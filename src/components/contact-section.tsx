import { ContactForm } from "@/components/contact-form";
import { Icon } from "@/components/icon";
import { SocialLinks } from "@/components/social-links";
import { publicPages } from "@/content/public-pages";
import type { Locale } from "@/i18n";

export function ContactSection({ locale }: { locale: Locale }) {
  const page = publicPages[locale].contact;
  const contact = page.contact;
  if (!contact) return null;

  return (
    <section id="contact" className="contact-section" aria-labelledby="contact-title">
      <div className="container contact-layout">
        <div className="contact-intro">
          {page.eyebrow ? <p className="eyebrow"><span className="kicker-rule" />{page.eyebrow}</p> : null}
          <h2 id="contact-title">{page.title}</h2>
          <div className="info-channels">
            <a href="tel:+995511777165"><Icon name="phone" size={17} />{contact.phone}</a>
            <a href={`mailto:${contact.email}`}><Icon name="mail" size={18} />{contact.email}</a>
          </div>
        </div>
        <div className="contact-card">
          <ContactForm labels={contact.form} subject={page.title} />
        </div>
        {page.social ? (
          <div className="contact-social">
            <h3>{page.social}</h3>
            <SocialLinks />
          </div>
        ) : null}
      </div>
    </section>
  );
}
