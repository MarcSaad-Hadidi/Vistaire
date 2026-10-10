import type { StaticImageData } from "next/image";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import restaurantBackground2 from "@/Framer/PhotoRestoComplet6.png";
import restaurantBackground3 from "@/Framer/PhotoRestoComplet4.png";
import pageDigitalPhoto from "@/public/images/marketing/maison-elyse-souffle-phone.webp";
import photoDigital2 from "@/public/images/marketing/sauge-noire-dessert-phone.webp";
import photoQrCode1 from "@/public/images/marketing/sauge-noire-qr-menu.webp";
import type {
  EditorialGuideKey,
  EditorialGuideLocale
} from "@/lib/editorialGuideRoutes";

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
      fr: "Soufflé au chocolat et fiche dessert Maison Élyse sur téléphone",
      en: "Chocolate soufflé beside the Maison Élyse dessert page on a phone"
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
      "selective-3d": "split"
    }
  },
  "mobile-qr-without-app": {
    heroImage: photoQrCode1,
    backgroundImage: restaurantBackground2,
    heroImageAlt: {
      fr: "Menu Sauge Noire sur téléphone à côté du support QR Vistaire",
      en: "Sauge Noire menu on a phone beside a Vistaire QR display"
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
      "maintenance-security": "split"
    }
  },
  "restaurant-3d-decision": {
    heroImage: photoDigital2,
    backgroundImage: restaurantBackground3,
    heroImageAlt: {
      fr: "Chocolat fumé et fiche dessert Sauge Noire sur téléphone",
      en: "Chocolat fumé beside the Sauge Noire dessert page on a phone"
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
      gouvernance: "feature"
    }
  }
};

export function getEditorialGuidePresentation(
  key: EditorialGuideKey,
  locale: EditorialGuideLocale
): EditorialGuidePresentation & { locale: EditorialGuideLocale } {
  const presentation = PRESENTATIONS[key];

  if (!presentation) {
    throw new Error(`Missing editorial guide presentation: ${key}`);
  }

  return { ...presentation, locale };
}
