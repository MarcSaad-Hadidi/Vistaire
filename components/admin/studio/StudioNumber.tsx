"use client";

import NumberFlow, { useCanAnimate } from "@number-flow/react";
import { useStudioLocale } from "./studioLocale";
import styles from "./Studio.module.css";

/** Approved v29 metric island: NumberFlow with a single readable value for AT. */
export function StudioNumber({ value }: { value: number | null | undefined }) {
  const { locale, number } = useStudioLocale();
  const animated = useCanAnimate({ respectMotionPreference: true });
  if (typeof value !== "number" || !Number.isFinite(value)) return <>N/A</>;
  return (
    <span data-component="number-flow">
      <span className={styles.srOnly}>{number(value)}</span>
      <span aria-hidden="true">
        <NumberFlow
          value={value}
          locales={locale === "en" ? "en-CA" : "fr-CA"}
          format={{ maximumFractionDigits: 0 }}
          animated={animated}
          respectMotionPreference
          willChange={false}
        />
      </span>
    </span>
  );
}
