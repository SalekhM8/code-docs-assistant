import { Hono } from "hono";
import { z } from "zod";
import { FeedbackRequest } from "@cda/shared";
import { parseJson, parseParam, type AppEnv } from "../lib/http";
import type { TraceService } from "../services/traces";

const Id = z.string().uuid();

export function traceRoutes(traces: TraceService) {
  return new Hono<AppEnv>()
    .get("/traces/:id", async (c) => c.json(await traces.get(parseParam(c.req.param("id"), Id, "Trace id"))))
    .put("/traces/:id/feedback", async (c) => {
      const id = parseParam(c.req.param("id"), Id, "Trace id");
      const body = await parseJson(c, FeedbackRequest);
      return c.json(await traces.setFeedback(id, body.rating));
    })
    .delete("/traces/:id/feedback", async (c) => c.json(await traces.setFeedback(parseParam(c.req.param("id"), Id, "Trace id"), null)));
}
