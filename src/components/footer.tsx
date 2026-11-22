import Image from "next/image";
import { getMessages, getPublicLinks, type Locale } from "@/i18n";
import { Icon } from "./icon";

export function Footer({ locale }: { locale: Locale }) {
  const { contact, footer, nav } = getMessages(locale);
  const links = getPublicLinks(locale);
  return (
    <footer className="site-footer" id="contact">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <a href={`/${locale}`} className="brand-signature"><Image src="/brand/logo.png" alt="" width={46} height={47} />Hi, Better Life</a>
            <p>{footer.tagline}</p>
          </div>
          <nav aria-label={nav.footer} className="footer-nav">
            <h2>{footer.navigation}</h2>
            <a href="#courses">{nav.courses}</a>
            <a href="#books">{nav.books}</a>
            <a href="#about">{nav.about}</a>
          </nav>
          <div className="footer-contact">
            <h2>{contact.title}</h2>
            <a href={links.email}><Icon name="mail" size={18} />info.hibetterlife@gmail.com</a>
            <a href={links.phone}><Icon name="phone" size={17} />+995 511 77 71 65</a>
          </div>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} Hi, Better Life</span>
          <div><a href={links.privacy}>{footer.privacy}</a><a href={links.terms}>{footer.terms}</a><a href={links.refund}>{footer.refund}</a></div>
        </div>
      </div>
    </footer>
  );
}
