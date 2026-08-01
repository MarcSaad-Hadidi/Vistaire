"use client";

import { useMemo } from "react";
import { MaisonElyseQrMenu } from "@/components/menu/MaisonElyseQrMenu";
import type { Locale } from "@/lib/i18n";
import {
  inflateLandingLocalizedMenus,
  inflateLandingMenuUiMenu,
  type LandingMenuUiPreview
} from "@/lib/landing/landingMenuUiPreview";

export function MaisonElyseComparisonPreview({
  locale,
  menuUi
}: {
  locale: Locale;
  menuUi: LandingMenuUiPreview;
}) {
  const menu = useMemo(
    () => inflateLandingMenuUiMenu(menuUi.menu),
    [menuUi.menu]
  );
  const localizedMenus = useMemo(
    () => inflateLandingLocalizedMenus(menuUi.localizedMenus),
    [menuUi.localizedMenus]
  );

  return (
    <MaisonElyseQrMenu
      config={menuUi.config}
      displayMode="comparison-preview"
      locale={locale}
      localizedMenus={localizedMenus}
      menu={menu}
      query={menuUi.query}
      showGoogleReview={false}
    />
  );
}
