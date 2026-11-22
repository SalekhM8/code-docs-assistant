import { z } from "zod";

export const JobProgress = z.object({
  filesTotal: z.number().int(),
  filesDone: z.number().int(),
  filesReused: z.number().int(),
  chunks: z.number().int(),
});
export type JobProgress = z.infer<typeof JobProgress>;

export const JOB_STAGES = ["queued", "cloning", "scanning", "chunking", "embedding", "activating", "overview", "done", "failed"] as const;
export const JobStage = z.enum(JOB_STAGES);
export type JobStage = z.infer<typeof JobStage>;

export const JobSummary = z.object({
  id: z.string().uuid(),
  kind: z.enum(["index", "reindex"]),
  status: z.enum(["queued", "running", "ready", "failed"]),
  stage: JobStage,
  progress: JobProgress,
  commitSha: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type JobSummary = z.infer<typeof JobSummary>;

/** `indexing` while a job runs; `ready` when a version is live (even if a later re-index failed); else `failed`. */
export const RepoStatus = z.enum(["indexing", "ready", "failed"]);
export type RepoStatus = z.infer<typeof RepoStatus>;

export const RepoSummary = z.object({
  id: z.string().uuid(),
  url: z.string(),
  owner: z.string(),
  name: z.string(),
  status: RepoStatus,
  commitSha: z.string().nullable(),
  fileCount: z.number().int(),
  chunkCount: z.number().int(),
  latestJob: JobSummary.nullable(),
  createdAt: z.string(),
});
export type RepoSummary = z.infer<typeof RepoSummary>;

export const RepoDetail = RepoSummary.extend({
  overview: z.string().nullable(),
  suggestedQuestions: z.array(z.string()),
});
export type RepoDetail = z.infer<typeof RepoDetail>;

export const CreateRepoRequest = z.object({ url: z.string().trim().min(1, "Paste a GitHub repo URL first.").max(300, "That URL is too long to be a GitHub repo.") });
export type CreateRepoRequest = z.infer<typeof CreateRepoRequest>;

export const RepoList = z.array(RepoSummary);
