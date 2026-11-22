"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMessages, localeFromPathname } from "@/i18n";
import styles from "@/modules/learning/learning.module.css";

export function LocaleStatus({ kind, onReset }: {
  kind: "loading" | "error" | "notFound";
  onReset?: () => void;
}) {
  const locale = localeFromPathname(usePathname());
  const text = getMessages(locale).status;
  const copy = {
    loading: { eyebrow: text.loadingEyebrow, title: text.loadingTitle, body: text.loadingBody },
    error: { eyebrow: text.errorEyebrow, title: text.errorTitle, body: text.errorBody },
    notFound: { eyebrow: text.notFoundEyebrow, title: text.notFoundTitle, body: text.notFoundBody },
  }[kind];
  return (
    <main id="main" tabIndex={-1} className={`container ${styles.page}`} aria-busy={kind === "loading" ? true : undefined}>
      <p className="eyebrow"><span className="kicker-rule" />{copy.eyebrow}</p>
      <header className={styles.heading}>
        <h1>{copy.title}</h1>
        <p role={kind === "error" ? "alert" : "status"}>{copy.body}</p>
      </header>
      {kind === "error" && onReset && (
        <button type="button" className="button primary-button" onClick={() => onReset()}>{text.retry}</button>
      )}
      {kind === "notFound" && <Link className="text-link" href={`/${locale}`}>{text.home}</Link>}
    </main>
  );
}
