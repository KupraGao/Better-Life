import en from "../../../messages/learning/en.json";
import ka from "../../../messages/learning/ka.json";
import { isLocale, type Locale } from "@/i18n";
import { notFound } from "next/navigation";

export const learningLabels: Record<Locale, typeof ka> = { ka, en };

export function courseLocale(value: string) {
  if (!isLocale(value)) notFound();
  return value;
}

export function coursePath(locale: Locale, slug: string) {
  return `/${locale}/courses/${encodeURIComponent(slug)}`;
}

export function lessonPath(locale: Locale, slug: string, id: string) {
  return `${coursePath(locale, slug)}/lessons/${encodeURIComponent(id)}`;
}
