import Link from "next/link";
import { getMessages, type Locale } from "@/i18n";
import { RichText, LessonVideo } from "@/modules/catalog/lesson-content";
import type { AdminPreview as Preview } from "./service";
import styles from "./learning.module.css";

export function AdminPreview({ locale, course }: { locale: Locale; course: Preview }) {
  const { manage: t } = getMessages(locale);
  const editorHref = `/${locale}/manage/${course.id}`;
  const contentLocale = locale === "ka" ? "en" : "ka";
  const shownLocale = course.missingLanguage ? contentLocale : locale;
  const mediaHref = (id: string) => `/api/media/${id}?locale=${shownLocale}`;
  const courseStatus = course.published ? t.published : t.draft;
  return (
    <main id="main" tabIndex={-1} className={`container ${styles.page}`}>
      <Link className={styles.back} href={editorHref}>← {t.previewBack}</Link>
      <p className={styles.meta} role="status">{t.previewBanner}</p>
      <header className={styles.heading}>
        {course.coverImage?.startsWith("https://") && (
          // The address is chosen by an administrator and is not on an image allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.cover} src={course.coverImage} alt="" />
        )}
        {course.missingLanguage && <p className={styles.meta} role="status">{t.missingLanguage}</p>}
        <p className={styles.meta}>{courseStatus}</p>
        <h1>{course.title}</h1>
      </header>
      <div className={styles.columns}>
        <div>
          <div className={styles.description}><RichText value={course.description} /></div>
          {course.modules.length === 0 ? <p>{t.emptyModules}</p> : course.modules.map((courseModule) => (
            <section className={styles.module} key={courseModule.id}>
              <h2 className={styles.sectionTitle}>
                {courseModule.title}
                {courseModule.fallback ? <small> {t.missingLanguage}</small> : null}
              </h2>
              {courseModule.lessons.map((lesson) => {
                const images = lesson.assets.filter((asset) => asset.kind === "IMAGE");
                const files = lesson.assets.filter((asset) => asset.kind === "ATTACHMENT");
                return (
                  <article className={styles.body} id={`lesson-${lesson.id}`} key={lesson.id}>
                    <h3>{lesson.title}</h3>
                    <p className={styles.meta}>{lesson.published ? t.published : t.previewHidden}</p>
                    <LessonVideo source={lesson.videoSource} reference={lesson.videoRef} title={lesson.title || undefined} />
                    <RichText value={lesson.body} />
                    {images.map((asset) => <figure key={asset.id}>
                      {/* Native requests carry the viewer's session to the permission-checked media route. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaHref(asset.id)} alt={asset.name} loading="lazy" />
                    </figure>)}
                    {files.length > 0 && <section className={styles.files}><h3>{t.files}</h3><ul>
                      {files.map((file) => <li key={file.id}><a href={mediaHref(file.id)} download>{file.name}</a></li>)}
                    </ul></section>}
                  </article>
                );
              })}
            </section>
          ))}
        </div>
        <aside className={styles.panel}>
          <p role="status">{t.previewBanner}</p>
          <p className={styles.meta}>{courseStatus}</p>
          <Link className="text-link" href={editorHref}>{t.previewBack}</Link>
          {course.modules.map((courseModule) => (
            <section className={styles.module} key={courseModule.id}>
              <h3>
                {courseModule.title}
                {courseModule.fallback ? <small> {t.missingLanguage}</small> : null}
              </h3>
              <ol>
                {courseModule.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <a href={`#lesson-${lesson.id}`}>{lesson.title}</a>
                    <small>{lesson.published ? t.published : t.previewHidden}</small>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </aside>
      </div>
    </main>
  );
}
