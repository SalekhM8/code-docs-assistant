/**
 * `pnpm eval` runs the golden set against the sample repo and saves docs/eval-results.md.
 *   --retrieval-only   score retrieval only (no model calls); what CI runs
 *   --modes=baseline   limit answer modes (default: baseline,agent)
 *   --limit=10         use the first N questions
 *   --min-recall=0.6   exit 1 if hybrid Recall@10 is below this (CI floor)
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { AnswerMode } from "@cda/shared";
import { loadConfig } from "../config";
import { createDb } from "../db/client";
import { runMigrations } from "../db/migrate";
import { GitCloner } from "../indexing/clone";
import { GitHubApi } from "../indexing/github";
import { createLogger } from "../lib/logger";
import { createProviders } from "../providers";
import { createRetrievers } from "../retrieval/hybrid";
import { createServices, type Services } from "../services/container";
import { evaluateAnswer, type AnswerResult } from "./answer-eval";
import { loadGoldenSet, type GoldenQuestion, type GoldenSet } from "./golden";
import { renderReport, retrievalTable } from "./report";
import { runRetrievalEval } from "./retrieval-eval";

const RESULTS_PATH = new URL("../../../../docs/eval-results.md", import.meta.url);
const CONCURRENCY = 3;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { "retrieval-only": { type: "boolean" }, modes: { type: "string" }, limit: { type: "string" }, "min-recall": { type: "string" } },
  });
  const config = loadConfig();
  const log = createLogger("warn");
  const { db, close } = createDb(config.DATABASE_URL);
  await runMigrations(db);
  const providers = createProviders(config);
  const services = await createServices({ config, db, log, providers, cloner: new GitCloner(), github: new GitHubApi(config.GITHUB_TOKEN) });

  const golden = await loadGoldenSet();
  const questions = golden.questions.slice(0, values.limit ? Number(values.limit) : undefined);
  console.log(`Ensuring ${golden.repo} is indexed at ${golden.commit.slice(0, 12)}...`);
  const { repoId, versionId } = await ensureIndexed(services, golden);

  console.log(`Retrieval eval on ${questions.length} questions (embeddings: ${providers.embeddings.model})`);
  const retrieval = await runRetrievalEval(createRetrievers(db, providers.embeddings), versionId, questions);
  console.log(`\n${retrievalTable(retrieval)}\n`);

  let answers: AnswerResult[] | null = null;
  let skipped: string | null = null;
  if (values["retrieval-only"]) skipped = "run with --retrieval-only";
  else if (providers.llm.name === "fake") skipped = "no ANTHROPIC_API_KEY (LLM_PROVIDER=fake); answer quality needs a real model";
  else {
    const modes = (values.modes ?? "baseline,agent").split(",").map((m) => AnswerMode.parse(m.trim()));
    answers = await runAnswers({ db, services, judgeLlm: providers.llm, repoId, versionId }, questions, modes);
  }
  if (skipped) console.log(`Answer eval skipped: ${skipped}.`);

  const report = renderReport(
    { date: new Date().toISOString().slice(0, 10), commit: golden.commit, questions: questions.length, reviewed: golden.reviewed, embeddingModel: providers.embeddings.model, answerModel: providers.llm.modelFor("answer"), skippedAnswers: skipped },
    retrieval,
    answers,
  );
  if (answers) console.log(report.slice(report.indexOf("## Answers")).split("### Per question")[0]);
  await writeFile(RESULTS_PATH, report);
  console.log(`Saved ${RESULTS_PATH.pathname}`);
  await close();

  const floor = values["min-recall"] ? Number(values["min-recall"]) : null;
  const hybrid = retrieval.find((r) => r.variant === "hybrid")?.recallAt10 ?? 0;
  if (floor !== null && hybrid < floor) {
    console.error(`Hybrid Recall@10 ${hybrid.toFixed(3)} is below the floor ${floor}.`);
    process.exit(1);
  }
}

/** Indexes the sample repo at the golden set's commit, re-indexing only if it has moved. */
async function ensureIndexed(services: Services, golden: GoldenSet): Promise<{ repoId: string; versionId: string }> {
  const existing = (await services.repos.list()).find((r) => r.url === golden.repo);
  if (!existing) await services.repos.create(golden.repo, golden.commit);
  else if (existing.commitSha !== golden.commit && existing.status !== "indexing") await services.repos.reindex(existing.id, golden.commit);
  await services.runner.idle();
  const repo = await waitWhileIndexing(services, golden.repo);
  if (!repo || repo.commitSha !== golden.commit) throw new Error(`Could not index ${golden.repo} at ${golden.commit}: ${repo?.latestJob?.error ?? "unknown error"}`);
  const ready = await services.repos.requireReady(repo.id);
  return { repoId: repo.id, versionId: ready.versionId };
}

/** Another process (the dev server seeding on start) may be indexing the same repo; wait for it. */
async function waitWhileIndexing(services: Services, url: string, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const repo = (await services.repos.list()).find((r) => r.url === url);
    if (repo?.status !== "indexing" || Date.now() > deadline) return repo;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function runAnswers(deps: Parameters<typeof evaluateAnswer>[0], questions: GoldenQuestion[], modes: AnswerMode[]): Promise<AnswerResult[]> {
  const jobs = modes.flatMap((mode) => questions.map((q) => ({ q, mode })));
  const results: AnswerResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (!job) return;
      const result = await evaluateAnswer(deps, job.q, job.mode);
      results.push(result);
      console.log(`  ${job.mode.padEnd(8)} ${job.q.id.padEnd(16)} ${result.status.padEnd(9)} recall ${result.recall.toFixed(2)} correct ${result.judge?.correctness.toFixed(2) ?? "-"}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results.sort((a, b) => a.mode.localeCompare(b.mode) || a.id.localeCompare(b.id));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
