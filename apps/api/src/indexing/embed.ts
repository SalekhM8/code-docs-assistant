import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { embeddingCache } from "../db/schema";
import { estimateTokens } from "../lib/text";
import type { EmbeddingProvider } from "../providers/embeddings";

export interface EmbedInput {
  hash: string;
  text: string;
}

const MAX_BATCH_ITEMS = 128;
const MAX_BATCH_TOKENS = 60_000;
/** Chunks are capped well under the model context; a longer one is truncated for embedding only. */
const MAX_EMBED_CHARS = 24_000;

/**
 * Embeds texts, reading and filling the cache keyed by (content hash, model). Identical
 * chunks across versions, repos and re-indexes are embedded once.
 */
export async function embedWithCache(
  db: Db,
  provider: EmbeddingProvider,
  inputs: EmbedInput[],
  signal?: AbortSignal,
): Promise<{ vectors: Map<string, number[]>; cacheHits: number }> {
  const unique = [...new Map(inputs.map((i) => [i.hash, i])).values()];
  const vectors = await readCache(db, provider.model, unique.map((i) => i.hash));
  const cacheHits = vectors.size;
  const missing = unique.filter((i) => !vectors.has(i.hash));

  for (const batch of batches(missing)) {
    const embedded = await provider.embed(batch.map((i) => i.text.slice(0, MAX_EMBED_CHARS)), "document", signal);
    const rows = batch.map((input, idx) => ({ contentHash: input.hash, model: provider.model, embedding: embedded[idx] ?? [] }));
    await db.insert(embeddingCache).values(rows).onConflictDoNothing();
    rows.forEach((r) => vectors.set(r.contentHash, r.embedding));
  }
  return { vectors, cacheHits };
}

async function readCache(db: Db, model: string, hashes: string[]): Promise<Map<string, number[]>> {
  const found = new Map<string, number[]>();
  for (let i = 0; i < hashes.length; i += 1000) {
    const slice = hashes.slice(i, i + 1000);
    const rows = await db
      .select({ hash: embeddingCache.contentHash, embedding: embeddingCache.embedding })
      .from(embeddingCache)
      .where(and(eq(embeddingCache.model, model), inArray(embeddingCache.contentHash, slice)));
    rows.forEach((r) => found.set(r.hash, r.embedding));
  }
  return found;
}

/** Splits by item count and an estimated token total, both under the provider's per-request limits. */
export function batches<T extends { text: string }>(items: T[]): T[][] {
  const out: T[][] = [];
  let current: T[] = [];
  let tokens = 0;
  for (const item of items) {
    const t = estimateTokens(item.text.slice(0, MAX_EMBED_CHARS));
    if (current.length > 0 && (current.length >= MAX_BATCH_ITEMS || tokens + t > MAX_BATCH_TOKENS)) {
      out.push(current);
      current = [];
      tokens = 0;
    }
    current.push(item);
    tokens += t;
  }
  if (current.length > 0) out.push(current);
  return out;
}
