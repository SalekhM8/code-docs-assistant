import type { MiddlewareHandler } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { AppError } from "./errors";
import type { AppEnv } from "./http";

/**
 * Fixed one-minute window per client address, in memory. Enough to stop a runaway client
 * from burning model tokens; a multi-instance deployment would move this to a shared store.
 */
export function rateLimit(perMinute: number, now: () => number = Date.now): MiddlewareHandler<AppEnv> {
  const windows = new Map<string, { start: number; count: number }>();
  return async (c, next) => {
    const key = clientKey(c);
    const t = now();
    const w = windows.get(key);
    if (!w || t - w.start >= 60_000) {
      windows.set(key, { start: t, count: 1 });
      if (windows.size > 10_000) windows.clear(); // bound memory; worst case a client gets a fresh window
    } else if (++w.count > perMinute) {
      const wait = Math.ceil((60_000 - (t - w.start)) / 1000);
      c.header("retry-after", String(wait));
      throw new AppError("rate_limited", `Too many requests. Wait ${wait} seconds and try again.`);
    }
    await next();
  };
}

function clientKey(c: Parameters<MiddlewareHandler<AppEnv>>[0]): string {
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown"; // app.request() in tests has no socket
  }
}
