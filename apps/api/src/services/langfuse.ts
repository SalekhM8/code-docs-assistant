import { asc, eq } from "drizzle-orm";
import type { Config } from "../config";
import type { Db } from "../db/client";
import { traceSteps, traces } from "../db/schema";
import type { Logger } from "../lib/logger";

type TraceRow = typeof traces.$inferSelect;
type StepRow = typeof traceSteps.$inferSelect;

interface Attribute {
  key: string;
  value: { stringValue: string } | { intValue: number } | { doubleValue: number };
}

const attr = (key: string, v: string | number): Attribute => ({
  key,
  value: typeof v === "string" ? { stringValue: v } : Number.isInteger(v) ? { intValue: v } : { doubleValue: v },
});

const nanos = (d: Date) => `${BigInt(d.getTime()) * 1_000_000n}`;
const hex = (uuid: string, length: number) => uuid.replaceAll("-", "").slice(0, length).padEnd(length, "0");

/**
 * Maps a stored trace to OTLP/HTTP JSON for Langfuse's OpenTelemetry endpoint: one root span
 * for the answer and a child span per step. Only ids, names, refs and counts are sent, never file contents.
 */
export function toOtlp(trace: TraceRow, steps: StepRow[]) {
  const traceId = hex(trace.id, 32);
  const rootId = hex(trace.id, 16);
  const end = new Date(trace.createdAt.getTime());
  const start = new Date(end.getTime() - trace.durationMs);
  const root = {
    traceId, spanId: rootId, name: `answer.${trace.mode}`, kind: 1,
    startTimeUnixNano: nanos(start), endTimeUnixNano: nanos(end),
    attributes: [
      attr("langfuse.trace.name", `answer.${trace.mode}`), attr("langfuse.trace.metadata.outcome", trace.outcome),
      attr("langfuse.trace.metadata.prompt_version", trace.promptVersion), attr("gen_ai.request.model", trace.model),
      attr("gen_ai.usage.input_tokens", trace.inputTokens), attr("gen_ai.usage.output_tokens", trace.outputTokens),
      ...(trace.costUsd === null ? [] : [attr("gen_ai.usage.cost", trace.costUsd)]),
    ],
  };
  const children = steps.map((s) => ({
    traceId, spanId: hex(s.id, 16), parentSpanId: rootId, name: s.name, kind: 1,
    startTimeUnixNano: nanos(s.startedAt), endTimeUnixNano: nanos(new Date(s.startedAt.getTime() + s.durationMs)),
    attributes: [
      attr("langfuse.observation.type", s.kind === "model" ? "generation" : "span"),
      attr("langfuse.observation.output", JSON.stringify(s.output)),
      ...(s.kind === "model" ? [attr("gen_ai.request.model", trace.model), attr("gen_ai.usage.input_tokens", s.inputTokens), attr("gen_ai.usage.output_tokens", s.outputTokens)] : []),
    ],
  }));
  return {
    resourceSpans: [{
      resource: { attributes: [attr("service.name", "code-docs-assistant")] },
      scopeSpans: [{ scope: { name: "code-docs-assistant" }, spans: [root, ...children] }],
    }],
  };
}

/** Returns an exporter when Langfuse keys are configured; traces stay in Postgres either way. */
export function createLangfuseExporter(
  config: Pick<Config, "LANGFUSE_PUBLIC_KEY" | "LANGFUSE_SECRET_KEY" | "LANGFUSE_HOST">,
  db: Db,
  log: Logger,
  fetchImpl: typeof fetch = fetch,
): ((traceId: string) => void) | undefined {
  const { LANGFUSE_PUBLIC_KEY: pub, LANGFUSE_SECRET_KEY: secret, LANGFUSE_HOST: host } = config;
  if (!pub || !secret) return undefined;
  const auth = `Basic ${Buffer.from(`${pub}:${secret}`).toString("base64")}`;
  return (traceId) => {
    void (async () => {
      const [trace] = await db.select().from(traces).where(eq(traces.id, traceId));
      if (!trace) return;
      const steps = await db.select().from(traceSteps).where(eq(traceSteps.traceId, traceId)).orderBy(asc(traceSteps.position));
      const res = await fetchImpl(`${host.replace(/\/$/, "")}/api/public/otel/v1/traces`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: auth },
        body: JSON.stringify(toOtlp(trace, steps)),
      });
      if (!res.ok) log.warn({ traceId, status: res.status }, "langfuse export rejected");
    })().catch((err: unknown) => log.warn({ err, traceId }, "langfuse export failed"));
  };
}
