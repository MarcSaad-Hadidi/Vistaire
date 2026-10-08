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
      "Vistaire crée votre menu digital restaurant premium : carte mobile personnalisée, photos sur place, supports QR physiques et mise en place accompagnée.",
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
      "Vistaire est un service accompagné. Nous préparons la carte mobile personnalisée, les photos des plats sur place et les supports QR physiques avec vous. Votre restaurant valide les maquettes avant la production et la mise en ligne; l’hébergement et la maintenance font partie de l’offre."
    ],
    takeaway: {
      heading: "À retenir",
      text:
        "Un menu digital premium structure la carte pour le mobile, met les plats en scène avec fiches et visuels, et garde la 3D/AR sélective pour les signatures qui le méritent."
    },
    visualImage: {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "Plat signature illustré dans une fiche de menu digital Vistaire"
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
          "L’option Vistaire Pilotage permet de gérer les disponibilités des plats depuis le dashboard et de consulter l’activité du menu : ouvertures, plats consultés et interactions 3D/AR. Elle est proposée en complément du service, à 100 $ CAD supplémentaires par mois."
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
          after: "Photos des plats et 3D/AR sur une sélection de créations adaptées."
        }
      ]
    },
    faq: [
      {
        question: "Comment le menu digital s'intègre-t-il au service à table ?",
        answer:
          "Le client scanne le QR code du restaurant, consulte les catégories et ouvre les fiches plats depuis la table. L'équipe en salle reste disponible pour conseiller et accompagner le choix."
      },
      {
        question: "Le client doit-il télécharger une application ?",
        answer:
          "Non. Le menu Vistaire s'ouvre dans le navigateur mobile après le scan du QR code."
      },
      {
        question: "Le QR code suffit-il à créer une expérience premium ?",
        answer:
          "Non. Le QR code est le point d'accès. L'expérience vient ensuite de la lisibilité mobile, de la hiérarchie de la carte et de la qualité des fiches plats."
      },
      {
        question: "Comment le restaurant met-il la carte à jour ?",
        answer:
          "La mise à jour des plats, des prix, des descriptions et de la composition se prépare avec Vistaire à partir des informations validées par votre restaurant. L’option Pilotage permet aussi de gérer les disponibilités depuis le dashboard."
      },
      {
        question: "Chaque plat peut-il présenter une photo ?",
        answer:
          "Oui. Vistaire réalise la prise de photos des plats sur place lors de la mise en place. Les photos existantes peuvent aussi compléter la carte après validation avec vous. Un plat sans photo conserve son nom, sa description, son prix et ses informations."
      },
      {
        question: "Où les allergènes apparaissent-ils ?",
        answer:
          "Les allergènes déclarés par le restaurant peuvent apparaître sur la fiche du plat. Pour un besoin alimentaire sensible, le client doit aussi confirmer l'information avec l'équipe en salle."
      },
      {
        question: "Tous les plats ont-ils besoin de 3D ou d'AR ?",
        answer:
          "Non. Vistaire réserve l'immersion aux plats signatures ou aux créations pour lesquelles le volume apporte une information utile."
      },
      {
        question: "Le menu reste-t-il utile sans contenu immersif ?",
        answer:
          "Oui. La navigation, les catégories et les fiches plats fonctionnent avec les contenus disponibles, indépendamment de la présence d'une vue 3D ou AR."
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
      href: "/apercu-restaurateur",
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
      "Un générateur QR gratuit crée un lien à scanner. Le service Vistaire comprend la préparation de la carte personnalisée, les photos des plats sur place, les supports physiques et la mise en ligne accompagnée. Votre restaurant valide les maquettes avant la production finale."
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
          "Les collections Acrylique, Sculpté, Carré et Signature proposent différentes présentations du QR code sur la table. L’offre inclut jusqu’à vingt supports personnalisés dans la collection choisie."
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
          "Un support par table ou par zone peut convenir selon votre service. Vistaire inclut jusqu’à vingt supports QR personnalisés; les supports supplémentaires font l’objet d’une estimation selon la collection et le besoin."
      },
      {
        question: "Le client doit-il être connecté au Wi-Fi du restaurant ?",
        answer:
          "Non. Le menu s'ouvre via la connexion mobile du client, comme n'importe quelle page web."
      },
      {
        question: "Un QR code peut-il rester élégant en restaurant premium ?",
        answer:
          "Oui. Les supports personnalisés, les photos des plats et la carte mobile sont préparés pour refléter votre restaurant et accompagner le service."
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
      "Plats 3D sélectionnés avec vous, limites de l’AR et photos toujours consultables sur la fiche.",
    eyebrow: "3D/AR restaurant",
    footerLabel: "Menu 3D / AR restaurant",
    linkTitle: "3D utile vs gadget : quand l'activer",
    h1: "La 3D n'impressionne que si elle rend le plat plus désirable.",
    answer: [
      "La 3D/AR dans un menu de restaurant aide le client à mieux comprendre un plat avant de choisir, surtout pour les signatures, desserts et cocktails visuels. Vistaire l'intègre comme option de présentation : les plats compatibles peuvent être explorés en 3D, et l'AR s'ouvre sur mobile compatible après action du client.",
      "L’offre Vistaire peut inclure jusqu’à cinq plats en 3D, sélectionnés avec vous. La réalité augmentée dépend du plat, de l’appareil et du navigateur. Les photos, les prix et les descriptions restent consultables lorsque cette vue n’est pas disponible."
    ],
    takeaway: {
      heading: "À retenir",
      text:
        "La 3D/AR aide quand le volume ou la présentation du plat compte. Vistaire la réserve aux plats compatibles, avec une fiche visuelle claire si l'AR n'est pas disponible."
    },
    visualImage: {
      src: "/images/demo/dishes/maison-elyse-n1.png",
      alt: "Plat signature présenté dans une démonstration immersive Vistaire"
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
          "Vue immersive proposée sur les fiches des plats sélectionnés"
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
          after: "Les photos et les informations du plat restent consultables sans AR."
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
          "Non. L’offre comprend jusqu’à cinq plats en 3D, sélectionnés avec vous. Les nouvelles productions au-delà du volume inclus sont facturées séparément selon les packs ou le tarif à l’unité présentés sur la page Tarifs."
      },
      {
        question: "La 3D ralentit-elle le chargement du menu ?",
        answer:
          "La carte permet d’abord de parcourir les catégories et les plats. Le client peut ensuite découvrir les vues 3D/AR proposées pour les plats sélectionnés; les autres fiches restent accessibles avec leurs informations et leurs photos."
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
        "Présentation de plats sélectionnés en 3D et en réalité augmentée selon compatibilité, avec photos et informations du menu accessibles sans AR."
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
      alt: "Dessert présenté dans un exemple de carte digitale Vistaire"
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
          "Vistaire prépare cette carte avec vous, réalise les photos sur place et personnalise les supports QR. Vous validez les maquettes avant leur production finale. La 3D/AR complète la présentation d’une sélection de plats lorsque disponible."
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
        question: "Quelle différence entre un PDF et un menu digital ?",
        answer:
          "Un PDF est un document à mise en page fixe. Un menu digital organise la carte pour l'écran du téléphone avec des catégories, des fiches plats et une navigation dédiée."
      },
      {
        question: "Pourquoi la lecture d'un PDF peut-elle gêner sur mobile ?",
        answer:
          "La page conserve ses dimensions de document. Selon sa mise en page, le client peut devoir zoomer, se déplacer dans la page ou chercher une information dans un texte réduit."
      },
      {
        question: "Un QR code transforme-t-il un PDF en menu digital ?",
        answer:
          "Non. Le QR code facilite l'accès au fichier, mais la destination reste un document fixe si le lien ouvre un PDF."
      },
      {
        question: "Que se passe-t-il quand la carte change ?",
        answer:
          "Le PDF doit être exporté et remplacé pour intégrer les changements. Les mises à jour de la carte se préparent avec Vistaire à partir de vos informations validées, sans refaire la mise en page d’un document."
      },
      {
        question: "Quand un PDF reste-t-il adapté ?",
        answer:
          "Il peut rester adapté à une carte courte, stable et conçue avec une mise en page suffisamment lisible sur téléphone."
      },
      {
        question: "Peut-on faire la transition progressivement ?",
        answer:
          "Oui. Le restaurant peut commencer avec ses informations fiables et ses plats signatures, puis enrichir progressivement les autres fiches."
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
      "Vistaire creates premium restaurant digital menus with custom mobile design, on-site dish photography, physical QR displays and guided setup.",
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
      "Vistaire is a guided service. We prepare the custom mobile menu, photograph dishes on site and personalize the physical QR displays with you. Your restaurant approves the layouts before production and launch. Hosting and maintenance are included."
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
          "The optional Vistaire Pilotage service lets you manage dish availability from the dashboard and view menu activity, including openings, dish views and 3D/AR interactions. It is available for an additional $100 CAD per month."
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
          after: "Photographs of your food and 3D/AR for selected suitable dishes."
        }
      ]
    },
    faq: [
      {
        question: "How does a digital menu fit table service?",
        answer:
          "The guest scans the restaurant's QR code, browses categories and opens dish pages from the table. The dining-room team remains available to guide the choice."
      },
      {
        question: "Does the guest need to download an app?",
        answer:
          "No. A Vistaire menu opens in the mobile browser after the QR code is scanned."
      },
      {
        question: "Is a QR code enough to create a premium experience?",
        answer:
          "No. The QR code is the access point. The experience comes from mobile readability, menu hierarchy and the quality of the dish pages."
      },
      {
        question: "How does the restaurant update the menu?",
        answer:
          "Changes to dishes, prices, descriptions and recipes are prepared with Vistaire using information your restaurant validates. The optional Pilotage service also lets you manage dish availability from the dashboard."
      },
      {
        question: "Can each dish include a photo?",
        answer:
          "Yes. Vistaire photographs dishes on site during setup. Existing photos can also complement the menu after review with you. Dishes without a photo keep their name, description, price and available information."
      },
      {
        question: "Where does allergen information appear?",
        answer:
          "Allergens declared by the restaurant can appear on the dish page. For a sensitive dietary need, the guest should also confirm the information with the dining-room team."
      },
      {
        question: "Does every dish need 3D or AR?",
        answer:
          "No. Vistaire keeps immersion selective for signature dishes or creations where volume adds useful information."
      },
      {
        question: "Does the menu remain useful without immersive content?",
        answer:
          "Yes. Navigation, categories and dish pages work with the available content, whether or not a 3D or AR view is present."
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
      "A free QR generator creates a scannable link. Vistaire’s guided service includes a custom menu, on-site dish photography, personalized physical displays and launch. Your team approves the layouts before final production."
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
          "The Acrylique, Sculpté, Carré and Signature collections offer different QR display styles for the table. The offer includes up to twenty personalized displays from your chosen collection."
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
          "One display per table or zone can work depending on your service. Vistaire includes up to twenty personalized QR displays; additional displays are quoted according to the collection and your needs."
      },
      {
        question: "Does the guest need restaurant Wi-Fi?",
        answer:
          "No. The menu opens through the guest's mobile connection like any web page."
      },
      {
        question: "Can a QR code stay elegant in a premium restaurant?",
        answer:
          "Yes. Personalized displays, dish photography and the mobile menu are prepared to reflect your restaurant and fit the service."
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
      "Selected 3D dishes, the limits of AR and photos that remain accessible on the dish page.",
    eyebrow: "Restaurant 3D/AR",
    footerLabel: "3D / AR restaurant menu",
    linkTitle: "Useful 3D vs gimmick: when to activate it",
    h1: "3D impresses only when it makes the dish more desirable.",
    answer: [
      "3D and augmented reality help guests picture selected dishes before choosing. Compatible dishes can be explored in 3D, while an AR view can be opened on supported mobile devices. This can be useful for signature plates, desserts and other creations where the presentation matters.",
      "The Vistaire offer can include up to five 3D dishes selected with you. AR availability depends on the dish, device and browser. Photos, prices and descriptions remain accessible when that view is unavailable."
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
          "Immersive views offered on selected dish pages"
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
          after: "Photos and dish information remain available without AR."
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
          "No. The offer includes up to five 3D dishes selected with you. New productions beyond the included volume are charged separately using the packs or individual pricing listed on the pricing page."
      },
      {
        question: "Does 3D slow the menu down?",
        answer:
          "Guests can browse categories and dishes first, then explore the 3D/AR views offered for selected dishes. Other dish pages remain available with their information and photographs."
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
        "3D and augmented reality presentation for selected compatible dishes, with photos and menu information accessible without AR."
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
          "Vistaire prepares the menu with you, photographs dishes on site and personalizes physical QR displays. You approve the layouts before final production. Selected dishes can also be explored in 3D/AR where available."
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
        question: "What is the difference between a PDF and a digital menu?",
        answer:
          "A PDF is a fixed-layout document. A digital menu organizes the menu for a phone screen with categories, dish pages and dedicated navigation."
      },
      {
        question: "Why can a PDF be difficult to read on mobile?",
        answer:
          "The page keeps its document dimensions. Depending on the layout, the guest may need to zoom, move around the page or search through reduced text."
      },
      {
        question: "Does a QR code turn a PDF into a digital menu?",
        answer:
          "No. The QR code makes the file easier to reach, but the destination remains a fixed document when the link opens a PDF."
      },
      {
        question: "What happens when the menu changes?",
        answer:
          "A PDF must be exported and replaced to include changes. Vistaire prepares menu updates with your validated information, without recreating the layout of a document."
      },
      {
        question: "When is a PDF still suitable?",
        answer:
          "It can remain suitable for a short, stable menu designed with a layout that is readable enough on a phone."
      },
      {
        question: "Can the transition happen gradually?",
        answer:
          "Yes. The restaurant can begin with reliable information and signature dishes, then progressively enrich the remaining pages."
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
