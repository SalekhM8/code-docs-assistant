import type { AssistantState, LiveStep } from "@cda/shared";
import type { Db } from "../db/client";
import type { LlmMessage, LlmProvider, SystemBlock, TurnRequest, TurnResult } from "../providers/llm";
import type { HybridSearch } from "../retrieval/hybrid";
import type { TraceRecorder } from "../services/trace";
import type { Evidence } from "./evidence";

/** Everything one answer run needs. Built per request by the answer service. */
export interface RunContext {
  db: Db;
  llm: LlmProvider;
  search: HybridSearch;
  versionId: string;
  question: string;
  history: LlmMessage[];
  system: SystemBlock[];
  evidence: Evidence;
  trace: TraceRecorder;
  signal: AbortSignal;
  limits: { maxSteps: number; maxTokens: number };
  onState(state: AssistantState): void;
  onStep(step: LiveStep): void;
  onText(delta: string): void;
  /** Discards text streamed so far (narration before tool calls). */
  onReset(): void;
}

/** What a mode returns. `text` is the final answer text, already streamed through onText. */
export interface RunResult {
  text: string;
  model: string;
  stopReason: TurnResult["stopReason"] | "no_evidence";
}

/** One streamed model call, recorded as a trace step. */
export async function modelTurn(ctx: RunContext, name: string, req: Omit<TurnRequest, "system">): Promise<TurnResult> {
  const startedAt = new Date();
  const t0 = performance.now();
  let started = false;
  const onText = (delta: string) => {
    // The orb switches to "answering" when words actually arrive, not when the call starts.
    if (!started) ctx.onState("answering");
    started = true;
    ctx.onText(delta);
  };
  const turn = await ctx.llm.streamTurn({ ...req, system: ctx.system }, onText, ctx.signal);
  ctx.trace.model(name, turn.model, turn.usage, {
    stopReason: turn.stopReason,
    toolCalls: turn.toolCalls.map((c) => c.name),
    textChars: turn.text.length,
  }, performance.now() - t0, startedAt);
  return turn;
}
