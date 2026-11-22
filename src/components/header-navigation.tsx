"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { swapLocalePath, type Locale, type Messages } from "@/i18n";
import styles from "./header.module.css";

type HeaderNavigationProps = {
  locale: Locale;
  nav: Messages["nav"];
  registerHref: string;
};

function useLanguageHref(locale: Locale) {
  const pathname = usePathname() || `/${locale}`;
  const searchParams = useSearchParams();
  const nextLocale = locale === "ka" ? "en" : "ka";
  const [hash, setHash] = useState("");

  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [pathname]);

  const query = searchParams.toString();
  return `${swapLocalePath(pathname, nextLocale)}${query ? `?${query}` : ""}${hash}`;
}

function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  const nextLocale = locale === "ka" ? "en" : "ka";
  const href = useLanguageHref(locale);
  return (
    <a
      className={styles.language}
      href={href}
      hrefLang={nextLocale}
      aria-label={label}
      onClick={(event) => {
        const currentHash = window.location.hash;
        if (currentHash && !event.currentTarget.hash) event.currentTarget.hash = currentHash;
      }}
    >
      <Icon name="globe" size={17} />
      <span lang="en">{nextLocale.toUpperCase()}</span>
    </a>
  );
}

function LanguageSlot({ locale, label }: { locale: Locale; label: string }) {
  const nextLocale = locale === "ka" ? "en" : "ka";
  const fallback = (
    <a className={styles.language} href={`/${nextLocale}`} hrefLang={nextLocale} aria-label={label}>
      <Icon name="globe" size={17} />
      <span lang="en">{nextLocale.toUpperCase()}</span>
    </a>
  );
  return (
    <Suspense fallback={fallback}>
      <LanguageSwitch locale={locale} label={label} />
    </Suspense>
  );
}

export function HeaderNavigation({ locale, nav, registerHref }: HeaderNavigationProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const servicesRef = useRef<HTMLDetailsElement>(null);
  const servicesTrigger = useRef<HTMLElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const home = `/${locale}`;
  const homeCurrent = pathname === home || pathname === `${home}/`;

  function closeMenus() {
    if (servicesRef.current) servicesRef.current.open = false;
    setServicesOpen(false);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen && !servicesOpen) return;

    function closeOutside(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!headerRef.current?.contains(event.target)) closeMenus();
      else if (servicesRef.current?.open && !servicesRef.current.contains(event.target)) {
        servicesRef.current.open = false;
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (servicesRef.current?.open) {
        servicesRef.current.open = false;
        servicesTrigger.current?.focus();
      } else if (mobileOpen) {
        setMobileOpen(false);
        mobileTrigger.current?.focus();
      }
    }

    const desktop = window.matchMedia("(min-width: 1080px)");
    desktop.addEventListener("change", closeMenus);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      desktop.removeEventListener("change", closeMenus);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen, servicesOpen]);

  const registration = (
    <Link className={styles.register} href={registerHref} onClick={closeMenus}>
      <Icon name="user" size={16} />
      {nav.register}
    </Link>
  );

  const languageSwitch = <LanguageSlot locale={locale} label={nav.switchLanguage} />;

  return (
    <header
      className={styles.header}
      ref={headerRef}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeMenus();
      }}
    >
      <a className={styles.skip} href="#main">{nav.skip}</a>
      <div className={`container ${styles.row}`}>
        <Link href={home} className={styles.brand} onClick={closeMenus}>
          <Image src="/brand/logo.png" alt="" width={42} height={43} />
          <span lang="en">Hi, Better Life</span>
        </Link>
        <div className={styles.mobileTools}>
          {languageSwitch}
          <button
            type="button"
            ref={mobileTrigger}
            className={styles.menuButton}
            aria-label={mobileOpen ? nav.closeMenu : nav.menu}
            aria-controls="site-navigation"
            aria-expanded={mobileOpen}
            onClick={() => {
              if (servicesRef.current) servicesRef.current.open = false;
              setServicesOpen(false);
              setMobileOpen(!mobileOpen);
            }}
          >
            <Icon name={mobileOpen ? "close" : "menu"} size={23} />
          </button>
        </div>
        <nav
          className={styles.navigation}
          data-open={mobileOpen}
          aria-label={nav.primary}
          id="site-navigation"
        >
          <Link href={home} aria-current={homeCurrent ? "page" : undefined} className={homeCurrent ? styles.current : undefined} onClick={closeMenus}>
            {nav.home}
          </Link>
          <details
            className={styles.services}
            ref={servicesRef}
            onToggle={(event) => setServicesOpen(event.currentTarget.open)}
          >
            <summary ref={servicesTrigger} className={styles.servicesButton}>
              {nav.services}
              <span className={styles.chevron}><Icon name="chevron" size={14} /></span>
            </summary>
            <div id="site-services" className={styles.dropdown}>
              <a href={home + "#courses"} onClick={closeMenus}>{nav.courses}</a>
              <a href={home + "#books"} onClick={closeMenus}>{nav.books}</a>
              <a href={home + "#programmes"} onClick={closeMenus}>{nav.programmes}</a>
            </div>
          </details>
          <a href={home + "#about"} onClick={closeMenus}>{nav.about}</a>
          <a href={home + "#contact"} onClick={closeMenus}>{nav.contact}</a>
          <div className={styles.mobileRegister}>{registration}</div>
        </nav>
        <div className={styles.tools}>
          {languageSwitch}
          <div className={styles.desktopRegister}>{registration}</div>
        </div>
      </div>
    </header>
  );
}
