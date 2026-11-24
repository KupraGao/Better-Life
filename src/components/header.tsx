import { getMessages, getPublicLinks, type Locale } from "@/i18n";
import { identityMessages } from "@/modules/identity/messages";
import { logout } from "@/modules/identity/actions";
import { getCurrentUser } from "@/modules/identity/session";
import { learningLabels } from "@/modules/learning/labels";
import { HeaderNavigation } from "./header-navigation";

export async function Header({ locale }: { locale: Locale }) {
  const user = await getCurrentUser();
  const messages = getMessages(locale);
  const nav = messages.nav;
  const programmes = messages.services.items;
  const publicLinks = getPublicLinks(locale);
  const identity = identityMessages[locale];
  const learning = learningLabels[locale];
  const home = `/${locale}`;
  return (
    <HeaderNavigation
      locale={locale}
      nav={nav}
      viewer={user ? { name: user.displayName, role: user.role } : null}
      links={{
        login: `${home}/login`,
        register: `${home}/register`,
        account: `${home}/account`,
        courses: `${home}/dashboard`,
        manage: `${home}/manage`,
      }}
      serviceLinks={[
        { href: publicLinks.courses, label: nav.courses },
        { href: publicLinks.books, label: nav.books },
        { href: publicLinks.teenagers, label: programmes[0].title },
        { href: publicLinks.adults, label: programmes[1].title },
        { href: publicLinks.companies, label: programmes[2].title },
      ]}
      pageLinks={{ about: publicLinks.about, contact: publicLinks.contact }}
      accountText={{
        menu: nav.account,
        login: identity.login,
        register: identity.register,
        account: learning.account,
        courses: learning.myCourses,
        manage: learning.manage,
        logout: identity.logout,
      }}
      logoutAction={logout.bind(null, locale)}
    />
  );
}
