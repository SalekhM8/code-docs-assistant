import { describe, expect, it } from "vitest";
import type { StreamEvent } from "@cda/shared";
import { reduceLive, startLive } from "./live-answer";

const msg = { id: "00000000-0000-4000-8000-000000000001", role: "assistant" as const, content: "x", status: "complete" as const, citations: [], searched: [], traceId: null, feedback: null, createdAt: "" };

describe("reduceLive", () => {
  it("follows the stream: steps upsert by id, text accumulates, reset clears narration", () => {
    const events: StreamEvent[] = [
      { type: "status", state: "searching" },
      { type: "step", step: { id: "a", kind: "search", label: "parse", done: false } },
      { type: "text", delta: "Let me look." },
      { type: "reset" },
      { type: "step", step: { id: "a", kind: "search", label: "parse", detail: "8 results", done: true } },
      { type: "status", state: "answering" },
      { type: "text", delta: "It " },
      { type: "text", delta: "parses." },
    ];
    const live = events.reduce(reduceLive, startLive("q", "agent"));
    expect(live.orb).toBe("answering");
    expect(live.steps).toEqual([{ id: "a", kind: "search", label: "parse", detail: "8 results", done: true }]);
    expect(live.text).toBe("It parses.");
  });

  it("ends in done, or failed on an error or a failed message", () => {
    expect(reduceLive(startLive("q", "agent"), { type: "done", message: msg }).orb).toBe("done");
    expect(reduceLive(startLive("q", "agent"), { type: "done", message: { ...msg, status: "failed" } }).orb).toBe("failed");
    expect(reduceLive(startLive("q", "agent"), { type: "error", code: "x", message: "boom" })).toMatchObject({ orb: "failed", error: "boom" });
  });
});
