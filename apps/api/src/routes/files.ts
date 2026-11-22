import { Hono } from "hono";
import { z } from "zod";
import { parseParam, type AppEnv } from "../lib/http";
import type { FileService } from "../services/files";

const Id = z.string().uuid();
// Control characters never appear in an indexed path, and Postgres rejects a NUL outright.
const FilePath = z.string().min(1).max(500).refine((p) => !/\p{Cc}/u.test(p));

export function fileRoutes(files: FileService) {
  return new Hono<AppEnv>()
    .get("/repos/:id/files", async (c) => c.json(await files.list(parseParam(c.req.param("id"), Id, "Repo id"))))
    .get("/repos/:id/file", async (c) =>
      c.json(await files.get(parseParam(c.req.param("id"), Id, "Repo id"), parseParam(c.req.query("path"), FilePath, "File path"))),
    );
}
