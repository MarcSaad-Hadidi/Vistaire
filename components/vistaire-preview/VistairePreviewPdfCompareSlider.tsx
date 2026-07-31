"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode
} from "react";
import { PublicDishImage } from "@/components/public-menu/PublicDishImage";
import type {
  CompareCategoryPreview,
  CompareDishPreview,
  PdfComparePreviewData,
  PdfMenuSection
} from "@/lib/pdfComparePreviewData";
import type { Locale } from "@/lib/i18n";
import { getLandingCopy } from "@/lib/landing/landingCopy";
import styles from "./VistairePreviewPdfCompareSlider.module.css";

type PdfComparisonStrings = {
  caption: string;
  hint: string;
  label: string;
  pdfRegionLabel: (restaurantName: string) => string;
  pdfTitle: string;
};

type VistairePreviewPdfCompareSliderProps = {
  preview: PdfComparePreviewData;
  digitalLayer: ReactNode;
  className?: string;
  locale?: Locale;
  strings?: Partial<PdfComparisonStrings>;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function PdfRow({ name, price }: { name: string; price: string }) {
  return (
    <div className={styles.pdfRow}>
      <span className={styles.pdfDishName}>{name}</span>
      <span className={styles.pdfDots} aria-hidden="true" />
      <span className={styles.pdfPrice}>{price}</span>
    </div>
  );
}

export function VistairePreviewPdfLayer({
  locale = "fr",
  restaurantName,
  sections,
  strings
}: {
  locale?: Locale;
  restaurantName: string;
  sections: PdfMenuSection[];
  strings?: Pick<PdfComparisonStrings, "pdfRegionLabel" | "pdfTitle">;
}) {
  const localeCopy = getLandingCopy(locale).comparison;
  const pdfRegionLabel = strings?.pdfRegionLabel ?? localeCopy.pdfRegionLabel;
  const pdfTitle = strings?.pdfTitle ?? localeCopy.pdfTitle;

  return (
    <div
      aria-label={pdfRegionLabel(restaurantName)}
      className={styles.pdfScene}
      data-comparison-scroll-root="pdf"
      role="region"
      tabIndex={0}
    >
      <span className={`${styles.layerLabel} ${styles.pdfLabel}`}>PDF</span>
      <div className={styles.pdfContent}>
        <p className={styles.pdfRestaurant}>{restaurantName}</p>
        <h3 className={styles.pdfTitle}>{pdfTitle}</h3>
        <span className={styles.pdfDivider} />
        <div className={styles.pdfSections}>
          {sections.map((section) => (
            <section key={section.title}>
              <p className={styles.pdfSectionTitle}>{section.title}</p>
              {section.rows.map((row) => (
                <PdfRow key={`${section.title}-${row.name}`} {...row} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryPreviewCard({
  category,
  priority
}: {
  category: CompareCategoryPreview;
  priority: boolean;
}) {
  return (
    <article className={styles.categoryCard}>
      <span className={styles.categoryImage} aria-hidden="true">
        {category.image ? (
          <PublicDishImage
            alt=""
            priority={priority}
            quality={90}
            sizes="(max-width: 520px) 260px, 330px"
            src={category.image}
            objectPosition={category.imageObjectPosition}
          />
        ) : null}
      </span>
      <span className={styles.categoryShade} aria-hidden="true" />
      <span className={styles.categoryCopy}>
        <strong>{category.name}</strong>
        <small>{category.description}</small>
      </span>
    </article>
  );
}

function FeaturedDishPreview({ dish }: { dish: CompareDishPreview }) {
  return (
    <article className={styles.featuredDish}>
      <span className={styles.featuredImage} aria-hidden="true">
        {dish.image ? (
          <PublicDishImage
            alt=""
            quality={90}
            sizes="72px"
            src={dish.image}
            objectPosition={dish.imageObjectPosition}
          />
        ) : null}
      </span>
      <span className={styles.featuredCopy}>
        <strong>{dish.name}</strong>
        <small>{dish.shortDescription}</small>
      </span>
      <span className={styles.featuredPrice}>{dish.price}</span>
    </article>
  );
}

export function VistairePreviewMenuLayer({
  preview,
  prioritizeFirstCategory = true
}: {
  preview: PdfComparePreviewData;
  prioritizeFirstCategory?: boolean;
}) {
  const featuredDish = preview.featuredDish ?? preview.vistaireDishes[0];
  const presentation = preview.presentation ?? {
    theme: "maison-elyse" as const,
    eyebrow: "Carte à table",
    title: "Bienvenue chez Maison Élyse",
    tagline:
      "Découvrez les entrées, plats signatures, desserts et cocktails de la maison, pensés pour être explorés directement à table.",
    featuredKicker: "Suggestion du chef",
    featuredTitle: "À découvrir ce soir",
    cta: "Voir toute la carte"
  };

  return (
    <div
      className={styles.previewMenu}
      data-preview-theme={presentation.theme}
    >
      <header className={styles.previewHeader}>
        <p className={styles.previewEyebrow}>{presentation.eyebrow}</p>
        <h3>{presentation.title}</h3>
        <p className={styles.previewTagline}>{presentation.tagline}</p>
      </header>

      <div className={styles.categoryGrid}>
        {preview.categoryCards.map((category, index) => (
          <CategoryPreviewCard
            category={category}
            key={category.id}
            priority={prioritizeFirstCategory && index === 0}
          />
        ))}
      </div>

      {featuredDish ? (
        <section className={styles.featuredSection}>
          <p className={styles.featuredKicker}>
            {presentation.featuredKicker}
          </p>
          <h4>{presentation.featuredTitle}</h4>
          <FeaturedDishPreview dish={featuredDish} />
          <span className={styles.previewCta}>{presentation.cta}</span>
        </section>
      ) : null}
    </div>
  );
}

export function VistairePreviewPdfCompareSlider({
  preview,
  digitalLayer,
  className = "",
  locale = "fr",
  strings
}: VistairePreviewPdfCompareSliderProps) {
  const localeCopy = getLandingCopy(locale).comparison;
  const sliderId = useId();
  const sliderRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const nextSplitRef = useRef(50);
  const draggingRef = useRef(false);
  const [split, setSplit] = useState(50);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const commitSplit = (value: number) => {
    const next = clamp(value, 0, 100);
    nextSplitRef.current = next;

    if (frameRef.current !== null) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const committed = nextSplitRef.current;
      sliderRef.current?.style.setProperty("--split", `${committed}%`);
      setSplit(Math.round(committed));
    });
  };

  const updateFromClientX = (clientX: number) => {
    const wrapper = sliderRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0) return;
    commitSplit(((clientX - rect.left) / rect.width) * 100);
    if (!hasInteracted) setHasInteracted(true);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== undefined && event.button !== 0) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientX(event.clientX);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 4;
    let next = split;

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = split - step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = split + step;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 100;
        break;
      default:
        return;
    }

    event.preventDefault();
    commitSplit(next);
    if (!hasInteracted) setHasInteracted(true);
  };

  return (
    <figure
      className={`${styles.figure} ${className}`}
      data-preview-comparison="pdf-vs-digital"
    >
      <div className={styles.phoneFrame}>
        <span className={styles.notch} aria-hidden="true" />
        <div className={styles.screen}>
          <div
            ref={sliderRef}
            className={styles.slider}
          >
            <div className={styles.vistaireLayer} id={`${sliderId}-vistaire`}>
              {digitalLayer}
            </div>
            <div className={styles.pdfLayer} id={`${sliderId}-pdf`}>
              <VistairePreviewPdfLayer
                locale={locale}
                restaurantName={preview.restaurant.name}
                sections={preview.pdfSections}
                strings={{
                  pdfRegionLabel:
                    strings?.pdfRegionLabel ?? localeCopy.pdfRegionLabel,
                  pdfTitle: strings?.pdfTitle ?? localeCopy.pdfTitle
                }}
              />
            </div>

            <div
              aria-controls={`${sliderId}-pdf ${sliderId}-vistaire`}
              aria-label={
                strings?.label ??
                localeCopy.revealLabel
              }
              aria-orientation="horizontal"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={split}
              aria-valuetext={
                locale === "en"
                  ? `${split} percent PDF, ${100 - split} percent Vistaire`
                  : `${split} pour cent PDF, ${100 - split} pour cent Vistaire`
              }
              className={styles.handle}
              onKeyDown={onKeyDown}
              onLostPointerCapture={() => {
                draggingRef.current = false;
              }}
              onPointerCancel={onPointerUp}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              role="slider"
              tabIndex={0}
            >
              <span className={styles.handleLine} />
              <span className={styles.handleButton}>
                <svg
                  aria-hidden="true"
                  fill="none"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                >
                  <path
                    d="M9 6 4 12l5 6m6-12 5 6-5 6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </svg>
              </span>
            </div>

            {!hasInteracted ? (
              <span className={styles.hint}>
                {strings?.hint ??
                  localeCopy.revealHint}
              </span>
            ) : null}
          </div>
        </div>
        <span className={styles.homeBar} aria-hidden="true">
          <span />
        </span>
      </div>
      <figcaption className={styles.srOnly}>
        {strings?.caption ??
          localeCopy.figureCaption}
      </figcaption>
    </figure>
  );
}
