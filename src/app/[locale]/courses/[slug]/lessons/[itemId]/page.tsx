import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/modules/identity/session";
import { RichText, LessonVideo } from "@/modules/catalog/lesson-content";
import { completeAction } from "@/modules/learning/actions";
import { courseLocale, coursePath, learningLabels, lessonPath } from "@/modules/learning/labels";
import { Progress } from "@/modules/learning/progress";
import { readLesson } from "@/modules/learning/service";
import styles from "@/modules/learning/learning.module.css";

export const dynamic = "force-dynamic";

export default async function Lesson({ params }: { params: Promise<{ locale: string; slug: string; itemId: string }> }) {
  const route = await params;
  const locale = courseLocale(route.locale);
  const text = learningLabels[locale];
  const user = await getCurrentUser();
  const lesson = await db.$transaction(
    (tx) => readLesson(tx, locale, route.slug, route.itemId, user?.id ?? null), { isolationLevel: "RepeatableRead" }
  );
  if (!lesson) notFound();
  const { course, current, assets } = lesson;
  const courseUrl = coursePath(locale, course.slug);
  const mediaHref = (id: string) => `/api/media/${id}?locale=${locale}`;
  const images = assets.filter((asset) => asset.kind === "IMAGE");
  const files = assets.filter((asset) => asset.kind === "ATTACHMENT");
  return (
    <main id="main" tabIndex={-1} className={`container ${styles.page}`}>
      <Link className={styles.back} href={courseUrl}>← {course.title}</Link>
      <header className={styles.heading}><h1>{current.title}</h1></header>
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
        </article>
        <aside className={styles.panel}>
          {course.enrolled ? <>
            <Progress locale={locale} completed={course.completed} total={course.total} />
            {!current.completed
              ? <form action={completeAction.bind(null, locale, course.slug, current.id)}><button className="button primary-button">{text.complete}</button></form>
              : <p className={styles.complete}>✓ {text.done}</p>}
            {lesson.next && <Link className="text-link" href={lessonPath(locale, course.slug, lesson.next.id)}>{text.next} →</Link>}
            {course.finished && <Link className="text-link" href={`/${locale}/dashboard`}>{text.dashboard}</Link>}
          </> : <><p>{text.previewNote}</p><Link className="text-link" href={courseUrl}>{text.returnCourse}</Link></>}
        </aside>
      </div>
    </main>
  );
}
