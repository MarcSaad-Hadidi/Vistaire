import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
  type JsonLdObject
} from "./seo.ts";
import type { Locale } from "./i18n.ts";
import { getSeoMarketingImage } from "./seoMarketingImages.ts";
import { formatSetupAmount } from "./pricingCalculator.ts";

export const PRICING_PATH = "/tarifs-menu-digital-restaurant";
export const SAMPLE_MENU_PATH = "/demo";
export const PRICING_PATH_EN = "/en/pricing-digital-restaurant-menu";
export const SAMPLE_MENU_PATH_EN = "/en/vistaire-menu";

const MONTHLY_AMOUNT = 200;
const SETUP_AMOUNTS = {
  digital: 1_500,
  acrylique: 2_000,
  sculpte: 2_050,
  carre: 2_100,
  signature: 2_200
} as const satisfies Readonly<Record<PricingOfferId, number>>;

export const pricingMetadata = {
  title: "Tarifs Vistaire | Supports QR et menu digital restaurant",
  description:
    `Découvrez Vistaire Digital dès ${formatSetupAmount(SETUP_AMOUNTS.digital, "fr")} et quatre collections de supports QR, avec menu digital à ${formatSetupAmount(MONTHLY_AMOUNT, "fr")} par mois et Pilotage en option.`
} as const;

export const pricingMetadataEn = {
  title: "Vistaire Pricing | QR Displays & Digital Restaurant Menu",
  description:
    `Explore Vistaire Digital from ${formatSetupAmount(SETUP_AMOUNTS.digital, "en")} and four QR display collections, with a digital menu at ${formatSetupAmount(MONTHLY_AMOUNT, "en")} per month and optional Pilotage controls.`
} as const;

export type PricingCollectionId =
  | "acrylique"
  | "sculpte"
  | "carre"
  | "signature";

export type PricingOfferId = "digital" | PricingCollectionId;

export type PricingCollection = {
  id: PricingOfferId;
  kind: "digital" | "physical";
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
  };
};

const collectionImages = {
  digital: getSeoMarketingImage("PRICING:collection:digital").src,
  acrylique: getSeoMarketingImage("PRICING:collection:acrylique").src,
  sculpte: getSeoMarketingImage("PRICING:collection:sculpte").src,
  carre: getSeoMarketingImage("PRICING:collection:carre").src,
  signature: getSeoMarketingImage("PRICING:collection:signature").src
} as const;

export const PRICING_PAGE = {
  path: PRICING_PATH,
  eyebrow: "Tarifs",
  h1: "Choisissez l’expérience qui prendra place sur vos tables.",
  subtitle:
    "Choisissez le menu digital seul ou une collection de supports QR pour mettre en valeur votre menu et votre identité.",
  monthlyAmount: MONTHLY_AMOUNT,
  collections: [
    {
      id: "digital",
      kind: "digital",
      name: "Vistaire Digital",
      label: "Vistaire",
      positioning: "Toute l’expérience Vistaire, sans support physique.",
      description:
        "Votre QR personnalisé est livré au format numérique pour être intégré à votre menu papier ou à vos supports actuels. Vous conservez votre présentation de table, sans nouveau support physique.",
      setupAmount: SETUP_AMOUNTS.digital,
      setupPrice: formatSetupAmount(SETUP_AMOUNTS.digital, "fr"),
      monthlyPrice: `+ ${formatSetupAmount(MONTHLY_AMOUNT, "fr")} / mois`,
      image: collectionImages.digital,
      imageAlt: getSeoMarketingImage("PRICING:collection:digital", "fr").alt,
      imagePosition: "50% 50%",
      cta: {
        label: "Découvrir Vistaire Digital",
        href: "/prendre-rendez-vous"
      }
    },
    {
      id: "acrylique",
      kind: "physical",
      name: "Vistaire Acrylique",
      label: "Vistaire",
      positioning: "Minimal. Moderne. Épuré.",
      description:
        "Une plaque verticale en acrylique sur une base en bois. La transparence du panneau et la chaleur du socle composent une présentation épurée, pensée pour laisser respirer la table.",
      setupAmount: SETUP_AMOUNTS.acrylique,
      setupPrice: formatSetupAmount(SETUP_AMOUNTS.acrylique, "fr"),
      monthlyPrice: `+ ${formatSetupAmount(MONTHLY_AMOUNT, "fr")} / mois`,
      image: collectionImages.acrylique,
      imageAlt: getSeoMarketingImage("PRICING:collection:acrylique", "fr").alt,
      imagePosition: "50% 50%",
      cta: {
        label: "Découvrir cette collection",
        href: "/prendre-rendez-vous"
      }
    },
    {
      id: "sculpte",
      kind: "physical",
      name: "Vistaire Sculpté",
      label: "Vistaire",
      positioning: "Design. Sculpté. Pour se démarquer.",
      description:
        "Une silhouette verticale en bois dont l’angle supérieur droit est arrondi et sculpté. Ses lignes travaillées donnent du relief à la présentation du QR et font du support un élément du dressage.",
      setupAmount: SETUP_AMOUNTS.sculpte,
      setupPrice: formatSetupAmount(SETUP_AMOUNTS.sculpte, "fr"),
      monthlyPrice: `+ ${formatSetupAmount(MONTHLY_AMOUNT, "fr")} / mois`,
      image: collectionImages.sculpte,
      imageAlt: getSeoMarketingImage("PRICING:collection:sculpte", "fr").alt,
      imagePosition: "50% 50%",
      cta: {
        label: "Découvrir cette collection",
        href: "/prendre-rendez-vous"
      }
    },
    {
      id: "carre",
      kind: "physical",
      name: "Vistaire Carré",
      label: "Vistaire",
      positioning: "Compact. Design. Chaleureux.",
      description:
        "Un format carré compact en bois, avec le QR directement intégré au support. Ses différentes finitions permettent de choisir l’accord avec la table et le décor du restaurant.",
      setupAmount: SETUP_AMOUNTS.carre,
      setupPrice: formatSetupAmount(SETUP_AMOUNTS.carre, "fr"),
      monthlyPrice: `+ ${formatSetupAmount(MONTHLY_AMOUNT, "fr")} / mois`,
      image: collectionImages.carre,
      imageAlt: getSeoMarketingImage("PRICING:collection:carre", "fr").alt,
      imagePosition: "50% 50%",
      cta: {
        label: "Découvrir cette collection",
        href: "/prendre-rendez-vous"
      }
    },
    {
      id: "signature",
      kind: "physical",
      name: "Vistaire Signature",
      label: "Vistaire",
      positioning: "Premium. Distinctif. Signature.",
      description:
        "Une présentation horizontale en bois premium avec un insert QR noir et amovible. Le contraste du bois et du noir souligne une silhouette basse, différente de nos présentations verticales.",
      setupAmount: SETUP_AMOUNTS.signature,
      setupPrice: formatSetupAmount(SETUP_AMOUNTS.signature, "fr"),
      monthlyPrice: `+ ${formatSetupAmount(MONTHLY_AMOUNT, "fr")} / mois`,
      image: collectionImages.signature,
      imageAlt: getSeoMarketingImage("PRICING:collection:signature", "fr").alt,
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
    title: "L’essentiel digital dans chaque offre Vistaire.",
    body:
      "Les cinq offres incluent le même menu digital, un QR personnalisé, les photographies culinaires prises sur place et jusqu’à 5 plats en 3D. Choisissez ensuite le QR numérique seul ou le support qui vous ressemble.",
    priceDifference:
      "Digital ne comprend aucun support physique. Les quatre collections physiques ajoutent jusqu’à 20 supports QR personnalisés ; leur différence de prix provient principalement du support choisi et de son positionnement premium."
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
        "Plusieurs devises"
      ]
    },
    {
      index: "02",
      title: "Sur vos tables",
      items: [
        "Jusqu’à 20 supports QR personnalisés avec les collections physiques seulement",
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
      "Jusqu’à 5 expériences 3D peuvent être incluses dans l’offre Vistaire. Toute nouvelle production qui dépasse le volume inclus est facturée séparément.",
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
    standardLabel: "Vistaire 200 $ / mois",
    optionPriceLabel: "Pilotage + 100 $ / mois",
    totalLabel: "Total 300 $ / mois"
  },
  workflow: {
    eyebrow: "De votre restaurant à la mise en ligne",
    title: "Un lancement cadré, validé à chaque étape.",
    body:
      "Vistaire prend en charge la préparation du menu et les maquettes. Les maquettes et la fabrication des supports concernent uniquement les collections physiques ; Digital ne comprend aucune production ni installation physique.",
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
          "Nous préparons la maquette du menu numérique et, pour les collections physiques, celle des supports personnalisés."
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
          "Après validation, Vistaire finalise le menu digital. La fabrication des supports concerne uniquement les collections physiques."
      },
      {
        index: "05",
        title: "Mise en ligne",
        body:
          "Vistaire active le menu et le service une fois les éléments de lancement prêts."
      }
    ],
    leadTime:
      "Une fois le menu et, le cas échéant, les maquettes des supports validés, et les éléments nécessaires reçus, la mise en place complète prend généralement environ deux semaines. Ce délai peut varier selon la complexité et, pour les collections physiques, les délais de production."
  },
  additional: {
    eyebrow: "Besoins complémentaires",
    extras: [
      "Collections physiques seulement : supports supplémentaires après les 20 inclus ou supports de remplacement, selon la collection et le besoin. Aucun support physique inclus avec Digital."
    ],
    startingAtTitle:
      "Pourquoi les frais de mise en place sont indiqués « À partir de » ?",
    startingAtBody:
      "Les collections physiques sont ajustées à la réalité de l’établissement et à la quantité de contenu à préparer. Le prix de Digital reste fixe quel que soit le nombre de tables.",
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
      "Nous vous accompagnons dans le choix du menu digital seul ou du support qui s’intègre le mieux à votre établissement.",
    primary: {
      label: "Prendre rendez vous",
      href: "/prendre-rendez-vous"
    }
  }
} satisfies PricingPageContent;

export const PRICING_PAGE_EN = {
  path: PRICING_PATH_EN,
  eyebrow: "Pricing",
  h1: "Choose the experience that belongs on your tables.",
  subtitle:
    "Choose the digital menu on its own or a QR display collection to showcase your menu and identity.",
  monthlyAmount: MONTHLY_AMOUNT,
  collections: [
    {
      id: "digital",
      kind: "digital",
      name: "Vistaire Digital",
      label: "Vistaire",
      positioning: "Everything Vistaire offers, without a physical display.",
      description:
        "Your personalized QR code is delivered digitally, ready to add to your printed menu or existing displays. Keep your current table presentation without introducing a new physical display.",
      setupAmount: SETUP_AMOUNTS.digital,
      setupPrice: formatSetupAmount(SETUP_AMOUNTS.digital, "en"),
      monthlyPrice: `+ ${formatSetupAmount(MONTHLY_AMOUNT, "en")} / month`,
      image: collectionImages.digital,
      imageAlt: getSeoMarketingImage("PRICING:collection:digital", "en").alt,
      imagePosition: "50% 50%",
      cta: {
        label: "Discover Vistaire Digital",
        href: "/en/book-a-call"
      }
    },
    {
      id: "acrylique",
      kind: "physical",
      name: "Vistaire Acrylic",
      label: "Vistaire",
      positioning: "Minimal. Modern. Refined.",
      description:
        "A vertical acrylic panel set into a wooden base. The transparent panel and warm wooden base create a clean presentation that leaves the rest of your table in view.",
      setupAmount: SETUP_AMOUNTS.acrylique,
      setupPrice: formatSetupAmount(SETUP_AMOUNTS.acrylique, "en"),
      monthlyPrice: `+ ${formatSetupAmount(MONTHLY_AMOUNT, "en")} / month`,
      image: collectionImages.acrylique,
      imageAlt: getSeoMarketingImage("PRICING:collection:acrylique", "en").alt,
      imagePosition: "50% 50%",
      cta: {
        label: "Discover this collection",
        href: "/en/book-a-call"
      }
    },
    {
      id: "sculpte",
      kind: "physical",
      name: "Vistaire Sculpted",
      label: "Vistaire",
      positioning: "Designed. Sculpted. Made to stand out.",
      description:
        "A vertical wooden silhouette with a rounded, sculpted upper right corner. Its shaped lines bring depth to the QR presentation and make the display part of your table setting.",
      setupAmount: SETUP_AMOUNTS.sculpte,
      setupPrice: formatSetupAmount(SETUP_AMOUNTS.sculpte, "en"),
      monthlyPrice: `+ ${formatSetupAmount(MONTHLY_AMOUNT, "en")} / month`,
      image: collectionImages.sculpte,
      imageAlt: getSeoMarketingImage("PRICING:collection:sculpte", "en").alt,
      imagePosition: "50% 50%",
      cta: {
        label: "Discover this collection",
        href: "/en/book-a-call"
      }
    },
    {
      id: "carre",
      kind: "physical",
      name: "Vistaire Square",
      label: "Vistaire",
      positioning: "Compact. Designed. Warm.",
      description:
        "A compact square wooden display with the QR code integrated directly into it. Choose from several finishes to find the right match for your tables and restaurant decor.",
      setupAmount: SETUP_AMOUNTS.carre,
      setupPrice: formatSetupAmount(SETUP_AMOUNTS.carre, "en"),
      monthlyPrice: `+ ${formatSetupAmount(MONTHLY_AMOUNT, "en")} / month`,
      image: collectionImages.carre,
      imageAlt: getSeoMarketingImage("PRICING:collection:carre", "en").alt,
      imagePosition: "50% 50%",
      cta: {
        label: "Discover this collection",
        href: "/en/book-a-call"
      }
    },
    {
      id: "signature",
      kind: "physical",
      name: "Vistaire Signature",
      label: "Vistaire",
      positioning: "Premium. Distinctive. Signature.",
      description:
        "A premium horizontal wooden display with a removable black QR insert. The contrast between wood and black defines a low silhouette that stands apart from our vertical displays.",
      setupAmount: SETUP_AMOUNTS.signature,
      setupPrice: formatSetupAmount(SETUP_AMOUNTS.signature, "en"),
      monthlyPrice: `+ ${formatSetupAmount(MONTHLY_AMOUNT, "en")} / month`,
      image: collectionImages.signature,
      imageAlt: getSeoMarketingImage("PRICING:collection:signature", "en").alt,
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
    title: "Digital essentials in every Vistaire offer.",
    body:
      "All five offers include the same digital menu, a personalized QR code, on site food photography and up to 5 dishes in 3D. Then choose a digital QR code on its own or the display that suits your tables.",
    priceDifference:
      "Digital includes no physical display. The four physical collections add up to 20 personalized QR displays; their price difference comes primarily from the display selected and its premium positioning."
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
        "Up to 20 personalized QR displays with physical collections only",
        "Personalized QR code",
        "Up to 5 dishes in 3D",
        "3D / AR experiences when available"
      ]
    },
    {
      index: "03",
      title: "Delivery and care",
      items: [
        "Dish photography at your restaurant by Vistaire",
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
      "Up to 5 3D experiences can be included in the Vistaire offer. New productions beyond the included volume are billed separately.",
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
      "Views for today, 7 days and 30 days, with comparison to the previous period"
    ],
    disclosure:
      "Displayed insights depend on recorded activity and respect the product’s privacy thresholds.",
    standardLabel: "Vistaire $200 / month",
    optionPriceLabel: "Pilotage + $100 / month",
    totalLabel: "Total $300 / month"
  },
  workflow: {
    eyebrow: "From your restaurant to launch",
    title: "A structured launch, approved at every key step.",
    body:
      "Vistaire handles menu preparation and mockups. Display mockups and manufacturing apply only to physical collections; Digital includes no physical production or installation.",
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
          "We prepare the digital menu mockup and, for physical collections, the personalized display mockup."
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
          "After approval, Vistaire finalizes the digital menu. Display manufacturing applies only to physical collections."
      },
      {
        index: "05",
        title: "Go live",
        body:
          "Vistaire activates the menu and service once the launch elements are ready."
      }
    ],
    leadTime:
      "Once the menu and, where applicable, display mockups are approved and all required materials are received, full setup generally takes about two weeks. Timing may vary with project complexity and, for physical collections, production lead times."
  },
  additional: {
    eyebrow: "Additional needs",
    extras: [
      "Physical collections only: displays beyond 20 or replacements, according to the collection and project need. No physical display included with Digital."
    ],
    startingAtTitle: "Why are setup fees shown as “Starting at”?",
    startingAtBody:
      "Physical collections are adjusted to the venue and the amount of content to prepare. Digital pricing stays fixed regardless of the table count.",
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
      "Initial commitment of 12 months.",
      "The monthly subscription starts when the service is activated.",
      "The agreed monthly rate stays fixed during the initial period of 12 months.",
      "Terms for the following period are established and communicated at renewal."
    ]
  },
  finalCta: {
    eyebrow: "Your collection",
    title: "Need help choosing?",
    body:
      "We will help you choose the digital menu on its own or the display that fits most naturally into your restaurant.",
    primary: {
      label: "Book a call",
      href: "/en/book-a-call"
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
      ? "Vistaire digital menu and QR display offers"
      : "Offres de menu digital et supports QR Vistaire",
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
        serviceType: collection.kind === "digital"
          ? english
            ? "Premium digital restaurant menu with no physical display included"
            : "Menu digital restaurant premium sans support physique inclus"
          : english
            ? "Physical QR display with a guided premium digital restaurant menu"
            : "Support QR physique avec menu digital restaurant premium accompagné",
        description: collection.description
      },
      priceSpecification: [
        {
          "@type": "UnitPriceSpecification",
          price: collection.setupAmount,
          priceCurrency: "CAD",
          unitText: english ? "one time setup" : "mise en place unique"
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
          value: collection.kind === "digital"
            ? english ? "No physical display included" : "Aucun support physique inclus"
            : english ? "Up to 20" : "Jusqu’à 20"
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
      ? "Vistaire digital restaurant menu and optional physical QR displays"
      : "Menu digital restaurant Vistaire et supports QR physiques au choix",
    serviceType: english
      ? "Premium physical and digital restaurant menu experience"
      : "Expérience de menu restaurant physique et digitale premium",
    url: absoluteUrl(page.path, env),
    description: english
      ? "A guided Vistaire experience with a premium mobile menu, selected 3D dishes and optional Pilotage controls. Digital includes no physical display; physical collections include personalized QR displays."
      : "Une expérience Vistaire accompagnée avec carte mobile premium, plats 3D sélectionnés et option Pilotage. Digital ne comprend aucun support physique ; les collections physiques incluent des supports QR personnalisés.",
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
        ? "Independent restaurants, premium bistros and high end restaurants"
        : "Restaurants indépendants, bistros premium et restaurants haut de gamme"
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Vistaire Pilotage",
        value: english
          ? `Optional Pilotage option at $${page.pilotage.monthlyAmount} CAD per month; $${page.pilotage.totalMonthlyAmount} CAD total monthly with Vistaire`
          : `Option à + ${page.pilotage.monthlyAmount} $ CAD par mois; total mensuel de ${page.pilotage.totalMonthlyAmount} $ CAD avec Vistaire`
      },
      {
        "@type": "PropertyValue",
        name: english
          ? "Dish photography at the restaurant"
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
