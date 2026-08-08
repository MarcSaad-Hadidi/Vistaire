"use client";

import { useMemo } from "react";
import { trouvableTypographyClassName } from "@/app/menu/[slug]/trouvableTypography";
import { TrouvablePremiumMenuExperience } from "@/components/menu/TrouvablePremiumMenuExperience";
import {
  inflateLandingMenuUiMenu,
  type LandingMenuUiPreview
} from "@/lib/landing/landingMenuUiPreview";

export function TrouvableComparisonPreview({
  displayMode = "comparison-preview",
  menuUi
}: {
  displayMode?: "comparison-preview" | "phone-preview";
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
      displayMode={displayMode}
      exchangeRates={menuUi.exchangeRates}
      menu={menu}
      query={menuUi.query}
      typographyClassName={trouvableTypographyClassName}
    />
  );
}
