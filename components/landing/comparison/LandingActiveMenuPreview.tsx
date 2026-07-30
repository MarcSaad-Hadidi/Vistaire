"use client";

import dynamic from "next/dynamic";
import type { LandingMenuPreviewPayload } from "@/lib/landing/menuExperiences";
import styles from "./LandingActiveMenuPreview.module.css";

const MaisonElyseComparisonPreview = dynamic(
  () =>
    import("./MaisonElyseComparisonPreview").then(
      (module) => module.MaisonElyseComparisonPreview
    ),
  { loading: PreviewLoading, ssr: false }
);

const TrouvableComparisonPreview = dynamic(
  () =>
    import("./TrouvableComparisonPreview").then(
      (module) => module.TrouvableComparisonPreview
    ),
  { loading: PreviewLoading, ssr: false }
);

const SaugeNoireComparisonPreview = dynamic(
  () =>
    import("./SaugeNoireComparisonPreview").then(
      (module) => module.SaugeNoireComparisonPreview
    ),
  { loading: PreviewLoading, ssr: false }
);

function PreviewLoading() {
  return (
    <span aria-hidden="true" className={styles.loading}>
      Vistaire
    </span>
  );
}

export function LandingActiveMenuPreview({
  payload
}: {
  payload: LandingMenuPreviewPayload | null | undefined;
}) {
  if (payload === undefined) {
    return <PreviewLoading />;
  }

  if (!payload) {
    return (
      <div className={styles.unavailable} data-public-menu-renderer="unavailable">
        Aperçu temporairement indisponible
      </div>
    );
  }

  if (payload.kind === "maison-elyse") {
    return (
      <div
        aria-label={`${payload.comparison.restaurant.name}, carte digitale Vistaire`}
        className={styles.rendererShell}
        data-comparison-scroll-root="digital"
        data-display-mode="comparison-preview"
        data-landing-menu-renderer="maison-elyse"
        data-public-menu-renderer="maison-elyse"
        role="region"
        tabIndex={0}
      >
        <MaisonElyseComparisonPreview preview={payload.comparison} />
      </div>
    );
  }

  if (payload.kind === "trouvable") {
    return (
      <div
        aria-label={`${payload.comparison.restaurant.name}, carte digitale Vistaire`}
        className={styles.rendererShell}
        data-comparison-scroll-root="digital"
        data-display-mode="comparison-preview"
        data-landing-menu-renderer="trouvable"
        data-public-menu-renderer="trouvable"
        role="region"
        tabIndex={0}
      >
        <TrouvableComparisonPreview preview={payload.comparison} />
      </div>
    );
  }

  if (
    payload.rendererKey === "sauge-noire-book-v1" &&
    payload.rendererVersion === 1
  ) {
    return (
      <div
        aria-label={`${payload.comparison.restaurant.name}, carte digitale Vistaire`}
        className={styles.rendererShell}
        data-comparison-scroll-root="digital"
        data-display-mode="comparison-preview"
        data-landing-menu-renderer="sauge-noire"
        data-public-menu-renderer="sauge-noire"
        role="region"
        tabIndex={0}
      >
        <SaugeNoireComparisonPreview preview={payload.comparison} />
      </div>
    );
  }

  return null;
}
