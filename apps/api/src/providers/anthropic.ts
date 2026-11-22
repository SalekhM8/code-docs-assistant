import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaTool,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AppError } from "../lib/errors";
import type {
  CompleteRequest,
  CompleteResult,
  LlmMessage,
  LlmProvider,
  ModelTier,
  StopReason,
  SystemBlock,
  ToolSpec,
  TurnRequest,
  TurnResult,
  Usage,
} from "./llm";

interface AnthropicOptions {
  apiKey: string;
  answerModel: string;
  cheapModel: string;
}

/**
 * Claude through the official SDK. Uses the beta namespace only for server-side refusal
 * fallbacks on the answer tier, so a declined answer is retried on a fallback model in the
 * same call instead of surfacing as an empty reply.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey, maxRetries: 2 });
  }

  modelFor(tier: ModelTier): string {
    return tier === "answer" ? this.options.answerModel : this.options.cheapModel;
  }

  async complete(req: CompleteRequest, signal?: AbortSignal): Promise<CompleteResult> {
    const tier = this.tierParams(req.tier);
    const message = await this.call(() =>
      this.client.beta.messages.create(
        {
          ...tier,
          ...(req.jsonSchema ? { output_config: { ...tier.output_config, format: { type: "json_schema" as const, schema: req.jsonSchema } } } : {}),
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: "user", content: req.prompt }],
        },
        { signal },
      ),
    );
    return { model: message.model, text: textOf(message), usage: usageOf(message) };
  }

  async streamTurn(req: TurnRequest, onText: (delta: string) => void, signal?: AbortSignal): Promise<TurnResult> {
    const message = await this.call(async () => {
      const stream = this.client.beta.messages.stream(
        {
          ...this.tierParams(req.tier),
          max_tokens: req.maxTokens,
          system: req.system.map(toSystemBlock),
          messages: req.messages.map(toMessageParam),
          ...(req.tools?.length ? { tools: req.tools.map(toTool), tool_choice: { type: req.toolChoice ?? "auto" } } : {}),
        },
        { signal },
      );
      stream.on("text", onText);
      return stream.finalMessage();
    });
    return {
      model: message.model,
      text: textOf(message),
      toolCalls: message.content.flatMap((b) => (b.type === "tool_use" ? [{ id: b.id, name: b.name, input: b.input }] : [])),
      stopReason: stopReasonOf(message.stop_reason),
      usage: usageOf(message),
      raw: message.content,
    };
  }

  private tierParams(tier: ModelTier) {
    if (tier === "cheap") {
      return { model: this.options.cheapModel, output_config: { effort: "low" as const } };
    }
    return {
      model: this.options.answerModel,
      output_config: { effort: "medium" as const },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default" as const,
    };
  }

  /** Maps SDK errors to messages a user can act on; aborts pass through untouched. */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Anthropic.APIUserAbortError) throw err;
      if (err instanceof Anthropic.AuthenticationError) {
        throw new AppError("provider_error", "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env and restart the api.", { cause: err });
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new AppError("provider_error", "The model is rate limited right now. Wait a minute and try again.", { cause: err });
      }
      if (err instanceof Anthropic.APIError) {
        throw new AppError("provider_error", `The model call failed (status ${err.status ?? "unknown"}). Try again.`, { cause: err });
      }
      throw err;
    }
  }
}

function toSystemBlock(block: SystemBlock): BetaTextBlockParam {
  return block.cache ? { type: "text", text: block.text, cache_control: { type: "ephemeral" } } : { type: "text", text: block.text };
}

function toTool(spec: ToolSpec): BetaTool {
  return { name: spec.name, description: spec.description, input_schema: spec.inputSchema as BetaTool["input_schema"], strict: true };
}

function toMessageParam(m: LlmMessage): BetaMessageParam {
  switch (m.role) {
    case "user":
      return { role: "user", content: m.text };
    case "assistant":
      // Replay the provider's own blocks when we have them: tool_use ids and thinking blocks must match.
      return { role: "assistant", content: m.turn ? (m.turn.raw as BetaContentBlockParam[]) : m.text };
    case "tool_results":
      return {
        role: "user",
        content: m.results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.toolCallId, content: r.content, is_error: r.isError })),
      };
  }
}

function textOf(message: BetaMessage): string {
  return message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
}

function usageOf(message: BetaMessage): Usage {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

function stopReasonOf(reason: BetaMessage["stop_reason"]): StopReason {
  switch (reason) {
    case "end_turn":
    case "tool_use":
    case "max_tokens":
    case "refusal":
      return reason;
    default:
      return "other";
  }
}
