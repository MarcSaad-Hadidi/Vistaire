"use client";

import Link from "next/link";
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import type { Locale } from "@/lib/i18n";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import type {
  LandingExperience,
  LandingExperienceId
} from "@/lib/landing/menuExperiences";
import { VistairePdfToDigitalHoverReveal } from "@/components/vistaire-preview/VistairePdfToDigitalHoverReveal";
import styles from "./LandingComparison.module.css";

export function LandingComparison({
  copy,
  experiences,
  locale
}: {
  copy: LandingCopy["comparison"];
  experiences: LandingExperience[];
  locale: Locale;
}) {
  const instanceId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeId, setActiveId] =
    useState<LandingExperienceId>("maison-elyse");
  const activeIndex = Math.max(
    0,
    experiences.findIndex((experience) => experience.id === activeId)
  );
  const activeExperience = experiences[activeIndex] ?? experiences[0];

  const activate = (index: number, focus = false) => {
    const normalizedIndex =
      (index + experiences.length) % experiences.length;
    const experience = experiences[normalizedIndex];
    if (!experience) return;
    setActiveId(experience.id);
    if (focus) tabRefs.current[normalizedIndex]?.focus();
  };

  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        activate(index - 1, true);
        break;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        activate(index + 1, true);
        break;
      case "Home":
        event.preventDefault();
        activate(0, true);
        break;
      case "End":
        event.preventDefault();
        activate(experiences.length - 1, true);
        break;
      default:
        break;
    }
  };

  const panelId = `${instanceId}-panel`;

  return (
    <div
      className={styles.comparison}
      data-testid="landing-comparison"
      style={{ transitionDuration: "var(--landing-transition-duration, 180ms)" }}
    >
      <div
        aria-label={copy.tabLabel}
        className={styles.tabs}
        role="tablist"
      >
        {experiences.map((experience, index) => {
          const selected = experience.id === activeExperience.id;
          return (
            <button
              aria-controls={panelId}
              aria-selected={selected}
              className={styles.tab}
              id={`${instanceId}-${experience.id}-tab`}
              key={experience.id}
              onClick={() => activate(index)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {experience.name}
            </button>
          );
        })}
      </div>

      <div
        aria-labelledby={`${instanceId}-${activeExperience.id}-tab`}
        className={styles.panel}
        data-active-preview={activeExperience.id}
        id={panelId}
        role="tabpanel"
      >
        <div
          className={styles.phone}
          data-testid="landing-comparison-phone"
        >
          <VistairePdfToDigitalHoverReveal
            key={activeExperience.id}
            locale={locale}
            preview={activeExperience.preview}
            prioritizePreviewImages={false}
            strings={{
              caption: copy.figureCaption,
              hint: copy.revealHint,
              label: copy.revealLabel
            }}
          />
        </div>
        <div className={styles.activeCopy}>
          <p>{activeExperience.label}</p>
          <h3>{activeExperience.name}</h3>
          <Link
            className={styles.activeLink}
            href={activeExperience.href}
            prefetch={false}
          >
            {copy.openCta}
          </Link>
        </div>
      </div>
    </div>
  );
}
