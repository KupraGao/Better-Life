import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { getMessages, isLocale, type Locale } from "@/i18n";
import { db } from "@/lib/db";
import { authorScope, isId, moduleTitles } from "@/modules/catalog/manage";
import { authorText, videoUrl } from "@/modules/catalog/content";
import { requireUser } from "@/modules/identity/session";
import { editCourse } from "../actions";
import { Move, Notice } from "../shared";
import styles from "../manage.module.css";

export const dynamic = "force-dynamic";

const pageSize = 20;
const noticeKeys = ["saved", "invalid", "denied", "stale", "duplicate", "publish", "video", "file"] as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageNumber(value: string | undefined) {
  if (!value || !/^[1-9]\d{0,8}$/.test(value)) return 1;
  return Number(value);
}

function knownNotice(value: string | undefined) {
  return value && (noticeKeys as readonly string[]).includes(value) ? value : undefined;
}

function editorHref(path: string, edit: Locale, notice: string | undefined, page: number) {
  const query = new URLSearchParams();
  query.set("edit", edit);
  if (notice) query.set("notice", notice);
  if (page > 1) query.set("page", String(page));
  return `${path}?${query}`;
}

export default async function CourseEditor({ params, searchParams }: {
  params: Promise<{ locale: string; courseId: string }>;
  searchParams: Promise<{ edit?: string | string[]; notice?: string | string[]; page?: string | string[] }>;
}) {
  const { locale, courseId } = await params;
  if (!isLocale(locale) || !isId(courseId)) notFound();
  const actor = await requireUser(locale);
  if (actor.role === "STUDENT") notFound();
  const args = await searchParams;
  const editValue = one(args.edit);
  const edit = editValue && isLocale(editValue) ? editValue : locale;
  const notice = knownNotice(one(args.notice));
  const requestedPage = pageNumber(one(args.page));
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
  const total = isAdmin ? await db.appUser.count() : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(requestedPage, pageCount);
  const people = isAdmin ? await db.appUser.findMany({
    select: { id: true, displayName: true, role: true,
      teaching: { where: { courseId }, select: { courseId: true } },
      enrollments: { where: { courseId }, select: { courseId: true } },
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  }) : [];
  const translation = course.translations.find((row) => row.locale === edit);
  const otherTranslation = course.translations.find((row) => row.locale !== edit);
  const title = translation?.title ?? otherTranslation?.title ?? course.slug;
  const path = `/${locale}/manage/${courseId}`;
  const action = (intent: string) => editCourse.bind(null, locale, courseId, edit, intent);
  const href = (page: number) => editorHref(path, edit, notice, page);

  return <main id="main" tabIndex={-1} className={`container ${styles.workspace}`}>
    <Link className={styles.back} href={`/${locale}/manage`}>← {t.all}</Link>
    <h1>{title}</h1>
    {!translation && otherTranslation && <p className={styles.notice} role="status">{t.missingLanguage}</p>}
    <div className={styles.toolbar}>
      <span className={styles.state}>{course.published ? t.published : t.draft}</span>
      <form action={action(course.published ? "unpublish" : "publish")}><SubmitButton pending={t.pending}>{course.published ? t.unpublish : t.publish}</SubmitButton></form>
    </div>
    <Notice notice={notice} t={t} />
    <div className={styles.columns}>
      <div className={styles.stack}>
        <section className={styles.panel}>
          <h2>{t.settings}</h2>
          <nav className={styles.languages} aria-label={t.translation}>
            <span>{t.translation}</span>
            {(["ka", "en"] as const).map((lang) => <Link key={lang} href={editorHref(path, lang, notice, safePage)} aria-current={edit === lang ? "true" : undefined}>{t[lang]}</Link>)}
          </nav>
          {!translation && <p className={styles.notice} role="status">{t.missingLanguage}</p>}
          <form action={action("course")}>
            <label>{t.name}<input key={edit} lang={edit} name="title" required maxLength={180} defaultValue={translation?.title ?? ""} /></label>
            <label>{t.description}<textarea key={edit} lang={edit} name="body" rows={4} maxLength={16000} defaultValue={authorText(translation?.description)} /></label>
            <small>{t.format}</small>
            <SubmitButton pending={t.pending}>{t.save}</SubmitButton>
          </form>
        </section>
        <section className={styles.panel}>
          <h2>{t.modules}</h2>
          {!course.modules.length && <p>{t.emptyModules}</p>}
          {course.modules.map((courseModule, modIndex) => {
            const names = moduleTitles(courseModule.titles);
            const currentName = names[edit]?.trim() ? names[edit] : undefined;
            const fallbackName = (edit === "ka" ? names.en : names.ka)?.trim() || undefined;
            return <article key={courseModule.id} className={styles.module}>
              <h3>{modIndex + 1}. {currentName ?? fallbackName ?? t.moduleName}{!currentName ? <small> {t.missingLanguage}</small> : null}</h3>
              <Move rows={course.modules} index={modIndex} action={action("module-move")} t={t} />
              <details><summary>{t.moduleName}</summary>
                <form action={action("module-edit")}>
                  <input type="hidden" name="target" value={courseModule.id} />
                  <label>{t.moduleName}<input key={edit} name="title" lang={edit} maxLength={180} defaultValue={names[edit] ?? ""} required /></label>
                  <SubmitButton pending={t.pending}>{t.save}</SubmitButton>
                </form>
              </details>
              {courseModule.items.map((lesson, i) => {
                const text = lesson.translations.find((row) => row.locale === edit);
                const other = lesson.translations.find((row) => row.locale !== edit);
                return <div className={styles.lesson} key={lesson.id}>
                  <details>
                    <summary>{modIndex + 1}.{i + 1} {text?.title ?? other?.title}{!text && <small>{t.missingLanguage}</small>}<small>{lesson.published ? t.published : t.draft}</small></summary>
                    <form action={action("lesson-edit")}>
                      <input type="hidden" name="target" value={lesson.id} />
                      <label>{t.name}<input key={edit} lang={edit} name="title" required maxLength={180} defaultValue={text?.title ?? ""} /></label>
                      <label>{t.body}<textarea key={edit} lang={edit} name="body" rows={6} maxLength={32000} defaultValue={authorText(text?.body)} required /></label>
                      <small>{t.format}</small>
                      <label>{t.video}<input name="video" dir="ltr" type="url" defaultValue={videoUrl(lesson.videoSource, lesson.videoRef) ?? ""} /></label>
                      <label className={styles.check}><input type="checkbox" name="published" defaultChecked={lesson.published} />{t.publishLesson}</label>
                      <label className={styles.check}><input type="checkbox" name="preview" defaultChecked={lesson.preview} />{t.preview}</label>
                      <SubmitButton pending={t.pending}>{t.save}</SubmitButton>
                    </form>
                    <h4>{t.files}</h4>
                    {lesson.assets.map((file) => <a className={styles.asset} key={file.id} href={`/api/media/${file.id}?locale=${edit}`}>{file.name} ↗</a>)}
                    <form action={action("asset")}>
                      <input type="hidden" name="target" value={lesson.id} />
                      <label>{t.file}<input name="file" type="file" accept=".png,.jpg,.jpeg,.pdf,.txt" required /></label>
                      <SubmitButton pending={t.pending}>{t.upload}</SubmitButton>
                    </form>
                  </details>
                  <Move rows={courseModule.items} index={i} action={action("lesson-move")} t={t} />
                </div>;
              })}
              <details><summary>{t.newLesson}</summary>
                <form action={action("lesson-new")}>
                  <input type="hidden" name="target" value={courseModule.id} />
                  <label>{t.nameKa}<input lang="ka" name="title" required maxLength={180} /></label>
                  <label>{t.bodyKa}<textarea lang="ka" rows={4} name="body" required maxLength={32000} /></label>
                  <small>{t.format}</small>
                  <SubmitButton pending={t.pending}>{t.create}</SubmitButton>
                </form>
              </details>
            </article>;
          })}
          <form action={action("module-new")}>
            <label>{t.newModule}<input lang="ka" name="title" aria-label={`${t.newModule} — ${t.nameKa}`} placeholder={t.nameKa} required maxLength={180} /></label>
            <SubmitButton pending={t.pending}>{t.create}</SubmitButton>
          </form>
        </section>
      </div>
      {isAdmin && <aside className={styles.panel}>
        <h2>{t.membership}</h2>
        <form action={action("access")}>
          <label className={styles.check}><input name="free" type="checkbox" defaultChecked={course.freeEnrollment} />{t.free}</label>
          <SubmitButton pending={t.pending}>{t.save}</SubmitButton>
        </form>
        <h3>{t.instructors}</h3>
        <p>{people.filter((person) => person.teaching.length).map((person) => person.displayName).join(", ") || t.none}</p>
        <form action={action("assign")}>
          <label>{t.instructorChoice}<select name="userId" required defaultValue=""><option disabled value="">{t.choose}</option>
            {people.filter((person) => person.role === "INSTRUCTOR" && !person.teaching.length).map((person) => <option key={person.id} value={person.id}>{person.displayName} · {person.id.slice(0, 8)}</option>)}
          </select></label>
          <SubmitButton pending={t.pending}>{t.assign}</SubmitButton>
        </form>
        <h3>{t.members}</h3>
        <p>{people.filter((person) => person.enrollments.length).map((person) => person.displayName).join(", ") || t.none}</p>
        <form action={action("enroll")}>
          <label>{t.enroll}<select name="userId" required defaultValue=""><option disabled value="">{t.choose}</option>
            {people.filter((person) => !person.enrollments.length).map((person) => <option key={person.id} value={person.id}>{person.displayName} · {person.id.slice(0, 8)}</option>)}
          </select></label>
          <SubmitButton pending={t.pending}>{t.enroll}</SubmitButton>
        </form>
        {pageCount > 1 && <nav className={styles.toolbar} aria-label={t.pageNav}>
          {safePage > 1 && <Link href={href(safePage - 1)}>{t.previous}</Link>}
          <span>{safePage} / {pageCount}</span>
          {safePage < pageCount && <Link href={href(safePage + 1)}>{t.nextPage}</Link>}
        </nav>}
      </aside>}
    </div>
  </main>;
}
