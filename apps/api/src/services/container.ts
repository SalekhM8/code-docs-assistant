import { runBaseline } from "../agent/baseline";
import { runAgent } from "../agent/loop";
import type { Config } from "../config";
import type { Db } from "../db/client";
import { CodeChunker } from "../indexing/chunkers/code";
import type { Cloner } from "../indexing/clone";
import type { GitHubClient } from "../indexing/github";
import type { Logger } from "../lib/logger";
import type { Providers } from "../providers";
import { createHybridSearch } from "../retrieval/hybrid";
import { AnswerService } from "./answer";
import { ConversationService } from "./conversations";
import { FileService } from "./files";
import { IndexRunner } from "./index-runner";
import { createLangfuseExporter } from "./langfuse";
import { RepoService } from "./repos";

export type ServiceConfig = Pick<
  Config,
  "MAX_REPO_SIZE_MB" | "MAX_FILE_COUNT" | "MAX_FILE_BYTES" | "ANSWER_MODE" | "MAX_AGENT_STEPS" | "MAX_TOKENS_PER_ANSWER"
> & Partial<Pick<Config, "LANGFUSE_PUBLIC_KEY" | "LANGFUSE_SECRET_KEY" | "LANGFUSE_HOST">>;

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
  conversations: ConversationService;
  answers: AnswerService;
  files: FileService;
}

/** The one composition root. main.ts passes real clients; tests pass fakes. */
export async function createServices(deps: ServiceDeps): Promise<Services> {
  const { db, log, providers, config } = deps;
  const runner = new IndexRunner({
    db,
    embeddings: providers.embeddings,
    llm: providers.llm,
    cloner: deps.cloner,
    chunker: await CodeChunker.create(),
    log,
    limits: {
      maxFileBytes: config.MAX_FILE_BYTES,
      maxFileCount: config.MAX_FILE_COUNT,
      maxTotalBytes: config.MAX_REPO_SIZE_MB * 1024 * 1024,
    },
  });
  const repos = new RepoService({ db, github: deps.github, runner, maxRepoSizeMb: config.MAX_REPO_SIZE_MB });
  const conversations = new ConversationService({ db, llm: providers.llm, log });
  const answers = new AnswerService({
    db,
    llm: providers.llm,
    search: createHybridSearch(db, providers.embeddings),
    repos,
    conversations,
    log,
    modes: { baseline: runBaseline, agent: runAgent },
    defaultMode: config.ANSWER_MODE,
    limits: { maxSteps: config.MAX_AGENT_STEPS, maxTokens: config.MAX_TOKENS_PER_ANSWER },
    onTrace: createLangfuseExporter({ LANGFUSE_HOST: "https://cloud.langfuse.com", ...config }, db, log),
  });
  return { runner, repos, conversations, answers, files: new FileService({ db, repos }) };
}
