import Image from "next/image";
import { getMessages, type Locale } from "@/i18n";
import { Icon } from "./icon";
import { ResourceFilter } from "./resource-filter";
import styles from "./resources.module.css";

export function Resources({ locale }: { locale: Locale }) {
  const { resources: labels, courses, books } = getMessages(locale);
  const catalogue = [
    ...courses.items.map((course) => ({
      id: `course-${course.title}`,
      kind: "courses" as const, label: labels.course, category: course.category,
      title: course.title, href: course.href, cover: "/brand/dyslexia.jpg", style: "course",
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
            <Image
              src={item.cover} alt="" width={612} height={612}
              sizes="(max-width: 700px) 70vw, 22vw" className={styles.courseImage}
            />
          ) : (
            <div className={styles.bookCover}>
              <Image src={item.cover} alt="" fill sizes="(max-width: 700px) 35vw, 12vw" />
            </div>
          )}
        </div>
        <div className={styles.metadata}>
          <span>{item.label}</span>
          <span className={styles.dot} aria-hidden="true" />
          <span>{item.category}</span>
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
