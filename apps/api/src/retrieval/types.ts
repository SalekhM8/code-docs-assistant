// A type alias (not an interface) so rows from db.execute<RetrievedChunk> satisfy Record<string, unknown>.
export type RetrievedChunk = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  symbol: string | null;
  content: string;
};

export type ScoredChunk = RetrievedChunk & {
  score: number;
  /** Which searches found it, for the trace panel and for evals. */
  sources: ("vector" | "keyword" | "symbol")[];
};
