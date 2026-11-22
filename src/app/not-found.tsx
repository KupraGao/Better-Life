import type { Metadata } from "next";
import Link from "next/link";
import { getMessages } from "@/i18n";
import "./globals.css";
import styles from "@/modules/learning/learning.module.css";

export const metadata: Metadata = {
  title: "ვერ მოიძებნა",
  description: "ეს გვერდი არ არსებობს.",
};

export default function NotFound() {
  const ka = getMessages("ka").status;
  const en = getMessages("en").status;
  return (
    <html lang="ka">
      <body>
        <main id="main" tabIndex={-1} className={`container ${styles.page}`}>
          <p className="eyebrow"><span className="kicker-rule" />{ka.notFoundEyebrow}</p>
          <header className={styles.heading}>
            <h1>{ka.notFoundTitle}</h1>
            <p role="status">{ka.notFoundBody}</p>
          </header>
          <p><Link className="text-link" href="/ka">{ka.home}</Link></p>
          <p lang="en">{en.notFoundTitle}. <Link className="text-link" href="/en">{en.home}</Link></p>
        </main>
      </body>
    </html>
  );
}
