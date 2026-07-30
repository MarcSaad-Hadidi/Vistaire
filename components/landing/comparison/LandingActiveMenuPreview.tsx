"use client";

import dynamic from "next/dynamic";
import type { LandingMenuPreviewPayload } from "@/lib/landing/menuExperiences";
import styles from "./LandingActiveMenuPreview.module.css";

const MaisonElyseQrMenu = dynamic(
  () =>
    import("@/components/menu/MaisonElyseQrMenu").then(
      (module) => module.MaisonElyseQrMenu
    ),
  { loading: PreviewLoading, ssr: false }
);

const TrouvablePremiumMenuExperience = dynamic(
  () =>
    import("@/components/menu/TrouvablePremiumMenuExperience").then(
      (module) => module.TrouvablePremiumMenuExperience
    ),
  { loading: PreviewLoading, ssr: false }
);

const SaugeNoireBookMenu = dynamic(
  () =>
    import("@/components/menu/unique/sauge-noire/SaugeNoireBookMenu").then(
      (module) => module.SaugeNoireBookMenu
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
        aria-hidden="true"
        className={styles.rendererShell}
        data-landing-menu-renderer="maison-elyse"
        data-phone-mockup-scroll=""
        inert
      >
        <MaisonElyseQrMenu
          config={payload.config}
          displayMode="phone-preview"
          locale={payload.locale}
          localizedMenus={payload.localizedMenus}
          menu={payload.menu}
          query={payload.query}
          showGoogleReview={false}
        />
      </div>
    );
  }

  if (payload.kind === "trouvable") {
    return (
      <div
        aria-hidden="true"
        className={styles.rendererShell}
        data-landing-menu-renderer="trouvable"
        data-phone-mockup-scroll=""
        inert
      >
        <TrouvablePremiumMenuExperience
          config={payload.config}
          displayMode="phone-preview"
          exchangeRates={payload.exchangeRates}
          menu={payload.menu}
          query={payload.query}
        />
      </div>
    );
  }

  if (
    payload.rendererKey === "sauge-noire-book-v1" &&
    payload.rendererVersion === 1
  ) {
    return (
      <div
        aria-hidden="true"
        className={styles.rendererShell}
        data-landing-menu-renderer="sauge-noire"
        data-phone-mockup-scroll=""
        inert
      >
        <SaugeNoireBookMenu
          config={payload.config}
          exchangeRates={payload.exchangeRates}
          locale={payload.locale}
          menu={payload.menu}
          mode="phone-preview"
          query={payload.query}
        />
      </div>
    );
  }

  return null;
}
