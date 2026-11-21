import type { Config } from "../config";
import { AnthropicProvider } from "./anthropic";
import { FakeEmbeddings, VoyageEmbeddings, type EmbeddingProvider } from "./embeddings";
import { FakeLlm } from "./fake-llm";
import type { LlmProvider } from "./llm";

export interface Providers {
  llm: LlmProvider;
  embeddings: EmbeddingProvider;
}

/** The only place that picks real or fake providers. Config validation guarantees the keys exist. */
export function createProviders(config: Config): Providers {
  const llm: LlmProvider =
    config.LLM_PROVIDER === "anthropic"
      ? new AnthropicProvider({ apiKey: config.ANTHROPIC_API_KEY ?? "", answerModel: config.ANSWER_MODEL, cheapModel: config.CHEAP_MODEL })
      : new FakeLlm({}, config.FAKE_STREAM_DELAY_MS);
  const embeddings: EmbeddingProvider =
    config.EMBEDDING_PROVIDER === "voyage"
      ? new VoyageEmbeddings({ apiKey: config.VOYAGE_API_KEY ?? "", model: config.EMBEDDING_MODEL })
      : new FakeEmbeddings();
  return { llm, embeddings };
}
