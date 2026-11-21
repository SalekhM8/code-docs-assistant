import { describe, expect, it } from "vitest";
import type { TraceDetail } from "@cda/shared";
import { parseRef, summariseTrace } from "./trace-view";

const step = (kind: TraceDetail["steps"][number]["kind"], name: string, input: Record<string, unknown>, output: Record<string, unknown>) => ({
  position: 0, kind, name, input, output, inputTokens: 0, outputTokens: 0, durationMs: 5, startedAt: "",
});

const trace: TraceDetail = {
  id: "00000000-0000-4000-8000-000000000001", messageId: "00000000-0000-4000-8000-000000000002", mode: "agent", model: "m", promptVersion: "p",
  outcome: "complete", inputTokens: 100, outputTokens: 20, cacheReadTokens: 50, cacheWriteTokens: 0, costUsd: 0.01, durationMs: 900, createdAt: "", feedback: null,
  steps: [
    step("model", "step 1", {}, {}),
    step("tool", "search_code", { query: "parse args" }, { refs: ["lib/a.js:1-9"] }),
    step("tool", "read_file", { path: "lib/a.js" }, { refs: ["lib/a.js:1-80"] }),
    step("model", "step 2", {}, {}),
  ],
};

describe("summariseTrace", () => {
  it("lists searches, files opened and totals", () => {
    expect(summariseTrace(trace)).toEqual({
      searches: [{ label: "parse args", tool: "search code", refs: ["lib/a.js:1-9"], durationMs: 5 }],
      filesOpened: ["lib/a.js:1-80"],
      modelCalls: 2,
      totalTokens: 170,
    });
  });

  it("parses refs for the code viewer", () => {
    expect(parseRef("lib/a.js:10-20")).toEqual({ path: "lib/a.js", startLine: 10, endLine: 20 });
    expect(parseRef("nope")).toBeNull();
  });
});
