import type { AnswerMode } from "@cda/shared";
import type { Db } from "../db/client";
import { traceSteps, traces } from "../db/schema";
import { addUsage, ZERO_USAGE, type Usage } from "../providers/llm";
import { costUsd } from "../providers/pricing";

type StepKind = (typeof traceSteps.$inferInsert)["kind"];

interface StepRecord {
  kind: StepKind;
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  usage: Usage;
  model?: string;
  durationMs: number;
  startedAt: Date;
}

export interface TraceTotals {
  usage: Usage;
  costUsd: number | null;
  durationMs: number;
}

/** Collects what happened during one answer, then writes a trace and its steps in one go. */
export class TraceRecorder {
  private readonly steps: StepRecord[] = [];
  private readonly started = performance.now();

  /** Times `fn` and records it as a step. `summarise` keeps file contents out of the trace. */
  async step<T>(kind: StepKind, name: string, input: Record<string, unknown>, fn: () => Promise<T>, summarise: (result: T) => Record<string, unknown>): Promise<T> {
    const startedAt = new Date();
    const t0 = performance.now();
    try {
      const result = await fn();
      this.push({ kind, name, input, output: summarise(result), usage: ZERO_USAGE, durationMs: performance.now() - t0, startedAt });
      return result;
    } catch (err) {
      this.push({ kind, name, input, output: { error: err instanceof Error ? err.message : String(err) }, usage: ZERO_USAGE, durationMs: performance.now() - t0, startedAt });
      throw err;
    }
  }

  model(name: string, model: string, usage: Usage, output: Record<string, unknown>, durationMs: number, startedAt: Date): void {
    this.push({ kind: "model", name, input: {}, output, usage, model, durationMs, startedAt });
  }

  note(kind: StepKind, name: string, output: Record<string, unknown>): void {
    this.push({ kind, name, input: {}, output, usage: ZERO_USAGE, durationMs: 0, startedAt: new Date() });
  }

  totals(): TraceTotals {
    const usage = this.steps.reduce((sum, s) => addUsage(sum, s.usage), ZERO_USAGE);
    const costs = this.steps.filter((s) => s.model).map((s) => costUsd(s.model ?? "", s.usage));
    const costUsdTotal = costs.includes(null) ? null : costs.reduce<number>((a, b) => a + (b ?? 0), 0);
    return { usage, costUsd: costUsdTotal, durationMs: Math.round(performance.now() - this.started) };
  }

  async save(db: Db, meta: { messageId: string; conversationId: string; mode: AnswerMode; model: string; promptVersion: string; outcome: string }): Promise<string> {
    const totals = this.totals();
    const [trace] = await db
      .insert(traces)
      .values({
        ...meta,
        inputTokens: totals.usage.inputTokens,
        outputTokens: totals.usage.outputTokens,
        cacheReadTokens: totals.usage.cacheReadTokens,
        cacheWriteTokens: totals.usage.cacheWriteTokens,
        costUsd: totals.costUsd,
        durationMs: totals.durationMs,
      })
      .returning({ id: traces.id });
    if (!trace) throw new Error("insert into traces returned no row");
    if (this.steps.length > 0) {
      await db.insert(traceSteps).values(
        this.steps.map((s, position) => ({
          traceId: trace.id, position, kind: s.kind, name: s.name, input: s.input, output: s.output,
          inputTokens: s.usage.inputTokens, outputTokens: s.usage.outputTokens, durationMs: Math.round(s.durationMs), startedAt: s.startedAt,
        })),
      );
    }
    return trace.id;
  }

  private push(step: StepRecord): void {
    this.steps.push(step);
  }
}
