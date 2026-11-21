import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { HealthResponse } from "@cda/shared";
import type { Db } from "../db/client";
import type { AppEnv } from "../lib/http";

export function healthRoutes(deps: { db: Db; providers: HealthResponse["providers"] }) {
  return new Hono<AppEnv>().get("/health", async (c) => {
    const db = await deps.db
      .execute(sql`select 1`)
      .then(() => "ok" as const)
      .catch(() => "down" as const);
    const body: HealthResponse = { status: db === "ok" ? "ok" : "degraded", db, providers: deps.providers };
    return c.json(body, db === "ok" ? 200 : 503);
  });
}
