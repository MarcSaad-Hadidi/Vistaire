"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { PublicControls } from "./PublicControls";
import type { Locale } from "@/lib/i18n";
import { bindPublicMenuViewport } from "@/lib/publicMenuViewport";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  const menuId = useId();
  const navigationId = useId();
  const close = useCallback(() => setMenuOpen(false), []);
  const english = locale === "en";
  const chapters = [
    ["hero", "Introduction"],
    ["features", english ? "The experience" : "L’expérience"],
    ["product", "Collections"],
    ["open-weight", english ? "Pricing" : "Tarifs"],
    ["footer", "Contact"],
  ];
  // PreviewNav supplies these public destinations in their header order.
  const [, cards, pricing, about, contact] = items;
  const [digital, qr, ar, pdf, dashboard] = extraItems;
  const pageItems: Item[] = [
    { ...cards, label: english ? "The menus" : "Les cartes" },
    about,
    { ...pricing, label: english ? "The complete offer" : "L’offre complète" },
    { ...dashboard, label: english ? "The dashboard" : "Le Dashboard" },
    { ...contact, label: english ? "Contact us" : "Nous contacter" },
    {
      href: appointment,
      label: appointmentLabel ?? (english ? "Book a call" : "Prendre rendez-vous"),
    },
    { ...digital, label: english ? "Discover Vistaire" : "Découvrir Vistaire" },
    { ...qr, label: english ? "QR code menu" : "Menu QR code" },
    { ...ar, label: english ? "3D & AR menu" : "Menu 3D et AR" },
    pdf,
  ];

  useEffect(() => {
    window.addEventListener("popstate", close);
    window.addEventListener("hashchange", close);
    window.addEventListener("pageshow", close);
    return () => {
      window.removeEventListener("popstate", close);
      window.removeEventListener("hashchange", close);
      window.removeEventListener("pageshow", close);
    };
  }, [close]);

  useEffect(() => {
    if (!menuOpen) return;
    const unbindViewport = bindPublicMenuViewport(header.current!, panel.current!);
    panel.current!.scrollTop = 0;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => [
      ...header.current!.querySelectorAll<HTMLElement>("button,a[href]"),
      ...panel.current!.querySelectorAll<HTMLElement>("button,a[href]"),
    ].filter((control) => control.getClientRects().length > 0);
    // RAF callbacks precede paint. Cross a rendered frame before checking a
    // descendant whose inherited visibility is changing with the drawer.
    let focusFrame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => {
        const first = panel.current?.querySelector<HTMLElement>("a[href]");
        if (first?.isConnected && !panel.current!.inert && document.activeElement === previous
          && getComputedStyle(first).visibility === "visible") first.focus({ preventScroll: true });
      });
    });
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        const available = controls();
        const first = available[0];
        const last = available[available.length - 1];
        const outside = !available.includes(document.activeElement as HTMLElement);
        if (event.shiftKey && (document.activeElement === first || outside)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || outside)) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => {
      unbindViewport();
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", dismiss);
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [menuOpen, close]);
  return (
    <>
      <nav
        ref={header}
        id={navigationId}
        data-vistaire-chrome
        data-public-navigation-open="true"
        aria-label={locale === "en" ? "Main navigation" : "Navigation principale"}
        className={styles.previewNav}
      >
        <Link
          className={styles.navBrand}
          href={home}
          onClick={close}
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
              onClick={close}
              aria-current={item.active ? "page" : undefined}
              className={`${styles.navLink} ${item.active ? styles.navActive : ""}`}
              prefetch={false}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <PublicControls locale={locale} languages={languages} onNavigate={close} />
        <Link className={styles.navCta} href={appointment} prefetch={false} onClick={close}>
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
        <button
          type="button"
          className={styles.menuToggle}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className={styles.menuDot} aria-hidden="true" />
          {menuOpen ? (english ? "Close" : "Fermer") : "Menu"}
        </button>
      </nav>
      <aside
        ref={panel}
        id={menuId}
        data-vistaire-chrome
        data-public-menu
        className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ""}`}
        inert={!menuOpen ? true : undefined}
        aria-hidden={!menuOpen}
        aria-label={english ? "Vistaire menu" : "Menu Vistaire"}
      >
        <nav className={styles.menuChapters} aria-label={english ? "The Vistaire experience" : "L’expérience Vistaire"}>
          {chapters.map(([id, label], index) => (
            <Link
              key={id}
              href={`${home}#${id}`}
              prefetch={false}
              onClick={close}
            >
              <small>0{index + 1}</small>
              {label}
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
            </Link>
          ))}
        </nav>
        <nav className={styles.menuPageLinks} aria-label={english ? "Vistaire pages" : "Les pages Vistaire"}>
          {pageItems.map((item) => (
            <Link key={item.href} href={item.href} prefetch={false} onClick={close} aria-current={item.active ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.menuContact}>
          <span>{english ? "A menu that feels like you." : "Une carte qui vous ressemble."}</span>
          <a href="mailto:contact@vistaire.ca" onClick={close}>contact@vistaire.ca</a>
        </div>
      </aside>
      {menuOpen && (
        <button type="button" className={styles.menuShade} tabIndex={-1}
          aria-label={english ? "Close the menu" : "Fermer le menu"} onClick={close} />
      )}
    </>
  );
}
