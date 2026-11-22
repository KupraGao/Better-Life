import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/i18n";
import { appOrigin } from "@/modules/identity/client";
import { returnPath } from "@/modules/identity/paths";
import { writableAuthClient } from "@/modules/identity/session";

export async function GET(request: NextRequest, { params }: RouteContext<"/[locale]/auth/callback">) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  const code = request.nextUrl.searchParams.get("code");
  const next = returnPath(locale, request.nextUrl.searchParams.get("next"));
  let target = `/${locale}/login?message=expired`;
  if (code) {
    const client = await writableAuthClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) target = next;
  }
  const response = NextResponse.redirect(new URL(target, appOrigin()), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
