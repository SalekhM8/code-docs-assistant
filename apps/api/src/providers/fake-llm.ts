import { estimateTokens } from "../lib/text";
import type {
  CompleteRequest,
  CompleteResult,
  LlmMessage,
  LlmProvider,
  ModelTier,
  StopReason,
  ToolCall,
  TurnRequest,
  TurnResult,
} from "./llm";

export interface FakeTurnScript {
  text?: string;
  toolCalls?: ToolCall[];
  stopReason?: StopReason;
}

interface FakeBehaviour {
  turn?: (req: TurnRequest, callIndex: number) => FakeTurnScript;
  complete?: (req: CompleteRequest) => string;
}

/**
 * Stand-in model. Tests pass a script; without one it behaves like a tiny, honest
 * assistant (search once, then cite what it was shown) so the app is usable with no keys.
 */
export class FakeLlm implements LlmProvider {
  readonly name = "fake";
  readonly turnRequests: TurnRequest[] = [];
  readonly completeRequests: CompleteRequest[] = [];

  constructor(private readonly behaviour: FakeBehaviour = {}) {}

  modelFor(tier: ModelTier): string {
    return `fake-${tier}`;
  }

  async complete(req: CompleteRequest): Promise<CompleteResult> {
    this.completeRequests.push(req);
    const text = this.behaviour.complete?.(req) ?? `Summary: ${req.prompt.slice(0, 120)}`;
    return { model: this.modelFor(req.tier), text, usage: fakeUsage(req.system + req.prompt, text) };
  }

  async streamTurn(req: TurnRequest, onText: (delta: string) => void, signal?: AbortSignal): Promise<TurnResult> {
    const index = this.turnRequests.push(req) - 1;
    const script = this.behaviour.turn?.(req, index) ?? defaultTurn(req);
    const text = script.text ?? "";
    for (const delta of text.match(/\S+\s*/g) ?? []) {
      // Yield between deltas so a Stop click (abort) can land mid answer, as with a real stream.
      await new Promise((r) => setImmediate(r));
      signal?.throwIfAborted();
      onText(delta);
    }
    const toolCalls = script.toolCalls ?? [];
    const prompt = req.system.map((b) => b.text).join("") + JSON.stringify(req.messages);
    return {
      model: this.modelFor(req.tier),
      text,
      toolCalls,
      stopReason: script.stopReason ?? (toolCalls.length ? "tool_use" : "end_turn"),
      usage: fakeUsage(prompt, text),
      raw: null,
    };
  }
}

function fakeUsage(input: string, output: string) {
  return { inputTokens: estimateTokens(input), outputTokens: estimateTokens(output), cacheReadTokens: 0, cacheWriteTokens: 0 };
}

const CITABLE = /^### (\S+):(\d+)-(\d+)/gm;

function defaultTurn(req: TurnRequest): FakeTurnScript {
  const sawTools = req.messages.some((m) => m.role === "tool_results");
  if (req.tools?.length && req.toolChoice !== "none" && !sawTools) {
    return { toolCalls: [{ id: "fake-call-1", name: "search_code", input: { query: lastUserText(req.messages) } }] };
  }
  const context = req.system.map((b) => b.text).join("\n") + req.messages.map(messageText).join("\n");
  const refs = [...context.matchAll(CITABLE)].slice(0, 2).map((m) => `[${m[1]}:${m[2]}-${m[3]}]`);
  if (refs.length === 0) {
    return { text: "NOT_FOUND: I could not find code in this repository that answers the question." };
  }
  return {
    text: `(Fake model: no API key is configured, so this answer only points at the best matches.) The most relevant code is ${refs.join(" and ")}.`,
  };
}

function lastUserText(messages: LlmMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") return m.text;
  }
  return "";
}

function messageText(m: LlmMessage): string {
  if (m.role === "tool_results") return m.results.map((r) => r.content).join("\n");
  return m.text;
}
