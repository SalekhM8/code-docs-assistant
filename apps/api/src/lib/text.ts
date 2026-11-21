import { createHash } from "node:crypto";

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Splits code into lowercase words, breaking identifiers apart:
 * `parseOptions_v2` -> parse, options, v2. Shared by keyword indexing and the fake embedder
 * so `parseOptions` in code matches "parse options" in a question.
 */
export function identifierWords(text: string): string[] {
  const words: string[] = [];
  for (const token of text.match(/[A-Za-z0-9_$]+/g) ?? []) {
    for (const part of token.split(/[_$]+|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)) {
      if (part.length > 1) words.push(part.toLowerCase());
    }
    if (/[a-z][A-Z]|_/.test(token) && token.length > 1) words.push(token.toLowerCase());
  }
  return words;
}

export function countLines(text: string): number {
  if (text.length === 0) return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

/** Rough token estimate used only for budgets and batching, never for billing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
