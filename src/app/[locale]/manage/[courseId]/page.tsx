import Link from "next/link";
import { notFound } from "next/navigation";
import { getMessages, isLocale } from "@/i18n";
import { db } from "@/lib/db";
import { authorScope, isId, moduleTitles } from "@/modules/catalog/manage";
import { authorText, videoUrl } from "@/modules/catalog/content";
import { requireUser } from "@/modules/identity/session";
import { editCourse } from "../actions";
import { Move, Notice } from "../shared";
import styles from "../manage.module.css";

export default async function CourseEditor({ params, searchParams }: {
  params: Promise<{ locale: string; courseId: string }>;
  searchParams: Promise<{ edit?: string; notice?: string }>;
}) {
  const { locale, courseId } = await params;
  if (!isLocale(locale) || !isId(courseId)) notFound();
  const actor = await requireUser(locale);
  if (actor.role === "STUDENT") notFound();
  const args = await searchParams;
  const edit = args.edit && isLocale(args.edit) ? args.edit : locale;
  const { manage: t } = getMessages(locale);
  const course = await db.course.findFirst({
    where: { ...authorScope(actor), id: courseId },
    select: {
      slug: true, published: true, freeEnrollment: true, translations: true,
      modules: { where: { archivedAt: null }, orderBy: { position: "asc" }, select: {
        id: true, titles: true, items: { where: { kind: "LESSON", archivedAt: null }, orderBy: { position: "asc" },
          select: { id: true, videoSource: true, videoRef: true, published: true, preview: true, translations: true,
            assets: { select: { id: true, name: true } } } },
      } },
    },
  });
  if (!course) notFound();
  const isAdmin = actor.role === "ADMIN";
  const people = isAdmin ? await db.appUser.findMany({
    select: { id: true, displayName: true, role: true,
      teaching: { where: { courseId }, select: { courseId: true } },
      enrollments: { where: { courseId }, select: { courseId: true } },
    }, orderBy: [{ displayName: "asc" }, { id: "asc" }],
  }) : [];
  const translation = course.translations.find((row) => row.locale === edit);
  const title = course.translations.find((row) => row.locale === locale)?.title ?? course.translations[0]?.title ?? course.slug;
  const path = `/${locale}/manage/${courseId}`;
  const action = (intent: string) => editCourse.bind(null, locale, courseId, edit, intent);

  return <main id="main" tabIndex={-1} className={`container ${styles.workspace}`}>
    <Link className={styles.back} href={`/${locale}/manage`}>← {t.all}</Link>
    <h1>{title}</h1>
    <div className={styles.toolbar}>
      <span className={styles.state}>{course.published ? t.published : t.draft}</span>
      <form action={action(course.published ? "unpublish" : "publish")}><button>{course.published ? t.unpublish : t.publish}</button></form>
    </div>
    <Notice notice={args.notice} t={t} />
    <div className={styles.columns}>
      <div className={styles.stack}>
        <section className={styles.panel}>
          <h2>{t.settings}</h2>
          <nav className={styles.languages} aria-label={t.translation}>
            <span>{t.translation}</span>
            {(["ka", "en"] as const).map((lang) => <Link key={lang} href={`${path}?edit=${lang}`} aria-current={edit === lang ? "page" : undefined}>{t[lang]}</Link>)}
          </nav>
          <form action={action("course")}>
            <label>{t.name}<input key={edit} lang={edit} name="title" required maxLength={180} defaultValue={translation?.title ?? ""} /></label>
            <label>{t.description}<textarea key={edit} lang={edit} name="body" rows={4} maxLength={16000} defaultValue={authorText(translation?.description)} /></label>
            <small>{t.format}</small>
            <button>{t.save}</button>
          </form>
        </section>
        <section className={styles.panel}>
          <h2>{t.modules}</h2>
          {!course.modules.length && <p>{t.emptyModules}</p>}
          {course.modules.map((module, modIndex) => {
            const names = moduleTitles(module.titles);
            return <article key={module.id} className={styles.module}>
              <h3>{modIndex + 1}. {names[edit] ?? names.ka}</h3>
              <Move rows={course.modules} index={modIndex} action={action("module-move")} t={t} />
              <details><summary>{t.moduleName}</summary>
                <form action={action("module-edit")}>
                  <input type="hidden" name="target" value={module.id} />
                  <label>{t.moduleName}<input key={edit} name="title" lang={edit} maxLength={180} defaultValue={names[edit] ?? ""} required /></label>
                  <button>{t.save}</button>
                </form>
              </details>
              {module.items.map((lesson, i) => {
                const text = lesson.translations.find((row) => row.locale === edit);
                const defaultTitle = lesson.translations.find((row) => row.locale === "ka")?.title;
                return <div className={styles.lesson} key={lesson.id}>
                  <details>
                    <summary>{modIndex + 1}.{i + 1} {text?.title ?? defaultTitle}<small>{lesson.published ? t.published : t.draft}</small></summary>
                    <form action={action("lesson-edit")}>
                      <input type="hidden" name="target" value={lesson.id} />
                      <label>{t.name}<input key={edit} lang={edit} name="title" required maxLength={180} defaultValue={text?.title ?? ""} /></label>
                      <label>{t.body}<textarea key={edit} lang={edit} name="body" rows={6} maxLength={32000} defaultValue={authorText(text?.body)} required /></label>
                      <small>{t.format}</small>
                      <label>{t.video}<input name="video" dir="ltr" type="url" defaultValue={videoUrl(lesson.videoSource, lesson.videoRef) ?? ""} /></label>
                      <label className={styles.check}><input type="checkbox" name="published" defaultChecked={lesson.published} />{t.publishLesson}</label>
                      <label className={styles.check}><input type="checkbox" name="preview" defaultChecked={lesson.preview} />{t.preview}</label>
                      <button>{t.save}</button>
                    </form>
                    <h4>{t.files}</h4>
                    {lesson.assets.map((file) => <a className={styles.asset} key={file.id} href={`/api/media/${file.id}?locale=${edit}`}>{file.name} ↗</a>)}
                    <form action={action("asset")}>
                      <input type="hidden" name="target" value={lesson.id} />
                      <label>{t.file}<input name="file" type="file" accept=".png,.jpg,.jpeg,.pdf,.txt" required /></label>
                      <button>{t.upload}</button>
                    </form>
                  </details>
                  <Move rows={module.items} index={i} action={action("lesson-move")} t={t} />
                </div>;
              })}
              <details><summary>{t.newLesson}</summary>
                <form action={action("lesson-new")}>
                  <input type="hidden" name="target" value={module.id} />
                  <label>{t.nameKa}<input lang="ka" name="title" required maxLength={180} /></label>
                  <label>{t.bodyKa}<textarea lang="ka" rows={4} name="body" required maxLength={32000} /></label>
                  <small>{t.format}</small>
                  <button>{t.create}</button>
                </form>
              </details>
            </article>;
          })}
          <form action={action("module-new")}>
            <label>{t.newModule}<input lang="ka" name="title" aria-label={`${t.newModule} — ${t.nameKa}`} placeholder={t.nameKa} required maxLength={180} /></label>
            <button>{t.create}</button>
          </form>
        </section>
      </div>
      {isAdmin && <aside className={styles.panel}>
        <h2>{t.membership}</h2>
        <form action={action("access")}>
          <label className={styles.check}><input name="free" type="checkbox" defaultChecked={course.freeEnrollment} />{t.free}</label>
          <button>{t.save}</button>
        </form>
        <h3>{t.instructors}</h3>
        <p>{people.filter((person) => person.teaching.length).map((p) => p.displayName).join(", ") || t.none}</p>
        <form action={action("assign")}>
          <label>{t.instructorChoice}<select name="userId" required defaultValue=""><option disabled value="">{t.choose}</option>
            {people.filter((p) => p.role === "INSTRUCTOR" && !p.teaching.length).map((p) => <option key={p.id} value={p.id}>{p.displayName} · {p.id.slice(0, 8)}</option>)}
          </select></label>
          <button>{t.assign}</button>
        </form>
        <h3>{t.members}</h3>
        <p>{people.filter((person) => person.enrollments.length).map((p) => p.displayName).join(", ") || t.none}</p>
        <form action={action("enroll")}>
          <label>{t.enroll}<select name="userId" required defaultValue=""><option disabled value="">{t.choose}</option>
            {people.filter((p) => !p.enrollments.length).map((p) => <option key={p.id} value={p.id}>{p.displayName} · {p.id.slice(0, 8)}</option>)}
          </select></label>
          <button>{t.enroll}</button>
        </form>
      </aside>}
    </div>
  </main>;
}
