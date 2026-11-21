import { readFile } from "node:fs/promises";
import { z } from "zod";

export const QuestionType = z.enum(["find", "explain", "multi_step", "unanswerable", "injection"]);
export type QuestionType = z.infer<typeof QuestionType>;

export const GoldenQuestion = z.object({
  id: z.string(),
  type: QuestionType,
  question: z.string(),
  expectedFiles: z.array(z.string()),
  keyFacts: z.array(z.string()).min(1),
  evidence: z.array(z.string()).default([]),
});
export type GoldenQuestion = z.infer<typeof GoldenQuestion>;

export const GoldenSet = z.object({
  repo: z.string().url(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  reviewed: z.boolean(),
  note: z.string().optional(),
  questions: z.array(GoldenQuestion).min(1),
});
export type GoldenSet = z.infer<typeof GoldenSet>;

export const GOLDEN_SET_PATH = new URL("./golden-set.json", import.meta.url);

export async function loadGoldenSet(path: URL = GOLDEN_SET_PATH): Promise<GoldenSet> {
  return GoldenSet.parse(JSON.parse(await readFile(path, "utf8")));
}
