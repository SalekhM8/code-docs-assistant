import { describe, expect, it } from "vitest";
import { retrievalQuery } from "./baseline";
import { parseCitations } from "./citations";
import { historyMessages, numberLines } from "./context";
import { Evidence } from "./evidence";

describe("parseCitations", () => {
  it("reads ranges and single lines, once each", () => {
    expect(parseCitations("See [lib/a.js:10-20] and [b.ts:5], again [lib/a.js:10-20]. Not [a link](x) or [x: 1-2].")).toEqual([
      { path: "lib/a.js", startLine: 10, endLine: 20 },
      { path: "b.ts", startLine: 5, endLine: 5 },
    ]);
  });
});

describe("Evidence", () => {
  it("covers a citation that overlaps a retrieved range of the same file", () => {
    const e = new Evidence();
    e.add({ path: "a.ts", startLine: 10, endLine: 20 });
    expect(e.covers({ path: "a.ts", startLine: 18, endLine: 25 })).toBe(true);
    expect(e.covers({ path: "a.ts", startLine: 21, endLine: 25 })).toBe(false);
    expect(e.covers({ path: "b.ts", startLine: 10, endLine: 20 })).toBe(false);
  });
});

describe("context helpers", () => {
  it("numbers lines from the chunk's first line", () => {
    expect(numberLines("a\nb", 41)).toBe("41| a\n42| b");
  });

  it("keeps recent turns in full and prefixes the summary when older turns were folded", () => {
    const turns = Array.from({ length: 8 }, (_, i) => ({ role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant", content: `t${i}` }));
    const msgs = historyMessages(turns, "earlier stuff");
    expect(msgs[0]).toEqual({ role: "user", text: "Summary of our earlier conversation:\nearlier stuff" });
    expect(msgs.slice(2).map((m) => m.role === "tool_results" ? "" : m.text)).toEqual(["t2", "t3", "t4", "t5", "t6", "t7"]);
  });

  it("adds the previous question to short follow-ups for retrieval", () => {
    const history = [{ role: "user" as const, text: "How does parse work?" }, { role: "assistant" as const, text: "..." }];
    expect(retrievalQuery("and errors?", history)).toBe("How does parse work?\nand errors?");
    expect(retrievalQuery("Explain how the help text is formatted for subcommands in detail", history)).toBe("Explain how the help text is formatted for subcommands in detail");
  });
});

describe("runBaseline with no search results", () => {
  it("does not call the model and is stored as not found", async () => {
    const { FakeLlm } = await import("../providers/fake-llm");
    const { TraceRecorder } = await import("../services/trace");
    const { runBaseline } = await import("./baseline");
    const { finalizeAnswer, NO_EVIDENCE_TEXT } = await import("./finalize");
    const llm = new FakeLlm();
    const ctx = {
      db: undefined as never, llm, search: async () => [], versionId: "v", question: "Where is X?", history: [], system: [],
      evidence: new Evidence(), trace: new TraceRecorder(), signal: new AbortController().signal, limits: { maxSteps: 6, maxTokens: 1000 },
      onState: () => undefined, onStep: () => undefined, onText: () => undefined,
    };
    const result = await runBaseline(ctx);
    expect(llm.turnRequests).toHaveLength(0);
    expect(await finalizeAnswer(ctx, result)).toEqual({ status: "not_found", content: NO_EVIDENCE_TEXT, citations: [] });
  });
});
