import { NextResponse, type NextRequest } from "next/server";
import { authClient, sessionCookie } from "@/modules/identity/client";

export async function proxy(request: NextRequest) {
  if (!request.cookies.getAll().some(({ name }) => name === sessionCookie || name.startsWith(sessionCookie + "."))) return NextResponse.next();
  let response = NextResponse.next({ request });
  const auth = authClient({
    getAll: () => request.cookies.getAll(),
    setAll: (items) => {
      for (const { name, value } of items) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of items) response.cookies.set(name, value, options);
      response.headers.set("Cache-Control", "private, no-store");
    },
  });
  await auth.auth.getUser();
  return response;
}

export const config = { matcher: ["/ka/:path*", "/en/:path*", "/api/media/:path*"] };
