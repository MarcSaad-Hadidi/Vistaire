"use client";

import dynamic from "next/dynamic";
import { LOCALE_LANGUAGE_TAG, type Locale } from "@/lib/i18n";
import type { LandingCopy } from "@/lib/landing/landingCopy";
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
  copy,
  locale,
  payload
}: {
  copy: LandingCopy["comparison"];
  locale: Locale;
  payload: LandingMenuPreviewPayload | null | undefined;
}) {
  if (payload === undefined) {
    return (
      <div
        aria-live="polite"
        className={styles.loading}
        lang={LOCALE_LANGUAGE_TAG[locale]}
        role="status"
      >
        {copy.loadingStatus}
      </div>
    );
  }

  if (!payload) {
    return (
      <div
        aria-live="polite"
        className={styles.unavailable}
        data-public-menu-renderer="unavailable"
        lang={LOCALE_LANGUAGE_TAG[locale]}
        role="status"
      >
        {copy.unavailableStatus}
      </div>
    );
  }

  if (payload.kind === "maison-elyse") {
    return (
      <div
        aria-label={copy.digitalRegionLabel(payload.comparison.restaurant.name)}
        className={styles.rendererShell}
        data-comparison-scroll-root="digital"
        data-display-mode="comparison-preview"
        data-landing-menu-renderer="maison-elyse"
        data-menu-ui="maison-elyse"
        lang={LOCALE_LANGUAGE_TAG[locale]}
        role="region"
        tabIndex={0}
      >
        <MaisonElyseComparisonPreview
          locale={payload.locale}
          menuUi={payload.menuUi}
        />
      </div>
    );
  }

  if (payload.kind === "trouvable") {
    return (
      <div
        aria-label={copy.digitalRegionLabel(payload.comparison.restaurant.name)}
        className={styles.rendererShell}
        data-comparison-scroll-root="digital"
        data-display-mode="comparison-preview"
        data-landing-menu-renderer="trouvable"
        data-menu-ui="trouvable"
        lang={LOCALE_LANGUAGE_TAG[locale]}
        role="region"
        tabIndex={0}
      >
        <TrouvableComparisonPreview menuUi={payload.menuUi} />
      </div>
    );
  }

  if (
    payload.rendererKey === "sauge-noire-book-v1" &&
    payload.rendererVersion === 1
  ) {
    return (
      <div
        aria-label={copy.digitalRegionLabel(payload.comparison.restaurant.name)}
        className={styles.rendererShell}
        data-comparison-scroll-root="digital"
        data-display-mode="comparison-preview"
        data-landing-menu-renderer="sauge-noire"
        data-menu-ui="sauge-noire"
        lang={LOCALE_LANGUAGE_TAG[locale]}
        role="region"
        tabIndex={0}
      >
        <SaugeNoireComparisonPreview
          locale={payload.locale}
          menuUi={payload.menuUi}
        />
      </div>
    );
  }

  return null;
}
