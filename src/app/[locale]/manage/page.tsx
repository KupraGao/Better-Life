import Link from "next/link";
import { notFound } from "next/navigation";
import { getMessages, isLocale } from "@/i18n";
import { db } from "@/lib/db";
import { authorScope } from "@/modules/catalog/manage";
import { requireUser } from "@/modules/identity/session";
import { SubmitButton } from "@/components/submit-button";
import { addCourse, saveCategory } from "./actions";
import { Notice } from "./shared";
import styles from "./manage.module.css";

export const dynamic = "force-dynamic";

export default async function Manage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await requireUser(locale);
  if (actor.role === "STUDENT") notFound();
  const { manage: t } = getMessages(locale);
  const { notice } = await searchParams;
  const categories = actor.role === "ADMIN" ? await db.category.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, translations: { select: { locale: true, title: true } }, _count: { select: { courses: true } } },
  }) : [];
  const courses = await db.course.findMany({
    where: authorScope(actor), orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, published: true, translations: { select: { title: true, locale: true } } },
  });
  return (
    <main id="main" tabIndex={-1} className={`container ${styles.workspace}`}>
      <p className="eyebrow"><span className="kicker-rule" />{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <Notice notice={notice} t={t} />
      <div className={styles.columns}>
        <section className={styles.panel}>
          <h2>{t.myCourses}</h2>
          {courses.length ? <ul className={styles.courseList}>{courses.map((course) => {
            const own = course.translations.find((row) => row.locale === locale);
            const other = course.translations.find((row) => row.locale !== locale);
            return <li className={styles.courseRow} key={course.id}>
              <span><strong>{own?.title ?? other?.title ?? course.slug}</strong>
                <small>{course.slug}{!own && other ? ` · ${t.missingLanguage}` : ""}</small></span>
              <span className={styles.state}>{course.published ? t.published : t.draft}</span>
              {actor.role === "ADMIN" && <Link className={styles.back} href={`/${locale}/manage/${course.id}/preview`}>{t.view}</Link>}
              <Link className={styles.editLink} href={`/${locale}/manage/${course.id}`}>{t.update}</Link>
            </li>;
          })}</ul> : <p>{t.empty}</p>}
        </section>
        {actor.role === "ADMIN" && <section className={styles.panel}>
          <h2>{t.createCourse}</h2>
          <form action={addCourse.bind(null, locale)}>
            <label>{t.nameKa}<input name="title" required maxLength={180} /></label>
            <label>{t.slug}<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} dir="ltr" /></label>
            <label>{t.descriptionKa}<textarea name="body" maxLength={16000} rows={3} /></label>
            <SubmitButton pending={t.pending}>{t.create}</SubmitButton>
          </form>
        </section>}
      </div>
      {actor.role === "ADMIN" && <section className={styles.panel}>
        <h2>{t.categories}</h2>
        <form action={saveCategory.bind(null, locale, "category-new")}>
          <label>{t.categoryTitle}<input name="title" required maxLength={120} /></label>
          <label>{t.categoryTitleEn}<input name="titleEn" maxLength={120} /></label>
          <label>{t.slug}<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} dir="ltr" /></label>
          <SubmitButton pending={t.pending}>{t.newCategory}</SubmitButton>
        </form>
        {categories.map((category) => {
          const georgian = category.translations.find((row) => row.locale === "ka")?.title ?? "";
          const english = category.translations.find((row) => row.locale === "en")?.title ?? "";
          return <article key={category.id}>
            <h3>{georgian || category.slug}</h3>
            <form action={saveCategory.bind(null, locale, "category-edit")}>
              <input type="hidden" name="target" value={category.id} />
              <label>{t.categoryTitle}<input name="title" required maxLength={120} defaultValue={georgian} /></label>
              <label>{t.categoryTitleEn}<input name="titleEn" maxLength={120} defaultValue={english} /></label>
              <label>{t.slug}<input name="slug" required dir="ltr" maxLength={100} defaultValue={category.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
              <SubmitButton pending={t.pending}>{t.editCategory}</SubmitButton>
            </form>
            {category._count.courses === 0 ? <form action={saveCategory.bind(null, locale, "category-delete")}>
              <input type="hidden" name="target" value={category.id} />
              <small>{t.categoryUnused}</small>
              <SubmitButton pending={t.pending}>{t.deleteCategory}</SubmitButton>
            </form> : <small>{t.categoryUnused}</small>}
          </article>;
        })}
      </section>}
    </main>
  );
}
