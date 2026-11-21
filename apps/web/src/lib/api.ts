import {
  ApiErrorBody, ConversationDetail, ConversationList, ConversationSummary, FileContent, FileList, HealthResponse, RepoDetail, RepoList,
  type AnswerMode, type Rating,
} from "@cda/shared";
import { z } from "zod";
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

/** Turns a non-2xx response into an ApiError carrying the api's own user-facing message. */
export async function toApiError(res: Response): Promise<ApiError> {
  const parsed = ApiErrorBody.safeParse(await res.json().catch(() => undefined));
  if (parsed.success) return new ApiError(res.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.requestId);
  return new ApiError(res.status, "unknown", `The api answered with status ${res.status}. Try again.`);
}

/** Every call goes through here: a request id header, parsed errors, and a zod-checked response. */
export async function apiFetch<T extends z.ZodType>(path: string, schema: T, init: RequestInit = {}): Promise<z.infer<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-request-id": newRequestId(), ...init.headers },
  }).catch(() => {
    throw new ApiError(0, "network", "Could not reach the api. Check that it is running, then try again.");
  });
  if (!res.ok) throw await toApiError(res);
  return schema.parse(res.status === 204 ? undefined : await res.json());
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const Empty = z.undefined();

export const api = {
  health: () => apiFetch("/health", HealthResponse),
  repos: () => apiFetch("/repos", RepoList),
  repo: (id: string) => apiFetch(`/repos/${id}`, RepoDetail),
  addRepo: (url: string) => apiFetch("/repos", RepoDetail, json({ url })),
  reindexRepo: (id: string) => apiFetch(`/repos/${id}/reindex`, RepoDetail, { method: "POST" }),
  deleteRepo: (id: string) => apiFetch(`/repos/${id}`, Empty, { method: "DELETE" }),
  conversations: (repoId: string) => apiFetch(`/repos/${repoId}/conversations`, ConversationList),
  createConversation: (repoId: string) => apiFetch(`/repos/${repoId}/conversations`, ConversationSummary, { method: "POST" }),
  conversation: (id: string) => apiFetch(`/conversations/${id}`, ConversationDetail),
  deleteConversation: (id: string) => apiFetch(`/conversations/${id}`, Empty, { method: "DELETE" }),
  files: (repoId: string) => apiFetch(`/repos/${repoId}/files`, FileList),
  file: (repoId: string, path: string) => apiFetch(`/repos/${repoId}/file?path=${encodeURIComponent(path)}`, FileContent),
};

export type AnswerRequest =
  | { kind: "ask"; conversationId: string; content: string; mode: AnswerMode }
  | { kind: "regenerate"; conversationId: string; mode: AnswerMode };

export type { Rating };
