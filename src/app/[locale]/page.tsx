import Image from "next/image";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
import { Resources } from "@/components/resources";
import { getMessages, getPublicLinks, isLocale } from "@/i18n";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { hero, courses, about, services } = getMessages(locale);
  const course = courses.items[0];

  return (
    <main id="main" tabIndex={-1}>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-layout">
          <div className="hero-copy">
            <p className="eyebrow"><span className="kicker-rule" />{hero.eyebrow}</p>
            <h1 id="hero-title">{hero.title[0]}<span>{hero.title[1]}</span></h1>
            <p className="hero-intro">{hero.intro}</p>
            <div className="hero-actions">
              <a className="button primary-button" href="#courses"><Icon name="cap" />{hero.courses}</a>
              <a className="button secondary-button" href="#books"><Icon name="book" />{hero.books}</a>
            </div>
          </div>
          <div className="hero-art">
            <div className="orbit" aria-hidden="true"><i /><b /></div>
            <div className="print-dots" aria-hidden="true" />
            <Image className="hero-portrait" src="/brand/founder.webp" alt={hero.portraitAlt} width={1024} height={1536} sizes="(max-width: 720px) 95vw, 690px" preload />
            <a className="spotlight" href={course.href}>
              <Image src="/brand/dyslexia.jpg" alt="" width={62} height={62} className="spotlight-cover" />
              <span className="spotlight-text"><span className="spotlight-label">{hero.featured}</span><strong>{course.title}</strong></span>
              <span className="spotlight-icon"><Icon name="play" size={21} /></span>
            </a>
          </div>
        </div>
      </section>

      <Resources locale={locale} />

      <section id="about" className="about" aria-labelledby="about-title">
        <div className="container about-layout">
          <div className="about-art">
            <Image src="/brand/balloons.jpg" alt="" fill sizes="(max-width: 720px) 92vw, 42vw" />
          </div>
          <div className="about-copy">
            <p className="eyebrow"><span className="kicker-rule" />{about.eyebrow}</p>
            <h2 id="about-title">{about.title}</h2>
            <p>{about.intro}</p>
            <a className="text-link" href={getPublicLinks(locale).about}>{about.detail}<Icon name="external" size={16} /></a>
            <div className="programme-list" id="programmes">
              <h3>{services.title}</h3>
              {services.items.map((programme) =>
                <a key={programme.title} href={programme.href}>
                  <span><strong>{programme.title}</strong><span>{programme.description}</span></span><Icon name="external" size={16} />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
