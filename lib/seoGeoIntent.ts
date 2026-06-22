import { SEO_GEO_EDITORIAL_QUERY_EVIDENCE } from "./seoGeoEvidence.ts";
import type { SearchIntentMatrixEntry, SeoGeoQueryEvidence } from "./seoGeoTypes.ts";

type SearchIntentMatrixEntryDraft = Omit<SearchIntentMatrixEntry, "evidence"> & {
  evidence?: SeoGeoQueryEvidence;
};

export const PLANNED_SEO_GEO_PAGES = [
  {
    path: "/menu-digital-restaurant-vieux-montreal",
    reason:
      "À garder planifié tant qu'il n'existe pas de contenu local unique au-delà de la page Montréal."
  },
  {
    path: "/menu-digital-restaurant-griffintown",
    reason:
      "Risque doorway si seule la zone change; nécessite angles restaurants de destination et preuves locales."
  },
  {
    path: "/menu-digital-restaurant-plateau",
    reason:
      "À publier seulement avec contenu distinct sur bistros, cafés premium et carte bilingue."
  },
  {
    path: "/menu-digital-restaurant-westmount",
    reason:
      "À publier seulement avec contenu distinct et utile pour restaurants premium de Westmount."
  },
  {
    path: "/menu-digital-restaurant-outremont",
    reason:
      "À publier seulement avec angle culinaire local réellement unique."
  },
  {
    path: "/menu-digital-restaurant-saint-laurent",
    reason:
      "À publier seulement avec contenu spécifique et non dupliqué."
  },
  {
    path: "/menu-digital-restaurant-italien",
    reason:
      "Vertical à traiter avec exemples de catégories, photos et allergènes propres à l'italien."
  },
  {
    path: "/menu-digital-restaurant-japonais",
    reason:
      "Vertical à traiter avec angle omakase, sushi, allergènes et photos sans dupliquer la page sushi."
  },
  {
    path: "/menu-digital-restaurant-sushi",
    reason:
      "Peut mériter une page si différenciée de japonais par rolls, plateaux, omakase et visuels."
  },
  {
    path: "/menu-digital-restaurant-libanais",
    reason:
      "Vertical à traiter avec mezzés, partage, allergènes et menus de groupe."
  },
  {
    path: "/menu-digital-restaurant-mediterraneen",
    reason:
      "À publier seulement avec contenu distinct de libanais/italien."
  },
  {
    path: "/menu-digital-steakhouse",
    reason:
      "Vertical fort possible avec cuisson, photos, accords et fiches pièces, mais à écrire séparément."
  }
] as const;

const SEARCH_INTENT_MATRIX_DRAFT: SearchIntentMatrixEntryDraft[] = [
  {
    cluster: "QR code",
    naturalQueries: [
      "menu avec QR code",
      "menu QR code restaurant",
      "créer un menu QR code restaurant",
      "générer un QR code menu restaurant"
    ],
    commercialIntent: "very-high",
    target: "/menu-qr-code-restaurant",
    pageType: "existing-pillar",
    contentAngle:
      "Page pilier existante pour l'intention QR générale; les pages nouvelles traitent les sous-problèmes.",
    duplicationRisk: "low",
    priority: "P0"
  },
  {
    cluster: "QR code sans PDF",
    naturalQueries: [
      "menu QR code sans PDF",
      "QR code menu digital restaurant",
      "menu sans contact QR code restaurant"
    ],
    commercialIntent: "very-high",
    target: "/menu-qr-sans-pdf",
    pageType: "published",
    contentAngle:
      "Répond au problème précis du QR qui ouvre un PDF inconfortable.",
    duplicationRisk: "low",
    priority: "P0"
  },
  {
    cluster: "Menu digital",
    naturalQueries: [
      "menu digital restaurant",
      "menu numérique restaurant",
      "carte digitale restaurant",
      "menu interactif restaurant"
    ],
    commercialIntent: "high",
    target: "/menu-digital-restaurant",
    pageType: "existing-pillar",
    contentAngle:
      "Page pilier pour la définition et la valeur globale d'une carte digitale premium.",
    duplicationRisk: "low",
    priority: "P0"
  },
  {
    cluster: "Sans application",
    naturalQueries: [
      "menu digital sans application",
      "menu mobile restaurant",
      "menu restaurant sur téléphone"
    ],
    commercialIntent: "high",
    target: "/menu-digital-sans-application",
    pageType: "published",
    contentAngle:
      "Réduit la friction client : navigateur mobile, pas de compte, pas d'app store.",
    duplicationRisk: "low",
    priority: "P0"
  },
  {
    cluster: "Problème PDF",
    naturalQueries: [
      "remplacer menu PDF restaurant",
      "transformer menu PDF en menu digital",
      "arrêter menu PDF restaurant"
    ],
    commercialIntent: "very-high",
    target: "/remplacer-menu-pdf-restaurant",
    pageType: "published",
    contentAngle:
      "Migration concrète du PDF vers une structure mobile Vistaire.",
    duplicationRisk: "medium",
    priority: "P0"
  },
  {
    cluster: "Alternative PDF",
    naturalQueries: [
      "alternative menu PDF restaurant",
      "meilleure alternative au menu PDF restaurant",
      "menu PDF pas pratique restaurant"
    ],
    commercialIntent: "high",
    target: "/alternative-menu-pdf-restaurant",
    pageType: "published",
    contentAngle:
      "Compare les alternatives possibles sans prétendre que Vistaire convient à tous.",
    duplicationRisk: "medium",
    priority: "P0"
  },
  {
    cluster: "Fiches plats",
    naturalQueries: [
      "fiche plat digitale restaurant",
      "menu restaurant avec fiches plats",
      "fiche plat menu digital"
    ],
    commercialIntent: "high",
    target: "/fiche-plat-digitale-restaurant",
    pageType: "published",
    contentAngle:
      "Montre la valeur d'une page plat détaillée sans alourdir toute la carte.",
    duplicationRisk: "low",
    priority: "P0"
  },
  {
    cluster: "Photos",
    naturalQueries: [
      "menu restaurant avec photos",
      "menu digital restaurant avec photos",
      "menu restaurant avec photos et prix"
    ],
    commercialIntent: "high",
    target: "/menu-restaurant-photos",
    pageType: "published",
    contentAngle:
      "Cadre l'usage sélectif de photos utiles et optimisées.",
    duplicationRisk: "low",
    priority: "P1"
  },
  {
    cluster: "Allergènes",
    naturalQueries: [
      "menu restaurant avec allergènes",
      "menu digital allergènes restaurant",
      "allergènes menu QR code"
    ],
    commercialIntent: "high",
    target: "/menu-restaurant-allergenes",
    pageType: "published",
    contentAngle:
      "Rend l'information allergène lisible sans remplacer la validation du restaurant.",
    duplicationRisk: "low",
    priority: "P1"
  },
  {
    cluster: "3D / AR",
    naturalQueries: [
      "menu 3D restaurant",
      "plat 3D restaurant",
      "menu restaurant réalité augmentée",
      "menu digital avec plats 3D"
    ],
    commercialIntent: "high",
    target: "/menu-3d-ar-restaurant",
    pageType: "existing-pillar",
    contentAngle:
      "Page pilier existante sur la 3D/AR sélective avec fallback et performance protégée.",
    duplicationRisk: "low",
    priority: "P0"
  },
  {
    cluster: "Local Montréal",
    naturalQueries: [
      "menu digital restaurant Montréal",
      "menu QR code restaurant Montréal",
      "création menu QR code Montréal"
    ],
    commercialIntent: "very-high",
    target: "/menu-digital-restaurant-montreal",
    pageType: "published",
    contentAngle:
      "Page locale principale qui couvre aussi les quartiers pour éviter des doorway pages.",
    duplicationRisk: "low",
    priority: "P0"
  },
  {
    cluster: "Local Rive-Nord/Rive-Sud",
    naturalQueries: [
      "menu digital restaurant Laval",
      "menu QR code restaurant Laval",
      "menu digital restaurant Brossard"
    ],
    commercialIntent: "high",
    target: "/menu-digital-restaurant-laval + /menu-digital-restaurant-brossard",
    pageType: "published",
    contentAngle:
      "Deux pages locales distinctes avec contexte Laval/Brossard, sans fausse présence physique.",
    duplicationRisk: "medium",
    priority: "P1"
  },
  {
    cluster: "Premium / gastronomie",
    naturalQueries: [
      "menu digital restaurant haut de gamme",
      "carte digitale restaurant gastronomique",
      "menu interactif restaurant premium"
    ],
    commercialIntent: "very-high",
    target:
      "/menu-digital-restaurant-haut-de-gamme + /menu-digital-restaurant-gastronomique",
    pageType: "published",
    contentAngle:
      "Deux verticals distincts : image premium générale et précision gastronomique.",
    duplicationRisk: "medium",
    priority: "P0"
  },
  {
    cluster: "Verticals cuisine",
    naturalQueries: [
      "menu digital restaurant italien",
      "menu digital restaurant japonais",
      "menu digital restaurant sushi",
      "menu digital steakhouse"
    ],
    commercialIntent: "high",
    target: "planned registry",
    pageType: "planned",
    contentAngle:
      "À publier seulement quand chaque cuisine a un contenu réellement distinct.",
    duplicationRisk: "high",
    priority: "P2"
  }
];

export const SEARCH_INTENT_MATRIX: SearchIntentMatrixEntry[] =
  SEARCH_INTENT_MATRIX_DRAFT.map((entry) => ({
    ...entry,
    evidence: entry.evidence ?? SEO_GEO_EDITORIAL_QUERY_EVIDENCE
  }));
