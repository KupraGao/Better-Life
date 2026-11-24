import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
import { SocialLinks } from "@/components/social-links";
import { publicPages, type PublicBlock, type PublicSlug } from "@/content/public-pages";
import { isLocale } from "@/i18n";

type RouteProps = { params: Promise<{ locale: string }> };
type HeadingBlock = Extract<PublicBlock, { type: "h" }>;

export function createPublicPage(slug: PublicSlug) {
  async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    const page = publicPages[locale][slug];
    return {
      title: page.metaTitle,
      description: page.metaDescription,
      alternates: {
        canonical: `/${locale}/${slug}`,
        languages: { ka: `/ka/${slug}`, en: `/en/${slug}`, "x-default": `/ka/${slug}` },
      },
    };
  }

  async function Page({ params }: RouteProps) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    const page = publicPages[locale][slug];
    const { intro, sections } = groupBlocks(page.blocks);

    return (
      <main id="main" tabIndex={-1} className="info">
        <div className={`container${page.image ? " info-layout" : ""}`}>
          <div className={`info-heading${page.books ? " info-wide" : ""}`}>
            {page.eyebrow ? <p className="eyebrow"><span className="kicker-rule" /><span>{page.eyebrow}</span></p> : null}
            <h1>{page.title}</h1>
          </div>
          {page.image ? (
            <div className="info-art">
              <Image src={page.image.src} alt="" width={page.image.width} height={page.image.height} sizes="(max-width: 720px) 92vw, 36vw" priority />
            </div>
          ) : null}
          <div className={`info-copy${page.books ? " info-wide" : ""}`}>
            {intro.length > 0 ? (
              sections.length > 0 ? (
                <div className="info-stack"><Flow blocks={intro} /></div>
              ) : (
                <div className="info-panel"><div className="info-stack"><Flow blocks={intro} /></div></div>
              )
            ) : null}
            {sections.map((section) => (
              <section
                key={section.key}
                className={section.heading.level === 3 ? "info-panel info-panel-accent" : "info-panel"}
                aria-labelledby={`section-${section.key}`}
              >
                {section.heading.level === 2 ? (
                  <h2 id={`section-${section.key}`}>{section.heading.text}</h2>
                ) : (
                  <h3 id={`section-${section.key}`}>{section.heading.text}</h3>
                )}
                {section.body.length > 0 ? <div className="info-stack"><Flow blocks={section.body} /></div> : null}
              </section>
            ))}
            {page.books ? (
              <ul className="info-books">
                {page.books.map((book) => (
                  <li id={book.id} key={book.id} className="info-book">
                    <div className="info-cover">
                      <Image src={book.cover} alt="" fill sizes="(max-width: 720px) 46vw, 18vw" />
                    </div>
                    <h2>{book.title}</h2>
                    <p className="info-price">{book.price}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {page.social ? (
              <section className="info-social" aria-label={page.social}>
                <h2>{page.social}</h2>
                <SocialLinks />
              </section>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  return { generateMetadata, Page };
}

function groupBlocks(blocks: PublicBlock[]) {
  const intro: PublicBlock[] = [];
  const sections: { key: number; heading: HeadingBlock; body: PublicBlock[] }[] = [];
  let current: (typeof sections)[number] | null = null;

  blocks.forEach((block, index) => {
    if (block.type === "h" && (block.level === 2 || (block.level === 3 && current === null))) {
      current = { key: index, heading: block, body: [] };
      sections.push(current);
      return;
    }
    if (current) current.body.push(block);
    else intro.push(block);
  });

  return { intro, sections };
}

function Flow({ blocks }: { blocks: PublicBlock[] }) {
  let paragraphSeen = false;
  return blocks.map((block, index) => {
    const lead = block.type === "p" && !paragraphSeen;
    if (block.type === "p") paragraphSeen = true;
    if (block.type === "h") {
      return block.level === 2 ? <h2 key={index}>{block.text}</h2> : <h3 key={index}>{block.text}</h3>;
    }
    if (block.type === "list") {
      return (
        <ul key={index} className="info-points">
          {block.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      );
    }
    if (block.type === "mail") {
      return (
        <p key={index} className="info-mail">
          <a className="text-link" href={`mailto:${block.address}`}><Icon name="mail" size={18} />{block.address}</a>
        </p>
      );
    }
    return <p key={index} className={lead ? "info-lead" : undefined}>{block.text}</p>;
  });
}
