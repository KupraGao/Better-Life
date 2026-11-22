import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

export const sessionCookie = "betterlife-auth";

export function appOrigin() {
  return new URL(process.env.APP_ORIGIN || "http://127.0.0.1:3000").origin;
}

export function authClient(cookies: CookieMethodsServer) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.");
  // Standalone Auth listens at /; hosted Supabase serves Auth through its gateway.
  const direct = process.env.SUPABASE_STANDALONE_AUTH === "true";
  const fetchAuth: typeof fetch = (input, init) => {
    if (direct) {
      const endpoint = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      if (endpoint.origin === new URL(url).origin && endpoint.pathname.startsWith("/auth/v1/")) {
        endpoint.pathname = endpoint.pathname.slice("/auth/v1".length);
        return fetch(endpoint, { ...init, cache: "no-store" });
      }
    }
    return fetch(input, { ...init, cache: "no-store" });
  };
  return createServerClient(url, key, {
    cookies,
    cookieOptions: { name: sessionCookie, httpOnly: true, sameSite: "lax", secure: appOrigin().startsWith("https:") },
    global: { fetch: fetchAuth },
  });
}
