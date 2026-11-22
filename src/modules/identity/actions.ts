"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { isLocale, type Locale } from "@/i18n";
import { writableAuthClient } from "./session";
import { appOrigin, isAuthTransportError } from "./client";
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

  let outcome: { mode: AuthMode; message: string } | null = null;
  try {
    if (mode === "forgot-password") {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callback.href });
      outcome = { mode, message: isAuthTransportError(error) ? "unavailable" : "sent" };
    } else if (mode === "register") {
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { displayName: name }, emailRedirectTo: callback.href } });
      if (isAuthTransportError(error)) outcome = { mode, message: "unavailable" };
      else if (error) outcome = { mode, message: "registerFailed" };
      else if (!data.session) outcome = { mode, message: "confirm" };
    } else if (mode === "login") {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (isAuthTransportError(error)) outcome = { mode, message: "unavailable" };
      else if (error) outcome = { mode, message: error.code === "email_not_confirmed" ? "confirm" : "loginFailed" };
    } else {
      const { data, error: sessionError } = await client.auth.getUser();
      if (isAuthTransportError(sessionError)) outcome = { mode, message: "unavailable" };
      else if (!data.user) outcome = { mode: "forgot-password", message: "expired" };
      else {
        const { error } = await client.auth.updateUser({ password });
        if (isAuthTransportError(error)) outcome = { mode, message: "unavailable" };
        else if (error) outcome = { mode, message: "passwordFailed" };
        else {
          const signedOut = await client.auth.signOut({ scope: "global" });
          outcome = isAuthTransportError(signedOut.error)
            ? { mode, message: "unavailable" }
            : { mode: "login", message: "changed" };
        }
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    if (!isAuthTransportError(error)) throw error;
    outcome = { mode, message: "unavailable" };
  }
  if (outcome) result(locale, outcome.mode, outcome.message, next);
  redirect(next);
}

export async function logout(locale: Locale) {
  if (!isLocale(locale)) throw new Error("Invalid language");
  const client = await writableAuthClient();
  let transport = false;
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (isAuthTransportError(error)) transport = true;
    else if (error) throw new Error("Sign out failed");
  } catch (error) {
    unstable_rethrow(error);
    if (!isAuthTransportError(error)) throw error;
    transport = true;
  }
  redirect(transport ? `/${locale}/login?message=unavailable` : `/${locale}/login`);
}
