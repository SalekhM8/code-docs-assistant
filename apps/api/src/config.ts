import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8787),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    DATABASE_URL: z.string().url(),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    LLM_PROVIDER: z.enum(["anthropic", "fake"]).default("anthropic"),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANSWER_MODEL: z.string().default("claude-sonnet-5-5"),
    CHEAP_MODEL: z.string().default("claude-haiku-5-5"),

    EMBEDDING_PROVIDER: z.enum(["voyage", "fake"]).default("voyage"),
    VOYAGE_API_KEY: z.string().optional(),
    EMBEDDING_MODEL: z.string().default("voyage-code-4"),

    ANSWER_MODE: z.enum(["baseline", "agent"]).default("agent"),

    GITHUB_TOKEN: z.string().optional(),
    SEED_SAMPLE_REPO: bool.default(false),
    SAMPLE_REPO_URL: z.string().default("https://github.com/tj/commander.js"),
    SAMPLE_REPO_COMMIT: z.string().default("a5a7dc084d4d2b7932e85ca049c5204e50a2c721"),

    MAX_REPO_SIZE_MB: z.coerce.number().positive().default(100),
    MAX_FILE_COUNT: z.coerce.number().int().positive().default(3000),
    MAX_FILE_BYTES: z.coerce.number().int().positive().default(300_000),
    MAX_AGENT_STEPS: z.coerce.number().int().min(1).max(6).default(6),
    MAX_TOKENS_PER_ANSWER: z.coerce.number().int().positive().default(120_000),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),

    LANGFUSE_PUBLIC_KEY: z.string().optional(),
    LANGFUSE_SECRET_KEY: z.string().optional(),
    LANGFUSE_HOST: z.string().url().default("https://cloud.langfuse.com"),
  })
  .superRefine((c, ctx) => {
    if (c.LLM_PROVIDER === "anthropic" && !c.ANTHROPIC_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["ANTHROPIC_API_KEY"], message: "required when LLM_PROVIDER=anthropic (or set LLM_PROVIDER=fake)" });
    }
    if (c.EMBEDDING_PROVIDER === "voyage" && !c.VOYAGE_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["VOYAGE_API_KEY"], message: "required when EMBEDDING_PROVIDER=voyage (or set EMBEDDING_PROVIDER=fake)" });
    }
  });

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

/** Fails fast at start-up with every problem listed, so a bad `.env` never half-starts the server. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new ConfigError(`Invalid configuration:\n${lines.join("\n")}`);
  }
  return result.data;
}
