import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/modules/identity/session";
import { RichText } from "@/modules/catalog/lesson-content";
import { enrollAction } from "@/modules/learning/actions";
import { courseLocale, coursePath, learningLabels, lessonPath } from "@/modules/learning/labels";
import { Progress } from "@/modules/learning/progress";
import { readCourse } from "@/modules/learning/service";
import styles from "@/modules/learning/learning.module.css";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const route = await params;
  const locale = courseLocale(route.locale);
  const text = learningLabels[locale];
  const actor = await getCurrentUser();
  const course = await readCourse(db, locale, route.slug, actor?.id ?? null);
  if (!course) notFound();
  const path = coursePath(locale, course.slug);
  return (
    <main id="main" tabIndex={-1} className={`container ${styles.page}`}>
      <Link className={styles.back} href={`/${locale}/courses`}>← {text.catalog}</Link>
      <header className={styles.heading}><p className={styles.meta}>{course.freeEnrollment ? text.free : text.assigned}</p><h1>{course.title}</h1></header>
      <div className={styles.columns}>
        <div>
          <div className={styles.description}><RichText value={course.description} /></div>
          <h2 className={styles.sectionTitle}>{text.syllabus}</h2>
          {course.total === 0 && <p>{text.emptySyllabus}</p>}
          {course.modules.map((module) => <section className={styles.module} key={module.id}>
            <h3>{module.title}</h3>
            <ol>{module.lessons.map((item) => <li key={item.id}>
              {item.accessible ? <Link href={lessonPath(locale, course.slug, item.id)}>{item.title}</Link> : <span>{item.title}</span>}
              <small>{item.completed ? text.done : !item.accessible ? text.unavailable : !course.enrolled && item.preview ? text.preview : ""}</small>
            </li>)}</ol>
          </section>)}
        </div>
        <aside className={styles.panel}>
          {course.enrolled ? <>
            <Progress locale={locale} completed={course.completed} total={course.total} />
            {course.nextLesson && <Link className="button primary-button" href={lessonPath(locale, course.slug, course.nextLesson.id)}>{course.finished ? text.review : course.completed ? text.continue : text.start}</Link>}
            <Link className="text-link" href={`/${locale}/dashboard`}>{text.dashboard}</Link>
          </> : course.freeEnrollment ? <>
            <p className={styles.count}>{text.lessons} · {course.total}</p>
            {actor
              ? <form action={enrollAction.bind(null, locale, course.slug)}><button className="button primary-button">{text.enroll}</button></form>
              : <Link className="button primary-button" href={`/${locale}/login?next=${encodeURIComponent(path)}`}>{text.loginToEnroll}</Link>}
          </> : <><p>{text.invitation}</p><Link className="text-link" href={`/${locale}#contact`}>{text.contact}</Link></>}
        </aside>
      </div>
    </main>
  );
}
