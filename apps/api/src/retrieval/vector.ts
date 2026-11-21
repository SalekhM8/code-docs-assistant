import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import type { RetrievedChunk } from "./types";

/**
 * Cosine nearest neighbours over the HNSW index, restricted to one index version.
 * The index is shared by all repos, so a plain filtered HNSW scan could return fewer than
 * `limit` rows; pgvector's iterative scan keeps searching until the filter is satisfied.
 */
export async function vectorSearch(db: Db, versionId: string, embedding: number[], limit: number): Promise<RetrievedChunk[]> {
  const vector = JSON.stringify(embedding);
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local hnsw.iterative_scan = relaxed_order`);
    await tx.execute(sql`set local hnsw.ef_search = 100`);
    const rows = await tx.execute<RetrievedChunk & { distance: number }>(sql`
      select id, path, start_line as "startLine", end_line as "endLine", symbol, content,
             embedding <=> ${vector}::vector as distance
      from chunks
      where version_id = ${versionId}
      order by embedding <=> ${vector}::vector
      limit ${limit}`);
    // relaxed_order may return results slightly out of order; restore exact order.
    return [...rows].sort((a, b) => a.distance - b.distance).map(({ distance: _d, ...chunk }) => chunk);
  });
}
