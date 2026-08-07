"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode
} from "react";
import type { Locale } from "@/lib/i18n";
import type { PdfComparePreviewData } from "@/lib/pdfComparePreviewData";
import {
  VistairePreviewMenuLayer,
  VistairePreviewPdfLayer
} from "./VistairePreviewPdfCompareSlider";
import sliderStyles from "./VistairePreviewPdfCompareSlider.module.css";
import styles from "./VistairePdfToDigitalHoverReveal.module.css";

type VistairePdfToDigitalHoverRevealProps = {
  preview: PdfComparePreviewData;
  locale?: Locale;
  prioritizePreviewImages?: boolean;
  digitalLayer?: ReactNode;
  strings?: {
    caption: string;
    hint: string;
    label: string;
  };
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function VistairePdfToDigitalHoverReveal({
  preview,
  locale = "fr",
  prioritizePreviewImages = true,
  digitalLayer,
  strings
}: VistairePdfToDigitalHoverRevealProps) {
  const captionId = useId();
  const frameId = useId();
  const activeTouchRectRef = useRef<DOMRect | null>(null);
  const [locked, setLocked] = useState(false);
  const [fingerActive, setFingerActive] = useState(false);
  const copy = strings ?? {
    caption:
      locale === "en"
        ? "Interactive comparison between a PDF menu and a Vistaire digital menu."
        : "Comparaison interactive entre un menu PDF et une carte digitale Vistaire.",
    hint:
      locale === "en"
        ? "Hover or touch to reveal Vistaire"
        : "Survolez ou touchez pour révéler Vistaire",
    label:
      locale === "en"
        ? "Reveal the Vistaire digital menu over the PDF menu"
        : "Révéler le menu digital Vistaire par-dessus le menu PDF"
  };

  const updateRevealPosition = (event: PointerEvent<HTMLDivElement>) => {
    const rect =
      activeTouchRectRef.current ?? event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
    const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
    event.currentTarget.style.setProperty("--reveal-x", `${x}%`);
    event.currentTarget.style.setProperty("--reveal-y", `${y}%`);
  };

  const clearTouchInteraction = (event: PointerEvent<HTMLDivElement>) => {
    setFingerActive(false);
    activeTouchRectRef.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may already have released the pointer.
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      activeTouchRectRef.current = event.currentTarget.getBoundingClientRect();
    }

    updateRevealPosition(event);

    if (event.pointerType !== "touch") return;
    setFingerActive(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    updateRevealPosition(event);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setLocked(false);
      event.currentTarget.focus();
      return;
    }

    if (event.target !== event.currentTarget) return;

    if (!locked && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setLocked(true);
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      clearTouchInteraction(event);
    }
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof Element) {
      const nestedControl = target.closest(
        'a, button, input, select, textarea, [role="button"], [role="slider"]'
      );
      if (nestedControl && nestedControl !== event.currentTarget) return;
    }
    setLocked((current) => !current);
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    clearTouchInteraction(event);
  };

  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    clearTouchInteraction(event);
  };

  return (
    <figure
      className={styles.figure}
      data-preview-interaction="pdf-to-vistaire-hover-reveal"
    >
      <div className={sliderStyles.phoneFrame}>
        <span className={sliderStyles.notch} aria-hidden="true" />
        <div className={sliderStyles.screen}>
          <div
            aria-describedby={captionId}
            aria-keyshortcuts="Enter Space Escape"
            aria-label={copy.label}
            aria-pressed={locked ? undefined : false}
            className={styles.frame}
            data-preview-reveal-frame="true"
            data-revealed={locked ? "true" : "false"}
            data-reveal-locked={locked ? "true" : "false"}
            data-touching={fingerActive ? "true" : "false"}
            id={frameId}
            onClick={onClick}
            onKeyDown={onKeyDown}
            onPointerCancel={onPointerCancel}
            onPointerDown={onPointerDown}
            onPointerLeave={onPointerLeave}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            role={locked ? "group" : "button"}
            style={{ touchAction: "pan-y pinch-zoom" }}
            tabIndex={0}
          >
            <div
              aria-hidden={!locked}
              className={styles.vistaireLayer}
              data-preview-digital-layer="true"
              inert={!locked}
            >
              {digitalLayer ?? (
                <VistairePreviewMenuLayer
                  preview={preview}
                  prioritizeFirstCategory={prioritizePreviewImages}
                />
              )}
            </div>
            <div className={styles.pdfLayer} aria-hidden="true">
              <VistairePreviewPdfLayer
                locale={locale}
                restaurantName={preview.restaurant.name}
                sections={preview.pdfSections}
              />
            </div>

            <span className={styles.cursorRing} aria-hidden="true" />
            <span className={styles.hint} aria-hidden="true">
              {copy.hint}
            </span>
          </div>
        </div>
        <span className={sliderStyles.homeBar} aria-hidden="true">
          <span />
        </span>
      </div>

      <figcaption id={captionId} className="sr-only">
        {copy.caption}
      </figcaption>
    </figure>
  );
}
