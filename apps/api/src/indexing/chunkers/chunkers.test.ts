import { beforeAll, describe, expect, it } from "vitest";
import { CodeChunker } from "./code";
import { chunkByLines, windowChunks } from "./lines";
import { chunkMarkdown } from "./markdown";
import { MAX_CHUNK_LINES } from "./types";

let code: CodeChunker;
beforeAll(async () => {
  code = await CodeChunker.create();
});

describe("CodeChunker", () => {
  it("makes one chunk per function and class, with leading doc comments", async () => {
    const src = ["import x from 'y';", "import z from 'w';", "", "/** Adds. */", "export function add(a, b) {", "  return a + b;", "}", "", "class Box {", "  open() {}", "}"].join("\n");
    const chunks = await code.chunk(src, "typescript");
    expect(chunks.map((c) => [c.kind, c.symbol, c.startLine, c.endLine])).toEqual([
      ["module", null, 1, 3],
      ["function", "add", 4, 7],
      ["class", "Box", 9, 11],
    ]);
  });

  it("splits a large class by method and names methods Class.method", async () => {
    const body = Array.from({ length: 40 }, (_, i) => `  m${i}() {\n    const a = ${i};\n    const b = a + 1;\n    return b;\n  }`).join("\n");
    const chunks = await code.chunk(`export class Big {\n${body}\n}\n`, "typescript");
    expect(chunks.length).toBeGreaterThanOrEqual(40);
    expect(chunks.filter((c) => c.kind === "method").map((c) => c.symbol)).toContain("Big.m7");
    expect(Math.max(...chunks.map((c) => c.endLine - c.startLine + 1))).toBeLessThanOrEqual(MAX_CHUNK_LINES);
  });

  it("handles Python classes and decorated functions", async () => {
    const src = "import os\nimport re\n\n@cache\ndef load(p):\n    return os.path.join(p)\n\nclass Store:\n    def get(self):\n        return 1\n";
    const chunks = await code.chunk(src, "python");
    expect(chunks.map((c) => c.symbol)).toEqual([null, "load", "Store"]);
    expect(chunks[1]?.startLine).toBe(4);
  });

  it("names CommonJS-style assigned functions", async () => {
    const chunks = await code.chunk("exports.parse = function (s) {\n  return s;\n};\n", "javascript");
    expect(chunks[0]?.symbol).toBe("exports.parse");
  });
});

describe("chunkMarkdown", () => {
  it("splits by heading and ignores headings inside code fences", () => {
    const md = "# Title\nintro\n\n## Install\nrun it\n```sh\n# comment, not a heading\n```\n## Use\ncall it\n";
    expect(chunkMarkdown(md).map((c) => [c.symbol, c.startLine, c.endLine])).toEqual([
      ["Title", 1, 3],
      ["Install", 4, 8],
      ["Use", 9, 11],
    ]);
  });
});

describe("line windows", () => {
  it("overlaps windows and covers the whole file", () => {
    const lines = Array.from({ length: 130 }, (_, i) => `line ${i + 1}`);
    const chunks = windowChunks(lines, 1, 130, { size: 60, overlap: 10 });
    expect(chunks.map((c) => [c.startLine, c.endLine])).toEqual([[1, 60], [51, 110], [101, 130]]);
  });

  it("drops empty windows", () => {
    expect(chunkByLines("\n\n\n")).toEqual([]);
  });
});
