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
      return reciprocalRankFusion([{ source: "vector", chunks: vector }, { source: "keyword", chunks: keyword }], limit);
    },
  };
}

export function createHybridSearch(db: Db, embeddings: EmbeddingProvider): HybridSearch {
  return createRetrievers(db, embeddings).hybrid;
}
