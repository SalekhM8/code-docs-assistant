import type { Config } from "../config";
import type { Db } from "../db/client";
import { CodeChunker } from "../indexing/chunkers/code";
import type { Cloner } from "../indexing/clone";
import type { GitHubClient } from "../indexing/github";
import type { Logger } from "../lib/logger";
import type { Providers } from "../providers";
import { IndexRunner } from "./index-runner";
import { RepoService } from "./repos";

export type ServiceConfig = Pick<Config, "MAX_REPO_SIZE_MB" | "MAX_FILE_COUNT" | "MAX_FILE_BYTES">;

export interface ServiceDeps {
  config: ServiceConfig;
  db: Db;
  log: Logger;
  providers: Providers;
  cloner: Cloner;
  github: GitHubClient;
}

export interface Services {
  runner: IndexRunner;
  repos: RepoService;
}

/** The one composition root. main.ts passes real clients; tests pass fakes. */
export async function createServices(deps: ServiceDeps): Promise<Services> {
  const runner = new IndexRunner({
    db: deps.db,
    embeddings: deps.providers.embeddings,
    llm: deps.providers.llm,
    cloner: deps.cloner,
    chunker: await CodeChunker.create(),
    log: deps.log,
    limits: {
      maxFileBytes: deps.config.MAX_FILE_BYTES,
      maxFileCount: deps.config.MAX_FILE_COUNT,
      maxTotalBytes: deps.config.MAX_REPO_SIZE_MB * 1024 * 1024,
    },
  });
  const repos = new RepoService({ db: deps.db, github: deps.github, runner, maxRepoSizeMb: deps.config.MAX_REPO_SIZE_MB });
  return { runner, repos };
}
