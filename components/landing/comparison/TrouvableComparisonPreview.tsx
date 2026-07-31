"use client";

import { useMemo } from "react";
import { TrouvablePremiumMenuExperience } from "@/components/menu/TrouvablePremiumMenuExperience";
import {
  inflateLandingMenuUiMenu,
  type LandingMenuUiPreview
} from "@/lib/landing/landingMenuUiPreview";

export function TrouvableComparisonPreview({
  menuUi
}: {
  menuUi: LandingMenuUiPreview;
}) {
  const menu = useMemo(
    () => inflateLandingMenuUiMenu(menuUi.menu),
    [menuUi.menu]
  );

  return (
    <TrouvablePremiumMenuExperience
      config={menuUi.config}
      context={menuUi.context}
      displayMode="comparison-preview"
      exchangeRates={menuUi.exchangeRates}
      menu={menu}
      query={menuUi.query}
    />
  );
}
