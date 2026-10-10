"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import { getPublicTheme, setPublicTheme, subscribePublicTheme } from "@/lib/publicTheme";
import styles from "./PublicControls.module.css";

export function PublicControls({ locale, languages, onNavigate }: {
  locale: Locale;
  languages: { href: string; label: string; active: boolean }[];
  onNavigate?: () => void;
}) {
  const theme = useSyncExternalStore(subscribePublicTheme, getPublicTheme, () => "dark");
  return (
    <div className={styles.controls} data-public-controls>
      <div className={styles.languages} aria-label={locale === "en" ? "Language" : "Langue"}>
        {languages.map((item) => (
          <a key={item.label} href={item.href} hrefLang={item.label.toLowerCase()}
            aria-current={item.active ? "true" : undefined}
            aria-label={item.label === "EN" ? "View this page in English" : "Voir cette page en français"}
            onClick={(event) => {
              // Language changes cross document roots. Preserve campaign/form context.
              const destination = new URL(item.href, window.location.origin);
              new URLSearchParams(window.location.search).forEach((value, key) => {
                if (!destination.searchParams.has(key)) destination.searchParams.set(key, value);
              });
              event.currentTarget.href = destination.href;
              onNavigate?.();
            }}>
            {item.label}
          </a>
        ))}
      </div>
      <button type="button" className={styles.theme} data-public-theme-toggle
        aria-label={locale === "en" ? "Light theme" : "Thème clair"}
        aria-pressed={theme === "light"}
        title={locale === "en" ? "Switch light / dark theme" : "Changer le thème clair / sombre"}
        onClick={() => setPublicTheme(getPublicTheme() === "dark" ? "light" : "dark")}>
        <svg className={styles.sun} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </svg>
        <svg className={styles.moon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M20.5 14a8.5 8.5 0 0 1-10.5-10.5A8.5 8.5 0 1 0 20.5 14Z" />
        </svg>
      </button>
    </div>
  );
}
