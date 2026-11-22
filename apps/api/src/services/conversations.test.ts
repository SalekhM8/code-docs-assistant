import { describe, expect, it } from "vitest";
import type { Message } from "@cda/shared";
import { answeredTurns } from "./conversations";

const m = (role: Message["role"], status: Message["status"], content: string): Message => ({
  id: content, role, content, status, citations: [], searched: [], traceId: null, feedback: null, createdAt: "2026-01-01T00:00:00.000Z",
});

describe("answeredTurns", () => {
  it("keeps answered and declined pairs, and drops a question whose answer was stopped or failed", () => {
    const all = [
      m("user", "complete", "q1"), m("assistant", "complete", "a1"),
      m("user", "complete", "q2"), m("assistant", "not_found", "a2"),
      m("user", "complete", "q3"), m("assistant", "stopped", "a3"),
      m("user", "complete", "q4"), m("assistant", "failed", "a4"),
      m("user", "complete", "q5"),
    ];
    expect(answeredTurns(all).map((x) => x.content)).toEqual(["q1", "a1", "q2", "a2"]);
  });

  it("always alternates, starting with a question", () => {
    const all = [m("user", "complete", "q1"), m("user", "complete", "q2"), m("assistant", "complete", "a2")];
    expect(answeredTurns(all).map((x) => x.role)).toEqual(["user", "assistant"]);
  });
});
