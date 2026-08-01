"use client";

import { useMemo } from "react";
import {
  SaugeNoireMenuPages,
  type SaugeNoirePageCopy
} from "@/components/menu/unique/sauge-noire/SaugeNoireMenuPages";
import type { Locale } from "@/lib/i18n";
import {
  inflateLandingMenuUiMenu,
  type LandingMenuUiPreview
} from "@/lib/landing/landingMenuUiPreview";

const COPY: Record<Locale, SaugeNoirePageCopy> = {
  fr: {
    tagline: "La braise, le végétal, le temps.",
    menu: "La Carte",
    city: "Montréal",
    open: "Tapotez pour ouvrir",
    contents: "Table des matières",
    touchSection: "Touchez une section pour l’ouvrir",
    swipeSection: "Balayez ou touchez une section",
    swipePage: "Faites défiler la page",
    previous: "Page précédente",
    next: "Page suivante",
    thanks: "Merci et à bientôt",
    soon: "Au plaisir de vous retrouver autour d’une prochaine assiette.",
    googleReview: "Laisser un avis Google",
    googleReviewAria: "Laisser un avis Google"
  },
  en: {
    tagline: "Fire, botanicals, and time.",
    menu: "The Menu",
    city: "Montréal",
    open: "Tap to open",
    contents: "Table of contents",
    touchSection: "Touch a section to open it",
    swipeSection: "Swipe or touch a section",
    swipePage: "Scroll through the page",
    previous: "Previous page",
    next: "Next page",
    thanks: "Thank you and see you soon",
    soon: "We look forward to welcoming you around the table again.",
    googleReview: "Leave a Google review",
    googleReviewAria: "Leave a Google review"
  }
};

export function SaugeNoireComparisonPreview({
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
  const localeTag =
    menuUi.query.lang?.toString() ?? (locale === "en" ? "en-CA" : "fr-CA");
  const currency =
    menuUi.query.currency ?? menu.settings.defaultCurrency;

  return (
    <SaugeNoireMenuPages
      copy={COPY[locale]}
      currency={currency}
      exchangeRates={menuUi.exchangeRates}
      locale={locale}
      localeTag={localeTag}
      menu={menu}
      query={menuUi.query}
    />
  );
}
