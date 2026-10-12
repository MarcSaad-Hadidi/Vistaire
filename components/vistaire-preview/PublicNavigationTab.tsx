"use client";

import { useLayoutEffect, type RefObject } from "react";
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
  useLayoutEffect(() => {
    const header = document.getElementById(controls);
    if (!header) return;
    header.dataset.publicNavigationReady = "false";
    header.inert = true;
    if (!expanded) return;

    // The existing owner opens the bar; this shared launcher only gates the
    // clipped controls until its visual surface has reached the full width.
    let active = true;
    let completed = false;
    let timer: number | undefined;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => {
      if (!active || completed) return;
      completed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      header.removeEventListener("transitionend", onEnd);
      motionPreference.removeEventListener("change", onMotionChange);
      header.dataset.publicNavigationReady = "true";
      header.inert = false;
      // Do not steal focus from a newer click, keyboard action, or dialog.
      if (document.activeElement === buttonRef.current || header.contains(document.activeElement)) {
        header.querySelector<HTMLElement>("button,a[href]")?.focus({ preventScroll: true });
      }
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === header && event.propertyName === "clip-path") finish();
    };
    const onMotionChange = () => { if (motionPreference.matches) finish(); };
    if (motionPreference.matches) finish();
    else {
      header.addEventListener("transitionend", onEnd);
      motionPreference.addEventListener("change", onMotionChange);
      // Transition events can be omitted for a background tab or rapid reversal.
      timer = window.setTimeout(finish, 360);
    }
    return () => {
      active = false;
      motionPreference.removeEventListener("change", onMotionChange);
      if (timer !== undefined) window.clearTimeout(timer);
      header.removeEventListener("transitionend", onEnd);
    };
  }, [expanded, controls, buttonRef]);

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
