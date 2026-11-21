import { baselineQuestion } from "../prompts/answer.v1";
import type { LlmMessage } from "../providers/llm";
import { formatSearchResults, refOf } from "./context";
import { modelTurn, type RunContext, type RunResult } from "./run-context";

export const BASELINE_TOP_K = 8;

/** For a short follow-up ("and how is it tested?") the previous question carries the subject. */
export function retrievalQuery(question: string, history: LlmMessage[]): string {
  const previous = [...history].reverse().find((m) => m.role === "user");
  const isFollowUp = question.split(/\s+/).length <= 8 && previous?.role === "user";
  return isFollowUp ? `${previous.text}\n${question}` : question;
}

/** Baseline mode: one hybrid search, then one model call over the top results. */
export async function runBaseline(ctx: RunContext): Promise<RunResult> {
  ctx.onState("searching");
  const query = retrievalQuery(ctx.question, ctx.history);
  ctx.onStep({ id: "search-1", kind: "search", label: ctx.question, done: false });
  const results = await ctx.trace.step("retrieval", "hybrid_search", { query }, () => ctx.search(ctx.versionId, query, BASELINE_TOP_K, ctx.signal), (r) => ({
    refs: r.map(refOf),
    sources: r.map((c) => c.sources.join("+")),
  }));
  ctx.evidence.noteSearch(`Searched for "${ctx.question}"`);
  results.forEach((c) => ctx.evidence.add(c));
  ctx.onStep({ id: "search-1", kind: "search", label: ctx.question, detail: `${results.length} results`, done: true });
  if (results.length === 0) return { text: "", model: ctx.llm.modelFor("answer"), stopReason: "no_evidence" };

  ctx.onState("answering");
  const turn = await modelTurn(ctx, "answer", {
    tier: "answer",
    maxTokens: 16_000,
    messages: [...ctx.history, { role: "user", text: baselineQuestion(ctx.question, formatSearchResults(query, results)) }],
  });
  return { text: turn.text, model: turn.model, stopReason: turn.stopReason };
}
