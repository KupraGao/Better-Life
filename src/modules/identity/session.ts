import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { db } from "@/lib/db";
import type { Locale } from "@/i18n";
import { authClient, isAuthTransportError, sessionCookie } from "./client";

export async function writableAuthClient() {
  const jar = await cookies();
  return authClient({
    getAll: () => jar.getAll(),
    setAll: (items) => { for (const { name, value, options } of items) jar.set(name, value, options); },
  });
}

export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  if (!jar.getAll().some(({ name }) => name === sessionCookie || name.startsWith(sessionCookie + "."))) return null;
  const auth = authClient({ getAll: () => jar.getAll(), setAll: () => {} });
  let user;
  try {
    const result = await auth.auth.getUser();
    if (result.error || !result.data.user) return null;
    user = result.data.user;
  } catch (error) {
    unstable_rethrow(error);
    if (isAuthTransportError(error)) return null;
    throw error;
  }
  const displayName = typeof user.user_metadata?.displayName === "string" ? user.user_metadata.displayName.trim().slice(0, 90) : "";
  const select = { id: true, displayName: true, role: true } as const;
  const profile = await db.appUser.findUnique({ where: { id: user.id }, select });
  if (profile) return profile;
  // Profile roles come exclusively from the database default or an operator grant.
  await db.appUser.createMany({ data: [{ id: user.id, displayName: displayName || user.email?.split("@")[0] || "Student" }], skipDuplicates: true });
  return db.appUser.findUniqueOrThrow({ where: { id: user.id }, select });
});

export async function requireUser(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}
