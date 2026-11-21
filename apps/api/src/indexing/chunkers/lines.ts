import { hasContent, sliceLines, type Chunk, type ChunkKind } from "./types";

interface WindowOptions {
  size?: number;
  overlap?: number;
  symbol?: string | null;
  kind?: ChunkKind;
}

/**
 * Fixed line windows with overlap, for files without a parser and for oversized
 * definitions. Overlap keeps a statement that straddles a boundary findable from both sides.
 */
export function windowChunks(lines: string[], firstLine: number, lastLine: number, options: WindowOptions = {}): Chunk[] {
  const size = options.size ?? 60;
  const overlap = Math.min(options.overlap ?? 10, size - 1);
  const chunks: Chunk[] = [];
  for (let start = firstLine; start <= lastLine; start += size - overlap) {
    const end = Math.min(start + size - 1, lastLine);
    const content = sliceLines(lines, start, end);
    if (hasContent(content)) {
      chunks.push({ startLine: start, endLine: end, symbol: options.symbol ?? null, kind: options.kind ?? "window", content });
    }
    if (end === lastLine) break;
  }
  return chunks;
}

export function chunkByLines(content: string): Chunk[] {
  const lines = content.split("\n");
  return windowChunks(lines, 1, lines.length);
}
