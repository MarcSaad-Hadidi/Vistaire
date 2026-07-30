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
import styles from "./VistairePreviewPdfCompareSlider.module.css";

type VistairePreviewPdfCompareSliderProps = {
  preview: PdfComparePreviewData;
  digitalLayer: ReactNode;
  className?: string;
  locale?: Locale;
  strings?: {
    caption: string;
    hint: string;
    label: string;
  };
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
  restaurantName,
  sections
}: {
  restaurantName: string;
  sections: PdfMenuSection[];
}) {
  return (
    <div className={styles.pdfScene} aria-hidden="true">
      <span className={`${styles.layerLabel} ${styles.pdfLabel}`}>PDF</span>
      <div className={styles.pdfContent}>
        <p className={styles.pdfRestaurant}>{restaurantName}</p>
        <h3 className={styles.pdfTitle}>Carte</h3>
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
            role="slider"
            tabIndex={0}
            aria-label={
              strings?.label ??
              (locale === "en"
                ? "Compare a PDF menu with the current Vistaire digital menu."
                : "Comparer un menu PDF avec la carte digitale Vistaire actuelle.")
            }
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={split}
            aria-valuetext={
              locale === "en"
                ? `${split} percent PDF, ${100 - split} percent Vistaire`
                : `${split} pour cent PDF, ${100 - split} pour cent Vistaire`
            }
            aria-controls={`${sliderId}-pdf ${sliderId}-vistaire`}
            className={styles.slider}
            onKeyDown={onKeyDown}
            onPointerCancel={onPointerUp}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div className={styles.vistaireLayer} id={`${sliderId}-vistaire`}>
              {digitalLayer}
            </div>
            <div
              aria-hidden="true"
              className={styles.pdfLayer}
              id={`${sliderId}-pdf`}
            >
              <VistairePreviewPdfLayer
                restaurantName={preview.restaurant.name}
                sections={preview.pdfSections}
              />
            </div>

            <span className={styles.handle} aria-hidden="true">
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
            </span>

            {!hasInteracted ? (
              <span className={styles.hint}>
                {strings?.hint ??
                  (locale === "en" ? "Drag to compare" : "Glissez pour comparer")}
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
          (locale === "en"
            ? `Comparison inside one phone: a PDF example and the current ${preview.restaurant.name} digital menu.`
            : `Comparaison dans un même téléphone : un exemple PDF et la carte digitale actuelle de ${preview.restaurant.name}.`)}
      </figcaption>
    </figure>
  );
}
