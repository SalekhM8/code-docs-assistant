import type { LanguageInfo } from "../languages";
import type { CodeChunker } from "./code";
import { chunkByLines } from "./lines";
import { chunkMarkdown } from "./markdown";
import type { Chunk } from "./types";

export type { Chunk } from "./types";

/** Picks the chunker for a file: tree-sitter for code, headings for markdown, line windows otherwise. */
export async function chunkFile(content: string, lang: LanguageInfo, code: CodeChunker): Promise<Chunk[]> {
  if (lang.strategy === "code" && lang.grammar) return code.chunk(content, lang.grammar);
  if (lang.strategy === "markdown") return chunkMarkdown(content);
  return chunkByLines(content);
}

/** The text that is embedded. Path and symbol go first so "where is X defined" queries match the right chunk. */
export function embeddingText(filePath: string, chunk: Chunk): string {
  const header = chunk.symbol ? `path: ${filePath}\nsymbol: ${chunk.symbol}` : `path: ${filePath}`;
  return `${header}\n\n${chunk.content}`;
}
