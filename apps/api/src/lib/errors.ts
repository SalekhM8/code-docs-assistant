/**
 * Errors a user can act on. `message` is shown as is in the UI, so it must say what
 * happened and what to do next. Anything that is not an AppError becomes a generic 500.
 */
export type ErrorCode =
  | "invalid_request"
  | "invalid_repo_url"
  | "repo_not_found"
  | "repo_too_large"
  | "repo_busy"
  | "repo_not_ready"
  | "not_found"
  | "rate_limited"
  | "provider_error"
  | "internal";

type Status = 400 | 404 | 409 | 413 | 429 | 500 | 502;

const STATUS: Record<ErrorCode, Status> = {
  invalid_request: 400,
  invalid_repo_url: 400,
  repo_not_found: 404,
  repo_too_large: 413,
  repo_busy: 409,
  repo_not_ready: 409,
  not_found: 404,
  rate_limited: 429,
  provider_error: 502,
  internal: 500,
};

export class AppError extends Error {
  override name = "AppError";
  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }

  get status(): Status {
    return STATUS[this.code];
  }
}

export function notFound(what: string): AppError {
  return new AppError("not_found", `${what} was not found. It may have been deleted; refresh the page.`);
}
