import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { getMessages, isLocale, type Locale } from "@/i18n";
import { db } from "@/lib/db";
import { gelInput } from "@/modules/catalog/basics";
import { accessStampFrom, authorScope, basicsStampFrom, isId, moduleTitles, planStampFrom } from "@/modules/catalog/manage";
import { authorText, videoUrl } from "@/modules/catalog/content";
import { requireUser } from "@/modules/identity/session";
import { editCourse } from "../actions";
import { AccessEditor } from "../access-editor";
import { BasicsEditor } from "../basics-editor";
import { PlanEditor } from "../plan-editor";
import type { PlanDraft } from "../draft";
import { Notice } from "../shared";
import styles from "../manage.module.css";

export const dynamic = "force-dynamic";

const pageSize = 20;
const noticeKeys = ["saved", "removed", "replaced", "invalid", "denied", "stale", "duplicate", "publish", "video", "file", "file-size", "price", "cover", "category"] as const;
const editorTabs = ["basics", "plan", "access"] as const;

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

function editorHref(path: string, edit: Locale, notice: string | undefined, page: number, tab: string) {
  const query = new URLSearchParams();
  query.set("edit", edit);
  query.set("tab", tab);
  if (notice) query.set("notice", notice);
  if (page > 1) query.set("page", String(page));
  return `${path}?${query}`;
}

export default async function CourseEditor({ params, searchParams }: {
  params: Promise<{ locale: string; courseId: string }>;
  searchParams: Promise<{ edit?: string | string[]; notice?: string | string[]; page?: string | string[]; tab?: string | string[] }>;
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
      slug: true, published: true, freeEnrollment: true, coverImage: true, level: true, listed: true,
      priceRegular: true, priceSale: true, translations: true,
      categories: { select: { categoryId: true } },
      modules: { where: { archivedAt: null }, orderBy: { position: "asc" }, select: {
        id: true, titles: true, items: { where: { kind: "LESSON", archivedAt: null }, orderBy: { position: "asc" },
          select: { id: true, published: true, videoSource: true, videoRef: true, translations: true,
            assets: { orderBy: { id: "asc" }, select: { id: true, name: true, mimeType: true, sizeBytes: true, kind: true } } } },
      } },
    },
  });
  if (!course) notFound();
  const isAdmin = actor.role === "ADMIN";
  const requestedTab = one(args.tab);
  const tab = requestedTab === "plan" || (requestedTab === "access" && isAdmin) ? requestedTab : "basics";
  const catalog = await db.category.findMany({
    orderBy: { slug: "asc" },
    select: { id: true, translations: { select: { locale: true, title: true } } },
  });
  const commerce = course.priceRegular != null ? "paid" : course.freeEnrollment ? "free" : "closed";
  const total = tab === "access" && isAdmin ? await db.appUser.count() : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(requestedPage, pageCount);
  const people = tab === "access" && isAdmin ? await db.appUser.findMany({
    select: { id: true, displayName: true, role: true,
      teaching: { where: { courseId }, select: { courseId: true } },
      enrollments: { where: { courseId }, select: { courseId: true } },
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  }) : [];
  const plan: PlanDraft = {
    modules: course.modules.map((courseModule) => {
      const names = moduleTitles(courseModule.titles);
      return {
        key: courseModule.id,
        id: courseModule.id,
        title: names[edit] ?? "",
        fallbackTitle: ((edit === "ka" ? names.en : names.ka) ?? "").trim(),
        remove: false,
        lessons: courseModule.items.map((lesson) => {
          const text = lesson.translations.find((row) => row.locale === edit);
          return {
            key: lesson.id,
            id: lesson.id,
            title: text?.title ?? "",
            body: authorText(text?.body),
            video: videoUrl(lesson.videoSource, lesson.videoRef) ?? "",
            published: lesson.published,
            remove: false,
            assets: lesson.assets.map((file) => ({
              key: file.id,
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
              kind: file.kind,
              action: "keep" as const,
            })),
          };
        }),
      };
    }),
  };
  const revision = crypto.randomUUID();
  const translation = course.translations.find((row) => row.locale === edit);
  const otherTranslation = course.translations.find((row) => row.locale !== edit);
  const title = translation?.title ?? otherTranslation?.title ?? course.slug;
  const path = `/${locale}/manage/${courseId}`;
  const action = (intent: string) => editCourse.bind(null, locale, courseId, edit, intent);
  const href = (page: number) => editorHref(path, edit, notice, page, tab);

  return <main id="main" tabIndex={-1} className={`container ${styles.workspace}`}>
    <Link className={styles.back} href={`/${locale}/manage`}>← {t.all}</Link>
    <h1>{title}</h1>
    {!translation && otherTranslation && <p className={styles.notice} role="status">{t.missingLanguage}</p>}
    <div className={styles.toolbar}>
      <span className={styles.state}>{course.published ? t.published : t.draft}</span>
      {isAdmin && <Link className={styles.back} href={`/${locale}/manage/${courseId}/preview?edit=${edit}`} data-preview="saved">{t.view}</Link>}
      <form action={action(course.published ? "unpublish" : "publish")}>
        <input type="hidden" name="tab" value={tab} />
        <SubmitButton pending={t.pending}>{course.published ? t.unpublish : t.publish}</SubmitButton>
      </form>
      {course.published && <Link href={`/${locale}/courses/${course.slug}`}>{t.open}</Link>}
    </div>
    <Notice notice={notice} t={t} />
    <nav className={styles.tabs} aria-label={t.sections}>
      {editorTabs.filter((item) => item !== "access" || isAdmin).map((item) => (
        <Link key={item} href={editorHref(path, edit, notice, safePage, item)} aria-current={tab === item ? "true" : undefined}>
          {item === "basics" ? t.basics : item === "plan" ? t.modules : t.accessTab}
        </Link>
      ))}
    </nav>
    <div className={styles.columns}>
      {tab === "basics" && <div className={styles.stack}>
        <BasicsEditor
          locale={locale}
          edit={edit}
          courseId={courseId}
          page={safePage}
          notice={notice}
          showMissing={!translation}
          revision={revision}
          stamp={basicsStampFrom(course)}
          t={t}
          initial={{
            title: translation?.title ?? "",
            body: authorText(translation?.description),
            slug: course.slug,
            cover: course.coverImage ?? "",
            level: course.level ?? "",
            categoryIds: course.categories.map((row) => row.categoryId),
          }}
          categories={catalog.map((item) => ({
            id: item.id,
            label: item.translations.find((row) => row.locale === edit)?.title
              ?? item.translations.find((row) => row.title)?.title
              ?? item.id,
          }))}
        />
      </div>}
      {tab === "plan" && <div className={styles.stack}>
        <PlanEditor locale={locale} edit={edit} courseId={courseId} initial={plan} revision={revision} stamp={planStampFrom(course.modules)} t={t} />
      </div>}
      {tab === "access" && isAdmin && <aside className={styles.panel}>
        <h2>{t.accessTab}</h2>
        <AccessEditor locale={locale} courseId={courseId} revision={revision} stamp={accessStampFrom(course)} t={t} initial={{
          mode: commerce, priceRegular: gelInput(course.priceRegular), priceSale: gelInput(course.priceSale), listed: course.listed,
        }} />
        <h3>{t.instructors}</h3>
        <p>{people.filter((person) => person.teaching.length).map((person) => person.displayName).join(", ") || t.none}</p>
        <form action={action("assign")}>
          <input type="hidden" name="tab" value="access" />
          <label>{t.instructorChoice}<select name="userId" required defaultValue=""><option disabled value="">{t.choose}</option>
            {people.filter((person) => person.role === "INSTRUCTOR" && !person.teaching.length).map((person) => <option key={person.id} value={person.id}>{person.displayName} · {person.id.slice(0, 8)}</option>)}
          </select></label>
          <SubmitButton pending={t.pending}>{t.assign}</SubmitButton>
        </form>
        <h3>{t.members}</h3>
        <p>{people.filter((person) => person.enrollments.length).map((person) => person.displayName).join(", ") || t.none}</p>
        <form action={action("enroll")}>
          <input type="hidden" name="tab" value="access" />
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
