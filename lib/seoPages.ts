import type { Locale } from "./i18n.ts";

export type SeoPageSlug =
  | "menu-digital-restaurant"
  | "menu-qr-code-restaurant"
  | "menu-3d-ar-restaurant"
  | "menu-pdf-vs-menu-digital";

type SeoSection = {
  heading: string;
  body: string[];
  points?: string[];
};

type ComparisonRow = {
  label: string;
  before: string;
  after: string;
};

export type SeoPageData = {
  locale?: Locale;
  slug: SeoPageSlug;
  path: string;
  metadataTitle: string;
  metadataDescription: string;
  cardDescription: string;
  relatedDescription: string;
  eyebrow: string;
  footerLabel?: string;
  linkTitle?: string;
  h1: string;
  answer: string[];
  takeaway: {
    heading: string;
    text: string;
  };
  visualImage: {
    src: string;
    alt: string;
  };
  sections: SeoSection[];
  comparison: {
    heading: string;
    beforeLabel: string;
    afterLabel: string;
    rows: ComparisonRow[];
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
  primaryCta: {
    href: string;
    label: string;
  };
  secondaryCta?: {
    href: string;
    label: string;
  };
};

export const SEO_PAGES: SeoPageData[] = [
  {
    slug: "menu-digital-restaurant",
    path: "/menu-digital-restaurant",
    metadataTitle: "Menu digital restaurant premium | Vistaire",
    metadataDescription:
      "Vistaire transforme le menu digital restaurant en expérience premium : QR code, fiches plats, allergènes, visuels et 3D/AR sélective.",
    cardDescription:
      "Fiches plats, allergènes, visuels et 3D sélective : ce qu'un menu digital premium doit offrir à table.",
    relatedDescription:
      "Anatomie d'une carte mobile premium : structure, fiches plats et immersion utile.",
    eyebrow: "Menu digital premium",
    footerLabel: "Menu digital restaurant",
    linkTitle: "Anatomie d'un menu digital haut de gamme",
    h1: "Le menu digital premium transforme la carte en expérience.",
    answer: [
      "Un menu digital pour restaurant est une carte consultable sur le téléphone du client, souvent après scan d'un QR code à table. Vistaire en fait une expérience premium : photos, fiches plats, allergènes, prix, accords et vues 3D/AR lorsque le plat le permet, sans téléchargement d'application.",
      "L'objectif n'est pas de transformer la salle en logiciel froid. Vistaire garde la carte, le plat et l'image du restaurant au centre, avec une lecture mobile claire pour le convive et un aperçu restaurateur des signaux anonymes autour du menu."
    ],
    takeaway: {
      heading: "À retenir",
      text:
        "Un menu digital premium structure la carte pour le mobile, met les plats en scène avec fiches et visuels, et garde la 3D/AR sélective pour les signatures qui le méritent."
    },
    visualImage: {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "Plat signature illustre dans une fiche de menu digital Vistaire"
    },
    sections: [
      {
        heading: "Qu'est-ce qu'un menu digital pour restaurant ?",
        body: [
          "Un menu digital restaurant remplace la lecture statique d'un fichier par une carte pensée pour le téléphone. Les catégories, les descriptions, les allergènes et les visuels restent lisibles pendant le service.",
          "Pour un restaurant haut de gamme, cette expérience doit rester sobre et fidèle à la salle. La technologie soutient le choix du client, elle ne prend pas la place de l'accueil ou du service."
        ],
        points: [
          "Carte accessible par QR code à table",
          "Fiches plats visuelles avec détails utiles",
          "Parcours mobile rapide, sans application à installer"
        ]
      },
      {
        heading: "Ce que Vistaire met en avant",
        body: [
          "Vistaire met les plats signatures en scène avec une hiérarchie claire : nom, prix, récit court, allergènes, accords et visuels. La 3D/AR reste sélective et réservée aux plats qui gagnent à être vus en volume.",
          "Côté restaurateur, l'aperçu aide à comprendre les consultations, recherches et interactions immersives sans promettre des résultats que le menu ne mesure pas."
        ]
      }
    ],
    comparison: {
      heading: "Menu digital simple ou expérience premium ?",
      beforeLabel: "Menu basique",
      afterLabel: "Vistaire",
      rows: [
        {
          label: "Lecture mobile",
          before: "Un fichier ou une liste longue à parcourir.",
          after: "Une carte structurée par catégories, fiches et détails utiles."
        },
        {
          label: "Image de marque",
          before: "Une présentation souvent détachée de l'ambiance du lieu.",
          after: "Un univers visuel cohérent avec la table et les plats signatures."
        },
        {
          label: "Immersion",
          before: "Photos isolées ou absence de contenus visuels.",
          after: "Visuels food-first et 3D/AR uniquement quand elle apporte de la clarté."
        }
      ]
    },
    faq: [
      {
        question: "Le client doit-il installer une application ?",
        answer:
          "Non. Le menu Vistaire s'ouvre dans le navigateur mobile après scan du QR code."
      },
      {
        question: "Tous les plats doivent-ils avoir une vue 3D ou AR ?",
        answer:
          "Non. Vistaire privilégie une 3D/AR sélective pour les plats signatures ou les créations qui gagnent à être explorées en volume."
      },
      {
        question: "Que doit contenir un vrai menu digital pour restaurant ?",
        answer:
          "Catégories lisibles, fiches plats avec prix et allergènes, visuels food-first, parcours mobile rapide et contenus immersifs seulement quand ils clarifient le plat."
      },
      {
        question: "Le menu digital remplace-t-il le menu papier ?",
        answer:
          "Pas nécessairement. Beaucoup de restaurants gardent un menu imprimé et utilisent le digital comme carte complémentaire à table."
      },
      {
        question: "Vistaire convient-il aux restaurants haut de gamme ?",
        answer:
          "Oui, si l'objectif est une présentation sobre, visuelle et fidèle à la salle, pas une interface utilitaire froide."
      },
      {
        question: "Comment le restaurateur met-il à jour la carte ?",
        answer:
          "Via l'aperçu restaurateur Vistaire : plats, catégories, visuels et contenus compatibles peuvent évoluer sans republier un fichier."
      }
    ],
    service: {
      name: "Menu digital restaurant Vistaire",
      serviceType: "Menu digital premium pour restaurants",
      description:
        "Carte mobile premium avec fiches plats, visuels, allergènes et immersion sélective pour restaurants haut de gamme."
    },
    primaryCta: {
      href: "/demo",
      label: "Explorer le menu exemple"
    },
    secondaryCta: {
      href: "/admin",
      label: "Voir l'aperçu restaurateur"
    }
  },
  {
    slug: "menu-qr-code-restaurant",
    path: "/menu-qr-code-restaurant",
    metadataTitle: "Menu QR code restaurant premium | Vistaire",
    metadataDescription:
      "Un menu QR code Vistaire ouvre une carte mobile premium : fiches plats, visuels, allergènes et expérience fidèle au restaurant.",
    cardDescription:
      "Après le scan, une carte mobile structurée, pas un fichier à zoomer. L'entrée QR, l'expérience Vistaire.",
    relatedDescription:
      "Du scan à la fiche plat : ce que le client voit vraiment après un QR code.",
    eyebrow: "QR code restaurant",
    footerLabel: "Menu QR code restaurant",
    linkTitle: "QR code → carte mobile sans application",
    h1: "Le QR code doit ouvrir une expérience, pas un fichier.",
    answer: [
      "Un menu QR code pour restaurant ne devrait pas se limiter à ouvrir un fichier à zoomer. Avec Vistaire, le QR code devient l'entrée vers une carte mobile, visuelle et fluide : le client parcourt les catégories, ouvre une fiche plat et découvre les contenus immersifs disponibles.",
      "La valeur du QR code dépend de ce qui se passe après le scan. Vistaire transforme cet accès en expérience de carte, avec une présentation soignée et adaptée au rythme du service."
    ],
    takeaway: {
      heading: "En résumé",
      text:
        "Le QR code n'est qu'une porte d'entrée. La qualité dépend de la carte mobile qui s'ouvre : claire, visuelle et fidèle au restaurant."
    },
    visualImage: {
      src: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
      alt: "Fiche plat accessible depuis un QR code restaurant Vistaire"
    },
    sections: [
      {
        heading: "Que voit le client après le scan ?",
        body: [
          "Le client arrive sur une carte mobile organisée, pas sur un document figé. Les catégories, les fiches plats et les détails importants restent faciles à consulter à table.",
          "Le QR code conserve son rôle simple : ouvrir vite. Vistaire prend ensuite le relais pour donner une lecture premium de la carte."
        ],
        points: [
          "Accès immédiat depuis la table",
          "Carte mobile adaptée à la lecture courte",
          "Fiches plats pour les créations qui demandent plus de contexte"
        ]
      },
      {
        heading: "Un QR code peut rester haut de gamme",
        body: [
          "Le QR code n'est pas incompatible avec un restaurant premium si l'expérience ouverte est soignée. Les textes, les visuels et les interactions doivent prolonger la salle plutôt que l'appauvrir.",
          "Vistaire évite la logique utilitaire froide : le scan sert de porte d'entrée vers une carte élégante, claire et centrée sur les plats."
        ]
      }
    ],
    comparison: {
      heading: "QR code seul ou carte Vistaire ?",
      beforeLabel: "QR code seul",
      afterLabel: "QR code Vistaire",
      rows: [
        {
          label: "Après le scan",
          before: "Le client ouvre souvent un fichier peu confortable.",
          after: "Le client arrive sur une carte mobile structurée."
        },
        {
          label: "Mise à jour",
          before: "La carte reste liée à un document à republier.",
          after: "L'expérience peut évoluer autour des plats et contenus disponibles."
        },
        {
          label: "Perception",
          before: "Le QR code peut paraître purement pratique.",
          after: "Le QR code devient l'accès discret à une présentation premium."
        }
      ]
    },
    faq: [
      {
        question: "Le QR code suffit-il à moderniser un menu ?",
        answer:
          "Non. Le QR code est seulement le point d'entrée; la qualité dépend de la carte mobile qui s'ouvre ensuite."
      },
      {
        question: "Le client doit-il télécharger quelque chose ?",
        answer:
          "Non. Vistaire est conçu pour s'ouvrir directement depuis le navigateur mobile."
      },
      {
        question: "Faut-il un QR code par table ou un seul suffit ?",
        answer:
          "Un QR par table ou par zone fonctionne selon le service. L'important est que le scan ouvre toujours la même carte soignée."
      },
      {
        question: "Le client doit-il être connecté au Wi-Fi du restaurant ?",
        answer:
          "Non. Le menu s'ouvre via la connexion mobile du client, comme n'importe quelle page web."
      },
      {
        question: "Un QR code peut-il rester élégant en restaurant premium ?",
        answer:
          "Oui, si l'expérience ouverte prolonge la salle : textes soignés, visuels food-first et parcours mobile fluide."
      },
      {
        question: "Que se passe-t-il si le client n'a pas de smartphone ?",
        answer:
          "Le restaurant peut conserver un menu papier ou proposer une tablette. Vistaire ne remplace pas l'accueil humain."
      }
    ],
    service: {
      name: "Menu QR code Vistaire",
      serviceType: "Menu QR code premium pour restaurants",
      description:
        "Carte mobile premium accessible par QR code, pensée pour la lecture à table et les plats signatures."
    },
    primaryCta: {
      href: "/demo",
      label: "Tester le QR menu exemple"
    },
    secondaryCta: {
      href: "/menu-pdf-vs-menu-digital",
      label: "Comparer avec un PDF"
    }
  },
  {
    slug: "menu-3d-ar-restaurant",
    path: "/menu-3d-ar-restaurant",
    metadataTitle: "Menu 3D/AR pour restaurant | Vistaire",
    metadataDescription:
      "Vistaire ajoute la 3D/AR sélective aux menus de restaurants premium quand un plat compatible gagne à être vu en volume.",
    cardDescription:
      "Quand activer la 3D/AR, quand s'en passer, et comment rester premium sans gadget.",
    relatedDescription:
      "Immersion sélective : plats compatibles, fallback clair, pas de 3D systématique.",
    eyebrow: "3D/AR restaurant",
    footerLabel: "Menu 3D / AR restaurant",
    linkTitle: "3D utile vs gadget : quand l'activer",
    h1: "La 3D n'impressionne que si elle rend le plat plus désirable.",
    answer: [
      "La 3D/AR dans un menu de restaurant aide le client à mieux comprendre un plat avant de choisir, surtout pour les signatures, desserts et cocktails visuels. Vistaire l'intègre comme option de présentation : les plats compatibles peuvent être explorés en 3D, et l'AR s'ouvre sur mobile compatible après action du client.",
      "Cette immersion doit rester sélective. Une fiche plat Vistaire reste claire avec ou sans AR, afin que l'expérience principale du menu ne dépende jamais d'un appareil ou d'un asset particulier."
    ],
    takeaway: {
      heading: "À retenir",
      text:
        "La 3D/AR aide quand le volume ou la présentation du plat compte. Vistaire la réserve aux plats compatibles, avec une fiche visuelle claire si l'AR n'est pas disponible."
    },
    visualImage: {
      src: "/images/demo/dishes/maison-elyse-n1.png",
      alt: "Plat signature presente avec une experience immersive Vistaire"
    },
    sections: [
      {
        heading: "Quand la 3D ou l'AR est-elle pertinente ?",
        body: [
          "La 3D/AR est utile quand le volume, la texture ou la présentation d'un plat raconte quelque chose qu'une ligne de texte ne suffit pas à transmettre.",
          "Vistaire la réserve aux plats compatibles et garde toujours une fiche visuelle lisible pour les clients qui ne l'ouvrent pas."
        ],
        points: [
          "Plats signatures à forte présentation",
          "Desserts, cocktails ou créations visuelles",
          "Ouverture immersive seulement après intention du client"
        ]
      },
      {
        heading: "Une immersion sans alourdir toute la carte",
        body: [
          "Le menu doit rester rapide à parcourir. Les contenus 3D/AR sont donc traités comme une couche de présentation, pas comme une condition d'accès au plat.",
          "Cette approche protège le rythme du service et conserve une expérience premium même si l'appareil ne prend pas en charge l'AR."
        ]
      }
    ],
    comparison: {
      heading: "3D/AR systématique ou sélective ?",
      beforeLabel: "Systématique",
      afterLabel: "Sélective",
      rows: [
        {
          label: "Performance",
          before: "Risque d'alourdir la carte sans bénéfice clair.",
          after: "Les contenus immersifs sont réservés aux plats qui le méritent."
        },
        {
          label: "Compréhension",
          before: "L'effet visuel peut prendre le dessus sur le plat.",
          after: "La 3D soutient la décision du client quand elle apporte du contexte."
        },
        {
          label: "Compatibilité",
          before: "L'expérience peut dépendre fortement de l'appareil.",
          after: "La fiche plat reste utile avec un fallback visuel clair."
        }
      ]
    },
    faq: [
      {
        question: "L'AR fonctionne-t-elle sur tous les téléphones ?",
        answer:
          "Non. Vistaire garde une fiche plat complète et n'ouvre l'AR que lorsqu'elle est disponible et demandée par le client."
      },
      {
        question: "Faut-il modéliser toute la carte ?",
        answer:
          "Non. Une sélection de plats signatures suffit souvent pour créer un moment immersif cohérent."
      },
      {
        question: "La 3D ralentit-elle le chargement du menu ?",
        answer:
          "Les contenus 3D/AR ne se chargent qu'après intention du client sur une fiche plat, pas au parcours initial de la carte."
      },
      {
        question: "L'AR remplace-t-elle la photo du plat ?",
        answer:
          "Non. La fiche garde toujours photo, texte, prix et allergènes. La 3D/AR complète la présentation quand elle apporte du contexte."
      },
      {
        question: "Quels plats méritent une vue 3D en priorité ?",
        answer:
          "Signatures à forte présentation, desserts visuels, cocktails travaillés ou créations dont le volume raconte mieux que le texte."
      },
      {
        question: "Que voit le client si l'AR n'est pas disponible ?",
        answer:
          "La fiche plat reste complète avec visuels premium. L'AR est un bonus, jamais une condition pour comprendre le plat."
      }
    ],
    service: {
      name: "Menu 3D/AR Vistaire",
      serviceType: "Présentation 3D/AR sélective pour menus de restaurants",
      description:
        "Couche immersive pour plats compatibles, avec fiche plat claire et fallback premium."
    },
    primaryCta: {
      href: "/demo",
      label: "Voir une fiche plat"
    },
    secondaryCta: {
      href: "/menu-digital-restaurant",
      label: "Revenir au menu digital"
    }
  },
  {
    slug: "menu-pdf-vs-menu-digital",
    path: "/menu-pdf-vs-menu-digital",
    metadataTitle: "Menu PDF vs menu digital restaurant | Vistaire",
    metadataDescription:
      "Comparez menu PDF et menu digital pour restaurant premium : lisibilité mobile, fiches plats, allergènes et expérience à table.",
    cardDescription:
      "Zoom, page fixe, image générique : pourquoi le PDF atteint vite ses limites sur mobile premium.",
    relatedDescription:
      "PDF acceptable parfois, insuffisant à table : la différence concrète avec une carte digitale.",
    eyebrow: "PDF ou digital",
    footerLabel: "PDF vs menu digital",
    linkTitle: "Un PDF n'est pas un menu digital",
    h1: "Un PDF n'est pas un menu digital.",
    answer: [
      "Un PDF reste simple à produire et pratique pour l'impression, mais il est souvent moins confortable à lire sur mobile à table. Un menu digital comme Vistaire structure la carte, met les plats en scène, rend les allergènes plus lisibles et peut ajouter des fiches visuelles ou 3D/AR.",
      "Le bon choix dépend du niveau d'expérience attendu. Pour une carte courte et rarement modifiée, un PDF peut suffire. Pour un restaurant qui veut valoriser ses plats et guider le client avec élégance, une carte digitale dédiée devient plus cohérente."
    ],
    takeaway: {
      heading: "Réponse directe",
      text:
        "Un PDF peut suffire pour une carte simple, mais il peine sur mobile à table. Un menu digital dédié structure la lecture, enrichit les fiches plats et prolonge l'image premium du restaurant."
    },
    visualImage: {
      src: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
      alt: "Dessert presente dans une carte digitale plutot qu'un menu PDF"
    },
    sections: [
      {
        heading: "Ce que le PDF fait bien",
        body: [
          "Le PDF est facile à créer, proche de l'imprimé et rapide à partager. Pour certaines cartes simples, il reste une solution acceptable.",
          "Sa limite apparaît surtout sur téléphone : zoom, défilement, poids du fichier, manque de hiérarchie et difficulté à mettre en valeur les fiches plats."
        ]
      },
      {
        heading: "Ce qu'apporte une carte digitale",
        body: [
          "Une carte digitale structure la lecture mobile. Le client navigue par catégories, ouvre un plat, vérifie les allergènes et découvre les visuels sans chercher dans une page complète.",
          "Vistaire ajoute une couche premium : image de marque, fiches sobres, visuels food-first et immersion sélective quand elle est pertinente."
        ],
        points: [
          "Lisibilité mobile sans zoom",
          "Fiches plats plus riches",
          "Expérience cohérente avec un restaurant haut de gamme"
        ]
      }
    ],
    comparison: {
      heading: "Menu PDF vs menu digital",
      beforeLabel: "PDF",
      afterLabel: "Vistaire",
      rows: [
        {
          label: "Mobile",
          before: "Le client zoome et cherche dans une page fixe.",
          after: "La carte est organisée pour l'écran du téléphone."
        },
        {
          label: "Fiches plats",
          before: "Le détail est limité par la mise en page du fichier.",
          after: "Chaque plat peut recevoir son image, son récit court et ses détails."
        },
        {
          label: "Perception premium",
          before: "Le fichier peut sembler générique même si la salle ne l'est pas.",
          after: "La carte prolonge le niveau de présentation du restaurant."
        }
      ]
    },
    faq: [
      {
        question: "Un menu PDF est-il mauvais pour tous les restaurants ?",
        answer:
          "Non. Il peut convenir à une carte très simple, mais il atteint vite ses limites en lecture mobile premium."
      },
      {
        question: "Comment commencer sans tout refaire ?",
        answer:
          "Le plus sûr est de partir des plats et informations déjà fiables, puis d'enrichir progressivement les fiches qui comptent le plus."
      },
      {
        question: "Un PDF est-il un menu digital ?",
        answer:
          "Non. Un PDF reste un fichier statique à zoomer. Un menu digital structure la carte pour le mobile avec fiches et navigation."
      },
      {
        question: "Quand le PDF reste-t-il acceptable ?",
        answer:
          "Pour une carte courte, peu modifiée, sans ambition de mise en scène des plats signatures à table."
      },
      {
        question: "Le PDF via QR code pose-t-il le même problème ?",
        answer:
          "Oui. Le QR code accélère l'accès, mais si un PDF s'ouvre, le client subit toujours zoom et page fixe."
      },
      {
        question: "Faut-il abandonner le PDF d'un coup ?",
        answer:
          "Non. Beaucoup de restaurants migrent d'abord leurs plats signatures vers des fiches digitales, puis élargissent progressivement."
      }
    ],
    service: {
      name: "Alternative premium au menu PDF",
      serviceType: "Menu digital premium pour remplacer un PDF QR",
      description:
        "Carte digitale lisible sur mobile avec fiches plats, visuels et informations utiles pour restaurants premium."
    },
    primaryCta: {
      href: "/demo",
      label: "Comparer avec la démo"
    },
    secondaryCta: {
      href: "/menu-qr-code-restaurant",
      label: "Voir le menu QR code"
    }
  }
];

export const SEO_PAGES_EN: SeoPageData[] = [
  {
    locale: "en",
    slug: "menu-digital-restaurant",
    path: "/en/digital-restaurant-menu",
    metadataTitle: "Premium digital restaurant menu | Vistaire",
    metadataDescription:
      "Vistaire turns a digital restaurant menu into a premium mobile experience: QR code, dish pages, allergens, visuals and selective 3D/AR.",
    cardDescription:
      "Dish pages, allergens, visuals and selective 3D: what a premium digital menu should offer at the table.",
    relatedDescription:
      "Anatomy of a premium mobile menu: structure, dish pages and useful immersion.",
    eyebrow: "Premium digital menu",
    footerLabel: "Digital restaurant menu",
    linkTitle: "Anatomy of a high-end digital menu",
    h1: "A premium digital menu turns the menu into an experience.",
    answer: [
      "A digital restaurant menu is a menu guests open on their phone, often after scanning a QR code at the table. Vistaire makes it premium: photos, dish pages, allergens, prices, pairings and 3D/AR views when a dish benefits from them, without an app download.",
      "The goal is not to turn the dining room into cold software. Vistaire keeps the menu, the dish and the restaurant image at the center, with a clear mobile reading for the guest and a restaurant preview of anonymous menu signals."
    ],
    takeaway: {
      heading: "Key takeaway",
      text:
        "A premium digital menu structures the menu for mobile, presents dishes with visual pages, and keeps 3D/AR selective for signature dishes that deserve it."
    },
    visualImage: {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "Signature dish shown in a Vistaire digital menu page"
    },
    sections: [
      {
        heading: "What is a digital menu for restaurants?",
        body: [
          "A digital restaurant menu replaces a static file with a menu designed for the phone. Categories, descriptions, allergens and visuals stay readable during service.",
          "For a high-end restaurant, the experience must remain calm and faithful to the dining room. The technology supports guest choice; it does not replace hospitality."
        ],
        points: [
          "Menu opened by table QR code",
          "Visual dish pages with useful details",
          "Fast mobile journey with no app to install"
        ]
      },
      {
        heading: "What Vistaire highlights",
        body: [
          "Vistaire presents signature dishes with a clear hierarchy: name, price, short story, allergens, pairings and visuals. 3D/AR stays selective and reserved for dishes that benefit from being seen in volume.",
          "On the restaurant side, the preview helps understand consultations, searches and immersive interactions without promising measurements the menu does not track."
        ]
      }
    ],
    comparison: {
      heading: "Simple digital menu or premium experience?",
      beforeLabel: "Basic menu",
      afterLabel: "Vistaire",
      rows: [
        {
          label: "Mobile reading",
          before: "A file or long list to scroll through.",
          after: "A menu structured by categories, pages and useful details."
        },
        {
          label: "Brand image",
          before: "A presentation often detached from the atmosphere of the place.",
          after: "A visual universe aligned with the table and signature dishes."
        },
        {
          label: "Immersion",
          before: "Isolated photos or no visual content.",
          after: "Food-first visuals and 3D/AR only when it adds clarity."
        }
      ]
    },
    faq: [
      {
        question: "Does the guest have to install an app?",
        answer:
          "No. A Vistaire menu opens in the mobile browser after the QR code is scanned."
      },
      {
        question: "Does every dish need 3D or AR?",
        answer:
          "No. Vistaire favors selective 3D/AR for signature dishes or creations that benefit from being explored in volume."
      },
      {
        question: "What should a real digital restaurant menu include?",
        answer:
          "Readable categories, dish pages with prices and allergens, food-first visuals, a fast mobile path and immersive content only when it clarifies the dish."
      },
      {
        question: "Does a digital menu replace printed menus?",
        answer:
          "Not necessarily. Many restaurants keep printed menus and use digital as a complementary table menu."
      },
      {
        question: "Is Vistaire suitable for high-end restaurants?",
        answer:
          "Yes, when the goal is a calm, visual presentation faithful to the dining room, not a cold utility interface."
      },
      {
        question: "How does the restaurant update the menu?",
        answer:
          "Through the Vistaire restaurant preview and guided service: dishes, categories, visuals and compatible content can evolve without republishing a PDF."
      }
    ],
    service: {
      name: "Vistaire digital restaurant menu",
      serviceType: "Premium digital menu for restaurants",
      description:
        "Premium mobile menu with dish pages, visuals, allergens and selective immersion for high-end restaurants."
    },
    primaryCta: {
      href: "/en/vistaire-menu",
      label: "Explore the sample menu"
    },
    secondaryCta: {
      href: "/en/restaurant-preview",
      label: "View the restaurant preview"
    }
  },
  {
    locale: "en",
    slug: "menu-qr-code-restaurant",
    path: "/en/qr-code-restaurant-menu",
    metadataTitle: "Premium QR code restaurant menu | Vistaire",
    metadataDescription:
      "A Vistaire QR code menu opens a premium mobile menu: dish pages, visuals, allergens and an experience faithful to the restaurant.",
    cardDescription:
      "After the scan: a structured mobile menu, not a file to pinch and zoom.",
    relatedDescription:
      "From scan to dish page: what the guest really sees after a QR code.",
    eyebrow: "Restaurant QR code",
    footerLabel: "QR code restaurant menu",
    linkTitle: "QR code to mobile menu, no app",
    h1: "The QR code should open an experience, not a file.",
    answer: [
      "A restaurant QR code menu should not be limited to opening a file guests have to zoom. With Vistaire, the QR code becomes the entrance to a mobile, visual and fluid menu: guests browse categories, open dish pages and discover available immersive content.",
      "The value of the QR code depends on what happens after the scan. Vistaire turns that access into a menu experience with careful presentation adapted to service."
    ],
    takeaway: {
      heading: "In short",
      text:
        "The QR code is only the entrance. Quality depends on the mobile menu it opens: clear, visual and faithful to the restaurant."
    },
    visualImage: {
      src: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
      alt: "Dish page opened from a Vistaire restaurant QR code"
    },
    sections: [
      {
        heading: "What does the guest see after the scan?",
        body: [
          "The guest arrives on an organized mobile menu, not a frozen document. Categories, dish pages and important details remain easy to consult at the table.",
          "The QR code keeps its simple role: open quickly. Vistaire then gives the menu a premium mobile reading."
        ],
        points: [
          "Immediate access from the table",
          "Mobile menu adapted to short reading",
          "Dish pages for creations that need more context"
        ]
      },
      {
        heading: "A QR code can still feel high-end",
        body: [
          "A QR code is not incompatible with a premium restaurant if the opened experience is carefully made. Text, visuals and interactions should extend the room rather than cheapen it.",
          "Vistaire avoids cold utility logic: the scan becomes a discreet entrance to an elegant, clear menu centered on dishes."
        ]
      }
    ],
    comparison: {
      heading: "QR code alone or Vistaire QR code?",
      beforeLabel: "QR code alone",
      afterLabel: "Vistaire QR code",
      rows: [
        {
          label: "After the scan",
          before: "The guest often opens an uncomfortable file.",
          after: "The guest arrives on a structured mobile menu."
        },
        {
          label: "Updates",
          before: "The menu stays tied to a document to republish.",
          after: "The experience can evolve around dishes and available content."
        },
        {
          label: "Perception",
          before: "The QR code may feel purely practical.",
          after: "The QR code becomes discreet access to a premium presentation."
        }
      ]
    },
    faq: [
      {
        question: "Is a QR code enough to modernize a menu?",
        answer:
          "No. The QR code is only the entry point; quality depends on the mobile menu that opens afterward."
      },
      {
        question: "Does the guest have to download anything?",
        answer:
          "No. Vistaire is designed to open directly in the mobile browser."
      },
      {
        question: "Do we need one QR per table?",
        answer:
          "One QR per table or zone can work depending on service. The important part is that the scan opens the same carefully made menu."
      },
      {
        question: "Does the guest need restaurant Wi-Fi?",
        answer:
          "No. The menu opens through the guest's mobile connection like any web page."
      },
      {
        question: "Can a QR code stay elegant in a premium restaurant?",
        answer:
          "Yes, if the opened experience extends the dining room: careful copy, food-first visuals and a fluid mobile path."
      },
      {
        question: "What if a guest does not have a smartphone?",
        answer:
          "The restaurant can keep printed menus or offer a tablet. Vistaire does not replace human hospitality."
      }
    ],
    service: {
      name: "Vistaire QR code menu",
      serviceType: "Premium QR code menu for restaurants",
      description:
        "Premium mobile menu opened by QR code and designed for table reading and signature dishes."
    },
    primaryCta: {
      href: "/en/vistaire-menu",
      label: "Try the sample QR menu"
    },
    secondaryCta: {
      href: "/en/pdf-vs-digital-menu",
      label: "Compare with a PDF"
    }
  },
  {
    locale: "en",
    slug: "menu-3d-ar-restaurant",
    path: "/en/3d-ar-restaurant-menu",
    metadataTitle: "3D/AR restaurant menu | Vistaire",
    metadataDescription:
      "Vistaire adds selective 3D/AR to premium restaurant menus when a compatible dish benefits from being seen in volume.",
    cardDescription:
      "When to activate 3D/AR, when to skip it, and how to stay premium without gimmicks.",
    relatedDescription:
      "Selective immersion: compatible dishes, clear fallback, no systematic 3D.",
    eyebrow: "Restaurant 3D/AR",
    footerLabel: "3D / AR restaurant menu",
    linkTitle: "Useful 3D vs gimmick: when to activate it",
    h1: "3D impresses only when it makes the dish more desirable.",
    answer: [
      "3D/AR in a restaurant menu helps guests understand a dish before choosing, especially signatures, desserts and visual cocktails. Vistaire integrates it as a presentation layer: compatible dishes can be explored in 3D, and AR opens on compatible mobile devices after guest intent.",
      "This immersion must stay selective. A Vistaire dish page remains clear with or without AR, so the main menu experience never depends on a specific device or asset."
    ],
    takeaway: {
      heading: "Key takeaway",
      text:
        "3D/AR helps when volume or presentation matters. Vistaire reserves it for compatible dishes, with a clear visual page if AR is unavailable."
    },
    visualImage: {
      src: "/images/demo/dishes/maison-elyse-n1.png",
      alt: "Signature dish presented with an immersive Vistaire experience"
    },
    sections: [
      {
        heading: "When is 3D or AR relevant?",
        body: [
          "3D/AR is useful when volume, texture or presentation tells something a line of text cannot transmit alone.",
          "Vistaire reserves it for compatible dishes and always keeps a readable visual page for guests who do not open it."
        ],
        points: [
          "Signature dishes with strong presentation",
          "Desserts, cocktails or visual creations",
          "Immersive opening only after guest intent"
        ]
      },
      {
        heading: "Immersion without weighing down the menu",
        body: [
          "The menu must remain quick to browse. 3D/AR content is treated as a presentation layer, not a condition for accessing the dish.",
          "This protects the rhythm of service and keeps a premium experience even when a device does not support AR."
        ]
      }
    ],
    comparison: {
      heading: "Systematic or selective 3D/AR?",
      beforeLabel: "Systematic",
      afterLabel: "Selective",
      rows: [
        {
          label: "Performance",
          before: "Can weigh down the menu without clear benefit.",
          after: "Immersive content is reserved for dishes that deserve it."
        },
        {
          label: "Understanding",
          before: "The visual effect can overtake the dish.",
          after: "3D supports the guest decision when it adds context."
        },
        {
          label: "Compatibility",
          before: "The experience can depend heavily on device support.",
          after: "The dish page remains useful with a clear visual fallback."
        }
      ]
    },
    faq: [
      {
        question: "Does AR work on every phone?",
        answer:
          "No. Vistaire keeps a complete dish page and opens AR only when available and requested by the guest."
      },
      {
        question: "Do we need to model the entire menu?",
        answer:
          "No. A selection of signature dishes is often enough to create a coherent immersive moment."
      },
      {
        question: "Does 3D slow the menu down?",
        answer:
          "3D/AR content loads only after guest intent on a dish page, not during the initial menu browsing."
      },
      {
        question: "Does AR replace the dish photo?",
        answer:
          "No. The page always keeps photo, text, price and allergens. 3D/AR complements the presentation when it adds context."
      },
      {
        question: "Which dishes deserve 3D first?",
        answer:
          "Highly presented signatures, visual desserts, crafted cocktails or creations whose volume explains more than text."
      },
      {
        question: "What does the guest see if AR is unavailable?",
        answer:
          "The dish page remains complete with premium visuals. AR is a bonus, never a condition for understanding the dish."
      }
    ],
    service: {
      name: "Vistaire 3D/AR menu",
      serviceType: "Selective 3D/AR presentation for restaurant menus",
      description:
        "Immersive layer for compatible dishes, with a clear dish page and premium fallback."
    },
    primaryCta: {
      href: "/en/vistaire-menu",
      label: "View a dish page"
    },
    secondaryCta: {
      href: "/en/digital-restaurant-menu",
      label: "Back to digital menu"
    }
  },
  {
    locale: "en",
    slug: "menu-pdf-vs-menu-digital",
    path: "/en/pdf-vs-digital-menu",
    metadataTitle: "PDF menu vs digital restaurant menu | Vistaire",
    metadataDescription:
      "Compare PDF menus and digital menus for premium restaurants: mobile readability, dish pages, allergens and table experience.",
    cardDescription:
      "Zooming, fixed pages, generic image: why PDF menus quickly reach their limits on premium mobile.",
    relatedDescription:
      "PDF can be acceptable sometimes, but insufficient at the table: the concrete difference with a digital menu.",
    eyebrow: "PDF or digital",
    footerLabel: "PDF vs digital menu",
    linkTitle: "A PDF is not a digital menu",
    h1: "A PDF is not a digital menu.",
    answer: [
      "A PDF is simple to produce and practical for print, but it is often less comfortable to read on mobile at the table. A digital menu like Vistaire structures the menu, presents dishes, makes allergens easier to read and can add visual pages or 3D/AR.",
      "The right choice depends on the level of experience expected. For a short menu that rarely changes, a PDF may be enough. For a restaurant that wants to elevate dishes and guide guests elegantly, a dedicated digital menu becomes more coherent."
    ],
    takeaway: {
      heading: "Direct answer",
      text:
        "A PDF can work for a simple menu, but it struggles on mobile at the table. A dedicated digital menu structures reading, enriches dish pages and extends the restaurant's premium image."
    },
    visualImage: {
      src: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
      alt: "Dessert presented in a digital menu instead of a PDF menu"
    },
    sections: [
      {
        heading: "What a PDF does well",
        body: [
          "The PDF is easy to create, close to print and quick to share. For some simple menus, it remains an acceptable solution.",
          "Its limits appear especially on phones: zooming, scrolling, file weight, lack of hierarchy and difficulty presenting dish pages."
        ]
      },
      {
        heading: "What a digital menu adds",
        body: [
          "A digital menu structures mobile reading. Guests navigate by categories, open a dish, check allergens and discover visuals without searching through a full page.",
          "Vistaire adds a premium layer: brand image, calm pages, food-first visuals and selective immersion when relevant."
        ],
        points: [
          "Mobile readability without zoom",
          "Richer dish pages",
          "Experience coherent with a high-end restaurant"
        ]
      }
    ],
    comparison: {
      heading: "PDF menu vs digital menu",
      beforeLabel: "PDF",
      afterLabel: "Vistaire",
      rows: [
        {
          label: "Mobile",
          before: "The guest zooms and searches in a fixed page.",
          after: "The menu is organized for the phone screen."
        },
        {
          label: "Dish pages",
          before: "Detail is limited by the file layout.",
          after: "Each dish can receive its image, short story and useful details."
        },
        {
          label: "Premium perception",
          before: "The file can feel generic even if the dining room is not.",
          after: "The menu extends the restaurant's presentation level."
        }
      ]
    },
    faq: [
      {
        question: "Is a PDF menu bad for every restaurant?",
        answer:
          "No. It can suit a very simple menu, but it quickly reaches its limits in premium mobile reading."
      },
      {
        question: "How can we start without rebuilding everything?",
        answer:
          "The safest approach is to start from reliable dish information, then progressively enrich the pages that matter most."
      },
      {
        question: "Is a PDF a digital menu?",
        answer:
          "No. A PDF remains a static file to zoom. A digital menu structures the menu for mobile with pages and navigation."
      },
      {
        question: "When is a PDF still acceptable?",
        answer:
          "For a short, rarely changed menu without a strong goal to present signature dishes at the table."
      },
      {
        question: "Does a PDF behind a QR code have the same issue?",
        answer:
          "Yes. The QR code speeds access, but if a PDF opens, the guest still deals with zoom and a fixed page."
      },
      {
        question: "Do we have to abandon the PDF at once?",
        answer:
          "No. Many restaurants first move signature dishes into digital pages, then expand gradually."
      }
    ],
    service: {
      name: "Premium alternative to a PDF menu",
      serviceType: "Premium digital menu to replace a QR PDF",
      description:
        "Mobile-readable digital menu with dish pages, visuals and useful information for premium restaurants."
    },
    primaryCta: {
      href: "/en/vistaire-menu",
      label: "Compare with the sample menu"
    },
    secondaryCta: {
      href: "/en/qr-code-restaurant-menu",
      label: "View the QR code menu"
    }
  }
];

export function getSeoPage(
  slug: SeoPageSlug,
  locale: Locale = "fr"
): SeoPageData {
  const pages = locale === "en" ? SEO_PAGES_EN : SEO_PAGES;
  const page = pages.find((candidate) => candidate.slug === slug);

  if (!page) {
    throw new Error(`Unknown SEO page: ${slug}`);
  }

  return page;
}

export function getRelatedSeoPages(
  currentSlug: SeoPageSlug,
  locale: Locale = "fr"
): SeoPageData[] {
  const pages = locale === "en" ? SEO_PAGES_EN : SEO_PAGES;

  return pages.filter((page) => page.slug !== currentSlug);
}
