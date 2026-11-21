import { Hono } from "hono";
import { z } from "zod";
import { CreateRepoRequest } from "@cda/shared";
import { parseJson, parseParam, type AppEnv } from "../lib/http";
import type { RepoService } from "../services/repos";

const RepoId = z.string().uuid();

export function repoRoutes(repos: RepoService) {
  return new Hono<AppEnv>()
    .get("/repos", async (c) => c.json(await repos.list()))
    .post("/repos", async (c) => {
      const body = await parseJson(c, CreateRepoRequest);
      return c.json(await repos.create(body.url), 202);
    })
    .get("/repos/:id", async (c) => c.json(await repos.get(parseParam(c.req.param("id"), RepoId, "Repo id"))))
    .post("/repos/:id/reindex", async (c) => c.json(await repos.reindex(parseParam(c.req.param("id"), RepoId, "Repo id")), 202))
    .delete("/repos/:id", async (c) => {
      await repos.delete(parseParam(c.req.param("id"), RepoId, "Repo id"));
      return c.body(null, 204);
    });
}
