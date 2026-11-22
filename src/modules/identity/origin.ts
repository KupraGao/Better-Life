const localOrigin = "http://127.0.0.1:3000";

function httpsOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_ORIGIN must be a valid https URL in production.");
  }
  if (url.protocol !== "https:" || url.hostname.length === 0) {
    throw new Error("APP_ORIGIN must be a valid https URL in production.");
  }
  return url.origin;
}

/** Read at call time. Importing this module must not require APP_ORIGIN. */
export function appOrigin() {
  const configured = process.env.APP_ORIGIN?.trim() ?? "";
  if (process.env.NODE_ENV === "production") return httpsOrigin(configured);
  if (!configured) return localOrigin;
  try {
    return new URL(configured).origin;
  } catch {
    throw new Error("APP_ORIGIN must be a valid URL.");
  }
}

export function sessionCookieAttributes(nodeEnv: string | undefined, readOrigin: () => string) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: nodeEnv === "production" || readOrigin().startsWith("https:"),
  };
}
