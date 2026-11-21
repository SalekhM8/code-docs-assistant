import type { Usage } from "./llm";

interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** USD per million tokens, from Anthropic's price list on 2026-11-21. Cache writes are 1.25x input (5 minute TTL). */
const PRICES: Record<string, Price> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

/** Returns null for models without a known price (fakes, or an id set in env that is not listed). */
export function costUsd(model: string, usage: Usage): number | null {
  if (model.startsWith("fake-")) return 0;
  const price = PRICES[model];
  if (!price) return null;
  const total =
    usage.inputTokens * price.input +
    usage.outputTokens * price.output +
    usage.cacheReadTokens * price.cacheRead +
    usage.cacheWriteTokens * price.cacheWrite;
  return total / 1_000_000;
}
