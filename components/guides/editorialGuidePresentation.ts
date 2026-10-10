import type { StaticImageData } from "next/image";
import { getSeoMarketingImage } from "@/lib/seoMarketingImages";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import restaurantBackground2 from "@/Framer/PhotoRestoComplet6.png";
import restaurantBackground3 from "@/Framer/PhotoRestoComplet4.png";
import type {
  EditorialGuideKey,
  EditorialGuideLocale
} from "@/lib/editorialGuideRoutes";

export type GuideSectionLayout = "feature" | "split" | "table" | "quiet";
export type EditorialGuideVariant = "anatomy" | "journey" | "decision";

export type EditorialGuidePresentation = {
  heroImageSlot: string;
  backgroundImage: StaticImageData;
  heroVariant: "visual-right" | "visual-left" | "editorial-stack";
  guideVariant: EditorialGuideVariant;
  sectionLayouts: Record<string, GuideSectionLayout>;
};

const PRESENTATIONS: Record<EditorialGuideKey, EditorialGuidePresentation> = {
  "premium-menu-anatomy": {
    heroImageSlot: "GUIDE-A:hero",
    backgroundImage: restaurantBackground,
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
      "selective-3d": "split"
    }
  },
  "mobile-qr-without-app": {
    heroImageSlot: "GUIDE-Q:hero",
    backgroundImage: restaurantBackground2,
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
      "maintenance-security": "split"
    }
  },
  "restaurant-3d-decision": {
    heroImageSlot: "GUIDE-3:hero",
    backgroundImage: restaurantBackground3,
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
      gouvernance: "feature"
    }
  }
};

export function getEditorialGuidePresentation(
  key: EditorialGuideKey,
  locale: EditorialGuideLocale
) {
  const presentation = PRESENTATIONS[key];

  if (!presentation) {
    throw new Error(`Missing editorial guide presentation: ${key}`);
  }

  const image = getSeoMarketingImage(presentation.heroImageSlot, locale);
  return { ...presentation, locale, heroImage: image.src, heroImageAlt: image.alt };
}
