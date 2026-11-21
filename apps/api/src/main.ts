import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrate";
import { createLogger } from "./lib/logger";

async function main(): Promise<void> {
  const config = loadConfig();
  const log = createLogger(config.LOG_LEVEL);
  const { db, close } = createDb(config.DATABASE_URL);
  await runMigrations(db);
  log.info("migrations applied");

  const app = createApp({
    config,
    db,
    log,
    providerNames: { llm: config.LLM_PROVIDER, embeddings: config.EMBEDDING_PROVIDER },
  });
  const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => log.info({ port: info.port }, "api listening"));

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
