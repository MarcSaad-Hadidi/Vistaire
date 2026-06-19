"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OWNER_NAV_ITEMS, ownerNavTitle } from "@/lib/owner/nav";

export function OwnerShell({
  children,
  accountControl = null
}: {
  children: React.ReactNode;
  accountControl?: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/owner";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(false);
  const { label, hint } = ownerNavTitle(pathname);
  const activeHref =
    [...OWNER_NAV_ITEMS]
      .filter((item) =>
        item.href === "/owner"
          ? pathname === "/owner"
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "/owner";

  function isActive(href: string) {
    return href === activeHref;
  }

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const sync = () => {
      setIsMobileNav(media.matches);
      if (!media.matches) setMobileOpen(false);
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const sidebarHidden = isMobileNav && !mobileOpen;
  const navTabIndex = sidebarHidden ? -1 : undefined;

  return (
    <div className={styles.console}>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          className={styles.sidebarBackdrop}
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarMobileOpen : ""}`}
        aria-label="Navigation Vistaire Owner"
        aria-hidden={sidebarHidden ? "true" : undefined}
      >
        <Link
          className={styles.sidebarBrand}
          href="/owner"
          prefetch={false}
          tabIndex={navTabIndex}
        >
          <span className={styles.sidebarBrandName}>Vistaire</span>
          <span className={styles.sidebarBrandMeta}>Studio Vistaire</span>
        </Link>
        <nav className={styles.sidebarNav}>
          {OWNER_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(item.href) ? "page" : undefined}
              tabIndex={navTabIndex}
              className={`${styles.navItem} ${
                isActive(item.href) ? styles.navItemActive : ""
              }`}
            >
              <span className={styles.navItemLabel}>{item.label}</span>
              <span className={styles.navItemHint}>{item.hint}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          Studio interne - accès owner-only
        </div>
      </aside>

      <div className={styles.consoleMain}>
        <header className={styles.consoleTopbar}>
          <button
            type="button"
            className={styles.menuToggle}
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            Menu
          </button>
          <div className={styles.topbarTitleWrap}>
            <h1 className={styles.topbarTitle}>{label}</h1>
            <p className={styles.topbarSub}>{hint}</p>
          </div>
          <div className={styles.topbarActions}>
            <Link className={styles.btn} href="/apercu-restaurateur" prefetch={false}>
              Aperçu public
            </Link>
            {accountControl}
          </div>
        </header>
        <main className={styles.consoleContent}>{children}</main>
      </div>
    </div>
  );
}
