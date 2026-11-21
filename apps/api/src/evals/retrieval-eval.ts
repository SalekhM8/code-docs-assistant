import { refOf } from "../agent/context";
import type { Retrievers } from "../retrieval/hybrid";
import type { GoldenQuestion } from "./golden";
import { mean, recallAtK, reciprocalRank } from "./scorers";

export const RETRIEVAL_K = [5, 10] as const;

export interface RetrievalRow {
  variant: keyof Retrievers;
  recallAt5: number | null;
  recallAt10: number | null;
  mrr: number | null;
  perQuestion: { id: string; recallAt10: number; rank: number }[];
}

/** Scores each search on its own and fused, on questions that have expected files. No model calls. */
export async function runRetrievalEval(retrievers: Retrievers, versionId: string, questions: GoldenQuestion[]): Promise<RetrievalRow[]> {
  const answerable = questions.filter((q) => q.expectedFiles.length > 0);
  const variants = Object.keys(retrievers) as (keyof Retrievers)[];
  const rows: RetrievalRow[] = [];
  for (const variant of variants) {
    const perQuestion = [];
    for (const q of answerable) {
      const refs = (await retrievers[variant](versionId, q.question, 10)).map(refOf);
      const rr = reciprocalRank(refs, q.expectedFiles);
      perQuestion.push({ id: q.id, recallAt10: recallAtK(refs, q.expectedFiles, 10), recallAt5: recallAtK(refs, q.expectedFiles, 5), rank: rr ? Math.round(1 / rr) : 0, rr });
    }
    rows.push({
      variant,
      recallAt5: mean(perQuestion.map((p) => p.recallAt5)),
      recallAt10: mean(perQuestion.map((p) => p.recallAt10)),
      mrr: mean(perQuestion.map((p) => p.rr)),
      perQuestion: perQuestion.map(({ id, recallAt10, rank }) => ({ id, recallAt10, rank })),
    });
  }
  return rows;
}
