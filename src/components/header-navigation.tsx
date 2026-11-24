"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { swapLocalePath, type Locale, type Messages } from "@/i18n";
import { PendingButton } from "@/modules/identity/pending-button";
import styles from "./header.module.css";

type HeaderViewer = { name: string; role: "STUDENT" | "INSTRUCTOR" | "ADMIN" };

type HeaderLinks = {
  login: string;
  register: string;
  account: string;
  courses: string;
  manage: string;
};

type SiteLink = { href: string; label: string };

type AccountText = {
  menu: string;
  login: string;
  register: string;
  account: string;
  courses: string;
  manage: string;
  logout: string;
};

type HeaderNavigationProps = {
  locale: Locale;
  nav: Messages["nav"];
  viewer: HeaderViewer | null;
  links: HeaderLinks;
  serviceLinks: SiteLink[];
  pageLinks: { about: string; contact: string };
  accountText: AccountText;
  logoutAction: (formData: FormData) => void | Promise<void>;
};

function initials(name: string) {
  const letters = Array.from(name.trim()).filter((char) => /\p{L}/u.test(char));
  return letters.slice(0, 2).join("").toLocaleUpperCase("en");
}

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

function AccountMenu({
  viewer, links, text, logoutAction, onNavigate, onToggle,
}: {
  viewer: HeaderViewer | null;
  links: HeaderLinks;
  text: AccountText;
  logoutAction: HeaderNavigationProps["logoutAction"];
  onNavigate: () => void;
  onToggle: (open: boolean) => void;
}) {
  const mark = viewer ? initials(viewer.name) : "";
  return (
    <details className={styles.account} data-account-menu onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary className={mark ? styles.avatar : styles.accountButton} aria-label={viewer ? `${text.menu}, ${viewer.name}` : text.menu}>
        {mark || <Icon name="user" size={18} />}
      </summary>
      <div className={styles.dropdown}>
        {viewer ? <>
          <a href={links.account} onClick={onNavigate}>{text.account}</a>
          <a href={links.courses} onClick={onNavigate}>{text.courses}</a>
          {viewer.role !== "STUDENT" && <a href={links.manage} onClick={onNavigate}>{text.manage}</a>}
          <form action={logoutAction}><PendingButton className={styles.menuAction} label={text.logout} /></form>
        </> : <>
          <a href={links.login} onClick={onNavigate}>{text.login}</a>
          <a href={links.register} onClick={onNavigate}>{text.register}</a>
        </>}
      </div>
    </details>
  );
}

export function HeaderNavigation({ locale, nav, viewer, links, serviceLinks, pageLinks, accountText, logoutAction }: HeaderNavigationProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [raised, setRaised] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const servicesRef = useRef<HTMLDetailsElement>(null);
  const servicesTrigger = useRef<HTMLElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const home = `/${locale}`;
  const homeCurrent = pathname === home || pathname === `${home}/`;

  const closeAccountMenus = useCallback(() => {
    headerRef.current?.querySelectorAll<HTMLDetailsElement>("[data-account-menu]").forEach((menu) => {
      menu.open = false;
    });
    setAccountOpen(false);
  }, []);

  const closeMenus = useCallback(() => {
    if (servicesRef.current) servicesRef.current.open = false;
    closeAccountMenus();
    setServicesOpen(false);
    setMobileOpen(false);
  }, [closeAccountMenus]);

  useEffect(() => {
    const update = () => setRaised(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!mobileOpen && !servicesOpen && !accountOpen) return;

    function closeOutside(event: PointerEvent) {
      if (!(event.target instanceof Node) || !headerRef.current) return;
      if (!headerRef.current.contains(event.target)) {
        closeMenus();
        return;
      }
      if (servicesRef.current?.open && !servicesRef.current.contains(event.target)) servicesRef.current.open = false;
      headerRef.current.querySelectorAll<HTMLDetailsElement>("[data-account-menu]").forEach((menu) => {
        if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
      });
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !headerRef.current) return;
      const account = headerRef.current.querySelector<HTMLDetailsElement>("[data-account-menu][open]");
      if (servicesRef.current?.open) {
        servicesRef.current.open = false;
        servicesTrigger.current?.focus();
      } else if (account?.open) {
        account.open = false;
        account.querySelector("summary")?.focus();
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
  }, [accountOpen, closeMenus, mobileOpen, servicesOpen]);

  function openAccount(open: boolean) {
    setAccountOpen(open);
    if (!open) return;
    if (servicesRef.current) servicesRef.current.open = false;
    setServicesOpen(false);
    setMobileOpen(false);
  }

  const languageSwitch = <LanguageSlot locale={locale} label={nav.switchLanguage} />;
  function renderAccount() {
    return (
      <AccountMenu
        viewer={viewer}
        links={links}
        text={accountText}
        logoutAction={logoutAction}
        onNavigate={closeMenus}
        onToggle={openAccount}
      />
    );
  }

  return (
    <header
      className={styles.header}
      data-raised={raised}
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
          {renderAccount()}
          <button
            type="button"
            ref={mobileTrigger}
            className={styles.menuButton}
            aria-label={mobileOpen ? nav.closeMenu : nav.menu}
            aria-controls="site-navigation"
            aria-expanded={mobileOpen}
            onClick={() => {
              if (servicesRef.current) servicesRef.current.open = false;
              closeAccountMenus();
              setServicesOpen(false);
              setMobileOpen((open) => !open);
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
            onToggle={(event) => {
              const open = event.currentTarget.open;
              setServicesOpen(open);
              if (open) closeAccountMenus();
            }}
          >
            <summary ref={servicesTrigger} className={styles.servicesButton}>
              {nav.services}
              <span className={styles.chevron}><Icon name="chevron" size={14} /></span>
            </summary>
            <div id="site-services" className={styles.dropdown}>
              {serviceLinks.map((item) => (
                <a key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={closeMenus}>{item.label}</a>
              ))}
            </div>
          </details>
          <a href={pageLinks.about} aria-current={pathname === pageLinks.about ? "page" : undefined} onClick={closeMenus}>{nav.about}</a>
          <a href={pageLinks.contact} aria-current={pathname === pageLinks.contact ? "page" : undefined} onClick={closeMenus}>{nav.contact}</a>
        </nav>
        <div className={styles.tools}>
          {languageSwitch}
          {renderAccount()}
        </div>
      </div>
    </header>
  );
}
