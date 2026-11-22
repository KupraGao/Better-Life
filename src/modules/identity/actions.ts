"use server";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/i18n";
import { writableAuthClient } from "./session";
import { appOrigin } from "./client";
import { returnPath } from "./paths";

export type AuthMode = "login" | "register" | "forgot-password" | "reset-password";

function result(locale: Locale, mode: AuthMode, message: string, next: string): never {
  redirect(`/${locale}/${mode}?${new URLSearchParams({ message, next })}`);
}

export async function submitAuth(locale: Locale, mode: AuthMode, form: FormData) {
  if (!isLocale(locale) || !["login", "register", "forgot-password", "reset-password"].includes(mode)) throw new Error("Invalid form");
  const next = returnPath(locale, form.get("next"));
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const name = String(form.get("displayName") || "").trim();
  if (mode !== "reset-password" && (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254)) result(locale, mode, "invalid", next);
  if (mode === "register" && (!name || name.length > 90)) result(locale, mode, "invalid", next);
  if (mode !== "forgot-password" && (!password || password.length > 128)) result(locale, mode, "invalid", next);
  if ((mode === "register" || mode === "reset-password") && password.length < 10) result(locale, mode, "short", next);
  const client = await writableAuthClient();
  const callback = new URL(`/${locale}/auth/callback`, appOrigin());
  callback.searchParams.set("next", mode === "forgot-password" ? `/${locale}/reset-password` : next);

  if (mode === "forgot-password") {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callback.href });
    if (error && (error.status === 429 || (error.status ?? 0) >= 500)) result(locale, mode, "unavailable", next);
    result(locale, mode, "sent", next);
  }
  if (mode === "register") {
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { displayName: name }, emailRedirectTo: callback.href } });
    if (error) result(locale, mode, error.status === 429 ? "unavailable" : "registerFailed", next);
    if (!data.session) result(locale, mode, "confirm", next);
  } else if (mode === "login") {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) result(locale, mode, error.code === "email_not_confirmed" ? "confirm" : "loginFailed", next);
  } else {
    const { data } = await client.auth.getUser();
    if (!data.user) result(locale, "forgot-password", "expired", next);
    const { error } = await client.auth.updateUser({ password });
    if (error) result(locale, mode, "passwordFailed", next);
    await client.auth.signOut({ scope: "global" });
    result(locale, "login", "changed", next);
  }
  redirect(next);
}

export async function logout(locale: Locale) {
  if (!isLocale(locale)) throw new Error("Invalid language");
  const client = await writableAuthClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("Sign out failed");
  redirect(`/${locale}/login`);
}
