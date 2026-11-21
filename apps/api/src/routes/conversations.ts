import { Hono, type Context, type MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { AskRequest, RegenerateRequest, type StreamEvent } from "@cda/shared";
import { AppError } from "../lib/errors";
import { parseJson, parseParam, type AppEnv } from "../lib/http";
import type { AnswerService, Emit } from "../services/answer";
import type { ConversationService } from "../services/conversations";

const Id = z.string().uuid();

interface Deps {
  conversations: ConversationService;
  answers: AnswerService;
  answerLimit: MiddlewareHandler<AppEnv>;
}

export function conversationRoutes({ conversations, answers, answerLimit }: Deps) {
  return new Hono<AppEnv>()
    .get("/repos/:id/conversations", async (c) => c.json(await conversations.list(parseParam(c.req.param("id"), Id, "Repo id"))))
    .post("/repos/:id/conversations", async (c) => c.json(await conversations.create(parseParam(c.req.param("id"), Id, "Repo id")), 201))
    .get("/conversations/:id", async (c) => c.json(await conversations.get(parseParam(c.req.param("id"), Id, "Conversation id"))))
    .delete("/conversations/:id", async (c) => {
      await conversations.delete(parseParam(c.req.param("id"), Id, "Conversation id"));
      return c.body(null, 204);
    })
    .post("/conversations/:id/messages", answerLimit, async (c) => {
      const id = parseParam(c.req.param("id"), Id, "Conversation id");
      const body = await parseJson(c, AskRequest);
      await answers.ensureReady(id);
      return stream(c, (emit, signal) => answers.ask(id, body.content, body.mode, emit, signal));
    })
    .post("/conversations/:id/regenerate", answerLimit, async (c) => {
      const id = parseParam(c.req.param("id"), Id, "Conversation id");
      const body = await parseJson(c, RegenerateRequest);
      await answers.ensureReady(id);
      return stream(c, (emit, signal) => answers.regenerate(id, body.mode, emit, signal));
    });
}

/**
 * Opens an SSE stream. When the client disconnects (the Stop button aborts its fetch),
 * the abort reaches the model call through `signal`, and the partial answer is saved as stopped.
 */
function stream(c: Context<AppEnv>, run: (emit: Emit, signal: AbortSignal) => Promise<void>): Response {
  const log = c.get("log");
  return streamSSE(c, async (sse) => {
    const controller = new AbortController();
    sse.onAbort(() => controller.abort(new Error("client disconnected")));
    let writes = Promise.resolve();
    const emit: Emit = (event: StreamEvent) => {
      if (controller.signal.aborted) return;
      writes = writes.then(() => sse.writeSSE({ event: event.type, data: JSON.stringify(event) })).catch(() => undefined);
    };
    try {
      await run(emit, controller.signal);
    } catch (err) {
      log.error({ err }, "answer stream failed");
      const message = err instanceof AppError ? err.message : "Something went wrong while answering. Try again.";
      emit({ type: "error", code: err instanceof AppError ? err.code : "internal", message });
    }
    await writes;
  });
}
