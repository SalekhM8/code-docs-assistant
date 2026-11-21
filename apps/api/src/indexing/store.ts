import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { chunks, files, indexVersions, repos } from "../db/schema";
import { identifierWords } from "../lib/text";
import type { Chunk } from "./chunkers";
import type { SourceFile } from "./walk";

export interface PreparedChunk extends Chunk {
  contentHash: string;
  embedding: number[];
}

export async function createVersion(db: Db, repoId: string, commitSha: string, embeddingModel: string): Promise<string> {
  const [row] = await db.insert(indexVersions).values({ repoId, commitSha, embeddingModel }).returning({ id: indexVersions.id });
  if (!row) throw new Error("insert into index_versions returned no row");
  return row.id;
}

export interface ActiveVersion {
  id: string;
  commitSha: string;
  embeddingModel: string;
}

export async function getActiveVersion(db: Db, repoId: string): Promise<ActiveVersion | null> {
  const [row] = await db
    .select({ id: indexVersions.id, commitSha: indexVersions.commitSha, embeddingModel: indexVersions.embeddingModel })
    .from(repos)
    .innerJoin(indexVersions, eq(indexVersions.id, repos.activeVersionId))
    .where(eq(repos.id, repoId));
  return row ?? null;
}

/** path -> content hash for every file in a version, used to decide what can be reused. */
export async function fileHashes(db: Db, versionId: string): Promise<Map<string, string>> {
  const rows = await db.select({ path: files.path, hash: files.contentHash }).from(files).where(eq(files.versionId, versionId));
  return new Map(rows.map((r) => [r.path, r.hash]));
}

/**
 * Copies unchanged files and their chunks (with embeddings) from the old version, so a
 * re-index only chunks and embeds files whose content changed. Two set-based statements.
 */
export async function copyUnchangedFiles(db: Db, fromVersion: string, toVersion: string, paths: string[]): Promise<number> {
  if (paths.length === 0) return 0;
  return db.transaction(async (tx) => {
    const copied = await tx.execute(sql`
      insert into files (version_id, path, language, size_bytes, line_count, content_hash, content)
      select ${toVersion}, path, language, size_bytes, line_count, content_hash, content
      from files where version_id = ${fromVersion} and path = any(${sql.param(paths)}::text[])`);
    await tx.execute(sql`
      insert into chunks (version_id, file_id, path, start_line, end_line, symbol, kind, language, content,
                          content_hash, embedding, embedding_model, search_vector)
      select ${toVersion}, nf.id, c.path, c.start_line, c.end_line, c.symbol, c.kind, c.language, c.content,
             c.content_hash, c.embedding, c.embedding_model, c.search_vector
      from chunks c
      join files nf on nf.version_id = ${toVersion} and nf.path = c.path
      where c.version_id = ${fromVersion} and c.path = any(${sql.param(paths)}::text[])`);
    return copied.count;
  });
}

export async function insertFileWithChunks(db: Db, versionId: string, file: SourceFile, prepared: PreparedChunk[], embeddingModel: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(files)
      .values({
        versionId, path: file.path, language: file.lang.language, sizeBytes: file.sizeBytes,
        lineCount: file.lineCount, contentHash: file.contentHash, content: file.content,
      })
      .returning({ id: files.id });
    if (!row || prepared.length === 0) return;
    await tx.insert(chunks).values(
      prepared.map((c) => ({
        versionId, fileId: row.id, path: file.path, startLine: c.startLine, endLine: c.endLine, symbol: c.symbol,
        kind: c.kind, language: file.lang.language, content: c.content, contentHash: c.contentHash,
        embedding: c.embedding, embeddingModel,
        searchVector: searchVector(file.path, c),
      })),
    );
  });
}

/** Words for the keyword index, with identifiers also split (`parseOptions` -> parse, options). */
export function searchWords(text: string): string {
  return `${text}\n${identifierWords(text).join(" ")}`;
}

/** Path and symbol are weighted A and the body D, so a match on a name outranks a passing mention. */
function searchVector(filePath: string, chunk: Pick<Chunk, "symbol" | "content">) {
  const head = searchWords(`${filePath} ${chunk.symbol ?? ""}`);
  return sql`setweight(to_tsvector('simple', ${head}), 'A') || setweight(to_tsvector('simple', ${searchWords(chunk.content)}), 'D')`;
}

/**
 * The swap: in one transaction the new version goes live and every other version of the
 * repo is deleted (files and chunks cascade). Readers see the old index or the new one, never a mix.
 */
export async function activateVersion(db: Db, repoId: string, versionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const counts = await tx.execute<{ files: number; chunks: number }>(sql`
      select (select count(*)::int from files where version_id = ${versionId}) as files,
             (select count(*)::int from chunks where version_id = ${versionId}) as chunks`);
    const c = counts[0] ?? { files: 0, chunks: 0 };
    await tx.update(indexVersions).set({ status: "active", fileCount: c.files, chunkCount: c.chunks }).where(eq(indexVersions.id, versionId));
    await tx.update(repos).set({ activeVersionId: versionId, updatedAt: new Date() }).where(eq(repos.id, repoId));
    await tx.delete(indexVersions).where(and(eq(indexVersions.repoId, repoId), ne(indexVersions.id, versionId)));
  });
}

export async function deleteVersion(db: Db, versionId: string): Promise<void> {
  await db.delete(indexVersions).where(and(eq(indexVersions.id, versionId), inArray(indexVersions.status, ["building"])));
}
