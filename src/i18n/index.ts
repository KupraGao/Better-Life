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

/** Public destinations checked against the original academy navigation. */
export function getPublicLinks(locale: Locale) {
  const home = locale === "ka" ? "https://betterlife.ge/" : "https://betterlife.ge/en/";
  return {
    home,
    services: home + "#services",
    courses: home + "courses/",
    books: home + "product-category/e-book/",
    about: home + "ჩემს-შესახებ/",
    contact: home + "#contact",
    register: home + "student-registration/",
    dyslexia: home + "courses/დისლექსია/",
    email: "mailto:info.hibetterlife@gmail.com",
    phone: "tel:+995511777165",
    privacy: home + "კონფიდენციალურობის-პოლი/",
    terms: home + "სერვისის-გამოყენების-პირ/",
    refund: home + "გადახდისა-და-თანხის-დაბრ/"
  };
}

export const publicLinks = getPublicLinks(defaultLocale);
