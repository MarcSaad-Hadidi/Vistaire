import type { Metadata, Viewport } from "next";
import { LOCALE_LANGUAGE_TAG, type Locale } from "@/lib/i18n";
import {
  DEFAULT_SITE_DESCRIPTION,
  SITE_NAME,
  getSiteUrl
} from "@/lib/seo";

const FRENCH_ROOT_TITLE = "Vistaire | Menu digital premium pour restaurants";
const ENGLISH_ROOT_TITLE =
  "Vistaire | Premium QR digital menu for high-end restaurants";
const ENGLISH_ROOT_DESCRIPTION =
  "Vistaire creates a premium mobile-first digital menu for high-end restaurants: QR code, visual dish pages, allergens and selective 3D/AR.";

export const ROOT_VIEWPORT: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#080706"
};

export function buildRootMetadata(locale: Locale): Metadata {
  const english = locale === "en";
  const title = english ? ENGLISH_ROOT_TITLE : FRENCH_ROOT_TITLE;
  const description = english
    ? ENGLISH_ROOT_DESCRIPTION
    : DEFAULT_SITE_DESCRIPTION;
  const openGraphLocale = LOCALE_LANGUAGE_TAG[locale].replace("-", "_");

  return {
    metadataBase: getSiteUrl(),
    title: {
      default: title,
      template: `%s | ${SITE_NAME}`
    },
    description,
    applicationName: SITE_NAME,
    creator: SITE_NAME,
    publisher: SITE_NAME,
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    },
    openGraph: {
      type: "website",
      locale: openGraphLocale,
      siteName: SITE_NAME,
      title,
      description
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}
