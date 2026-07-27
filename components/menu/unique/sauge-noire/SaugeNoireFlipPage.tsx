"use client";

import { forwardRef, type ReactNode } from "react";
import styles from "./SaugeNoireBookMenu.module.css";

export type SaugeNoireFlipPageDensity = "hard" | "soft";

type SaugeNoireFlipPageProps = {
  children: ReactNode;
  density: SaugeNoireFlipPageDensity;
  index: number;
};

/**
 * StPageFlip owns the page element after mount. Keeping this wrapper small
 * lets the existing Sauge Noire page components remain the only content
 * source while still exposing the real HTML page to the engine.
 */
export const SaugeNoireFlipPage = forwardRef<HTMLDivElement, SaugeNoireFlipPageProps>(
  function SaugeNoireFlipPage({ children, density, index }, ref) {
    return (
      <div
        ref={ref}
        className={styles.pageFlipPage}
        data-density={density}
        data-sauge-flip-page-index={index}
      >
        {children}
      </div>
    );
  }
);

SaugeNoireFlipPage.displayName = "SaugeNoireFlipPage";
