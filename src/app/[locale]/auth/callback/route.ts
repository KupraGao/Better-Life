import { NextResponse, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isLocale } from "@/i18n";
import { appOrigin, isAuthTransportError } from "@/modules/identity/client";
import { returnPath } from "@/modules/identity/paths";
import { writableAuthClient } from "@/modules/identity/session";

export async function GET(request: NextRequest, { params }: RouteContext<"/[locale]/auth/callback">) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  const code = request.nextUrl.searchParams.get("code");
  const next = returnPath(locale, request.nextUrl.searchParams.get("next"));
  const origin = appOrigin();
  let target = `/${locale}/login?message=expired`;
  if (code) {
    try {
      const client = await writableAuthClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (isAuthTransportError(error)) target = `/${locale}/login?message=unavailable`;
      else if (!error) target = next;
    } catch (error) {
      unstable_rethrow(error);
      if (!isAuthTransportError(error)) throw error;
      target = `/${locale}/login?message=unavailable`;
    }
  }
  let destination = new URL(target, origin);
  if (destination.origin !== origin || !destination.pathname.startsWith(`/${locale}/`)) {
    destination = new URL(`/${locale}/login?message=expired`, origin);
  }
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
