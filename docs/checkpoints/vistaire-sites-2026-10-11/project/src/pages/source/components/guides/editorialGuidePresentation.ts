import type { StaticImageData } from "../../../NativeImage.tsx";
const restaurantBackground = "/assets/pages/Framer/PhotoRestoComplet5.webp";
const restaurantBackground2 = "/assets/pages/Framer/PhotoRestoComplet6.webp";
const restaurantBackground3 = "/assets/pages/Framer/PhotoRestoComplet4.webp";
const pageDigitalPhoto = "/assets/pages/Framer/PageDigital.webp";
const photoDigital2 = "/assets/pages/Framer/PhotoDigital2.webp";
const photoQrCode1 = "/assets/pages/Framer/PhotoQRcode1.webp";
import type {
  EditorialGuideKey,
  EditorialGuideLocale,
} from "../../lib/editorialGuideRoutes.ts";

export type GuideSectionLayout = "feature" | "split" | "table" | "quiet";
export type EditorialGuideVariant = "anatomy" | "journey" | "decision";

export type EditorialGuidePresentation = {
  heroImage: StaticImageData;
  heroImageAlt: { fr: string; en: string };
  backgroundImage: StaticImageData;
  heroVariant: "visual-right" | "visual-left" | "editorial-stack";
  guideVariant: EditorialGuideVariant;
  sectionLayouts: Record<string, GuideSectionLayout>;
};

const PRESENTATIONS: Record<EditorialGuideKey, EditorialGuidePresentation> = {
  "premium-menu-anatomy": {
    heroImage: pageDigitalPhoto,
    backgroundImage: restaurantBackground,
    heroImageAlt: {
      fr: "Aperçu d’une fiche plat Vistaire sur téléphone",
      en: "Preview of a Vistaire dish page on a phone",
    },
    heroVariant: "visual-right",
    guideVariant: "anatomy",
    sectionLayouts: {
      hierarchie: "feature",
      "fiche-plat": "table",
      photos: "split",
      allergenes: "feature",
      "marque-vitesse": "quiet",
      "3d-selective": "split",
      hierarchy: "feature",
      "dish-page": "table",
      photography: "split",
      allergens: "feature",
      "brand-performance": "quiet",
      "selective-3d": "split",
    },
  },
  "mobile-qr-without-app": {
    heroImage: photoQrCode1,
    backgroundImage: restaurantBackground2,
    heroImageAlt: {
      fr: "Carte de restaurant Vistaire ouverte après un scan QR",
      en: "Vistaire restaurant menu opened after a QR scan",
    },
    heroVariant: "visual-left",
    guideVariant: "journey",
    sectionLayouts: {
      parcours: "feature",
      placement: "split",
      "lien-stable": "table",
      lisibilite: "feature",
      "reseau-repli": "quiet",
      "maintenance-securite": "split",
      journey: "feature",
      "stable-link": "table",
      readability: "feature",
      "network-fallback": "quiet",
      "maintenance-security": "split",
    },
  },
  "restaurant-3d-decision": {
    heroImage: photoDigital2,
    backgroundImage: restaurantBackground3,
    heroImageAlt: {
      fr: "Présentation d’un plat Vistaire avec une vue immersive",
      en: "Vistaire dish presentation with an immersive view",
    },
    heroVariant: "editorial-stack",
    guideVariant: "decision",
    sectionLayouts: {
      question: "feature",
      "positive-cases": "split",
      "negative-cases": "table",
      performance: "quiet",
      "fallback-compatibility": "split",
      governance: "feature",
      "cas-positifs": "split",
      "cas-negatifs": "table",
      "repli-compatibilite": "split",
      gouvernance: "feature",
    },
  },
};

export function getEditorialGuidePresentation(
  key: EditorialGuideKey,
  locale: EditorialGuideLocale,
): EditorialGuidePresentation & { locale: EditorialGuideLocale } {
  const presentation = PRESENTATIONS[key];

  if (!presentation) {
    throw new Error(`Missing editorial guide presentation: ${key}`);
  }

  return { ...presentation, locale };
}
