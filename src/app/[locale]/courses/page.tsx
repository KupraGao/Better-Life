import Link from "next/link";
import { db } from "@/lib/db";
import { RichText } from "@/modules/catalog/lesson-content";
import { courseLocale, coursePath, learningLabels } from "@/modules/learning/labels";
import { listCourses } from "@/modules/learning/service";
import styles from "@/modules/learning/learning.module.css";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = courseLocale((await params).locale);
  const text = learningLabels[locale];
  const courses = await listCourses(db, locale);
  return (
    <main id="main" tabIndex={-1} className={`container ${styles.page}`}>
      <header className={styles.heading}><h1>{text.catalog}</h1><p>{text.catalogIntro}</p></header>
      {courses.length === 0 ? <p>{text.emptyCatalog}</p> : (
        <ul className={styles.grid}>
          {courses.map((course) => <li className={styles.card} key={course.slug}>
            <p className={styles.meta}>{course.freeEnrollment ? text.free : text.assigned}</p>
            <h2><Link href={coursePath(locale, course.slug)}>{course.title}</Link></h2>
            <div className={styles.summary}><RichText value={course.description} /></div>
            <p className={styles.count}>{text.lessons} · {course.total}</p>
            <Link className="text-link" href={coursePath(locale, course.slug)}>{text.openCourse} →</Link>
          </li>)}
        </ul>
      )}
    </main>
  );
}
