import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config";

const base = { DATABASE_URL: "postgres://localhost/cda" };

describe("loadConfig", () => {
  it("requires the Anthropic key only when the real provider is selected", () => {
    expect(() => loadConfig({ ...base, EMBEDDING_PROVIDER: "fake" })).toThrow(ConfigError);
    expect(loadConfig({ ...base, LLM_PROVIDER: "fake", EMBEDDING_PROVIDER: "fake" }).LLM_PROVIDER).toBe("fake");
  });

  it("caps agent steps at six", () => {
    expect(() => loadConfig({ ...base, LLM_PROVIDER: "fake", EMBEDDING_PROVIDER: "fake", MAX_AGENT_STEPS: "7" })).toThrow(ConfigError);
  });
});
