import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n";
import { submitAuth, type AuthMode } from "@/modules/identity/actions";
import { identityMessages } from "@/modules/identity/messages";
import { returnPath } from "@/modules/identity/paths";
import { getCurrentUser } from "@/modules/identity/session";
import styles from "@/modules/identity/identity.module.css";

const screens: AuthMode[] = ["register", "login", "forgot-password", "reset-password"];

export default async function IdentityPage({ params, searchParams }: PageProps<"/[locale]/[screen]">) {
  const { locale, screen } = await params;
  if (!isLocale(locale) || !screens.includes(screen as AuthMode)) notFound();
  const mode = screen as AuthMode;
  const t = identityMessages[locale];
  const search = await searchParams;
  const next = returnPath(locale, search.next);
  const user = await getCurrentUser();
  if (mode === "reset-password" && !user) redirect(`/${locale}/forgot-password?message=expired`);
  if ((mode === "login" || mode === "register") && user) redirect(next);
  const key = typeof search.message === "string" && Object.hasOwn(t.messages, search.message) ? search.message as keyof typeof t.messages : null;
  const switchTo = (name: AuthMode) => `/${locale}/${name}?next=${encodeURIComponent(next)}`;
  return (
    <main id="main" tabIndex={-1} className={styles.region}>
      <section className={styles.panel}>
        <p className="eyebrow"><span className="kicker-rule" />{t.section}</p>
        <h1>{t[mode]}</h1><p className={styles.intro}>{t.intro[mode]}</p>
        {key && <p className={styles.feedback} role="status">{t.messages[key]}</p>}
        <form action={submitAuth.bind(null, locale, mode)} className={styles.form}>
          <input type="hidden" name="next" value={next} />
          {mode === "register" && <label>{t.displayName}<input name="displayName" autoComplete="name" maxLength={90} required /></label>}
          {mode !== "reset-password" && <label>{t.email}<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>}
          {mode !== "forgot-password" &&
            <label>{t.password}<input type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 10} maxLength={128} required />
              {mode !== "login" && <small>{t.hint}</small>}
            </label>}
          <button type="submit" className="button primary-button">{t.submit[mode]}</button>
        </form>
        <div className={styles.links}>
          {mode === "login" && <a href={switchTo("forgot-password")}>{t["forgot-password"]}</a>}
          {mode === "login" ? <p>{t.noAccount} <a href={switchTo("register")}>{t.register}</a></p> :
            <p>{mode === "register" && t.existing} <a href={switchTo("login")}>{t.login}</a></p>}
        </div>
      </section>
    </main>
  );
}
