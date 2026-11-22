function hasTransportSignal(error: unknown) {
  if (!error || typeof error !== "object") return false;
  if ("name" in error && error.name === "AuthRetryableFetchError") return true;
  if (error instanceof TypeError && /fetch/i.test(error.message)) return true;
  if ("status" in error && typeof error.status === "number") return error.status === 429 || error.status >= 500;
  return false;
}

/** Network loss, HTTP 429, and HTTP 5xx. Invalid credentials stay outside this set. */
export function isAuthTransportError(error: unknown) {
  if (hasTransportSignal(error)) return true;
  return error instanceof Error && error.cause !== undefined && hasTransportSignal(error.cause);
}
