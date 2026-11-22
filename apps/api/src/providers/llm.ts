/**
 * Provider-neutral model interface. The agent loop, baseline answerer and overview
 * generator depend only on this, so every one of them runs against the fake in tests.
 */

export type ModelTier = "answer" | "cheap";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the input. Inputs are validated again with zod before a tool runs. */
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError: boolean;
}

/** A system prompt block. `cache` marks the end of the fixed prefix for provider prompt caching. */
export interface SystemBlock {
  text: string;
  cache?: boolean;
}

export type LlmMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; turn?: TurnResult }
  | { role: "tool_results"; results: ToolResult[] };

export interface TurnRequest {
  tier: ModelTier;
  system: SystemBlock[];
  messages: LlmMessage[];
  tools?: ToolSpec[];
  /** "none" forces a text answer, used on the last allowed step. */
  toolChoice?: "auto" | "none";
  maxTokens: number;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";

export interface TurnResult {
  model: string;
  text: string;
  toolCalls: ToolCall[];
  stopReason: StopReason;
  usage: Usage;
  /** The provider's own content blocks, replayed verbatim on the next request (thinking blocks must be). */
  raw: unknown;
}

export interface CompleteRequest {
  tier: ModelTier;
  system: string;
  prompt: string;
  maxTokens: number;
  /** When set, the reply is constrained to JSON matching this schema (structured output). */
  jsonSchema?: Record<string, unknown>;
}

export interface CompleteResult {
  model: string;
  text: string;
  usage: Usage;
}

export interface LlmProvider {
  readonly name: string;
  modelFor(tier: ModelTier): string;
  complete(req: CompleteRequest, signal?: AbortSignal): Promise<CompleteResult>;
  /** Streams text deltas through `onText` and resolves with the whole turn. */
  streamTurn(req: TurnRequest, onText: (delta: string) => void, signal?: AbortSignal): Promise<TurnResult>;
}
