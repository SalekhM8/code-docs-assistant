import type { Db } from "../db/client";
import type { EmbeddingProvider } from "../providers/embeddings";
import { reciprocalRankFusion } from "./fusion";
import { keywordSearch } from "./keyword";
import type { ScoredChunk } from "./types";
import { vectorSearch } from "./vector";

export interface HybridSearch {
  (versionId: string, query: string, limit: number, signal?: AbortSignal): Promise<ScoredChunk[]>;
}

/** Each search fetches more candidates than needed, so fusion can promote chunks both agree on. */
const CANDIDATES = 30;

export function createHybridSearch(db: Db, embeddings: EmbeddingProvider): HybridSearch {
  return async (versionId, query, limit, signal) => {
    const [vector, keyword] = await Promise.all([
      embeddings.embed([query], "query", signal).then(([e]) => (e ? vectorSearch(db, versionId, e, CANDIDATES) : [])),
      keywordSearch(db, versionId, query, CANDIDATES),
    ]);
    return reciprocalRankFusion([{ source: "vector", chunks: vector }, { source: "keyword", chunks: keyword }], limit);
  };
}
