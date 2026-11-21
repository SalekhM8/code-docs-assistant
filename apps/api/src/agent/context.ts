import type { LlmMessage } from "../providers/llm";
import { wrapData } from "../prompts/untrusted";
import type { RetrievedChunk } from "../retrieval/types";

/** Numbered lines let the model cite exact ranges instead of guessing them. */
export function numberLines(content: string, firstLine: number): string {
  return content
    .split("\n")
    .map((line, i) => `${firstLine + i}| ${line}`)
    .join("\n");
}

/** `path:start-end`, the form used in citations, trace steps and eval scoring. */
export function refOf(r: { path: string; startLine: number; endLine: number }): string {
  return `${r.path}:${r.startLine}-${r.endLine}`;
}

/** The header format is the one the model is told to cite: path:start-end. */
export function formatChunk(chunk: RetrievedChunk): string {
  const symbol = chunk.symbol ? ` (${chunk.symbol})` : "";
  return `### ${refOf(chunk)}${symbol}\n${numberLines(chunk.content, chunk.startLine)}`;
}

export function formatSearchResults(query: string, chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return `No code matched the search "${query}".`;
  return wrapData(`search: ${query}`, chunks.map(formatChunk).join("\n\n"));
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

/** Turns of history sent in full; anything older is represented by the rolling summary. */
export const RECENT_TURNS = 6;

/** Recent turns in full, older turns as one summary note at the start. */
export function historyMessages(turns: HistoryTurn[], summary: string | null): LlmMessage[] {
  const recent = turns.slice(-RECENT_TURNS);
  const out: LlmMessage[] = [];
  if (summary && turns.length > RECENT_TURNS) {
    out.push({ role: "user", text: `Summary of our earlier conversation:\n${summary}` });
    out.push({ role: "assistant", text: "Understood." });
  }
  for (const t of recent) {
    out.push(t.role === "user" ? { role: "user", text: t.content } : { role: "assistant", text: t.content });
  }
  // The API needs alternating roles starting with user; drop a leading assistant turn if the window cut one.
  while (out[0]?.role === "assistant") out.shift();
  return out;
}
