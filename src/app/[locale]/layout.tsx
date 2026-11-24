import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { getMessages, isLocale, locales, publicOrigin } from "@/i18n";
import "../globals.css";
import "../scroll.css";

type RouteProps = { params: Promise<{ locale: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { title, description } = getMessages(locale).meta;
  const origin = publicOrigin();
  return {
    ...(origin ? { metadataBase: origin } : {}),
    title: { default: title, template: `%s | ${title}` },
    description,
    alternates: {
      canonical: "./",
      languages: { ka: "/ka", en: "/en", "x-default": "/ka" },
    },
    icons: { icon: "/brand/logo.png" },
  };
}

export default async function Layout({ children, params }: RouteProps & { children: React.ReactNode }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <body>
        <Header locale={locale} />
        {children}
        <Footer locale={locale} />
      </body>
    </html>
  );
}
