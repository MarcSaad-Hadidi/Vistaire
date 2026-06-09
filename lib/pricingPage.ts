import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildWebPageJsonLd,
  type JsonLdObject
} from "./seo.ts";
import type { Locale } from "./i18n.ts";

export const PRICING_PATH = "/tarifs-menu-digital-restaurant";
export const CARTE_VISTAIRE_PATH = "/carte-vistaire";
export const PRICING_PATH_EN = "/en/pricing-digital-restaurant-menu";
export const CARTE_VISTAIRE_PATH_EN = "/en/vistaire-menu";

export const pricingMetadata = {
  title: "Tarifs menu digital restaurant avec plats 3D | Vistaire",
  description:
    "Découvrez les tarifs Vistaire pour créer un menu digital premium clé en main avec QR code, fiches plats, photos, allergènes, mise en ligne et plats 3D inclus pour restaurants."
} as const;

export const pricingMetadataEn = {
  title: "Digital restaurant menu pricing with 3D dishes | Vistaire",
  description:
    "Explore Vistaire pricing for a premium mobile restaurant menu with QR code, dish pages, photos, allergens, launch support and included 3D dishes."
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

export const PRICING_PAGE_EN = {
  path: PRICING_PATH_EN,
  h1: "Vistaire pricing: premium digital menu with included 3D dishes",
  subtitle:
    "A guided service to turn your PDF menu into an elegant mobile menu opened by QR code, with selected 3D dishes included in every package.",
  proof:
    "Menu structure, dish pages, QR code, launch support and included 3D dishes.",
  primaryCta: {
    label: "Talk about your menu",
    href: "/en/book-a-call"
  },
  secondaryCta: {
    label: "View a Vistaire menu",
    href: CARTE_VISTAIRE_PATH_EN
  },
  plans: [
    {
      name: "Vistaire Base",
      setupPrice: "$950 CAD setup",
      monthlyPrice: "$125 CAD / month",
      setupAmount: 950,
      monthlyAmount: 125,
      menuDishLimit: 40,
      included3dDishCount: 5,
      cta: {
        label: "Talk about your menu",
        href: "/en/book-a-call"
      },
      bestFor:
        "An independent restaurant ready to replace a PDF with a premium mobile menu and a first visible 3D moment.",
      highlights: [
        "Up to 40 dishes",
        "5 included 3D dishes",
        "QR code ready for print",
        "Guided service"
      ],
      included: [
        "Premium digital menu",
        "Public menu link",
        "Category structure",
        "Dish pages with prices and concise descriptions",
        "Basic allergen information",
        "Provided photos integrated",
        "Photo fallback if a 3D render is not strong enough",
        "2 correction rounds before launch",
        "Reasonable small monthly updates"
      ]
    },
    {
      name: "Vistaire Premium",
      setupPrice: "$1,450 CAD setup",
      monthlyPrice: "$169 CAD / month",
      setupAmount: 1450,
      monthlyAmount: 169,
      menuDishLimit: 60,
      included3dDishCount: 10,
      recommended: true,
      cta: {
        label: "Choose Premium",
        href: "/en/book-a-call"
      },
      bestFor:
        "A restaurant that wants a fuller Vistaire experience and several key dishes visible in 3D.",
      highlights: [
        "Up to 60 dishes",
        "10 included 3D dishes",
        "Premium QR",
        "Stronger signature dish presentation"
      ],
      included: [
        "Everything in Base",
        "More developed menu structure",
        "Improved descriptions",
        "Signature, recommended, popular and new badges",
        "Allergens, options and sides",
        "Stronger adaptation to the restaurant identity",
        "More generous update support",
        "Better presentation of signature dishes"
      ]
    },
    {
      name: "Vistaire Signature",
      setupPrice: "$2,500 CAD setup",
      monthlyPrice: "$249 CAD / month",
      setupAmount: 2500,
      monthlyAmount: 249,
      menuDishLimit: 100,
      included3dDishCount: 20,
      cta: {
        label: "Discuss a Signature menu",
        href: "/en/book-a-call"
      },
      bestFor:
        "A high-end restaurant or venue that wants the menu to become a branded visual experience.",
      highlights: [
        "Up to 100 dishes",
        "20 included 3D dishes",
        "More premium visual direction",
        "Priority support"
      ],
      included: [
        "Everything in Premium",
        "More crafted dish pages",
        "Strategic signature dish highlights",
        "Launch support",
        "Premium QR",
        "Deeper QA",
        "Recommendations on menu presentation"
      ]
    }
  ] satisfies PricingPlan[],
  threeDPacks: [
    {
      label: "+5 3D dishes",
      price: "$149 CAD",
      description: "To extend the experience to a few more signatures."
    },
    {
      label: "+10 3D dishes",
      price: "$249 CAD",
      description: "To cover more important dishes without weighing down the menu."
    },
    {
      label: "+20 3D dishes",
      price: "$449 CAD",
      description: "For a menu where visual immersion becomes a stronger signal."
    },
    {
      label: "Single additional 3D dish",
      price: "From $35 to $50 CAD / dish",
      description: "Depending on dish complexity and validation needs."
    }
  ] satisfies PricingThreeDPack[],
  faq: [
    {
      question: "How much does Vistaire cost?",
      answer:
        "Vistaire Base starts at $950 CAD setup and $125 CAD per month. Vistaire Premium is $1,450 CAD setup and $169 CAD per month. Vistaire Signature is $2,500 CAD setup and $249 CAD per month. Applicable taxes are extra."
    },
    {
      question: "What is included in the Vistaire setup?",
      answer:
        "The setup includes menu structure, categories, dish pages, prices, descriptions, basic allergens, integration of provided photos, QR code, launch support and the included 3D dishes for the selected package."
    },
    {
      question: "Are 3D dishes included?",
      answer:
        "Yes. Every package includes selected 3D dishes created from restaurant-provided photos and validated before publication."
    },
    {
      question: "How many 3D dishes are included in each package?",
      answer:
        "Vistaire Base includes 5 3D dishes, Vistaire Premium includes 10 and Vistaire Signature includes 20."
    },
    {
      question: "Does Vistaire replace a PDF menu?",
      answer:
        "Yes. Vistaire can become the main QR-scanned menu experience while keeping the PDF as an archive if needed."
    },
    {
      question: "Is the QR code included?",
      answer:
        "Yes. Every offer includes a print-ready QR code and a public link to the digital menu."
    },
    {
      question: "Does the restaurant have to manage a dashboard?",
      answer:
        "No. Vistaire is first a guided service. You send your menu and Vistaire handles creation, launch and planned updates."
    },
    {
      question: "Are updates included?",
      answer:
        "Reasonable small monthly updates are included depending on the package. Larger changes are scoped before implementation."
    },
    {
      question: "Are photos required?",
      answer:
        "Good photos improve the result. Vistaire can start with existing photos, but some images may need retouching or replacement."
    },
    {
      question: "Does AR work on every device?",
      answer:
        "No. Augmented reality depends on the device, browser and validated asset format. Vistaire speaks first about included 3D dishes, with compatible AR when possible."
    },
    {
      question: "Is Vistaire available for Montreal restaurants?",
      answer:
        "Yes. Vistaire supports restaurants in Montreal, Quebec and Canada, with an approach suited to independent restaurants, premium bistros and high-end venues."
    },
    {
      question: "Is Vistaire suitable for high-end restaurants?",
      answer:
        "Yes. Vistaire is designed for restaurants that want a calm, visual and table-friendly mobile menu aligned with their brand."
    },
    {
      question: "How long does a Vistaire menu take to create?",
      answer:
        "The timeline depends on dish count, photo quality, writing needs and 3D validation. A simple menu moves faster when content is ready."
    },
    {
      question: "Can we start with a simple version?",
      answer:
        "Yes. Vistaire Base can replace a PDF with a premium digital menu and 5 included 3D dishes, then the experience can expand with a higher package or 3D packs."
    }
  ]
} as const;

export function getPricingPage(locale: Locale = "fr") {
  return locale === "en" ? PRICING_PAGE_EN : PRICING_PAGE;
}

export function getPricingMetadata(locale: Locale = "fr") {
  return locale === "en" ? pricingMetadataEn : pricingMetadata;
}

function buildPricingOfferCatalogEn(
  env?: Record<string, string | undefined>
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${absoluteUrl(PRICING_PATH_EN, env)}#offer-catalog`,
    name: "Vistaire packages with included 3D dishes",
    url: absoluteUrl(PRICING_PATH_EN, env),
    itemListElement: PRICING_PAGE_EN.plans.map((plan, index) => ({
      "@type": "Offer",
      position: index + 1,
      name: plan.name,
      url: absoluteUrl(PRICING_PATH_EN, env),
      priceCurrency: "CAD",
      itemOffered: {
        "@type": "Service",
        name: `${plan.name} - premium digital menu with ${plan.included3dDishCount} included 3D dishes`,
        serviceType: "Guided digital restaurant menu with included 3D dishes",
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
          unitText: "month"
        }
      ],
      additionalProperty: [
        {
          "@type": "PropertyValue",
          name: "Included dishes",
          value: `Up to ${plan.menuDishLimit} dishes`
        },
        {
          "@type": "PropertyValue",
          name: "Included 3D dishes",
          value: `${plan.included3dDishCount} included 3D dishes, validated before publication`
        }
      ]
    }))
  };
}

function buildPricingServiceJsonLdEn(
  env?: Record<string, string | undefined>
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(PRICING_PATH_EN, env)}#service`,
    name: "Vistaire digital restaurant menu with included 3D dishes",
    serviceType: "Guided premium digital menu creation for restaurants",
    url: absoluteUrl(PRICING_PATH_EN, env),
    description:
      "Guided service to create a premium mobile menu with QR code, dish pages, integrated provided photos, allergens, launch support and included 3D dishes.",
    provider: {
      "@id": `${absoluteUrl("/", env)}#organization`
    },
    areaServed: [
      {
        "@type": "City",
        name: "Montreal"
      },
      {
        "@type": "AdministrativeArea",
        name: "Quebec"
      },
      {
        "@type": "Country",
        name: "Canada"
      }
    ],
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Independent restaurants, premium bistros and high-end restaurants"
    },
    hasOfferCatalog: {
      "@id": `${absoluteUrl(PRICING_PATH_EN, env)}#offer-catalog`
    }
  };
}

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

export function buildPricingPageJsonLd(
  env?: Record<string, string | undefined>,
  locale: Locale = "fr"
) {
  if (locale === "en") {
    return [
      buildWebPageJsonLd(
        {
          path: PRICING_PATH_EN,
          name: pricingMetadataEn.title,
          description: pricingMetadataEn.description,
          locale: "en"
        },
        env
      ),
      buildPricingServiceJsonLdEn(env),
      buildPricingOfferCatalogEn(env),
      buildFaqPageJsonLd([...PRICING_PAGE_EN.faq], PRICING_PATH_EN, env),
      buildBreadcrumbJsonLd(
        [
          { name: "Home", path: "/en" },
          { name: "Digital restaurant menu pricing", path: PRICING_PATH_EN }
        ],
        env
      )
    ];
  }

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
