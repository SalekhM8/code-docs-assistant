import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { identifierWords } from "../lib/text";
import type { RetrievedChunk } from "./types";

const STOPWORDS = new Set([
  "the", "and", "for", "are", "how", "what", "where", "when", "which", "who", "why", "does", "do", "is", "it", "in", "of",
  "to", "a", "an", "on", "this", "that", "with", "from", "by", "be", "can", "i", "me", "my", "you", "your", "there",
  "code", "repo", "file", "files", "show", "tell", "about", "work", "works", "used", "use", "get", "into", "or", "as",
]);

/**
 * Turns a natural question into an OR tsquery over identifier words. OR, not AND, because a
 * question rarely shares every word with the code; ts_rank_cd then favours chunks matching more.
 */
export function buildTsQuery(question: string): string | null {
  const words = [...new Set(identifierWords(question).filter((w) => /^[a-z0-9_]+$/.test(w) && !STOPWORDS.has(w)))];
  return words.length ? words.slice(0, 24).join(" | ") : null;
}

/** Normalisation 1 divides the rank by 1 + log(length), so long README sections do not win on volume. */
export async function keywordSearch(db: Db, versionId: string, question: string, limit: number): Promise<RetrievedChunk[]> {
  const tsQuery = buildTsQuery(question);
  if (!tsQuery) return [];
  return db.execute<RetrievedChunk>(sql`
    select id, path, start_line as "startLine", end_line as "endLine", symbol, content
    from chunks, to_tsquery('simple', ${tsQuery}) q
    where version_id = ${versionId} and search_vector @@ q
    order by ts_rank_cd(search_vector, q, 1) desc, path
    limit ${limit}`);
}
