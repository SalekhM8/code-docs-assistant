import { and, eq, inArray } from "drizzle-orm";
import { CITATION_SOURCE, type Citation } from "@cda/shared";
import type { Db } from "../db/client";
import { files } from "../db/schema";
import type { Evidence, LineRange } from "./evidence";

const citationPattern = () => new RegExp(CITATION_SOURCE, "g");

export function parseCitations(text: string): LineRange[] {
  const seen = new Set<string>();
  const out: LineRange[] = [];
  for (const m of text.matchAll(citationPattern())) {
    const path = m[1] ?? "";
    const startLine = Number(m[2]);
    const endLine = m[3] ? Number(m[3]) : startLine;
    const key = `${path}:${startLine}-${endLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ path, startLine, endLine });
  }
  return out;
}

/**
 * Models shorten long paths when they repeat them (`Gson.java:10-20` for
 * `gson/src/main/java/com/google/gson/Gson.java`). When a cited path is not one the run
 * saw but exactly one seen path ends with it, the citation is rewritten to the full path.
 * An ambiguous short path is left alone and fails the check.
 */
export function expandShortPaths(text: string, seenPaths: string[]): string {
  const seen = new Set(seenPaths);
  return text.replace(citationPattern(), (match: string, path: string) => {
    if (seen.has(path)) return match;
    const hits = [...seen].filter((p) => p.endsWith(`/${path}`));
    const full = hits.length === 1 ? hits[0] : undefined;
    return full ? `[${full}${match.slice(1 + path.length)}` : match;
  });
}

/**
 * The guardrail run on every answer: each citation must name a file in this index
 * version, a real line range in it, and code that was retrieved during this run.
 */
export async function checkCitations(db: Db, versionId: string, text: string, evidence: Evidence): Promise<Citation[]> {
  const cited = parseCitations(text);
  if (cited.length === 0) return [];
  const rows = await db
    .select({ path: files.path, lineCount: files.lineCount })
    .from(files)
    .where(and(eq(files.versionId, versionId), inArray(files.path, [...new Set(cited.map((c) => c.path))])));
  const lineCounts = new Map(rows.map((r) => [r.path, r.lineCount]));
  return cited.map((c) => ({ ...c, ...verdict(c, lineCounts.get(c.path), evidence) }));
}

function verdict(c: LineRange, lineCount: number | undefined, evidence: Evidence): { valid: boolean; reason?: string } {
  if (lineCount === undefined) return { valid: false, reason: "This file is not in the indexed repo." };
  // A file that ends with a newline is shown to the model with one extra, empty numbered line.
  if (c.startLine < 1 || c.endLine < c.startLine || c.startLine > Math.max(lineCount, 1) || c.endLine > lineCount + 1) {
    return { valid: false, reason: `Lines are out of range (the file has ${lineCount} lines).` };
  }
  if (!evidence.covers(c)) return { valid: false, reason: "These lines were not retrieved while answering." };
  return { valid: true };
}
