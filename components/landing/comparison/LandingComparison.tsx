"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import type { Locale } from "@/lib/i18n";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import type {
  LandingExperience,
  LandingExperienceId,
  LandingMenuPreviewPayload
} from "@/lib/landing/menuExperiences";
import { VistairePreviewPdfCompareSlider } from "@/components/vistaire-preview/VistairePreviewPdfCompareSlider";
import { LandingActiveMenuPreview } from "./LandingActiveMenuPreview";
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
  const [previewPayloads, setPreviewPayloads] = useState<
    Partial<Record<LandingExperienceId, LandingMenuPreviewPayload | null>>
  >(() =>
    Object.fromEntries(
      experiences.flatMap((experience) =>
        experience.renderPayload
          ? [[experience.id, experience.renderPayload] as const]
          : []
      )
    )
  );
  const activeIndex = Math.max(
    0,
    experiences.findIndex((experience) => experience.id === activeId)
  );
  const activeExperience = experiences[activeIndex] ?? experiences[0];
  const activePayload = previewPayloads[activeExperience.id];

  useEffect(() => {
    if (activePayload !== undefined) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ locale });
    void fetch(
      `/api/public/landing-menu-preview/${activeExperience.id}?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Landing menu preview unavailable.");
        const result = (await response.json()) as {
          ok?: boolean;
          payload?: LandingMenuPreviewPayload;
        };
        if (!result.ok || !result.payload) {
          throw new Error("Landing menu preview unavailable.");
        }
        return result.payload;
      })
      .then((payload) => {
        if (
          (activeExperience.id === "maison-elyse" &&
            payload.kind !== "maison-elyse") ||
          (activeExperience.id === "trouvable" &&
            payload.kind !== "trouvable") ||
          (activeExperience.id === "sauge-noire" &&
            (payload.kind !== "unique-registered" ||
              payload.rendererKey !== "sauge-noire-book-v1" ||
              payload.rendererVersion !== 1))
        ) {
          throw new Error("Unexpected landing menu preview payload.");
        }
        setPreviewPayloads((current) => ({
          ...current,
          [activeExperience.id]: payload
        }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPreviewPayloads((current) => ({
          ...current,
          [activeExperience.id]: null
        }));
      });

    return () => controller.abort();
  }, [activeExperience.id, activePayload, locale]);

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
          <VistairePreviewPdfCompareSlider
            digitalLayer={
              <LandingActiveMenuPreview
                key={activeExperience.id}
                payload={activePayload}
              />
            }
            key={activeExperience.id}
            locale={locale}
            preview={activeExperience.preview}
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
            href={activeExperience.publicMenuHref}
            prefetch={false}
          >
            {copy.openCta}
          </Link>
        </div>
      </div>
    </div>
  );
}
