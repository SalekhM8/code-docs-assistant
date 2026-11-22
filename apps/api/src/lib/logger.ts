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
    serializers: { err: serializeError },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

const PARAMS = "\nparams:";

/** Database errors append the query's parameters to their message: file contents, answer text. Cut them off. */
function withoutParams(text: string): string {
  const at = text.indexOf(PARAMS);
  return at < 0 ? text : `${text.slice(0, at)}${PARAMS} [omitted]`;
}

/**
 * Replaces pino's default error serializer, which copies every property of the error
 * (a failed query's `params` included) into the log line. Keeps the type, message, stack
 * and cause chain, with query parameters removed from each.
 */
export function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { message: String(err) };
  const head = `${err.name}: ${err.message}`;
  const frames = err.stack?.startsWith(head) ? err.stack.slice(head.length) : "";
  const out: Record<string, unknown> = { type: err.name, message: withoutParams(err.message), stack: `${withoutParams(head)}${frames}` };
  if ("code" in err && typeof err.code === "string") out.code = err.code;
  if (err.cause !== undefined) out.cause = serializeError(err.cause);
  return out;
}
