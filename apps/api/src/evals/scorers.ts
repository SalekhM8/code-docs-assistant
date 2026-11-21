import type { Citation } from "@cda/shared";

/** `lib/command.js:10-20` -> `lib/command.js` */
export function fileOfRef(ref: string): string {
  return ref.replace(/:\d+(-\d+)?$/, "");
}

/** Distinct files in rank order. */
export function rankedFiles(refs: string[]): string[] {
  return [...new Set(refs.map(fileOfRef))];
}

/** Share of expected files found among the first k retrieved chunks. */
export function recallAtK(refs: string[], expected: string[], k: number): number {
  if (expected.length === 0) return 1;
  const top = new Set(refs.slice(0, k).map(fileOfRef));
  return expected.filter((f) => top.has(f)).length / expected.length;
}

/** 1 / rank of the first chunk from an expected file, 0 if none in the list. */
export function reciprocalRank(refs: string[], expected: string[]): number {
  const index = refs.findIndex((r) => expected.includes(fileOfRef(r)));
  return index < 0 ? 0 : 1 / (index + 1);
}

/** Share of citations that passed the checker. null when the answer cited nothing. */
export function citationValidity(citations: Citation[]): number | null {
  if (citations.length === 0) return null;
  return citations.filter((c) => c.valid).length / citations.length;
}

export function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? null;
}
