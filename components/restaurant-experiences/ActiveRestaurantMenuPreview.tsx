"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { LOCALE_LANGUAGE_TAG } from "@/lib/i18n";
import {
  payloadMatchesExperience,
  type RestaurantExperienceId,
  type RestaurantMenuPreviewPayload
} from "@/lib/restaurant-experiences/contracts";
import styles from "./ActiveRestaurantMenuPreview.module.css";

const MaisonElyseComparisonPreview = dynamic(
  () =>
    import("@/components/landing/comparison/MaisonElyseComparisonPreview").then(
      (module) => module.MaisonElyseComparisonPreview
    ),
  { ssr: false }
);

const TrouvableComparisonPreview = dynamic(
  () =>
    import("@/components/landing/comparison/TrouvableComparisonPreview").then(
      (module) => module.TrouvableComparisonPreview
    ),
  { ssr: false }
);

const SaugeNoireComparisonPreview = dynamic(
  () =>
    import("@/components/landing/comparison/SaugeNoireComparisonPreview").then(
      (module) => module.SaugeNoireComparisonPreview
    ),
  { ssr: false }
);

type PreviewStatusProps = {
  children: ReactNode;
  status: "error" | "fallback" | "loading";
};

function PreviewStatus({ children, status }: PreviewStatusProps) {
  return (
    <div
      aria-live="polite"
      className={status === "error" ? styles.error : styles.status}
      data-preview-status={status}
      role={status === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

type PreviewDisplayMode = "comparison-preview" | "phone-preview";

function rendererFor(
  payload: RestaurantMenuPreviewPayload,
  displayMode: PreviewDisplayMode
): ReactNode {
  if (payload.kind === "maison-elyse") {
    return (
      <MaisonElyseComparisonPreview
        displayMode={displayMode}
        locale={payload.locale}
        menuUi={payload.menuUi}
      />
    );
  }
  if (payload.kind === "trouvable") {
    return (
      <TrouvableComparisonPreview
        displayMode={displayMode}
        menuUi={payload.menuUi}
      />
    );
  }
  if (
    payload.rendererKey === "sauge-noire-book-v1" &&
    payload.rendererVersion === 1
  ) {
    return (
      <SaugeNoireComparisonPreview
        displayMode={displayMode}
        locale={payload.locale}
        menuUi={payload.menuUi}
      />
    );
  }
  return null;
}

export function ActiveRestaurantMenuPreview({
  errorMessage = "This restaurant menu preview is unavailable.",
  expectedExperienceId,
  fallback,
  fallbackMessage = "The selected restaurant preview is unavailable.",
  loadingMessage = "Loading menu preview…",
  payload,
  displayMode = "comparison-preview"
}: {
  errorMessage?: string;
  expectedExperienceId: RestaurantExperienceId;
  fallback?: ReactNode;
  fallbackMessage?: string;
  loadingMessage?: string;
  payload: RestaurantMenuPreviewPayload | null | undefined;
  displayMode?: PreviewDisplayMode;
}) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const rendererIdentity =
    payload?.kind === "unique-registered"
      ? `${payload.rendererKey}:${payload.rendererVersion}`
      : "";
  const previewKey = payload
    ? `${payload.menuSlug}:${payload.locale}:${payload.kind}:${rendererIdentity}`
    : expectedExperienceId;
  const isExpectedPayload =
    payload !== null &&
    payload !== undefined &&
    payloadMatchesExperience(payload, expectedExperienceId);
  const renderer = useMemo(
    () =>
      isExpectedPayload && payload ? rendererFor(payload, displayMode) : null,
    [displayMode, isExpectedPayload, payload]
  );

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;
    scrollRoot.scrollTop = 0;
    scrollRoot.scrollLeft = 0;
  }, [previewKey]);

  if (payload === undefined) {
    return <PreviewStatus status="loading">{loadingMessage}</PreviewStatus>;
  }

  if (payload === null) {
    return (
      <PreviewStatus status="fallback">
        {fallback ?? fallbackMessage}
      </PreviewStatus>
    );
  }

  if (!isExpectedPayload || !renderer) {
    return <PreviewStatus status="error">{errorMessage}</PreviewStatus>;
  }

  return (
    <div
      aria-label={`${payload.comparison.restaurant.name} menu preview`}
      className={styles.rendererShell}
      data-comparison-scroll-root="digital"
      data-display-mode={displayMode}
      data-landing-menu-renderer={expectedExperienceId}
      data-menu-active-locale={
        payload.menuUi.menu.activeLocale ?? LOCALE_LANGUAGE_TAG[payload.locale]
      }
      data-menu-slug={payload.menuSlug}
      data-preview-status="ready"
      lang={LOCALE_LANGUAGE_TAG[payload.locale]}
      ref={scrollRootRef}
      role="region"
      tabIndex={0}
    >
      <div key={previewKey}>{renderer}</div>
    </div>
  );
}
