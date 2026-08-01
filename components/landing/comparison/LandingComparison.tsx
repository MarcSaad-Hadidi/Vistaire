"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import { LOCALE_LANGUAGE_TAG, type Locale } from "@/lib/i18n";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import type {
  LandingExperience,
  LandingExperienceId,
  LandingMenuPreviewPayload
} from "@/lib/landing/menuExperiences";
import { VistairePreviewPdfCompareSlider } from "@/components/vistaire-preview/VistairePreviewPdfCompareSlider";
import { LandingActiveMenuPreview } from "./LandingActiveMenuPreview";
import { LandingPublicMenuLink } from "../LandingPublicMenuLink";
import styles from "./LandingComparison.module.css";

function pendingPreview(experience: LandingExperience, message: string) {
  return {
    ...experience.preview,
    pdfSections: [],
    categoryTabs: [],
    categoryCards: [],
    activeCategorySlug: "",
    vistaireDishes: [],
    featuredDish: undefined,
    presentation: experience.preview.presentation
      ? {
          ...experience.preview.presentation,
          tagline: message,
          featuredKicker: "",
          featuredTitle: "",
          cta: ""
        }
      : undefined
  };
}

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
    Record<string, LandingMenuPreviewPayload | null | undefined>
  >(() =>
    Object.fromEntries(
      experiences.flatMap((experience) =>
        experience.renderPayload
          ? [[`${locale}:${experience.id}`, experience.renderPayload] as const]
          : []
      )
    )
  );
  const activeIndex = Math.max(
    0,
    experiences.findIndex((experience) => experience.id === activeId)
  );
  const activeExperience = experiences[activeIndex] ?? experiences[0];
  const activePayloadKey = `${locale}:${activeExperience.id}`;
  const activePayload = previewPayloads[activePayloadKey];
  const activePreview =
    activePayload?.comparison ??
    (activePayload === null
      ? activeExperience.preview
      : pendingPreview(activeExperience, copy.loadingStatus));

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
          [activePayloadKey]: payload
        }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPreviewPayloads((current) => ({
          ...current,
          [activePayloadKey]: null
        }));
      });

    return () => controller.abort();
  }, [
    activeExperience.id,
    activePayload,
    activePayloadKey,
    locale
  ]);

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
      data-menu-active-locale={
        activePayload?.menuUi.menu.activeLocale ?? LOCALE_LANGUAGE_TAG[locale]
      }
      data-menu-slug={activePayload?.menuSlug ?? activeExperience.menuSlug}
      data-preview-locale={
        activePayload?.locale
          ? LOCALE_LANGUAGE_TAG[activePayload.locale]
          : LOCALE_LANGUAGE_TAG[locale]
      }
      data-preview-status={
        activePayload === undefined
          ? "loading"
          : activePayload === null
            ? "fallback"
            : "ready"
      }
      data-testid="landing-comparison"
      data-translation-status={
        activePayload?.menuUi.menu.translationStatus?.status ??
        (activePayload === null ? "fallback" : "unknown")
      }
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
                copy={copy}
                fallbackPreview={activeExperience.preview}
                key={activeExperience.id}
                locale={locale}
                menuSlug={activeExperience.menuSlug}
                payload={activePayload}
              />
            }
            key={activeExperience.id}
            locale={locale}
            preview={activePreview}
            strings={{
              caption: copy.figureCaption,
              hint: copy.revealHint,
              label: copy.revealLabel,
              pdfRegionLabel: copy.pdfRegionLabel,
              pdfTitle: copy.pdfTitle
            }}
          />
        </div>
        <div className={styles.activeCopy}>
          <p>{activeExperience.label}</p>
          <h3>{activeExperience.name}</h3>
          <LandingPublicMenuLink
            className={styles.activeLink}
            href={activeExperience.publicMenuHref}
            locale={locale}
            newTabLabelClassName={styles.srOnly}
          >
            {copy.openCta}
          </LandingPublicMenuLink>
        </div>
      </div>
    </div>
  );
}
