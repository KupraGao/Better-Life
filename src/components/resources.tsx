import Image from "next/image";
import { getMessages, type Locale } from "@/i18n";
import { coursePath } from "@/modules/learning/labels";
import { Icon } from "./icon";
import { ResourceFilter } from "./resource-filter";
import styles from "./resources.module.css";

export type HomeCourse = {
  slug: string;
  title: string;
  coverImage: string | null;
  categories: { title: string }[];
};

export function Resources({ locale, courses }: { locale: Locale; courses: HomeCourse[] }) {
  const { resources: labels, books } = getMessages(locale);
  const catalogue = [
    ...courses.map((course) => ({
      id: `course-${course.slug}`,
      kind: "courses" as const, label: labels.course,
      category: course.categories.map((item) => item.title).join(" · "),
      title: course.title, href: coursePath(locale, course.slug),
      cover: course.coverImage?.startsWith("https://") ? course.coverImage : "/brand/dyslexia.jpg",
      style: "course",
    })),
    ...books.items.map((book) => ({
      id: `book-${book.slug}`,
      kind: "books" as const, label: labels.book, category: book.language, title: book.title,
      href: book.href, cover: `/brand/${book.slug}-${locale}.webp`, style: book.slug,
    })),
  ];
  const cards = catalogue.map((item) => ({
    id: item.id,
    kind: item.kind,
    href: item.href,
    content: (
      <a href={item.href} className={styles.card}>
        <div className={`${styles.stage} ${styles[item.style]}`}>
          {item.kind === "courses" ? (
            item.cover.startsWith("https://") ? (
              // The address is chosen by an administrator and is not on an image allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.cover} alt="" width={612} height={612} className={styles.courseImage} />
            ) : (
              <Image
                src={item.cover} alt="" width={612} height={612}
                sizes="(max-width: 700px) 70vw, 22vw" className={styles.courseImage}
              />
            )
          ) : (
            <div className={styles.bookCover}>
              <Image src={item.cover} alt="" fill sizes="(max-width: 700px) 35vw, 12vw" />
            </div>
          )}
        </div>
        <div className={styles.metadata}>
          <span>{item.label}</span>
          {item.category ? <>
            <span className={styles.dot} aria-hidden="true" />
            <span>{item.category}</span>
          </> : null}
        </div>
        <div className={styles.cardHeading}>
          <h3>{item.title}</h3>
          <span className={styles.arrow}><Icon name="external" size={18} /></span>
        </div>
      </a>
    ),
  }));

  return (
    <section className={styles.section} aria-labelledby="resources-title">
      <div className="container">
        <ResourceFilter
          label={labels.filterLabel}
          options={{ resources: labels.all, courses: labels.courses, books: labels.books }}
          cards={cards}
        >
          <p className="eyebrow"><span className="kicker-rule" />{labels.eyebrow}</p>
          <h2 id="resources-title" className={styles.title}>{labels.title}</h2>
        </ResourceFilter>
      </div>
    </section>
  );
}
