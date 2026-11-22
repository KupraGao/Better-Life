import en from "../../messages/en.json";
import ka from "../../messages/ka.json";

export const locales = ["ka", "en"] as const;
export type Locale = (typeof locales)[number];
export type Messages = typeof ka;
export const defaultLocale: Locale = "ka";

const messages: Record<Locale, Messages> = { ka, en };

export function isLocale(value: string): value is Locale {
  return value === "ka" || value === "en";
}

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}

/** In-app destinations. Privacy, terms and refund have no pages here, so they return home. */
export function getPublicLinks(locale: Locale) {
  const home = `/${locale}`;
  return {
    home,
    services: `${home}#programmes`,
    courses: `${home}/courses`,
    books: `${home}#books`,
    about: `${home}#about`,
    contact: `${home}#contact`,
    register: `${home}/register`,
    dyslexia: `${home}/courses`,
    email: "mailto:info.hibetterlife@gmail.com",
    phone: "tel:+995511777165",
    privacy: home,
    terms: home,
    refund: home
  };
}

/** Absolute origin for metadata. Empty or invalid APP_ORIGIN yields null and never throws. */
export function publicOrigin(): URL | null {
  const raw = process.env.APP_ORIGIN?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
  url.search = "";
  url.hash = "";
  return url;
}

export function localeFromPathname(pathname: string | null | undefined): Locale {
  const segment = pathname?.split("/")[1];
  return segment && isLocale(segment) ? segment : defaultLocale;
}

/** Replace only a real ka/en prefix. Any other path keeps its tail. */
export function swapLocalePath(pathname: string, nextLocale: Locale) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const segments = path.split("/");
  if (segments[1] === "ka" || segments[1] === "en") {
    segments[1] = nextLocale;
    return segments.join("/") || `/${nextLocale}`;
  }
  return `/${nextLocale}${path === "/" ? "" : path}`;
}

export const publicLinks = getPublicLinks(defaultLocale);
