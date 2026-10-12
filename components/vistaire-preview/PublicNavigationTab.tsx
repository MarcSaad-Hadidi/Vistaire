"use client";

import type { RefObject } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./VistairePreviewChrome.module.css";

export function PublicNavigationTab({
  expanded,
  controls,
  locale,
  buttonRef,
  onClick,
}: {
  expanded: boolean;
  controls: string;
  locale: Locale;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
}) {
  const label = expanded
    ? locale === "en" ? "Hide navigation" : "Ranger la navigation"
    : locale === "en" ? "Open navigation" : "Ouvrir la navigation";
  return (
    <button
      ref={buttonRef}
      type="button"
      data-vistaire-chrome
      data-public-navigation-toggle
      className={styles.navigationTab}
      aria-controls={controls}
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d={expanded ? "M6 6l12 12M6 18 18 6" : "M5 6h14M5 12h14M5 18h14"} />
      </svg>
    </button>
  );
}
