import type { MetadataRoute } from "next";
import { publicOrigin } from "@/i18n";

export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin();
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(origin ? { sitemap: new URL("/sitemap.xml", origin).toString() } : {}),
  };
}
