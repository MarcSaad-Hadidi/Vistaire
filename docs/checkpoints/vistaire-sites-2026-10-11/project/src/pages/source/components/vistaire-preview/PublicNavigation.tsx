"use client";

import { useEffect, useRef, useState } from "react";
import Link from "../../../NativeLink.tsx";
import { PublicControls } from "./PublicControls";
import type { Locale } from "../../lib/i18n";
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
  menuOpen,
  onMenuChange,
}: {
  items: Item[];
  extraItems: Item[];
  home: string;
  appointment: string;
  appointmentLabel?: string;
  locale: Locale;
  languages: { href: string; label: string; active: boolean }[];
  menuOpen?: boolean;
  onMenuChange?: (open: boolean) => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const nav = useRef<HTMLElement>(null);
  const [localOpen, setLocalOpen] = useState(false);
  const open = menuOpen ?? localOpen;
  const updateOpen = (value: boolean) => {
    setLocalOpen(value);
    onMenuChange?.(value);
  };
  const close = () => {
    updateOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menu.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    const dismiss = () => {
      setLocalOpen(false);
      onMenuChange?.(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(nav.current?.querySelectorAll<HTMLElement>(
          "a[href],button,summary",
        ) ?? []),
      ].filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!nav.current?.contains(event.target as Node)) dismiss();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
      previous?.focus({ preventScroll: true });
    };
  }, [open, onMenuChange]);
  return (
    <nav
      ref={nav}
      data-vistaire-chrome
      data-public-navigation
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
      <PublicControls
        locale={locale}
        languages={languages}
        onNavigate={close}
      />
      <Link className={styles.navCta} href={appointment} prefetch={false}>
        <span className={styles.navCtaFull}>
          {appointmentLabel ??
            (locale === "en" ? "Book a call" : "Prendre rendez-vous")}
        </span>
        <span className={styles.navCtaShort}>
          {locale === "en"
            ? "Book"
            : appointmentLabel
              ? "Rendez vous"
              : "Rendez-vous"}
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
        open={open}
        onToggle={(event) => {
          if (event.currentTarget.open !== open)
            updateOpen(event.currentTarget.open);
        }}
      >
        <summary aria-label={locale === "en" ? "Site menu" : "Menu du site"}>
          <span>{open ? (locale === "en" ? "Close" : "Fermer") : "Menu"}</span>{" "}
          <svg aria-hidden="true" viewBox="0 0 18 18">
            <path d={open ? "M4 4l10 10M4 14 14 4" : "M3 6h12M3 12h12"} stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </summary>
        <div className={styles.mobilePanel} onClick={close}>
          <p className={styles.menuHeading}>{locale === "en" ? "Explore Vistaire" : "Explorez Vistaire"}</p>
          {items.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              prefetch={false}
            >
              <small aria-hidden="true">{String(index + 1).padStart(2, "0")}</small>
              <span>{item.label}</span>
              <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 13 13 3M3 3h10v10" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
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
            <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 13 13 3M3 3h10v10" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
          </Link>
        </div>
      </details>
    </nav>
  );
}
