import { eq } from "drizzle-orm";
import type { AnswerMode, Message, StreamEvent } from "@cda/shared";
import type { Db } from "../db/client";
import { traceSteps, traces } from "../db/schema";
import type { LlmProvider } from "../providers/llm";
import type { Services } from "../services/container";
import type { GoldenQuestion } from "./golden";
import { judgeAnswer, type JudgeScore } from "./judge";
import { citationValidity, recallAtK, reciprocalRank } from "./scorers";

export interface AnswerResult {
  id: string;
  type: GoldenQuestion["type"];
  mode: AnswerMode;
  status: Message["status"];
  recall: number;
  rr: number;
  citationValidity: number | null;
  /** For unanswerable questions: did it decline? Null for the rest. */
  declinedCorrectly: boolean | null;
  judge: JudgeScore | null;
  costUsd: number | null;
  latencyMs: number;
  tokens: number;
}

interface Deps {
  db: Db;
  services: Services;
  judgeLlm: LlmProvider;
  repoId: string;
  versionId: string;
}

/** Asks one golden question through the real answer pipeline, then scores it in code and with the judge. */
export async function evaluateAnswer(deps: Deps, q: GoldenQuestion, mode: AnswerMode): Promise<AnswerResult> {
  const conversation = await deps.services.conversations.create(deps.repoId);
  try {
    const events: StreamEvent[] = [];
    await deps.services.answers.ask(conversation.id, q.question, mode, (e) => events.push(e), new AbortController().signal);
    const done = events.find((e) => e.type === "done");
    if (done?.type !== "done") throw new Error(`no answer for ${q.id}`);
    const message = done.message;
    const refs = await evidenceRefs(deps.db, message.traceId ?? "");
    const [trace] = await deps.db.select().from(traces).where(eq(traces.id, message.traceId ?? ""));
    const unanswerable = q.type === "unanswerable";
    return {
      id: q.id,
      type: q.type,
      mode,
      status: message.status,
      recall: recallAtK(refs, q.expectedFiles, refs.length),
      rr: q.expectedFiles.length ? reciprocalRank(refs, q.expectedFiles) : 1,
      citationValidity: citationValidity(message.citations),
      declinedCorrectly: unanswerable ? message.status === "not_found" : null,
      judge: unanswerable ? null : await judgeAnswer(deps.judgeLlm, deps.db, deps.versionId, q, message.content, message.citations),
      costUsd: trace?.costUsd ?? null,
      latencyMs: trace?.durationMs ?? 0,
      tokens: (trace?.inputTokens ?? 0) + (trace?.outputTokens ?? 0) + (trace?.cacheReadTokens ?? 0),
    };
  } finally {
    await deps.services.conversations.delete(conversation.id);
  }
}

/** Every range the run looked at, in the order it looked, from the trace steps' `refs`. */
async function evidenceRefs(db: Db, traceId: string): Promise<string[]> {
  const steps = await db.select({ output: traceSteps.output }).from(traceSteps).where(eq(traceSteps.traceId, traceId)).orderBy(traceSteps.position);
  return steps.flatMap((s) => (Array.isArray(s.output.refs) ? s.output.refs.filter((r): r is string => typeof r === "string") : []));
}
