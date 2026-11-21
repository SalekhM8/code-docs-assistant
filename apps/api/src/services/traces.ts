import { asc, eq } from "drizzle-orm";
import type { Rating, TraceDetail } from "@cda/shared";
import type { Db } from "../db/client";
import { feedback, traceSteps, traces } from "../db/schema";
import { notFound } from "../lib/errors";

export class TraceService {
  constructor(private readonly deps: { db: Db }) {}

  async get(id: string): Promise<TraceDetail> {
    const [row] = await this.deps.db
      .select({ t: traces, rating: feedback.rating })
      .from(traces)
      .leftJoin(feedback, eq(feedback.traceId, traces.id))
      .where(eq(traces.id, id));
    if (!row) throw notFound("That trace");
    const steps = await this.deps.db.select().from(traceSteps).where(eq(traceSteps.traceId, id)).orderBy(asc(traceSteps.position));
    const { t } = row;
    return {
      id: t.id, messageId: t.messageId, mode: t.mode, model: t.model, promptVersion: t.promptVersion, outcome: t.outcome,
      inputTokens: t.inputTokens, outputTokens: t.outputTokens, cacheReadTokens: t.cacheReadTokens, cacheWriteTokens: t.cacheWriteTokens,
      costUsd: t.costUsd, durationMs: t.durationMs, createdAt: t.createdAt.toISOString(), feedback: row.rating,
      steps: steps.map((s) => ({
        position: s.position, kind: s.kind, name: s.name, input: s.input, output: s.output,
        inputTokens: s.inputTokens, outputTokens: s.outputTokens, durationMs: s.durationMs, startedAt: s.startedAt.toISOString(),
      })),
    };
  }

  /** One rating per trace; rating again replaces it. Stored against the trace so it can be joined to everything the answer did. */
  async setFeedback(traceId: string, rating: Rating | null): Promise<{ traceId: string; rating: Rating | null }> {
    const [trace] = await this.deps.db.select({ id: traces.id }).from(traces).where(eq(traces.id, traceId));
    if (!trace) throw notFound("That answer's trace");
    if (rating === null) {
      await this.deps.db.delete(feedback).where(eq(feedback.traceId, traceId));
    } else {
      await this.deps.db
        .insert(feedback)
        .values({ traceId, rating })
        .onConflictDoUpdate({ target: feedback.traceId, set: { rating, createdAt: new Date() } });
    }
    return { traceId, rating };
  }
}
