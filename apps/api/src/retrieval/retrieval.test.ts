import { describe, expect, it } from "vitest";
import { reciprocalRankFusion, RRF_K } from "./fusion";
import { buildTsQuery } from "./keyword";
import type { RetrievedChunk } from "./types";

const chunk = (id: string): RetrievedChunk => ({ id, path: `${id}.ts`, startLine: 1, endLine: 2, symbol: null, content: "" });

describe("reciprocalRankFusion", () => {
  it("ranks a chunk found by both searches above one found by a single search", () => {
    const fused = reciprocalRankFusion(
      [
        { source: "vector", chunks: [chunk("a"), chunk("b"), chunk("c")] },
        { source: "keyword", chunks: [chunk("c"), chunk("d")] },
      ],
      10,
    );
    expect(fused.map((c) => c.id)).toEqual(["c", "a", "b", "d"]);
    expect(fused[0]?.sources).toEqual(["vector", "keyword"]);
    expect(fused[0]?.score).toBeCloseTo(1 / (RRF_K + 3) + 1 / (RRF_K + 1));
  });

  it("lets a down-weighted list reorder the other list without outranking it", () => {
    const vector = { source: "vector" as const, chunks: [chunk("v1"), chunk("v2"), chunk("both")] };
    const keyword = { source: "keyword" as const, chunks: [chunk("k1"), chunk("both")], weight: 0.3 };
    expect(reciprocalRankFusion([vector, keyword], 4).map((c) => c.id)).toEqual(["both", "v1", "v2", "k1"]);
  });

  it("respects the limit and handles empty lists", () => {
    expect(reciprocalRankFusion([{ source: "vector", chunks: [chunk("a"), chunk("b")] }, { source: "keyword", chunks: [] }], 1)).toHaveLength(1);
    expect(reciprocalRankFusion([], 5)).toEqual([]);
  });
});

describe("buildTsQuery", () => {
  it("ORs identifier words and drops stopwords and punctuation", () => {
    expect(buildTsQuery("How does parseOptions handle --help?")).toBe("parse | options | parseoptions | handle | help");
  });

  it("returns null when nothing searchable is left", () => {
    expect(buildTsQuery("how does it work?")).toBeNull();
  });
});
