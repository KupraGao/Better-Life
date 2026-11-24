import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "@/lib/security-headers";
import { authClient, isAuthTransportError, sessionCookie } from "@/modules/identity/client";

function continueWithoutSession() {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function redirectToDefaultLocale(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/ka";
  const response = NextResponse.redirect(url, 307);
  for (const header of securityHeaders()) response.headers.set(header.key, header.value);
  return response;
}

function redirectRetiredContact(request: NextRequest) {
  const match = /^\/(ka|en)\/contact\/?$/.exec(request.nextUrl.pathname);
  if (!match) return null;
  const response = NextResponse.redirect(new URL(`/${match[1]}#contact`, request.url), 308);
  for (const header of securityHeaders()) response.headers.set(header.key, header.value);
  return response;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") return redirectToDefaultLocale(request);
  const retiredContact = redirectRetiredContact(request);
  if (retiredContact) return retiredContact;
  if (!request.cookies.getAll().some(({ name }) => name === sessionCookie || name.startsWith(sessionCookie + "."))) return NextResponse.next();
  let response = NextResponse.next({ request });
  try {
    const auth = authClient({
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
        response.headers.set("Cache-Control", "private, no-store");
      },
    });
    const { error } = await auth.auth.getUser();
    if (isAuthTransportError(error)) return continueWithoutSession();
  } catch (error) {
    if (isAuthTransportError(error)) return continueWithoutSession();
    throw error;
  }
  return response;
}

export const config = { matcher: ["/", "/ka/:path*", "/en/:path*", "/api/media/:path*"] };
