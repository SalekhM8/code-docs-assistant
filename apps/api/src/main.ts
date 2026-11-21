import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrate";
import { GitCloner } from "./indexing/clone";
import { GitHubApi } from "./indexing/github";
import { createLogger } from "./lib/logger";
import { createProviders } from "./providers";
import { createServices } from "./services/container";
import { failInterruptedJobs } from "./services/index-runner";
import { seedSampleRepo } from "./services/seed";

async function main(): Promise<void> {
  const config = loadConfig();
  const log = createLogger(config.LOG_LEVEL);
  const { db, close } = createDb(config.DATABASE_URL);
  await runMigrations(db);
  const interrupted = await failInterruptedJobs(db);
  log.info({ interrupted }, "migrations applied");

  const providers = createProviders(config);
  const services = await createServices({ config, db, log, providers, cloner: new GitCloner(), github: new GitHubApi(config.GITHUB_TOKEN) });
  const app = createApp({
    config,
    db,
    log,
    providerNames: { llm: config.LLM_PROVIDER, embeddings: config.EMBEDDING_PROVIDER },
    services,
  });
  const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => log.info({ port: info.port, llm: config.LLM_PROVIDER, embeddings: config.EMBEDDING_PROVIDER }, "api listening"));
  if (config.SEED_SAMPLE_REPO) void seedSampleRepo(services.repos, config, log);

  const shutdown = () => {
    log.info("shutting down");
    server.close();
    void close().then(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
