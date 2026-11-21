import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { identifierWords } from "../lib/text";

export type EmbedKind = "document" | "query";

export interface EmbeddingProvider {
  /** Recorded on every stored embedding and used in the cache key. */
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[], kind: EmbedKind, signal?: AbortSignal): Promise<number[][]>;
}

/**
 * Deterministic stand-in for tests and key-less runs. Feature hashing over identifier
 * words gives real lexical similarity, so retrieval tests exercise the vector path honestly.
 */
export class FakeEmbeddings implements EmbeddingProvider {
  readonly model = "fake-hash-embeddings";
  constructor(readonly dimensions = 1024) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vector(t));
  }

  private vector(text: string): number[] {
    const v = new Array<number>(this.dimensions).fill(0);
    for (const word of identifierWords(text)) {
      const h = createHash("md5").update(word).digest();
      const slot = h.readUInt32LE(0) % this.dimensions;
      v[slot] = (v[slot] ?? 0) + ((h[4] ?? 0) % 2 === 0 ? 1 : -1);
    }
    const norm = Math.hypot(...v) || 1;
    return v.map((x) => x / norm);
  }
}

interface VoyageOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
}

/** Voyage REST client. Kept to one endpoint, so no SDK dependency. */
export class VoyageEmbeddings implements EmbeddingProvider {
  readonly dimensions = 1024;
  readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxAttempts: number;

  constructor(private readonly options: VoyageOptions) {
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxAttempts = options.maxAttempts ?? 4;
  }

  async embed(texts: string[], kind: EmbedKind, signal?: AbortSignal): Promise<number[][]> {
    for (let attempt = 1; ; attempt++) {
      const res = await this.fetchImpl("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        signal: signal ?? null,
        headers: { "content-type": "application/json", authorization: `Bearer ${this.options.apiKey}` },
        body: JSON.stringify({ input: texts, model: this.model, input_type: kind, output_dimension: this.dimensions }),
      });
      if (res.ok) return parseVoyage(await res.json(), texts.length);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= this.maxAttempts) {
        throw new AppError("provider_error", `The embedding service returned ${res.status}. Check VOYAGE_API_KEY and your Voyage usage limits, then retry.`);
      }
      await sleep(500 * 2 ** attempt, signal);
    }
  }
}

const VoyageResponse = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()), index: z.number().int() })),
});

function parseVoyage(body: unknown, expected: number): number[][] {
  const parsed = VoyageResponse.safeParse(body);
  if (!parsed.success || parsed.data.data.length !== expected) {
    throw new AppError("provider_error", "The embedding service returned an unexpected response. Retry the indexing job.");
  }
  return [...parsed.data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}
