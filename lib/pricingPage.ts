import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
  type JsonLdObject
} from "./seo.ts";
import type { Locale } from "./i18n.ts";

export const PRICING_PATH = "/tarifs-menu-digital-restaurant";
export const SAMPLE_MENU_PATH = "/demo";
export const PRICING_PATH_EN = "/en/pricing-digital-restaurant-menu";
export const SAMPLE_MENU_PATH_EN = "/en/vistaire-menu";

export const pricingMetadata = {
  title: "Tarifs Vistaire | Supports QR et menu digital restaurant",
  description:
    "Découvrez les quatre collections de supports QR Vistaire dès 2 000 $ CAD, avec menu digital restaurant à 200 $ par mois et Pilotage en option."
} as const;

export const pricingMetadataEn = {
  title: "Vistaire Pricing | QR Displays & Digital Restaurant Menu",
  description:
    "Explore four Vistaire QR display collections from $2,000 CAD, with a digital restaurant menu at $200 per month and optional Pilotage controls."
} as const;

export type PricingCollectionId =
  | "acrylique"
  | "sculpte"
  | "carre"
  | "signature";

export type PricingCollection = {
  id: PricingCollectionId;
  name: string;
  label: string;
  positioning: string;
  description: string;
  setupAmount: number;
  setupPrice: string;
  monthlyPrice: string;
  image: string;
  imageAlt: string;
  imagePosition: string;
  featured?: boolean;
  cta: {
    label: string;
    href: string;
  };
};

export type PricingIncludedGroup = {
  title: string;
  index: string;
  items: string[];
};

export type PricingThreeDPack = {
  quantity: number;
  label: string;
  priceAmount: number;
  price: string;
};

export type PricingWorkflowStep = {
  index: string;
  title: string;
  body: string;
};

export type PricingWorkflowContent = {
  eyebrow: string;
  title: string;
  body: string;
  steps: PricingWorkflowStep[];
  leadTime: string;
};

export type PricingPageContent = {
  path: string;
  eyebrow: string;
  h1: string;
  subtitle: string;
  monthlyAmount: number;
  collections: PricingCollection[];
  included: {
    eyebrow: string;
    title: string;
    body: string;
    priceDifference: string;
  };
  includedGroups: PricingIncludedGroup[];
  threeDAddOns: {
    eyebrow: string;
    title: string;
    body: string;
    packs: PricingThreeDPack[];
    individualLabel: string;
    individualMinAmount: number;
    individualMaxAmount: number;
    individualPrice: string;
    individualNote: string;
    replacementNote: string;
  };
  pilotage: {
    eyebrow: string;
    optionLabel: string;
    title: string;
    price: string;
    monthlyAmount: number;
    totalMonthlyAmount: number;
    body: string;
    features: string[];
    disclosure: string;
    standardLabel: string;
    optionPriceLabel: string;
    totalLabel: string;
  };
  workflow: PricingWorkflowContent;
  additional: {
    eyebrow: string;
    extras: string[];
    startingAtTitle: string;
    startingAtBody: string;
    variables: string[];
  };
  commercialTerms: {
    eyebrow: string;
    title: string;
    items: string[];
  };
  finalCta: {
    eyebrow: string;
    title: string;
    body: string;
    primary: {
      label: string;
      href: string;
    };
    secondary: {
      label: string;
      href: string;
    };
  };
};

const collectionImages = {
  acrylique: "/images/pricing/vistaire-acrylique.jpg",
  sculpte: "/images/pricing/vistaire-sculpte.jpg",
  carre: "/images/pricing/vistaire-carre.png",
  signature: "/images/pricing/vistaire-signature.jpg"
} as const;

export const PRICING_PAGE = {
  path: PRICING_PATH,
  eyebrow: "Tarifs",
  h1: "Choisissez l’expérience qui prendra place sur vos tables.",
  subtitle:
    "Chaque support Vistaire est conçu pour mettre en valeur votre menu et votre identité tout en offrant une expérience digitale immersive.",
  monthlyAmount: 200,
  collections: [
    {
      id: "acrylique",
      name: "Vistaire Acrylique",
      label: "Vistaire",
      positioning: "Minimal. Moderne. Épuré.",
      description:
        "Support vertical transparent en acrylique avec base en bois.",
      setupAmount: 2_000,
      setupPrice: "2 000 $ CAD",
      monthlyPrice: "+ 200 $ CAD / mois",
      image: collectionImages.acrylique,
      imageAlt:
        "Support QR Vistaire Acrylique transparent sur une table de restaurant",
      imagePosition: "50% 50%",
      cta: {
        label: "Découvrir cette collection",
        href: "/prendre-rendez-vous"
      }
    },
    {
      id: "sculpte",
      name: "Vistaire Sculpté",
      label: "Vistaire",
      positioning: "Design. Sculpté. Pour se démarquer.",
      description:
        "Support vertical en bois avec coin supérieur droit arrondi et sculpté.",
      setupAmount: 2_050,
      setupPrice: "2 050 $ CAD",
      monthlyPrice: "+ 200 $ CAD / mois",
      image: collectionImages.sculpte,
      imageAlt:
        "Support QR Vistaire Sculpté en bois avec coin supérieur arrondi",
      imagePosition: "50% 52%",
      cta: {
        label: "Découvrir cette collection",
        href: "/prendre-rendez-vous"
      }
    },
    {
      id: "carre",
      name: "Vistaire Carré",
      label: "Vistaire",
      positioning: "Compact. Design. Chaleureux.",
      description:
        "Petit support carré en bois avec QR directement intégré, offert dans plusieurs finitions.",
      setupAmount: 2_100,
      setupPrice: "2 100 $ CAD",
      monthlyPrice: "+ 200 $ CAD / mois",
      image: collectionImages.carre,
      imageAlt:
        "Support QR carré Vistaire présenté recto et verso sur une table de restaurant",
      imagePosition: "84% 50%",
      cta: {
        label: "Découvrir cette collection",
        href: "/prendre-rendez-vous"
      }
    },
    {
      id: "signature",
      name: "Vistaire Signature",
      label: "Vistaire",
      positioning: "Premium. Distinctif. Signature.",
      description:
        "Support horizontal en bois premium avec partie QR noire et amovible.",
      setupAmount: 2_200,
      setupPrice: "2 200 $ CAD",
      monthlyPrice: "+ 200 $ CAD / mois",
      image: collectionImages.signature,
      imageAlt:
        "Support QR horizontal Vistaire Signature en bois avec insert noir amovible",
      imagePosition: "50% 50%",
      featured: true,
      cta: {
        label: "Découvrir cette collection",
        href: "/prendre-rendez-vous"
      }
    }
  ],
  included: {
    eyebrow: "Inclus dans l’offre Vistaire",
    title: "Une seule offre Vistaire, avec l’essentiel inclus.",
    body:
      "Quelle que soit la collection choisie, vous profitez du même menu digital, des mêmes services et du même accompagnement Vistaire.",
    priceDifference:
      "La différence de prix entre les collections provient principalement du support physique choisi et de son positionnement premium."
  },
  includedGroups: [
    {
      index: "01",
      title: "L’expérience digitale",
      items: [
        "Menu digital personnalisé",
        "Expérience mobile optimisée",
        "Intégration du menu",
        "Personnalisation selon l’identité du restaurant",
        "Multilingue",
        "Multi-devises"
      ]
    },
    {
      index: "02",
      title: "Sur vos tables",
      items: [
        "Jusqu’à 20 supports QR personnalisés",
        "QR code personnalisé",
        "Jusqu’à 5 plats en 3D",
        "Expériences 3D / AR lorsque disponibles"
      ]
    },
    {
      index: "03",
      title: "Mise en place",
      items: [
        "Prise de photos des plats sur place par Vistaire",
        "Hébergement",
        "Maintenance",
        "Configuration initiale",
        "Accompagnement et mise en place"
      ]
    }
  ],
  threeDAddOns: {
    eyebrow: "Productions 3D supplémentaires",
    title: "Faites évoluer vos expériences 3D avec votre carte.",
    body:
      "Les 5 premières expériences 3D prévues dans l’offre Vistaire sont incluses. Les nouvelles productions au-delà de ce volume sont facturées séparément.",
    packs: [
      {
        quantity: 5,
        label: "+5 plats 3D",
        priceAmount: 149,
        price: "149 $ CAD"
      },
      {
        quantity: 10,
        label: "+10 plats 3D",
        priceAmount: 249,
        price: "249 $ CAD"
      },
      {
        quantity: 20,
        label: "+20 plats 3D",
        priceAmount: 449,
        price: "449 $ CAD"
      }
    ],
    individualLabel: "1 plat 3D supplémentaire",
    individualMinAmount: 35,
    individualMaxAmount: 50,
    individualPrice: "35 à 50 $ CAD",
    individualNote: "Selon la complexité de la nouvelle production 3D.",
    replacementNote:
      "Un nouveau plat nécessitant une nouvelle production 3D est une nouvelle production facturable, y compris s’il remplace un ancien plat. Une correction d’un modèle 3D défectueux imputable à Vistaire n’est pas traitée comme une nouvelle production."
  },
  pilotage: {
    eyebrow: "Vistaire Pilotage",
    optionLabel: "Option",
    title: "Prenez le contrôle.",
    price: "+ 100 $ CAD / mois",
    monthlyAmount: 100,
    totalMonthlyAmount: 300,
    body:
      "Ajoutez le dashboard Vistaire pour gérer la disponibilité de vos plats et analyser l’expérience de vos clients.",
    features: [
      "Disponibilités gérées depuis le dashboard et répercutées sur la carte après validation",
      "Ouvertures du menu",
      "Plats consultés",
      "Recherches anonymisées lorsque l’échantillon est suffisant",
      "Interactions 3D / AR",
      "Consultations de plats par catégorie",
      "Moments d’activité par plages horaires UTC",
      "Aujourd’hui, 7 jours et 30 jours, avec comparaison à la période précédente"
    ],
    disclosure:
      "Les données affichées dépendent de l’activité enregistrée et respectent les seuils de confidentialité du produit.",
    standardLabel: "Vistaire — 200 $ / mois",
    optionPriceLabel: "Pilotage — + 100 $ / mois",
    totalLabel: "Total — 300 $ / mois"
  },
  workflow: {
    eyebrow: "De votre restaurant à la mise en ligne",
    title: "Un lancement cadré, validé à chaque étape.",
    body:
      "Vistaire prend en charge la préparation, les maquettes et la production. Votre restaurant valide les éléments clés avant toute fabrication finale.",
    steps: [
      {
        index: "01",
        title: "Prise de photos & préparation",
        body:
          "Vistaire réalise la prise de photos des plats sur place et collecte les éléments nécessaires au projet."
      },
      {
        index: "02",
        title: "Création des maquettes",
        body:
          "Nous préparons la maquette du menu numérique et celle des supports physiques personnalisés."
      },
      {
        index: "03",
        title: "Validation du restaurant",
        body:
          "Vous vérifiez et approuvez les maquettes avant le lancement de toute production finale."
      },
      {
        index: "04",
        title: "Production",
        body:
          "Après validation, Vistaire lance la fabrication des supports et finalise le menu digital."
      },
      {
        index: "05",
        title: "Mise en ligne",
        body:
          "Vistaire active le menu et le service une fois les éléments de lancement prêts."
      }
    ],
    leadTime:
      "Une fois le menu et les maquettes des supports validés, et les éléments nécessaires reçus, la mise en place complète prend généralement environ deux semaines. Ce délai peut varier selon la complexité et les délais de production."
  },
  additional: {
    eyebrow: "Besoins complémentaires",
    extras: [
      "Supports au-delà de 20 ou de remplacement : estimation selon la collection et le besoin."
    ],
    startingAtTitle:
      "Pourquoi les frais de mise en place sont-ils indiqués « À partir de » ?",
    startingAtBody:
      "Chaque projet est ajusté à la réalité de l’établissement et à la quantité de contenu à préparer.",
    variables: [
      "taille du menu",
      "nombre de plats",
      "nombre de menus",
      "contenu à préparer",
      "plats 3D",
      "établissements",
      "supports",
      "complexité du projet"
    ]
  },
  commercialTerms: {
    eyebrow: "Conditions essentielles",
    title: "Les repères commerciaux à connaître.",
    items: [
      "Prix en dollars canadiens; taxes en sus.",
      "Frais de mise en place payables à 100 % avant le début du projet.",
      "Engagement initial de 12 mois.",
      "L’abonnement mensuel débute à l’activation du service.",
      "Le tarif mensuel convenu reste fixe pendant la période initiale de 12 mois.",
      "Les conditions applicables à la période suivante sont établies et communiquées au renouvellement."
    ]
  },
  finalCta: {
    eyebrow: "Votre collection",
    title: "Besoin d’aide pour choisir ?",
    body:
      "Nous vous accompagnons dans le choix du support qui s’intègre le mieux à votre établissement.",
    primary: {
      label: "Prendre rendez-vous",
      href: "/prendre-rendez-vous"
    },
    secondary: {
      label: "Parler à un expert",
      href: "/contact"
    }
  }
} satisfies PricingPageContent;

export const PRICING_PAGE_EN = {
  path: PRICING_PATH_EN,
  eyebrow: "Pricing",
  h1: "Choose the experience that belongs on your tables.",
  subtitle:
    "Every Vistaire display is designed to showcase your menu and identity while delivering an immersive digital experience.",
  monthlyAmount: 200,
  collections: [
    {
      id: "acrylique",
      name: "Vistaire Acrylic",
      label: "Vistaire",
      positioning: "Minimal. Modern. Refined.",
      description:
        "A transparent vertical acrylic display set into a wooden base.",
      setupAmount: 2_000,
      setupPrice: "$2,000 CAD",
      monthlyPrice: "+ $200 CAD / month",
      image: collectionImages.acrylique,
      imageAlt:
        "Transparent Vistaire Acrylic QR display on a restaurant table",
      imagePosition: "50% 50%",
      cta: {
        label: "Discover this collection",
        href: "/en/book-a-call"
      }
    },
    {
      id: "sculpte",
      name: "Vistaire Sculpted",
      label: "Vistaire",
      positioning: "Designed. Sculpted. Made to stand out.",
      description:
        "A vertical wooden display with a rounded, sculpted upper-right corner.",
      setupAmount: 2_050,
      setupPrice: "$2,050 CAD",
      monthlyPrice: "+ $200 CAD / month",
      image: collectionImages.sculpte,
      imageAlt:
        "Vistaire Sculpted wooden QR display with a rounded upper corner",
      imagePosition: "50% 52%",
      cta: {
        label: "Discover this collection",
        href: "/en/book-a-call"
      }
    },
    {
      id: "carre",
      name: "Vistaire Square",
      label: "Vistaire",
      positioning: "Compact. Designed. Warm.",
      description:
        "A compact square wooden display with the QR code built directly into it, available in several finishes.",
      setupAmount: 2_100,
      setupPrice: "$2,100 CAD",
      monthlyPrice: "+ $200 CAD / month",
      image: collectionImages.carre,
      imageAlt:
        "Vistaire Square QR display shown from the front and back on a restaurant table",
      imagePosition: "84% 50%",
      cta: {
        label: "Discover this collection",
        href: "/en/book-a-call"
      }
    },
    {
      id: "signature",
      name: "Vistaire Signature",
      label: "Vistaire",
      positioning: "Premium. Distinctive. Signature.",
      description:
        "A premium horizontal wooden display with a removable black QR insert.",
      setupAmount: 2_200,
      setupPrice: "$2,200 CAD",
      monthlyPrice: "+ $200 CAD / month",
      image: collectionImages.signature,
      imageAlt:
        "Horizontal Vistaire Signature wooden QR display with a removable black insert",
      imagePosition: "50% 50%",
      featured: true,
      cta: {
        label: "Discover this collection",
        href: "/en/book-a-call"
      }
    }
  ],
  included: {
    eyebrow: "Included in the Vistaire offer",
    title: "One Vistaire offer, with the essentials included.",
    body:
      "Whichever collection you choose, you receive the same digital menu, services and guided Vistaire setup.",
    priceDifference:
      "The price difference between collections comes primarily from the physical display selected and its premium positioning."
  },
  includedGroups: [
    {
      index: "01",
      title: "The digital experience",
      items: [
        "Personalized digital menu",
        "Optimized mobile experience",
        "Menu integration",
        "Adaptation to the restaurant identity",
        "Multiple languages",
        "Multiple currencies"
      ]
    },
    {
      index: "02",
      title: "On your tables",
      items: [
        "Up to 20 personalized QR displays",
        "Personalized QR code",
        "Up to 5 dishes in 3D",
        "3D / AR experiences when available"
      ]
    },
    {
      index: "03",
      title: "Delivery and care",
      items: [
        "On-site dish photography by Vistaire",
        "Hosting",
        "Maintenance",
        "Initial configuration",
        "Guided setup and launch"
      ]
    }
  ],
  threeDAddOns: {
    eyebrow: "Additional 3D productions",
    title: "Keep your 3D experiences aligned with your menu.",
    body:
      "The first 5 3D experiences planned in the Vistaire offer are included. New productions beyond that volume are billed separately.",
    packs: [
      {
        quantity: 5,
        label: "+5 3D dishes",
        priceAmount: 149,
        price: "$149 CAD"
      },
      {
        quantity: 10,
        label: "+10 3D dishes",
        priceAmount: 249,
        price: "$249 CAD"
      },
      {
        quantity: 20,
        label: "+20 3D dishes",
        priceAmount: 449,
        price: "$449 CAD"
      }
    ],
    individualLabel: "1 additional 3D dish",
    individualMinAmount: 35,
    individualMaxAmount: 50,
    individualPrice: "$35 to $50 CAD",
    individualNote: "Depending on the complexity of the new 3D production.",
    replacementNote:
      "A new dish that requires a new 3D production is a billable new production, including when it replaces an older dish. A correction to a defective 3D model attributable to Vistaire is not treated as a new production."
  },
  pilotage: {
    eyebrow: "Vistaire Pilotage",
    optionLabel: "Option",
    title: "Take control.",
    price: "+ $100 CAD / month",
    monthlyAmount: 100,
    totalMonthlyAmount: 300,
    body:
      "Add the Vistaire dashboard to manage dish availability and understand how guests experience your menu.",
    features: [
      "Availability managed from the dashboard and reflected in the menu after validation",
      "Menu openings",
      "Dishes viewed",
      "Anonymized searches when the sample is sufficient",
      "3D / AR interactions",
      "Dish views by category",
      "Activity moments grouped into UTC time ranges",
      "Today, 7-day and 30-day views with prior-period comparison"
    ],
    disclosure:
      "Displayed insights depend on recorded activity and respect the product’s privacy thresholds.",
    standardLabel: "Vistaire — $200 / month",
    optionPriceLabel: "Pilotage — + $100 / month",
    totalLabel: "Total — $300 / month"
  },
  workflow: {
    eyebrow: "From your restaurant to launch",
    title: "A structured launch, approved at every key step.",
    body:
      "Vistaire handles preparation, mockups and production. Your restaurant approves the key elements before final manufacturing.",
    steps: [
      {
        index: "01",
        title: "Photography & preparation",
        body:
          "Vistaire photographs the dishes on site and collects the project materials we need."
      },
      {
        index: "02",
        title: "Mockup creation",
        body:
          "We prepare the digital menu mockup and the personalized physical display mockup."
      },
      {
        index: "03",
        title: "Restaurant approval",
        body:
          "You review and approve the mockups before any final production is launched."
      },
      {
        index: "04",
        title: "Production",
        body:
          "After approval, Vistaire starts display manufacturing and finalizes the digital menu."
      },
      {
        index: "05",
        title: "Go live",
        body:
          "Vistaire activates the menu and service once the launch elements are ready."
      }
    ],
    leadTime:
      "Once the menu and display mockups are approved and all required materials are received, full setup generally takes about two weeks. Timing may vary with project complexity and production lead times."
  },
  additional: {
    eyebrow: "Additional needs",
    extras: [
      "Displays beyond 20 or replacements: estimated according to the collection and project need."
    ],
    startingAtTitle: "Why are setup fees shown as “Starting at”?",
    startingAtBody:
      "Every project is adjusted to the venue and the amount of content to prepare.",
    variables: [
      "menu size",
      "dish count",
      "number of menus",
      "content preparation",
      "3D dishes",
      "locations",
      "display quantity",
      "project complexity"
    ]
  },
  commercialTerms: {
    eyebrow: "Essential terms",
    title: "The commercial terms to know.",
    items: [
      "Prices are in Canadian dollars; taxes are extra.",
      "Setup fees are payable 100% before the project begins.",
      "Initial 12-month commitment.",
      "The monthly subscription starts when the service is activated.",
      "The agreed monthly rate stays fixed during the initial 12-month period.",
      "Terms for the following period are established and communicated at renewal."
    ]
  },
  finalCta: {
    eyebrow: "Your collection",
    title: "Need help choosing?",
    body:
      "We will help you choose the display that fits most naturally into your restaurant.",
    primary: {
      label: "Book a call",
      href: "/en/book-a-call"
    },
    secondary: {
      label: "Talk to an expert",
      href: "/en/contact"
    }
  }
} satisfies PricingPageContent;

export function getPricingPage(locale: Locale = "fr"): PricingPageContent {
  return locale === "en" ? PRICING_PAGE_EN : PRICING_PAGE;
}

export function getPricingMetadata(locale: Locale = "fr") {
  return locale === "en" ? pricingMetadataEn : pricingMetadata;
}

function buildPricingOfferCatalog(
  page: PricingPageContent,
  locale: Locale,
  env?: Record<string, string | undefined>
): JsonLdObject {
  const english = locale === "en";

  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${absoluteUrl(page.path, env)}#offer-catalog`,
    name: english
      ? "Vistaire physical QR display collections"
      : "Collections de supports QR physiques Vistaire",
    url: absoluteUrl(page.path, env),
    itemListElement: page.collections.map((collection, index) => ({
      "@type": "Offer",
      position: index + 1,
      name: collection.name,
      url: `${absoluteUrl(page.path, env)}#collection-${collection.id}`,
      priceCurrency: "CAD",
      itemOffered: {
        "@type": "Service",
        name: english
          ? `${collection.name} restaurant menu experience`
          : `Expérience restaurant ${collection.name}`,
        serviceType: english
          ? "Physical QR display with a guided premium digital restaurant menu"
          : "Support QR physique avec menu digital restaurant premium accompagné",
        description: collection.description
      },
      priceSpecification: [
        {
          "@type": "UnitPriceSpecification",
          price: collection.setupAmount,
          priceCurrency: "CAD",
          unitText: english ? "one-time setup" : "mise en place unique"
        },
        {
          "@type": "UnitPriceSpecification",
          price: page.monthlyAmount,
          priceCurrency: "CAD",
          unitText: english ? "month" : "mois"
        }
      ],
      additionalProperty: [
        {
          "@type": "PropertyValue",
          name: english ? "Personalized QR displays" : "Supports QR personnalisés",
          value: english ? "Up to 20" : "Jusqu’à 20"
        },
        {
          "@type": "PropertyValue",
          name: english ? "Included 3D dishes" : "Plats 3D inclus",
          value: english ? "Up to 5" : "Jusqu’à 5"
        }
      ]
    }))
  };
}

function buildPricingServiceJsonLd(
  page: PricingPageContent,
  locale: Locale,
  env?: Record<string, string | undefined>
): JsonLdObject {
  const english = locale === "en";
  const threeDPackValue = page.threeDAddOns.packs
    .map((pack) => `${pack.label}: ${pack.price}`)
    .join("; ");

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(page.path, env)}#service`,
    name: english
      ? "Vistaire physical QR displays and digital restaurant menu"
      : "Supports QR physiques et menu digital restaurant Vistaire",
    serviceType: english
      ? "Premium physical and digital restaurant menu experience"
      : "Expérience de menu restaurant physique et digitale premium",
    url: absoluteUrl(page.path, env),
    description: english
      ? "A guided Vistaire experience combining a personalized physical QR display, a premium mobile menu, selected 3D dishes and optional Pilotage controls."
      : "Une expérience Vistaire accompagnée qui réunit support QR physique personnalisé, carte mobile premium, plats 3D sélectionnés et option Pilotage.",
    provider: {
      "@id": `${absoluteUrl("/", env)}#organization`
    },
    areaServed: [
      { "@type": "City", name: "Montreal" },
      { "@type": "AdministrativeArea", name: "Quebec" },
      { "@type": "Country", name: "Canada" }
    ],
    audience: {
      "@type": "BusinessAudience",
      audienceType: english
        ? "Independent restaurants, premium bistros and high-end restaurants"
        : "Restaurants indépendants, bistros premium et restaurants haut de gamme"
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Vistaire Pilotage",
        value: english
          ? `Optional add-on at $${page.pilotage.monthlyAmount} CAD per month; $${page.pilotage.totalMonthlyAmount} CAD total monthly with Vistaire`
          : `Option à + ${page.pilotage.monthlyAmount} $ CAD par mois; total mensuel de ${page.pilotage.totalMonthlyAmount} $ CAD avec Vistaire`
      },
      {
        "@type": "PropertyValue",
        name: english
          ? "On-site dish photography"
          : "Prise de photos des plats sur place",
        value: english
          ? "Performed by Vistaire as part of setup"
          : "Réalisée par Vistaire dans le cadre de la mise en place"
      },
      {
        "@type": "PropertyValue",
        name: english
          ? "Additional 3D production packs"
          : "Packs de productions 3D supplémentaires",
        value: threeDPackValue
      },
      {
        "@type": "PropertyValue",
        name: english
          ? "Individual additional 3D dish"
          : "Plat 3D supplémentaire à l’unité",
        value: page.threeDAddOns.individualPrice
      }
    ],
    hasOfferCatalog: {
      "@id": `${absoluteUrl(page.path, env)}#offer-catalog`
    }
  };
}

export function buildPricingPageJsonLd(
  env?: Record<string, string | undefined>,
  locale: Locale = "fr"
) {
  const page = getPricingPage(locale);
  const metadata = getPricingMetadata(locale);
  const english = locale === "en";

  return [
    buildWebPageJsonLd(
      {
        path: page.path,
        name: metadata.title,
        description: metadata.description,
        ...(english ? { locale: "en" as const } : {})
      },
      env
    ),
    buildPricingServiceJsonLd(page, locale, env),
    buildPricingOfferCatalog(page, locale, env),
    buildBreadcrumbJsonLd(
      [
        { name: english ? "Home" : "Accueil", path: english ? "/en" : "/" },
        {
          name: english ? "Vistaire pricing" : "Tarifs Vistaire",
          path: page.path
        }
      ],
      env
    )
  ];
}
