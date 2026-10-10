"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import styles from "./VistairePreviewChrome.module.css";

type Item = { href: string; label: string; active?: boolean };
export function PublicNavigation({
  items,
  extraItems,
  home,
  appointment,
  locale,
  languages,
  appointmentLabel,
  appointmentShortLabel,
}: {
  items: Item[];
  extraItems: Item[];
  home: string;
  appointment: string;
  appointmentLabel?: string;
  appointmentShortLabel?: string;
  locale: Locale;
  languages: { href: string; label: string; active: boolean }[];
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (menu.current) menu.current.open = false;
  };
  const languageLinks = languages.map((item) => (
    <Link
      key={item.label}
      href={item.href}
      hrefLang={item.label.toLowerCase()}
      aria-current={item.active ? "true" : undefined}
      aria-label={
        item.label === "EN"
          ? "View this page in English"
          : "Voir cette page en français"
      }
      className={`${styles.languageLink} ${item.active ? styles.languageLinkActive : ""}`}
      prefetch={false}
    >
      {item.label}
    </Link>
  ));
  return (
    <nav
      data-vistaire-chrome
      aria-label={locale === "en" ? "Main navigation" : "Navigation principale"}
      className={styles.previewNav}
    >
      <Link
        className={styles.navBrand}
        href={home}
        prefetch={false}
        aria-label={locale === "en" ? "Vistaire - home" : "Vistaire - accueil"}
      >
        VISTAIRE
      </Link>
      <div className={styles.navLinks}>
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`${styles.navLink} ${item.active ? styles.navActive : ""}`}
            prefetch={false}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div
        className={styles.languageSwitcher}
        aria-label={locale === "en" ? "Language" : "Langue"}
      >
        {languageLinks}
      </div>
      <Link className={styles.navCta} href={appointment} prefetch={false}>
        <span className={styles.navCtaFull}>
          {appointmentLabel ??
            (locale === "en" ? "Book a call" : "Prendre rendez-vous")}
        </span>
        <span className={styles.navCtaShort}>
          {appointmentShortLabel ??
            (locale === "en"
              ? "Book"
              : appointmentLabel
                ? "Rendez vous"
                : "Rendez-vous")}
        </span>
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path
            d="M3 13 13 3M3 3h10v10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      </Link>
      <details
        suppressHydrationWarning
        className={styles.mobileMenu}
        ref={menu}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
            menu.current?.querySelector("summary")?.focus();
          }
        }}
      >
        <summary>
          Menu{" "}
          <svg aria-hidden="true" viewBox="0 0 18 18">
            <path d="M3 6h12M3 12h12" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </summary>
        <div className={styles.mobilePanel} onClick={close}>
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              prefetch={false}
            >
              {item.label}
            </Link>
          ))}
          <div className={styles.mobileExtras}>
            {extraItems.map((item) => (
              <Link key={item.href} href={item.href} prefetch={false}>
                {item.label}
              </Link>
            ))}
          </div>
          <Link
            className={styles.mobileBooking}
            href={appointment}
            prefetch={false}
          >
            {appointmentLabel ??
              (locale === "en" ? "Book a call" : "Prendre rendez-vous")}
          </Link>
          <div className={styles.mobileLanguages}>{languageLinks}</div>
        </div>
      </details>
    </nav>
  );
}
