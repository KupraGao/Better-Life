import Link from "next/link";
import type { Locale } from "@/i18n";
import { learningLabels, lessonPath } from "./labels";
import styles from "./learning.module.css";

type Lesson = { id: string; title: string; preview: boolean; completed: boolean; accessible: boolean };
type CourseModule = { id: string; title: string; fallback: boolean; lessons: Lesson[] };

export function Syllabus({ locale, slug, modules, enrolled, total, currentId }: {
  locale: Locale;
  slug: string;
  modules: CourseModule[];
  enrolled: boolean;
  total: number;
  currentId?: string;
}) {
  const text = learningLabels[locale];
  if (total === 0) return <p>{text.emptySyllabus}</p>;
  return modules.map((courseModule) => <section className={styles.module} key={courseModule.id}>
    <h3>{courseModule.title}{courseModule.fallback ? <small> {text.missingLanguage}</small> : null}</h3>
    <ol>{courseModule.lessons.map((item) => {
      const state = item.completed ? styles.done : item.id === currentId ? styles.current : item.accessible ? undefined : styles.locked;
      const status = item.completed ? text.done : item.id === currentId ? text.current : !item.accessible ? text.unavailable : !enrolled && item.preview ? text.preview : "";
      return <li className={state} key={item.id} aria-current={item.id === currentId ? "step" : undefined}>
        {item.accessible ? <Link href={lessonPath(locale, slug, item.id)}>{item.title}</Link> : <span>{item.title}</span>}
        {status ? <small>{status}</small> : null}
      </li>;
    })}</ol>
  </section>);
}
