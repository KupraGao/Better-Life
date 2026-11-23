import Link from "next/link";
import { db } from "@/lib/db";
import { formatGel } from "@/modules/catalog/basics";
import { RichText } from "@/modules/catalog/lesson-content";
import { courseLocale, coursePath, learningLabels } from "@/modules/learning/labels";
import { listCatalogCategories, listCourses } from "@/modules/learning/service";
import styles from "@/modules/learning/learning.module.css";

export const dynamic = "force-dynamic";

const levels = { BEGINNER: "beginner", INTERMEDIATE: "intermediate", ADVANCED: "advanced" } as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CoursesPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const locale = courseLocale((await params).locale);
  const requested = one((await searchParams).category);
  const category = requested && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requested) ? requested : undefined;
  const text = learningLabels[locale];
  const [courses, categories] = await Promise.all([
    listCourses(db, locale, category),
    listCatalogCategories(db, locale),
  ]);
  return (
    <main id="main" tabIndex={-1} className={`container ${styles.page}`}>
      <header className={styles.heading}><h1>{text.catalog}</h1><p>{text.catalogIntro}</p></header>
      {categories.length > 0 && <ul className={styles.filters} aria-label={text.categoryFilter}>
        <li><Link href={`/${locale}/courses`} aria-current={category ? undefined : "true"}>{text.allCategories}</Link></li>
        {categories.map((item) => <li key={item.slug}>
          <Link href={`/${locale}/courses?category=${item.slug}`} aria-current={category === item.slug ? "true" : undefined}>{item.title}</Link>
        </li>)}
      </ul>}
      {courses.length === 0 ? <p>{text.emptyCatalog}</p> : (
        <ul className={styles.grid}>
          {courses.map((course) => <li className={styles.card} key={course.slug}>
            {course.coverImage?.startsWith("https://") && (
              // The address is chosen by an administrator and is not on an image allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.cover} src={course.coverImage} alt="" />
            )}
            {course.priceRegular ? <p className={styles.price}>
              {course.priceSale ? <s>{formatGel(course.priceRegular)}</s> : null}{formatGel(course.priceSale ?? course.priceRegular)}
            </p> : <p className={styles.meta}>{course.freeEnrollment ? text.free : text.assigned}</p>}
            {course.categories.length > 0 && <p className={styles.meta}>{course.categories.map((item) => item.title).join(" · ")}</p>}
            <h2><Link href={coursePath(locale, course.slug)}>{course.title}</Link></h2>
            {course.level && <p className={styles.count}>{text[levels[course.level]]}</p>}
            <div className={styles.summary}><RichText value={course.description} /></div>
            <p className={styles.count}>{text.lessons} · {course.total}</p>
            <Link className="text-link" href={coursePath(locale, course.slug)}>{text.openCourse} →</Link>
          </li>)}
        </ul>
      )}
    </main>
  );
}
