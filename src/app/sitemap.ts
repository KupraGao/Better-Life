import type { MetadataRoute } from "next";
import { locales, publicOrigin } from "@/i18n";

const paths = ["", "/courses", "/login", "/register", "/forgot-password", "/reset-password"] as const;

function location(origin: URL | null, path: string) {
  return origin ? new URL(path, origin).toString() : path;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin();
  return locales.flatMap((locale) => paths.map((path) => ({
    url: location(origin, `/${locale}${path}`),
    changeFrequency: path === "" ? "weekly" as const : "monthly" as const,
    priority: path === "" ? 1 : path === "/courses" ? 0.8 : 0.4,
  })));
}
