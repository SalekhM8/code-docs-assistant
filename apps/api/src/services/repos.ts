import { desc, eq } from "drizzle-orm";
import type { JobSummary, RepoDetail, RepoStatus, RepoSummary } from "@cda/shared";
import type { Db } from "../db/client";
import { indexJobs, indexVersions, repos } from "../db/schema";
import { AppError, notFound } from "../lib/errors";
import { assertWithinLimits, parseGitHubUrl, type GitHubClient } from "../indexing/github";
import type { IndexRunner } from "./index-runner";

interface RepoServiceDeps {
  db: Db;
  github: GitHubClient;
  runner: IndexRunner;
  maxRepoSizeMb: number;
}

type JobRow = typeof indexJobs.$inferSelect;
type RepoRow = typeof repos.$inferSelect;

export class RepoService {
  constructor(private readonly deps: RepoServiceDeps) {}

  async list(): Promise<RepoSummary[]> {
    const rows = await this.baseQuery().orderBy(desc(repos.createdAt));
    const jobs = await this.latestJobs();
    return rows.map((r) => toSummary(r.repo, r.version, jobs.get(r.repo.id) ?? null));
  }

  async get(id: string): Promise<RepoDetail> {
    const [row] = await this.baseQuery().where(eq(repos.id, id));
    if (!row) throw notFound("That repo");
    const [job] = await this.deps.db.select().from(indexJobs).where(eq(indexJobs.repoId, id)).orderBy(desc(indexJobs.createdAt)).limit(1);
    return {
      ...toSummary(row.repo, row.version, job ?? null),
      overview: row.repo.overview,
      suggestedQuestions: row.repo.suggestedQuestions,
    };
  }

  /**
   * Validates the URL and the repo's size on GitHub, then starts indexing in the background.
   * Adding a repo that already exists returns it, and retries it if its last attempt failed.
   */
  async create(rawUrl: string, commit: string | null = null): Promise<RepoDetail> {
    const ref = parseGitHubUrl(rawUrl);
    const existing = await this.findByUrl(ref.url);
    if (existing) {
      const current = await this.get(existing.id);
      return current.status === "failed" ? this.reindex(existing.id, commit) : current;
    }
    assertWithinLimits(await this.deps.github.getRepo(ref), this.deps.maxRepoSizeMb, ref);
    const [repo] = await this.deps.db
      .insert(repos)
      .values({ url: ref.url, owner: ref.owner, name: ref.name })
      .onConflictDoNothing()
      .returning();
    if (!repo) return this.get((await this.findByUrl(ref.url))?.id ?? "");
    await this.startJob(repo, "index", commit);
    return this.get(repo.id);
  }

  /** Re-index (fetch latest, process only changed files) or retry after a failure. */
  async reindex(id: string, commit: string | null = null): Promise<RepoDetail> {
    const [repo] = await this.deps.db.select().from(repos).where(eq(repos.id, id));
    if (!repo) throw notFound("That repo");
    if (this.deps.runner.isRunning(id)) throw new AppError("repo_busy", "This repo is already being indexed. Wait for it to finish.");
    await this.startJob(repo, repo.activeVersionId ? "reindex" : "index", commit);
    return this.get(id);
  }

  /** Deletes the repo and, by cascade, its versions, files, chunks, jobs, conversations and traces. */
  async delete(id: string): Promise<void> {
    this.deps.runner.cancel(id);
    const deleted = await this.deps.db.delete(repos).where(eq(repos.id, id)).returning({ id: repos.id });
    if (deleted.length === 0) throw notFound("That repo");
  }

  async requireReady(id: string): Promise<{ repo: RepoRow; versionId: string; commitSha: string | null }> {
    const [repo] = await this.deps.db.select().from(repos).where(eq(repos.id, id));
    if (!repo) throw notFound("That repo");
    if (!repo.activeVersionId) throw new AppError("repo_not_ready", "This repo has not finished indexing yet. Wait for it to be ready, then ask again.");
    const [version] = await this.deps.db.select({ commitSha: indexVersions.commitSha }).from(indexVersions).where(eq(indexVersions.id, repo.activeVersionId));
    return { repo, versionId: repo.activeVersionId, commitSha: version?.commitSha ?? null };
  }

  private async startJob(repo: RepoRow, kind: "index" | "reindex", commit: string | null): Promise<void> {
    const [job] = await this.deps.db.insert(indexJobs).values({ repoId: repo.id, kind, requestedCommit: commit }).returning({ id: indexJobs.id });
    if (!job) throw new Error("insert into index_jobs returned no row");
    this.deps.runner.start({ jobId: job.id, repoId: repo.id, repoUrl: repo.url, repoName: `${repo.owner}/${repo.name}`, commit });
  }

  private async findByUrl(url: string) {
    const [row] = await this.deps.db.select({ id: repos.id }).from(repos).where(eq(repos.url, url));
    return row;
  }

  private baseQuery() {
    return this.deps.db
      .select({ repo: repos, version: indexVersions })
      .from(repos)
      .leftJoin(indexVersions, eq(indexVersions.id, repos.activeVersionId))
      .$dynamic();
  }

  private async latestJobs(): Promise<Map<string, JobRow>> {
    const jobs = await this.deps.db
      .selectDistinctOn([indexJobs.repoId])
      .from(indexJobs)
      .orderBy(indexJobs.repoId, desc(indexJobs.createdAt));
    return new Map(jobs.map((j) => [j.repoId, j]));
  }
}

function toSummary(repo: RepoRow, version: typeof indexVersions.$inferSelect | null, job: JobRow | null): RepoSummary {
  return {
    id: repo.id,
    url: repo.url,
    owner: repo.owner,
    name: repo.name,
    status: statusOf(version !== null, job),
    commitSha: version?.commitSha ?? null,
    fileCount: version?.fileCount ?? 0,
    chunkCount: version?.chunkCount ?? 0,
    latestJob: job ? toJobSummary(job) : null,
    createdAt: repo.createdAt.toISOString(),
  };
}

function statusOf(hasVersion: boolean, job: JobRow | null): RepoStatus {
  if (job && (job.status === "queued" || job.status === "running")) return "indexing";
  return hasVersion ? "ready" : "failed";
}

export function toJobSummary(job: JobRow): JobSummary {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    commitSha: job.commitSha,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}
