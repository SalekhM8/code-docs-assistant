import { ApiErrorBody, type HealthResponse, HealthResponse as HealthSchema } from "@cda/shared";
import type { z } from "zod";
import { API_URL } from "./env";

export class ApiError extends Error {
  override name = "ApiError";
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

/** One place for every call to the api: request id header, error body parsing, response validation. */
export async function apiFetch<T extends z.ZodType>(path: string, schema: T, init: RequestInit = {}): Promise<z.infer<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-request-id": newRequestId(), ...init.headers },
  }).catch(() => {
    throw new ApiError(0, "network", "Could not reach the api. Check that it is running, then try again.");
  });
  const body: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) {
    const parsed = ApiErrorBody.safeParse(body);
    if (parsed.success) throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.requestId);
    throw new ApiError(res.status, "unknown", `The api answered with status ${res.status}. Try again.`);
  }
  return schema.parse(body);
}

export const getHealth = (): Promise<HealthResponse> => apiFetch("/health", HealthSchema);
