import type { Db } from "../db/client";
import type { EmbeddingProvider } from "../providers/embeddings";
import { reciprocalRankFusion } from "./fusion";
import { keywordSearch } from "./keyword";
import type { RetrievedChunk, ScoredChunk } from "./types";
import { vectorSearch } from "./vector";

export type HybridSearch = (versionId: string, query: string, limit: number, signal?: AbortSignal) => Promise<ScoredChunk[]>;
type RawSearch = (versionId: string, query: string, limit: number, signal?: AbortSignal) => Promise<RetrievedChunk[]>;

export interface Retrievers {
  vector: HybridSearch;
  keyword: HybridSearch;
  hybrid: HybridSearch;
}

/** Each search fetches more candidates than needed, so fusion can promote chunks both agree on. */
const CANDIDATES = 30;

/**
 * Keyword matches count for less than vector matches. Measured on the golden set with
 * voyage-code-4: equal weights gave Recall@10 86.7% and MRR 0.655, below vector search
 * alone (94.4%, 0.950), because keyword search is weak on natural-language questions
 * (44.4%) and its results pushed good vector results out of the top ten. At 0.3, hybrid
 * reaches 91.7% and 0.791. Below about 0.67 a keyword-only hit can no longer outrank a
 * vector hit, so keyword search acts as a tie-breaker; exact names are covered by the
 * agent's find_symbol tool.
 */
export const KEYWORD_WEIGHT = 0.3;

/** All three are exposed so evals can compare each search alone against the fused result. */
export function createRetrievers(db: Db, embeddings: EmbeddingProvider): Retrievers {
  const vectorOnly: RawSearch = async (versionId, query, limit, signal) => {
    const [embedding] = await embeddings.embed([query], "query", signal);
    return embedding ? vectorSearch(db, versionId, embedding, limit) : [];
  };
  const keywordOnly: RawSearch = (versionId, query, limit) => keywordSearch(db, versionId, query, limit);
  const single = (source: ScoredChunk["sources"][number], search: RawSearch): HybridSearch => async (versionId, query, limit, signal) =>
    reciprocalRankFusion([{ source, chunks: await search(versionId, query, limit, signal) }], limit);

  return {
    vector: single("vector", vectorOnly),
    keyword: single("keyword", keywordOnly),
    hybrid: async (versionId, query, limit, signal) => {
      const [vector, keyword] = await Promise.all([vectorOnly(versionId, query, CANDIDATES, signal), keywordOnly(versionId, query, CANDIDATES)]);
      return reciprocalRankFusion([{ source: "vector", chunks: vector }, { source: "keyword", chunks: keyword, weight: KEYWORD_WEIGHT }], limit);
    },
  };
}

export function createHybridSearch(db: Db, embeddings: EmbeddingProvider): HybridSearch {
  return createRetrievers(db, embeddings).hybrid;
}
