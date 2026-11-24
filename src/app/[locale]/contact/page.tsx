import { notFound, permanentRedirect } from "next/navigation";
import { isLocale } from "@/i18n";

type RouteProps = { params: Promise<{ locale: string }> };

export default async function ContactPage({ params }: RouteProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  permanentRedirect(`/${locale}#contact`);
}
