/**
 * Caps how much tool output enters the context in one answer. Append-only on purpose:
 * earlier tool results are never rewritten, which keeps the prompt cache prefix valid and
 * keeps replayed thinking blocks attached to an unedited history.
 */
export class ContextBudget {
  private used = 0;

  constructor(
    private readonly totalChars: number,
    private readonly perResultChars = 16_000,
  ) {}

  get remaining(): number {
    return Math.max(0, this.totalChars - this.used);
  }

  get exhausted(): boolean {
    return this.remaining === 0;
  }

  /** Truncates a tool result to what is left of the budget, saying so when it cuts. */
  fit(content: string): string {
    const allowed = Math.min(this.perResultChars, this.remaining);
    if (allowed === 0) return "Context budget for tool results is used up. Answer now with the evidence you already have.";
    const out = content.length <= allowed ? content : `${content.slice(0, allowed)}\n[truncated: ${content.length - allowed} more characters. Narrow the query or read a smaller range.]`;
    this.used += Math.min(content.length, allowed);
    return out;
  }
}
