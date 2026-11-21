export type ChunkKind = "function" | "class" | "method" | "type" | "module" | "section" | "window";

/** A contiguous, 1-based, inclusive line range of one file. */
export interface Chunk {
  startLine: number;
  endLine: number;
  symbol: string | null;
  kind: ChunkKind;
  content: string;
}

/** Above this many lines a class is split by member, and any chunk is split into windows. */
export const MAX_CHUNK_LINES = 150;

export function sliceLines(lines: string[], startLine: number, endLine: number): string {
  return lines.slice(startLine - 1, endLine).join("\n");
}

/** True when the text has something worth indexing: not just blank lines or closing braces. */
export function hasContent(text: string): boolean {
  return /[A-Za-z0-9]/.test(text);
}
