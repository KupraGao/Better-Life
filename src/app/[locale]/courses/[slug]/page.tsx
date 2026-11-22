import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { getMessages } from "@/i18n";
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
  const pending = getMessages(locale).forms.pending;
  const actor = await getCurrentUser();
  const actorId = actor?.id ?? null;
  const requested = await readCourse(db, locale, route.slug, actorId);
  const contentLocale = locale === "ka" ? "en" : "ka";
  const course = requested ?? await readCourse(db, contentLocale, route.slug, actorId);
  if (!course) notFound();
  const missingLanguage = !requested;
  const path = coursePath(locale, course.slug);
  return (
    <main id="main" tabIndex={-1} className={`container ${styles.page}`}>
      <Link className={styles.back} href={`/${locale}/courses`}>← {text.catalog}</Link>
      <header className={styles.heading}>
        {missingLanguage && <p className={styles.meta} role="status">{text.missingLanguage}</p>}
        <p className={styles.meta}>{course.freeEnrollment ? text.free : text.assigned}</p>
        <h1>{course.title}</h1>
      </header>
      <div className={styles.columns}>
        <div>
          <div className={styles.description}><RichText value={course.description} /></div>
          <h2 className={styles.sectionTitle}>{text.syllabus}</h2>
          {course.total === 0 && <p>{text.emptySyllabus}</p>}
          {course.modules.map((courseModule) => <section className={styles.module} key={courseModule.id}>
            <h3>{courseModule.title}{courseModule.fallback ? <small> {text.missingLanguage}</small> : null}</h3>
            <ol>{courseModule.lessons.map((item) => <li key={item.id}>
              {item.accessible ? <Link href={lessonPath(locale, course.slug, item.id)}>{item.title}</Link> : <span>{item.title}</span>}
              <small>{item.completed ? text.done : !item.accessible ? text.unavailable : !course.enrolled && item.preview ? text.preview : ""}</small>
            </li>)}</ol>
          </section>)}
        </div>
        <aside className={styles.panel}>
          {missingLanguage ? <>
            <p role="status">{text.missingLanguage}</p>
            <Link className="text-link" href={coursePath(contentLocale, course.slug)}>{text.openAvailable}</Link>
          </> : course.enrolled ? <>
            <Progress locale={locale} completed={course.completed} total={course.total} />
            {course.nextLesson && <Link className="button primary-button" href={lessonPath(locale, course.slug, course.nextLesson.id)}>{course.finished ? text.review : course.completed ? text.continue : text.start}</Link>}
            <Link className="text-link" href={`/${locale}/dashboard`}>{text.dashboard}</Link>
          </> : course.freeEnrollment ? <>
            <p className={styles.count}>{text.lessons} · {course.total}</p>
            {actor
              ? <form action={enrollAction.bind(null, locale, course.slug)}><SubmitButton className="button primary-button" pending={pending}>{text.enroll}</SubmitButton></form>
              : <Link className="button primary-button" href={`/${locale}/login?next=${encodeURIComponent(path)}`}>{text.loginToEnroll}</Link>}
          </> : <><p>{text.invitation}</p><Link className="text-link" href={`/${locale}#contact`}>{text.contact}</Link></>}
        </aside>
      </div>
    </main>
  );
}
