import type { JobStage, RepoSummary } from "@cda/shared";

const STAGE_LABEL: Record<JobStage, string> = {
  queued: "Waiting to start",
  cloning: "Cloning",
  scanning: "Scanning files",
  chunking: "Chunking code",
  embedding: "Embedding chunks",
  activating: "Switching to the new index",
  overview: "Writing the overview",
  done: "Ready",
  failed: "Failed",
};

export function stageLabel(stage: JobStage): string {
  return STAGE_LABEL[stage];
}

/** 0-100 while indexing; chunking and embedding move with files processed. */
export function progressPercent(repo: RepoSummary): number {
  const job = repo.latestJob;
  if (!job) return 0;
  const order: JobStage[] = ["queued", "cloning", "scanning", "chunking", "embedding", "activating", "overview", "done"];
  const p = job.progress;
  if ((job.stage === "chunking" || job.stage === "embedding") && p.filesTotal > 0) return Math.round(15 + (75 * p.filesDone) / p.filesTotal);
  return Math.round((Math.max(0, order.indexOf(job.stage)) / (order.length - 1)) * 100);
}

export const shortSha = (sha: string | null) => (sha ? sha.slice(0, 7) : "");
