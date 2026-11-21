import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Db } from "./db/client";
import type { Config } from "./config";
import { handleError, requestContext, type AppEnv } from "./lib/http";
import type { Logger } from "./lib/logger";
import { healthRoutes } from "./routes/health";

export interface AppDeps {
  config: Pick<Config, "CORS_ORIGIN">;
  db: Db;
  log: Logger;
  providerNames: { llm: string; embeddings: string };
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use("*", cors({ origin: deps.config.CORS_ORIGIN, exposeHeaders: ["x-request-id"] }));
  app.use("*", requestContext(deps.log));
  app.onError(handleError);
  app.notFound((c) => c.json({ error: { code: "not_found", message: "No such endpoint.", requestId: c.get("requestId") } }, 404));
  app.route("/", healthRoutes({ db: deps.db, providers: deps.providerNames }));
  return app;
}
