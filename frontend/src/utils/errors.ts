/**
 * Turns any thrown value (Axios error, plain Error, unknown) into a short,
 * human-readable sentence. Pure and framework-free so React Native can reuse it.
 */

type ApiErrorLike = {
  code?: string;
  message?: string;
  response?: { status?: number; data?: { detail?: unknown } };
  request?: unknown;
};

export function getErrorStatus(err: unknown): number | undefined {
  return (err as ApiErrorLike)?.response?.status;
}

/** True when the request never got an answer (offline, server down, timeout). */
export function isNetworkError(err: unknown): boolean {
  const e = err as ApiErrorLike;
  return !!e && !e.response && (!!e.request || e.code === "ERR_NETWORK" || e.code === "ECONNABORTED");
}

/**
 * True only when the server answered "your login is not valid".
 * A network drop or a 5xx says nothing about the login, so callers must NOT sign the user out for those.
 */
export function isAuthRejection(err: unknown): boolean {
  const status = getErrorStatus(err);
  return status === 400 || status === 401 || status === 403;
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as ApiErrorLike;
  if (!e) return fallback;

  if (e.code === "ECONNABORTED" || e.code === "ETIMEDOUT") {
    return "The server took too long to respond. Please try again.";
  }
  if (isNetworkError(err)) {
    return "Can't reach Chesslens. Check your internet connection and try again.";
  }

  const status = getErrorStatus(err);
  const detail = e.response?.data?.detail;
  // FastAPI sends `detail` as a string for HTTPException, and as a list for validation errors.
  if (typeof detail === "string" && detail.trim()) return detail;

  if (status === 401) return "Your session has expired. Please refresh the page.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 409) return "That is already in progress.";
  if (status === 422) return "Some of the information sent was invalid.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status && status >= 500) return "Something went wrong on our side. Please try again in a moment.";

  return fallback;
}

/**
 * Turns the raw error text the backend stores on a failed import job
 * (e.g. "Client error '404 Not Found' for url ...", or "" for a timeout)
 * into a message that says what to do next.
 */
export function getImportFailureMessage(raw: string | null | undefined, username: string): string {
  const text = (raw ?? "").toLowerCase();
  if (/\b404\b|not found/.test(text)) {
    return `We couldn't find a Chess.com player named "${username.trim()}". Check the spelling and try again.`;
  }
  if (/\b429\b|too many requests|rate limit/.test(text)) {
    return "Chess.com is limiting requests right now. Wait a few minutes, then try again.";
  }
  return "The import stopped before it finished. This is usually a temporary problem with Chess.com. Try again in a few minutes.";
}
