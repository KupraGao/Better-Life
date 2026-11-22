import { notFound } from "next/navigation";
import { isLocale } from "@/i18n";
import { requireUser } from "@/modules/identity/session";
import { logout } from "@/modules/identity/actions";
import { identityMessages } from "@/modules/identity/messages";
import styles from "@/modules/identity/identity.module.css";

export default async function Account({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(locale);
  const t = identityMessages[locale];
  return <main id="main" tabIndex={-1} className={styles.region}><section className={styles.panel}>
    <p className="eyebrow"><span className="kicker-rule" />{t.section}</p>
    <h1>{user.displayName}</h1><p>{t.roles[user.role]}</p>
    <div className={styles.form}>
      <a className="button primary-button" href={`/${locale}/dashboard`}>{t.dashboard}</a>
      {user.role !== "STUDENT" && <a className="button secondary-button" href={`/${locale}/manage`}>{t.manage}</a>}
      <form action={logout.bind(null, locale)}><button className="button secondary-button">{t.logout}</button></form>
    </div>
  </section></main>;
}
