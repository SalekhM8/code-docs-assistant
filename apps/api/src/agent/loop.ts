import type { LlmMessage } from "../providers/llm";
import { ContextBudget } from "./budget";
import { modelTurn, type RunContext, type RunResult } from "./run-context";
import { executeTool, TOOL_SPECS } from "./tools";

/** Roughly 40k tokens of tool output per answer; well inside the window, and bounds cost per answer. */
export const TOOL_RESULT_BUDGET_CHARS = 140_000;

/**
 * The agent: plain code, no framework. Call the model; if it asks for tools, run them (in
 * parallel), append the results, repeat. Stops on an answer, at the step cap (the last step
 * is forced to answer) or when the token cap for the answer is reached.
 */
export async function runAgent(ctx: RunContext): Promise<RunResult> {
  const messages: LlmMessage[] = [...ctx.history, { role: "user", text: ctx.question }];
  const budget = new ContextBudget(TOOL_RESULT_BUDGET_CHARS);
  ctx.onState("searching");

  for (let step = 1; ; step++) {
    const mustAnswer = step >= ctx.limits.maxSteps || budget.exhausted || overTokenCap(ctx);
    const turn = await modelTurn(ctx, `step ${step}`, {
      tier: "answer",
      maxTokens: 16_000,
      tools: TOOL_SPECS,
      toolChoice: mustAnswer ? "none" : "auto",
      messages,
    });
    if (turn.stopReason !== "tool_use" || turn.toolCalls.length === 0 || mustAnswer) {
      return { text: turn.text, model: turn.model, stopReason: turn.stopReason };
    }
    // Text written before tool calls is narration, not the answer; the client clears it.
    if (turn.text) ctx.onReset();
    messages.push({ role: "assistant", text: turn.text, turn });
    const results = await Promise.all(turn.toolCalls.map((call) => executeTool(ctx, call, budget)));
    messages.push({ role: "tool_results", results });
  }
}

function overTokenCap(ctx: RunContext): boolean {
  const { usage } = ctx.trace.totals();
  return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens >= ctx.limits.maxTokens;
}
