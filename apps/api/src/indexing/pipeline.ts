import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { JobProgress, JobStage } from "@cda/shared";
import type { Db } from "../db/client";
import { indexJobs, repos } from "../db/schema";
import { AppError } from "../lib/errors";
import type { Logger } from "../lib/logger";
import { sha256 } from "../lib/text";
import type { EmbeddingProvider } from "../providers/embeddings";
import type { LlmProvider } from "../providers/llm";
import { chunkFile, embeddingText } from "./chunkers";
import type { CodeChunker } from "./chunkers/code";
import type { Cloner } from "./clone";
import { embedWithCache } from "./embed";
import { generateOverview } from "./overview";
import {
  activateVersion, copyUnchangedFiles, createVersion, deleteVersion, fileHashes, getActiveVersion, insertFileWithChunks,
  type PreparedChunk,
} from "./store";
import { walkRepo, type SourceFile, type WalkLimits } from "./walk";

export interface IndexingDeps {
  db: Db;
  embeddings: EmbeddingProvider;
  llm: LlmProvider;
  cloner: Cloner;
  chunker: CodeChunker;
  log: Logger;
  limits: WalkLimits;
}

export interface IndexRequest {
  jobId: string;
  repoId: string;
  repoUrl: string;
  repoName: string;
  /** null means the head of the default branch. */
  commit: string | null;
}

const FILES_PER_BATCH = 25;

/** Runs one index or re-index job to completion. Never throws: failures are stored on the job row. */
export async function runIndexJob(deps: IndexingDeps, req: IndexRequest, signal: AbortSignal): Promise<void> {
  const job = jobWriter(deps.db, req.jobId);
  const log = deps.log.child({ jobId: req.jobId, repoId: req.repoId });
  const dir = await mkdtemp(path.join(tmpdir(), "cda-index-"));
  let building: string | null = null;
  try {
    await job.update({ status: "running", stage: "cloning", startedAt: new Date() });
    const commitSha = await deps.cloner.clone(req.repoUrl, dir, req.commit, signal);
    await job.update({ commitSha, stage: "scanning" });

    const active = await getActiveVersion(deps.db, req.repoId);
    if (active?.commitSha === commitSha && active.embeddingModel === deps.embeddings.model) {
      log.info({ commitSha }, "already indexed at this commit");
      await job.finish("ready", null);
      return;
    }

    const { files, skipped } = await walkRepo(dir, deps.limits);
    log.info({ files: files.length, skipped }, "scanned repo");
    if (files.length === 0) throw new AppError("invalid_request", "No indexable source files were found in this repo.");

    building = await createVersion(deps.db, req.repoId, commitSha, deps.embeddings.model);
    const previous = active?.embeddingModel === deps.embeddings.model ? await fileHashes(deps.db, active.id) : new Map<string, string>();
    const unchanged = files.filter((f) => previous.get(f.path) === f.contentHash);
    const changed = files.filter((f) => previous.get(f.path) !== f.contentHash);
    const reused = active ? await copyUnchangedFiles(deps.db, active.id, building, unchanged.map((f) => f.path)) : 0;

    const progress: JobProgress = { filesTotal: files.length, filesDone: reused, filesReused: reused, chunks: 0 };
    await job.update({ stage: "chunking", progress });
    await indexChangedFiles(deps, building, changed, progress, job, signal);

    await job.update({ stage: "activating" });
    await activateVersion(deps.db, req.repoId, building);
    building = null;
    log.info({ commitSha, reused, processed: changed.length, chunks: progress.chunks }, "index version activated");

    await job.update({ stage: "overview" });
    const overview = await generateOverview(deps.llm, req.repoName, files, log);
    await deps.db.update(repos).set({ overview: overview.overview, suggestedQuestions: overview.questions }).where(eq(repos.id, req.repoId));
    await job.finish("ready", null);
  } catch (err) {
    if (signal.aborted) {
      log.info("index job cancelled");
      return; // the repo was deleted; its job row is already gone
    }
    log.error({ err }, "index job failed");
    if (building) await deleteVersion(deps.db, building).catch(() => undefined);
    await job.finish("failed", userMessage(err));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function indexChangedFiles(
  deps: IndexingDeps,
  versionId: string,
  changed: SourceFile[],
  progress: JobProgress,
  job: JobWriter,
  signal: AbortSignal,
): Promise<void> {
  for (let i = 0; i < changed.length; i += FILES_PER_BATCH) {
    signal.throwIfAborted();
    const batch = changed.slice(i, i + FILES_PER_BATCH);
    const chunked = await Promise.all(batch.map(async (file) => ({ file, chunks: await chunkFile(file.content, file.lang, deps.chunker) })));
    const inputs = chunked.flatMap(({ file, chunks }) => chunks.map((c) => {
      const text = embeddingText(file.path, c);
      return { hash: sha256(text), text };
    }));
    await job.update({ stage: "embedding" });
    const { vectors } = await embedWithCache(deps.db, deps.embeddings, inputs, signal);
    let k = 0;
    for (const { file, chunks } of chunked) {
      const prepared: PreparedChunk[] = chunks.map((c) => {
        const hash = inputs[k++]?.hash ?? "";
        return { ...c, contentHash: hash, embedding: vectors.get(hash) ?? [] };
      });
      await insertFileWithChunks(deps.db, versionId, file, prepared, deps.embeddings.model);
      progress.chunks += prepared.length;
    }
    progress.filesDone += batch.length;
    await job.update({ progress });
  }
}

function userMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  return "Indexing failed unexpectedly. Retry; if it fails again, check the api logs for this job id.";
}

type JobPatch = Partial<{ status: "running" | "ready" | "failed"; stage: JobStage; progress: JobProgress; commitSha: string; startedAt: Date }>;

interface JobWriter {
  update(patch: JobPatch): Promise<void>;
  finish(status: "ready" | "failed", error: string | null): Promise<void>;
}

function jobWriter(db: Db, jobId: string): JobWriter {
  return {
    update: async (patch) => {
      await db.update(indexJobs).set(patch).where(eq(indexJobs.id, jobId));
    },
    finish: async (status, error) => {
      await db
        .update(indexJobs)
        .set({ status, error, stage: status === "ready" ? "done" : "failed", finishedAt: new Date() })
        .where(eq(indexJobs.id, jobId));
    },
  };
}
