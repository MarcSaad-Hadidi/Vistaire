import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildWebPageJsonLd,
  type JsonLdObject
} from "./seo.ts";

export const PRICING_PATH = "/tarifs-menu-digital-restaurant";
export const CARTE_VISTAIRE_PATH = "/carte-vistaire";

export const pricingMetadata = {
  title: "Tarifs menu digital restaurant avec plats 3D | Vistaire",
  description:
    "Découvrez les tarifs Vistaire pour créer un menu digital premium clé en main avec QR code, fiches plats, photos, allergènes, mise en ligne et plats 3D inclus pour restaurants."
} as const;

export type PricingPlan = {
  name: string;
  setupPrice: string;
  monthlyPrice: string;
  setupAmount: number;
  monthlyAmount: number;
  menuDishLimit: number;
  included3dDishCount: number;
  recommended?: boolean;
  cta: {
    label: string;
    href: string;
  };
  bestFor: string;
  highlights: string[];
  included: string[];
};

export type PricingThreeDPack = {
  label: string;
  price: string;
  description: string;
};

export const PRICING_PAGE = {
  path: PRICING_PATH,
  h1: "Tarifs Vistaire : menu digital premium avec plats 3D inclus",
  subtitle:
    "Un service clé en main pour transformer votre menu PDF en carte digitale mobile, élégante et accessible par QR code, avec une sélection de plats en 3D dans chaque offre.",
  proof:
    "Création, structure, fiches plats, QR code, mise en ligne et plats 3D inclus.",
  primaryCta: {
    label: "Parler de votre menu",
    href: "/prendre-rendez-vous"
  },
  secondaryCta: {
    label: "Voir une carte Vistaire",
    href: CARTE_VISTAIRE_PATH
  },
  plans: [
    {
      name: "Vistaire Base",
      setupPrice: "950 $ CAD setup",
      monthlyPrice: "125 $ CAD / mois",
      setupAmount: 950,
      monthlyAmount: 125,
      menuDishLimit: 40,
      included3dDishCount: 5,
      cta: {
        label: "Parler de votre menu",
        href: "/prendre-rendez-vous"
      },
      bestFor:
        "Restaurant indépendant qui veut remplacer son PDF par une vraie carte mobile premium avec un premier effet 3D visible.",
      highlights: [
        "Jusqu’à 40 plats",
        "5 plats 3D inclus",
        "QR code prêt à imprimer",
        "Service accompagné"
      ],
      included: [
        "Menu digital premium",
        "Lien public du menu",
        "Structure catégories",
        "Fiches plats avec prix et descriptions courtes",
        "Allergènes de base",
        "Photos fournies intégrées",
        "Fallback photo si un rendu 3D n’est pas assez bon",
        "2 rondes de corrections avant lancement",
        "Petites modifications mensuelles raisonnables"
      ]
    },
    {
      name: "Vistaire Premium",
      setupPrice: "1 450 $ CAD setup",
      monthlyPrice: "169 $ CAD / mois",
      setupAmount: 1450,
      monthlyAmount: 169,
      menuDishLimit: 60,
      included3dDishCount: 10,
      recommended: true,
      cta: {
        label: "Choisir Premium",
        href: "/prendre-rendez-vous"
      },
      bestFor:
        "Restaurant qui veut une expérience Vistaire plus complète et veut que plusieurs plats importants soient visibles en 3D.",
      highlights: [
        "Jusqu’à 60 plats",
        "10 plats 3D inclus",
        "QR premium",
        "Plats signatures mieux mis en avant"
      ],
      included: [
        "Tout dans Base",
        "Structure de menu plus poussée",
        "Descriptions améliorées",
        "Badges signature, recommandé, populaire et nouveauté",
        "Allergènes, options et accompagnements",
        "Adaptation plus forte à l’identité du restaurant",
        "Support modifications plus généreux",
        "Meilleure mise en avant des plats signatures"
      ]
    },
    {
      name: "Vistaire Signature",
      setupPrice: "2 500 $ CAD setup",
      monthlyPrice: "249 $ CAD / mois",
      setupAmount: 2500,
      monthlyAmount: 249,
      menuDishLimit: 100,
      included3dDishCount: 20,
      cta: {
        label: "Parler d’une carte Signature",
        href: "/prendre-rendez-vous"
      },
      bestFor:
        "Restaurant haut de gamme ou établissement qui veut utiliser son menu comme une vraie expérience de marque.",
      highlights: [
        "Jusqu’à 100 plats",
        "20 plats 3D inclus",
        "Direction visuelle plus premium",
        "Support prioritaire"
      ],
      included: [
        "Tout dans Premium",
        "Fiches plats plus travaillées",
        "Mise en avant stratégique des plats signatures",
        "Accompagnement lancement",
        "QR premium",
        "QA plus poussée",
        "Recommandations sur la présentation du menu"
      ]
    }
  ] satisfies PricingPlan[],
  threeDPacks: [
    {
      label: "+5 plats 3D",
      price: "149 $ CAD",
      description: "Pour étendre l’expérience à quelques signatures de plus."
    },
    {
      label: "+10 plats 3D",
      price: "249 $ CAD",
      description: "Pour couvrir davantage de plats importants sans alourdir la carte."
    },
    {
      label: "+20 plats 3D",
      price: "449 $ CAD",
      description: "Pour une carte où l’immersion visuelle devient un marqueur fort."
    },
    {
      label: "Plat 3D additionnel seul",
      price: "À partir de 35 $ à 50 $ CAD / plat",
      description: "Selon la complexité du plat et les validations nécessaires."
    }
  ] satisfies PricingThreeDPack[],
  faq: [
    {
      question: "Combien coûte Vistaire ?",
      answer:
        "Vistaire Base commence à 950 $ CAD setup et 125 $ CAD / mois. Vistaire Premium est à 1 450 $ CAD setup et 169 $ CAD / mois. Vistaire Signature est à 2 500 $ CAD setup et 249 $ CAD / mois. Taxes applicables en sus."
    },
    {
      question: "Que comprend le setup Vistaire ?",
      answer:
        "Le setup comprend la structure de la carte, les catégories, les fiches plats, les prix, les descriptions, les allergènes de base, l’intégration des photos fournies, le QR code, la mise en ligne et les plats 3D inclus selon le forfait."
    },
    {
      question: "Est-ce que les plats 3D sont inclus ?",
      answer:
        "Oui. Chaque forfait inclut une sélection de plats 3D créés à partir des photos fournies par le restaurant, puis validés avant publication."
    },
    {
      question: "Combien de plats 3D sont inclus dans chaque offre ?",
      answer:
        "Vistaire Base inclut 5 plats 3D, Vistaire Premium inclut 10 plats 3D et Vistaire Signature inclut 20 plats 3D."
    },
    {
      question: "Est-ce que Vistaire remplace un menu PDF ?",
      answer:
        "Oui. Vistaire peut devenir l’expérience principale scannée par QR code, tout en gardant le PDF comme archive si nécessaire."
    },
    {
      question: "Est-ce que le QR code est inclus ?",
      answer:
        "Oui. Chaque offre inclut un QR code prêt à imprimer et un lien public pour accéder à la carte digitale."
    },
    {
      question: "Est-ce que le restaurant doit gérer un dashboard ?",
      answer:
        "Non. Vistaire est d’abord un service accompagné. Vous envoyez votre menu et Vistaire s’occupe de la création, de la mise en ligne et des modifications prévues dans l’abonnement."
    },
    {
      question: "Est-ce que les modifications sont incluses ?",
      answer:
        "Les petites modifications mensuelles raisonnables sont incluses selon le forfait. Les changements plus lourds sont cadrés avant d’être réalisés."
    },
    {
      question: "Est-ce que les photos sont nécessaires ?",
      answer:
        "De bonnes photos améliorent le résultat. Vistaire peut démarrer avec les photos existantes, mais certaines images peuvent demander une retouche ou un remplacement."
    },
    {
      question: "Est-ce que l’AR fonctionne sur tous les appareils ?",
      answer:
        "Non. La réalité augmentée dépend de l’appareil, du navigateur et du format validé. Vistaire parle d’abord de plats 3D inclus, avec AR compatible lorsque possible."
    },
    {
      question: "Est-ce disponible pour les restaurants à Montréal ?",
      answer:
        "Oui. Vistaire accompagne les restaurants à Montréal, au Québec et au Canada, avec une approche adaptée aux restaurants indépendants, bistros premium et établissements haut de gamme."
    },
    {
      question: "Est-ce adapté aux restaurants haut de gamme ?",
      answer:
        "Oui. Vistaire est conçu pour les restaurants qui veulent une carte mobile sobre, lisible à table et cohérente avec leur image de marque."
    },
    {
      question: "Combien de temps prend la création d’un menu digital Vistaire ?",
      answer:
        "Le calendrier dépend du nombre de plats, de la qualité des photos, du niveau de rédaction et des validations 3D. Une carte simple avance plus vite lorsque les contenus sont prêts."
    },
    {
      question: "Peut-on commencer avec une version simple ?",
      answer:
        "Oui. Vistaire Base permet de remplacer un PDF par une carte digitale premium avec 5 plats 3D inclus, puis d’étendre l’expérience avec un forfait supérieur ou des packs 3D."
    }
  ]
} as const;

export function buildPricingOfferCatalog(env?: Record<string, string | undefined>): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${absoluteUrl(PRICING_PATH, env)}#offer-catalog`,
    name: "Forfaits Vistaire avec plats 3D inclus",
    url: absoluteUrl(PRICING_PATH, env),
    itemListElement: PRICING_PAGE.plans.map((plan, index) => ({
      "@type": "Offer",
      position: index + 1,
      name: plan.name,
      url: absoluteUrl(PRICING_PATH, env),
      priceCurrency: "CAD",
      itemOffered: {
        "@type": "Service",
        name: `${plan.name} - menu digital premium avec ${plan.included3dDishCount} plats 3D inclus`,
        serviceType: "Menu digital restaurant clé en main avec plats 3D inclus",
        description: plan.bestFor
      },
      priceSpecification: [
        {
          "@type": "UnitPriceSpecification",
          price: plan.setupAmount,
          priceCurrency: "CAD",
          unitText: "setup"
        },
        {
          "@type": "UnitPriceSpecification",
          price: plan.monthlyAmount,
          priceCurrency: "CAD",
          unitText: "mois"
        }
      ],
      additionalProperty: [
        {
          "@type": "PropertyValue",
          name: "Plats inclus",
          value: `Jusqu’à ${plan.menuDishLimit} plats`
        },
        {
          "@type": "PropertyValue",
          name: "Plats 3D inclus",
          value: `${plan.included3dDishCount} plats 3D inclus, validés avant publication`
        }
      ]
    }))
  };
}

export function buildPricingServiceJsonLd(
  env?: Record<string, string | undefined>
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(PRICING_PATH, env)}#service`,
    name: "Menu digital restaurant Vistaire avec plats 3D inclus",
    serviceType: "Création de menu digital premium clé en main pour restaurants",
    url: absoluteUrl(PRICING_PATH, env),
    description:
      "Service clé en main pour créer une carte digitale mobile premium avec QR code, fiches plats, photos fournies intégrées, allergènes, mise en ligne accompagnée et plats 3D inclus.",
    provider: {
      "@id": `${absoluteUrl("/", env)}#organization`
    },
    areaServed: [
      {
        "@type": "City",
        name: "Montréal"
      },
      {
        "@type": "AdministrativeArea",
        name: "Québec"
      },
      {
        "@type": "Country",
        name: "Canada"
      }
    ],
    audience: {
      "@type": "BusinessAudience",
      audienceType:
        "Restaurants indépendants, bistros premium et restaurants haut de gamme"
    },
    hasOfferCatalog: {
      "@id": `${absoluteUrl(PRICING_PATH, env)}#offer-catalog`
    }
  };
}

export function buildPricingPageJsonLd(env?: Record<string, string | undefined>) {
  return [
    buildWebPageJsonLd(
      {
        path: PRICING_PATH,
        name: pricingMetadata.title,
        description: pricingMetadata.description
      },
      env
    ),
    buildPricingServiceJsonLd(env),
    buildPricingOfferCatalog(env),
    buildFaqPageJsonLd([...PRICING_PAGE.faq], PRICING_PATH, env),
    buildBreadcrumbJsonLd(
      [
        { name: "Accueil", path: "/" },
        { name: "Tarifs menu digital restaurant", path: PRICING_PATH }
      ],
      env
    )
  ];
}
