import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { getMessages } from "@/i18n";
import { getCurrentUser } from "@/modules/identity/session";
import { RichText, LessonVideo } from "@/modules/catalog/lesson-content";
import { completeAction } from "@/modules/learning/actions";
import { courseLocale, coursePath, learningLabels, lessonPath } from "@/modules/learning/labels";
import { Progress } from "@/modules/learning/progress";
import { canonicalSlug, readLesson } from "@/modules/learning/service";
import { Syllabus } from "@/modules/learning/syllabus";
import styles from "@/modules/learning/learning.module.css";

export const dynamic = "force-dynamic";

export default async function Lesson({ params }: { params: Promise<{ locale: string; slug: string; itemId: string }> }) {
  const route = await params;
  const locale = courseLocale(route.locale);
  const text = learningLabels[locale];
  const pending = getMessages(locale).forms.pending;
  const user = await getCurrentUser();
  const actorId = user?.id ?? null;
  const canonical = await canonicalSlug(db, route.slug);
  if (canonical && canonical !== route.slug) redirect(lessonPath(locale, canonical, route.itemId));
  const contentLocale = locale === "ka" ? "en" : "ka";
  const requested = await db.$transaction(
    (tx) => readLesson(tx, locale, route.slug, route.itemId, actorId), { isolationLevel: "RepeatableRead" }
  );
  const lesson = requested ?? await db.$transaction(
    (tx) => readLesson(tx, contentLocale, route.slug, route.itemId, actorId), { isolationLevel: "RepeatableRead" }
  );
  if (!lesson) notFound();
  const missingLanguage = !requested;
  const shownLocale = missingLanguage ? contentLocale : locale;
  const { course, current, assets } = lesson;
  const courseUrl = coursePath(locale, course.slug);
  const mediaHref = (id: string) => `/api/media/${id}?locale=${shownLocale}`;
  const images = assets.filter((asset) => asset.kind === "IMAGE");
  const files = assets.filter((asset) => asset.kind === "ATTACHMENT");
  return (
    <main id="main" tabIndex={-1} className={`container ${styles.page}`}>
      <Link className={styles.back} href={courseUrl}>← {course.title}</Link>
      <header className={styles.heading}>
        {missingLanguage && <p className={styles.meta} role="status">{text.missingLanguage}</p>}
        <h1>{current.title}</h1>
      </header>
      <div className={styles.columns}>
        <article className={styles.body}>
          <LessonVideo source={lesson.videoSource} reference={lesson.videoRef} />
          <RichText value={lesson.body} />
          {images.map((asset) => <figure key={asset.id}>
            {/* Native requests carry the viewer's session to the permission-checked media route. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaHref(asset.id)} alt={asset.name} loading="lazy" />
          </figure>)}
          {files.length > 0 && <section className={styles.files}><h2>{text.files}</h2><ul>
            {files.map((file) => <li key={file.id}><a href={mediaHref(file.id)} download>{file.name}</a></li>)}
          </ul></section>}
          <h2 className={styles.sectionTitle}>{text.syllabus}</h2>
          <Syllabus locale={locale} slug={course.slug} modules={course.modules} enrolled={course.enrolled} total={course.total} currentId={current.completed ? undefined : current.id} />
        </article>
        <aside className={styles.panel}>
          {missingLanguage ? <>
            <p role="status">{text.missingLanguage}</p>
            <Link className="text-link" href={lessonPath(contentLocale, course.slug, current.id)}>{text.openAvailable}</Link>
          </> : course.enrolled ? <>
            <Progress locale={locale} completed={course.completed} total={course.total} />
            {!current.completed
              ? <form action={completeAction.bind(null, locale, course.slug, current.id)}><SubmitButton className="button primary-button" pending={pending}>{text.complete}</SubmitButton></form>
              : <p className={styles.complete}>✓ {text.done}</p>}
            {lesson.next && <Link className="text-link" href={lessonPath(locale, course.slug, lesson.next.id)}>{text.next} →</Link>}
            {course.finished && <Link className="text-link" href={`/${locale}/dashboard`}>{text.dashboard}</Link>}
          </> : <><p>{text.previewNote}</p><Link className="text-link" href={courseUrl}>{text.returnCourse}</Link></>}
        </aside>
      </div>
    </main>
  );
}
