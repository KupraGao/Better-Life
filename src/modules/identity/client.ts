import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { appOrigin, sessionCookieAttributes } from "./origin";

export const sessionCookie = "betterlife-auth";

export { appOrigin } from "./origin";
export { isAuthTransportError } from "./transport";

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
    cookieOptions: { name: sessionCookie, ...sessionCookieAttributes(process.env.NODE_ENV, appOrigin) },
    global: { fetch: fetchAuth },
  });
}
