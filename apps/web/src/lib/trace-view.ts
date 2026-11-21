import type { TraceDetail, TraceStep } from "@cda/shared";

export interface SearchRow {
  label: string;
  tool: string;
  refs: string[];
  durationMs: number;
}

export interface TraceSummary {
  searches: SearchRow[];
  filesOpened: string[];
  modelCalls: number;
  totalTokens: number;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const text = (v: unknown): string => (typeof v === "string" ? v : "");

/** Turns raw trace steps into what the panel shows: searches made, files opened, totals. */
export function summariseTrace(trace: TraceDetail): TraceSummary {
  const searches = trace.steps.filter(isSearch).map((s) => ({
    label: text(s.input.query) || text(s.input.name),
    tool: s.kind === "retrieval" ? "hybrid search" : s.name.replace("_", " "),
    refs: strings(s.output.refs),
    durationMs: s.durationMs,
  }));
  const filesOpened = trace.steps.filter((s) => s.kind === "tool" && s.name === "read_file").flatMap((s) => strings(s.output.refs));
  return {
    searches,
    filesOpened,
    modelCalls: trace.steps.filter((s) => s.kind === "model").length,
    totalTokens: trace.inputTokens + trace.outputTokens + trace.cacheReadTokens + trace.cacheWriteTokens,
  };
}

function isSearch(s: TraceStep): boolean {
  return s.kind === "retrieval" || (s.kind === "tool" && (s.name === "search_code" || s.name === "find_symbol"));
}

/** `lib/a.js:10-20` -> a code viewer target. */
export function parseRef(ref: string): { path: string; startLine: number; endLine: number } | null {
  const m = /^(.+):(\d+)-(\d+)$/.exec(ref);
  return m?.[1] ? { path: m[1], startLine: Number(m[2]), endLine: Number(m[3]) } : null;
}

export const formatMs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
export const formatCost = (usd: number | null) => (usd === null ? "unknown" : usd === 0 ? "$0 (fake model)" : `$${usd.toFixed(4)}`);
