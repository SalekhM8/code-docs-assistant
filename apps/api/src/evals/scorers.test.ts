import { describe, expect, it } from "vitest";
import { citationValidity, mean, percentile, rankedFiles, recallAtK, reciprocalRank } from "./scorers";

const refs = ["lib/help.js:1-20", "lib/command.js:5-9", "lib/help.js:40-60", "docs/a.md:1-3"];

describe("retrieval scorers", () => {
  it("computes recall over files in the top k chunks", () => {
    expect(recallAtK(refs, ["lib/command.js", "docs/a.md"], 2)).toBe(0.5);
    expect(recallAtK(refs, ["lib/command.js", "docs/a.md"], 4)).toBe(1);
    expect(recallAtK(refs, [], 4)).toBe(1);
  });

  it("computes the reciprocal rank of the first relevant chunk", () => {
    expect(reciprocalRank(refs, ["lib/command.js"])).toBe(0.5);
    expect(reciprocalRank(refs, ["missing.js"])).toBe(0);
  });

  it("dedupes files in rank order", () => {
    expect(rankedFiles(refs)).toEqual(["lib/help.js", "lib/command.js", "docs/a.md"]);
  });
});

describe("aggregate helpers", () => {
  it("scores citation validity and ignores answers without citations", () => {
    expect(citationValidity([{ path: "a", startLine: 1, endLine: 2, valid: true }, { path: "b", startLine: 1, endLine: 2, valid: false }])).toBe(0.5);
    expect(citationValidity([])).toBeNull();
    expect(mean([1, null, 0])).toBe(0.5);
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
  });
});
