import type { Locale } from "@/i18n";

export function returnPath(locale: Locale, value: unknown) {
  const fallback = `/${locale}/dashboard`;
  if (typeof value !== "string" || value.length > 1000 || !value.startsWith(`/${locale}/`)) return fallback;
  if (/[\\\u0000-\u001f]/.test(value)) return fallback;
  const target = new URL(value, "https://app.invalid");
  if (target.origin !== "https://app.invalid" || !target.pathname.startsWith(`/${locale}/`)) return fallback;
  return target.pathname + target.search + target.hash;
}
