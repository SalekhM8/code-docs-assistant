import { pino, type Logger } from "pino";

export type { Logger };

/**
 * JSON logs only. Secrets are redacted by path as a backstop; the real rule is that
 * callers never pass keys or file contents to the logger in the first place.
 */
export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: "api" },
    redact: {
      paths: ["*.apiKey", "*.authorization", "*.headers.authorization", "*.headers[\"x-api-key\"]", "*.content", "*.text"],
      censor: "[redacted]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
