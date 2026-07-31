"use client";

import dynamic from "next/dynamic";
import { LOCALE_LANGUAGE_TAG, type Locale } from "@/lib/i18n";
import {
  formatLandingCopyTemplate,
  type LandingCopy
} from "@/lib/landing/landingCopy";
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
  payload,
  menuSlug
}: {
  copy: LandingCopy["comparison"];
  locale: Locale;
  payload: LandingMenuPreviewPayload | null | undefined;
  menuSlug: string;
}) {
  if (payload === undefined) {
    return (
      <div
        aria-live="polite"
        className={styles.loading}
        data-menu-slug={menuSlug}
        data-preview-locale={LOCALE_LANGUAGE_TAG[locale]}
        data-preview-status="loading"
        data-translation-status="unknown"
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
        data-menu-active-locale={LOCALE_LANGUAGE_TAG[locale]}
        data-menu-slug={menuSlug}
        data-preview-locale={LOCALE_LANGUAGE_TAG[locale]}
        data-preview-status="unavailable"
        data-public-menu-renderer="unavailable"
        data-translation-status="unavailable"
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
        aria-label={formatLandingCopyTemplate(copy.digitalRegionLabel, {
          restaurantName: payload.comparison.restaurant.name
        })}
        className={styles.rendererShell}
        data-comparison-scroll-root="digital"
        data-display-mode="comparison-preview"
        data-landing-menu-renderer="maison-elyse"
        data-menu-active-locale={payload.menuUi.menu.activeLocale ?? LOCALE_LANGUAGE_TAG[payload.locale]}
        data-menu-slug={payload.menuSlug}
        data-menu-ui="maison-elyse"
        data-preview-locale={LOCALE_LANGUAGE_TAG[payload.locale]}
        data-preview-status="ready"
        data-translation-status={payload.menuUi.menu.translationStatus?.status ?? "unknown"}
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
        aria-label={formatLandingCopyTemplate(copy.digitalRegionLabel, {
          restaurantName: payload.comparison.restaurant.name
        })}
        className={styles.rendererShell}
        data-comparison-scroll-root="digital"
        data-display-mode="comparison-preview"
        data-landing-menu-renderer="trouvable"
        data-menu-active-locale={payload.menuUi.menu.activeLocale ?? LOCALE_LANGUAGE_TAG[payload.locale]}
        data-menu-slug={payload.menuSlug}
        data-menu-ui="trouvable"
        data-preview-locale={LOCALE_LANGUAGE_TAG[payload.locale]}
        data-preview-status="ready"
        data-translation-status={payload.menuUi.menu.translationStatus?.status ?? "unknown"}
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
        aria-label={formatLandingCopyTemplate(copy.digitalRegionLabel, {
          restaurantName: payload.comparison.restaurant.name
        })}
        className={styles.rendererShell}
        data-comparison-scroll-root="digital"
        data-display-mode="comparison-preview"
        data-landing-menu-renderer="sauge-noire"
        data-menu-active-locale={payload.menuUi.menu.activeLocale ?? LOCALE_LANGUAGE_TAG[payload.locale]}
        data-menu-slug={payload.menuSlug}
        data-menu-ui="sauge-noire"
        data-preview-locale={LOCALE_LANGUAGE_TAG[payload.locale]}
        data-preview-status="ready"
        data-translation-status={payload.menuUi.menu.translationStatus?.status ?? "unknown"}
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
