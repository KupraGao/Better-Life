"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import type { Locale, Messages } from "@/i18n";
import styles from "./header.module.css";

type HeaderNavigationProps = {
  locale: Locale;
  nav: Messages["nav"];
  registerHref: string;
};

export function HeaderNavigation({ locale, nav, registerHref }: HeaderNavigationProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  const servicesTrigger = useRef<HTMLButtonElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const home = `/${locale}`;
  const nextLocale = locale === "ka" ? "en" : "ka";

  function closeMenus() {
    setServicesOpen(false);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen && !servicesOpen) return;

    function closeOutside(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!headerRef.current?.contains(event.target)) closeMenus();
      else if (!servicesRef.current?.contains(event.target)) setServicesOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (servicesOpen) {
        setServicesOpen(false);
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
    <a className={styles.register} href={registerHref}>
      <Icon name="user" size={16} />
      {nav.register}
    </a>
  );

  const languageSwitch = (
    <a
      className={styles.language}
      href={`/${nextLocale}`}
      hrefLang={nextLocale}
      aria-label={nav.switchLanguage}
      onClick={(event) => { event.currentTarget.hash = window.location.hash; }}
    >
      <Icon name="globe" size={17} />
      <span lang="en">{nextLocale.toUpperCase()}</span>
    </a>
  );

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
          <Link href={home} aria-current="page" className={styles.current} onClick={closeMenus}>
            {nav.home}
          </Link>
          <div
            className={styles.services}
            ref={servicesRef}
            onBlur={(event) => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setServicesOpen(false);
            }}
          >
            <button
              type="button"
              ref={servicesTrigger}
              className={styles.servicesButton}
              aria-expanded={servicesOpen}
              aria-controls="site-services"
              onClick={() => setServicesOpen(!servicesOpen)}
            >
              {nav.services}
              <span className={styles.chevron}><Icon name="chevron" size={14} /></span>
            </button>
            <div hidden={!servicesOpen} id="site-services" className={styles.dropdown}>
              <a href={home + "#courses"} onClick={closeMenus}>{nav.courses}</a>
              <a href={home + "#books"} onClick={closeMenus}>{nav.books}</a>
              <a href={home + "#programmes"} onClick={closeMenus}>{nav.programmes}</a>
            </div>
          </div>
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
