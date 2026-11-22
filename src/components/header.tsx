import { getMessages, getPublicLinks, type Locale } from "@/i18n";
import { HeaderNavigation } from "./header-navigation";

export function Header({ locale }: { locale: Locale }) {
  return (
    <HeaderNavigation
      locale={locale}
      nav={getMessages(locale).nav}
      registerHref={getPublicLinks(locale).register}
    />
  );
}
