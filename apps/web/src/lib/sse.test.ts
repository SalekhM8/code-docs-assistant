import { describe, expect, it } from "vitest";
import { SseParser } from "./sse";

describe("SseParser", () => {
  it("parses frames split across chunks and ignores unknown events", () => {
    const p = new SseParser();
    expect(p.push('event: text\ndata: {"type":"te')).toEqual([]);
    expect(p.push('xt","delta":"Hi"}\n\nevent: status\ndata: {"type":"status","state":"answering"}\n\n')).toEqual([
      { type: "text", delta: "Hi" },
      { type: "status", state: "answering" },
    ]);
    expect(p.push('data: {"type":"mystery"}\n\n')).toEqual([]);
  });
});
