import { describe, expect, it } from "vitest";
import { createLogger } from "../lib/logger";
import { createLangfuseExporter, toOtlp } from "./langfuse";

const trace = {
  id: "11111111-2222-3333-4444-555555555555", messageId: "m", conversationId: "c", mode: "agent" as const, model: "claude-sonnet-5-5",
  promptVersion: "answer.v1", outcome: "complete", inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0,
  costUsd: 0.001, durationMs: 1200, createdAt: new Date("2026-11-21T10:00:00Z"),
};
const step = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", traceId: trace.id, position: 0, kind: "tool" as const, name: "read_file",
  input: { path: "a.ts" }, output: { refs: ["a.ts:1-4"] }, inputTokens: 0, outputTokens: 0, durationMs: 30, startedAt: new Date("2026-11-21T09:59:59Z"),
};

describe("Langfuse export", () => {
  it("maps a trace to one root span and a child span per step", () => {
    const spans = toOtlp(trace, [step]).resourceSpans[0]?.scopeSpans[0]?.spans ?? [];
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({ traceId: "11111111222233334444555555555555", spanId: "1111111122223333", name: "answer.agent" });
    expect(spans[1]).toMatchObject({ parentSpanId: "1111111122223333", name: "read_file" });
    expect(JSON.stringify(spans)).not.toContain('"path":"a.ts"'); // tool inputs are not exported
  });

  it("is disabled without keys", () => {
    expect(createLangfuseExporter({ LANGFUSE_HOST: "https://x.test" }, undefined as never, createLogger("silent"))).toBeUndefined();
  });
});
