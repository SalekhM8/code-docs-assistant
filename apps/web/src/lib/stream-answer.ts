import type { StreamEvent } from "@cda/shared";
import { type AnswerRequest, ApiError, newRequestId, toApiError } from "./api";
import { API_URL } from "./env";
import { SseParser } from "./sse";

/**
 * POSTs a question and calls onEvent for each streamed event. Aborting `signal` (Stop or
 * Escape) closes the connection, which the api treats as stop and saves the partial answer.
 */
export async function streamAnswer(req: AnswerRequest, onEvent: (e: StreamEvent) => void, signal: AbortSignal): Promise<void> {
  const path = req.kind === "ask" ? `/conversations/${req.conversationId}/messages` : `/conversations/${req.conversationId}/regenerate`;
  const body = req.kind === "ask" ? { content: req.content, mode: req.mode } : { mode: req.mode };
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": newRequestId() },
    body: JSON.stringify(body),
    signal,
  }).catch((err: unknown) => {
    if (signal.aborted) throw err;
    throw new ApiError(0, "network", "Could not reach the api. Check that it is running, then try again.");
  });
  if (!res.ok) throw await toApiError(res);
  if (!res.body) throw new ApiError(0, "stream", "The answer stream did not open. Try again.");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const parser = new SseParser();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    parser.push(value).forEach(onEvent);
  }
}
