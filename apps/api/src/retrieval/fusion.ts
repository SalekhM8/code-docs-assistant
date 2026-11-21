import type { RetrievedChunk, ScoredChunk } from "./types";

export interface RankedList {
  source: ScoredChunk["sources"][number];
  chunks: RetrievedChunk[];
}

/** The standard RRF constant: damps the gap between rank 1 and rank 2 so one list cannot dominate. */
export const RRF_K = 60;

/**
 * Reciprocal rank fusion: score = sum over lists of 1 / (k + rank). Uses ranks only, so
 * cosine distances and ts_rank scores never need to be put on the same scale.
 */
export function reciprocalRankFusion(lists: RankedList[], limit: number, k = RRF_K): ScoredChunk[] {
  const merged = new Map<string, ScoredChunk>();
  for (const list of lists) {
    list.chunks.forEach((chunk, index) => {
      const existing = merged.get(chunk.id);
      const contribution = 1 / (k + index + 1);
      if (existing) {
        existing.score += contribution;
        if (!existing.sources.includes(list.source)) existing.sources.push(list.source);
      } else {
        merged.set(chunk.id, { ...chunk, score: contribution, sources: [list.source] });
      }
    });
  }
  return [...merged.values()].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
}
