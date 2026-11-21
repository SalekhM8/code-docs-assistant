import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { Config } from "./config";
import type { Db } from "./db/client";
import { handleError, requestContext, type AppEnv } from "./lib/http";
import type { Logger } from "./lib/logger";
import { healthRoutes } from "./routes/health";
import { repoRoutes } from "./routes/repos";
import { conversationRoutes } from "./routes/conversations";
import { fileRoutes } from "./routes/files";
import { traceRoutes } from "./routes/traces";
import { rateLimit } from "./lib/rate-limit";
import type { Services } from "./services/container";

export interface AppDeps {
  config: Pick<Config, "CORS_ORIGIN" | "RATE_LIMIT_PER_MINUTE">;
  db: Db;
  log: Logger;
  providerNames: { llm: string; embeddings: string };
  services: Services;
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use("*", cors({ origin: deps.config.CORS_ORIGIN, allowMethods: ["GET", "POST", "PUT", "DELETE"], exposeHeaders: ["x-request-id", "retry-after"] }));
  app.use("*", requestContext(deps.log));
  // Every request body here is a small JSON object; 64 KB leaves room for a long question.
  app.use("*", bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: { code: "invalid_request", message: "The request is too large. Shorten the question and try again.", requestId: c.get("requestId") } }, 413) }));
  app.onError(handleError);
  app.notFound((c) => c.json({ error: { code: "not_found", message: "No such endpoint.", requestId: c.get("requestId") } }, 404));
  app.route("/", healthRoutes({ db: deps.db, providers: deps.providerNames }));
  // One limiter shared by the two routes that cost money: adding a repo and asking a question.
  const limit = rateLimit(deps.config.RATE_LIMIT_PER_MINUTE);
  app.post("/repos", limit);
  app.route("/", repoRoutes(deps.services.repos));
  app.route("/", fileRoutes(deps.services.files));
  app.route("/", traceRoutes(deps.services.traces));
  app.route("/", conversationRoutes({ conversations: deps.services.conversations, answers: deps.services.answers, answerLimit: limit }));
  return app;
}
