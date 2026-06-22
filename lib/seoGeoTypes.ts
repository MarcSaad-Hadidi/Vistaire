export type SeoGeoPageType = "aeo" | "local" | "vertical";

export type CommercialIntent = "medium" | "high" | "very-high";

export type SeoGeoPageSlugFr =
  | "menu-qr-sans-pdf"
  | "menu-digital-sans-application"
  | "remplacer-menu-pdf-restaurant"
  | "alternative-menu-pdf-restaurant"
  | "fiche-plat-digitale-restaurant"
  | "menu-restaurant-photos"
  | "menu-restaurant-allergenes"
  | "menu-digital-restaurant-montreal"
  | "menu-digital-restaurant-laval"
  | "menu-digital-restaurant-brossard"
  | "menu-digital-restaurant-haut-de-gamme"
  | "menu-digital-restaurant-gastronomique";

export type SeoGeoPageSlugEn =
  | "qr-menu-without-pdf"
  | "digital-menu-without-app"
  | "replace-restaurant-pdf-menu"
  | "restaurant-pdf-menu-alternative"
  | "digital-dish-page-restaurant"
  | "restaurant-menu-photos"
  | "restaurant-menu-allergens"
  | "digital-restaurant-menu-montreal"
  | "digital-restaurant-menu-laval"
  | "digital-restaurant-menu-brossard"
  | "high-end-restaurant-digital-menu"
  | "fine-dining-restaurant-digital-menu";

export type SeoGeoPageSlug = SeoGeoPageSlugFr | SeoGeoPageSlugEn;

type SeoGeoSection = {
  heading: string;
  body: string[];
  points?: string[];
};

type SeoGeoComparisonRow = {
  label: string;
  basic: string;
  vistaire: string;
};

export type SeoGeoInternalLink = {
  href: string;
  label: string;
};

export type SeoGeoQueryEvidenceStatus = "editorial-hypothesis";

export type SeoGeoQueryEvidence = {
  status: SeoGeoQueryEvidenceStatus;
  source: "editorial";
  updatedAt: string;
  note: string;
};

export type SeoGeoPageData = {
  slug: SeoGeoPageSlug;
  path: string;
  locale?: "fr" | "en";
  type: SeoGeoPageType;
  cluster: string;
  commercialIntent: CommercialIntent;
  priority: "P0" | "P1" | "P2";
  sitemapPriority: number;
  queries: string[];
  queryEvidence: SeoGeoQueryEvidence;
  updatedAt: string;
  metadataTitle: string;
  metadataDescription: string;
  h1: string;
  eyebrow: string;
  directAnswer: string;
  context: SeoGeoSection;
  productProof: {
    heading: string;
    body: string;
    points: string[];
  };
  comparison: {
    heading: string;
    basicLabel: string;
    vistaireLabel: string;
    rows: SeoGeoComparisonRow[];
  };
  included: Array<{
    title: string;
    text: string;
  }>;
  visualImage: {
    src: string;
    alt: string;
  };
  faq: Array<{
    question: string;
    answer: string;
  }>;
  service: {
    name: string;
    serviceType: string;
    description: string;
  };
  areaServed?: string[];
  primaryCta: SeoGeoInternalLink;
  secondaryCta: SeoGeoInternalLink;
  relatedLinks: SeoGeoInternalLink[];
};

export type SearchIntentMatrixEntry = {
  evidence: SeoGeoQueryEvidence;
  cluster: string;
  naturalQueries: string[];
  commercialIntent: CommercialIntent;
  target: string;
  pageType: "published" | "planned" | "existing-pillar";
  contentAngle: string;
  duplicationRisk: "low" | "medium" | "high";
  priority: "P0" | "P1" | "P2";
};

export type SeoGeoPageDraft = Omit<
  SeoGeoPageData,
  "queryEvidence" | "updatedAt"
> & {
  queryEvidence?: SeoGeoQueryEvidence;
  updatedAt?: string;
};

export type SeoGeoRoutePair = {
  fr: string;
  en: string;
  priority: number;
  updatedAt: string;
};
