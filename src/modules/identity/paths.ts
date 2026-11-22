import { isLocale, type Locale } from "@/i18n";

export function returnPath(locale: Locale, value: unknown) {
  if (!isLocale(locale)) return "/ka/dashboard";
  const fallback = `/${locale}/dashboard`;
  if (typeof value !== "string" || value.length > 1000 || !value.startsWith(`/${locale}/`)) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  let target: URL;
  try {
    target = new URL(value, "https://app.invalid");
  } catch {
    return fallback;
  }
  if (target.origin !== "https://app.invalid" || !target.pathname.startsWith(`/${locale}/`)) return fallback;
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(target.pathname);
  } catch {
    return fallback;
  }
  if (!decodedPath.startsWith(`/${locale}/`) || decodedPath.includes("\\") || decodedPath.includes("//") || /[\u0000-\u001f\u007f]/.test(decodedPath)) {
    return fallback;
  }
  try {
    const decoded = new URL(decodedPath, "https://app.invalid");
    if (decoded.origin !== "https://app.invalid" || !decoded.pathname.startsWith(`/${locale}/`)) return fallback;
  } catch {
    return fallback;
  }
  const safe = `${target.pathname}${target.search}${target.hash}`;
  if (!safe.startsWith(`/${locale}/`) || safe.includes("\\") || /[\u0000-\u001f\u007f]/.test(safe)) return fallback;
  return safe;
}
