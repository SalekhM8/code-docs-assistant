import type { Context, MiddlewareHandler } from "hono";
import type { z } from "zod";
import type { ApiErrorBody } from "@cda/shared";
import { AppError } from "./errors";
import type { Logger } from "./logger";

export interface AppEnv {
  Variables: { requestId: string; log: Logger };
}

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Reuses the web app's request id when it is well formed, so one id follows a request end to end. */
export function requestContext(root: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const incoming = c.req.header("x-request-id");
    const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
    const log = root.child({ requestId });
    c.set("requestId", requestId);
    c.set("log", log);
    c.header("x-request-id", requestId);
    const started = performance.now();
    await next();
    log.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(performance.now() - started) }, "request");
  };
}

export function errorBody(c: Context<AppEnv>, code: string, message: string): ApiErrorBody {
  return { error: { code, message, requestId: c.get("requestId") } };
}

export function handleError(err: Error, c: Context<AppEnv>): Response {
  if (err instanceof AppError) {
    return c.json(errorBody(c, err.code, err.message), err.status);
  }
  c.get("log").error({ err }, "unhandled error");
  return c.json(errorBody(c, "internal", "Something went wrong on our side. Try again; if it keeps happening, check the api logs for this request id."), 500);
}

/** Parses a JSON body with zod and turns failures into a 400 the UI can show. */
export async function parseJson<T extends z.ZodType>(c: Context<AppEnv>, schema: T): Promise<z.infer<T>> {
  const raw: unknown = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    throw new AppError("invalid_request", `The request was not valid (${detail}).`);
  }
  return result.data;
}

export function parseParam<T extends z.ZodType>(value: string | undefined, schema: T, label: string): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("invalid_request", `${label} is not valid.`);
  return result.data;
}
