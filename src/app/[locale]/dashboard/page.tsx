import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/modules/identity/session";
import { courseLocale, coursePath, learningLabels, lessonPath } from "@/modules/learning/labels";
import { Progress } from "@/modules/learning/progress";
import { myCourses } from "@/modules/learning/service";
import styles from "@/modules/learning/learning.module.css";

export const dynamic = "force-dynamic";

export default async function Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const locale = courseLocale((await params).locale);
  const text = learningLabels[locale];
  const user = await requireUser(locale);
  const courses = await myCourses(db, locale, user.id);
  const contentLocale = locale === "ka" ? "en" : "ka";
  const alternate = await myCourses(db, contentLocale, user.id);
  const seen = new Set(courses.map((course) => course.id));
  const missing = alternate.filter((course) => !seen.has(course.id));
  return (
    <main id="main" tabIndex={-1} className={`container ${styles.page}`}>
      <header className={styles.heading}>
        <p className={styles.meta}>{user.displayName}</p><h1>{text.dashboard}</h1>
        <div className={styles.actions}>
          <Link className="text-link" href={`/${locale}/account`}>{text.account}</Link>
          {user.role !== "STUDENT" && <Link className="text-link" href={`/${locale}/manage`}>{text.manage}</Link>}
        </div>
      </header>
      <h2 className={styles.sectionTitle}>{text.myCourses}</h2>
      {courses.length === 0 && missing.length === 0 ? <div className={styles.panel}>
        <p>{text.noEnrollments}</p><Link className="text-link" href={`/${locale}/courses`}>{text.browse} →</Link>
      </div> : <ul className={styles.grid}>
        {courses.map((course) => <li className={styles.card} key={course.id}>
          <h3><Link href={coursePath(locale, course.slug)}>{course.title}</Link></h3>
          <Progress locale={locale} completed={course.completed} total={course.total} />
          {course.nextLesson
            ? <Link className="text-link" href={lessonPath(locale, course.slug, course.nextLesson.id)}>{course.finished ? text.review : course.completed ? text.continue : text.start} →</Link>
            : <Link className="text-link" href={coursePath(locale, course.slug)}>{text.openCourse} →</Link>}
        </li>)}
        {missing.map((course) => <li className={styles.card} key={course.id}>
          <p className={styles.meta} role="status">{text.missingLanguage}</p>
          <h3><Link href={coursePath(locale, course.slug)}>{course.title}</Link></h3>
          <Link className="text-link" href={coursePath(contentLocale, course.slug)}>{text.openAvailable} →</Link>
        </li>)}
      </ul>}
    </main>
  );
}
