import type { Config } from "../config";
import type { Logger } from "../lib/logger";
import type { RepoService } from "./repos";

/** Indexes the pinned sample repo on first start, so a reviewer can ask questions straight away. */
export async function seedSampleRepo(repos: RepoService, config: Pick<Config, "SAMPLE_REPO_URL" | "SAMPLE_REPO_COMMIT">, log: Logger): Promise<void> {
  try {
    const existing = (await repos.list()).find((r) => r.url === config.SAMPLE_REPO_URL.replace(/\.git$/, ""));
    if (existing && existing.status !== "failed") return;
    const repo = await repos.create(config.SAMPLE_REPO_URL, config.SAMPLE_REPO_COMMIT);
    log.info({ repoId: repo.id, commit: config.SAMPLE_REPO_COMMIT }, "seeding sample repo");
  } catch (err) {
    log.warn({ err }, "could not seed the sample repo; add it from the UI instead");
  }
}
