import { withEditorialQueryEvidence } from "./seoGeoEvidence.ts";
import type { SeoGeoInternalLink, SeoGeoPageDraft } from "./seoGeoTypes.ts";

const coreLinks = {
  digital: { href: "/menu-digital-restaurant", label: "Menu digital restaurant" },
  qr: { href: "/menu-qr-code-restaurant", label: "Menu QR code restaurant" },
  pdf: { href: "/menu-pdf-vs-menu-digital", label: "PDF vs menu digital" },
  pricing: {
    href: "/tarifs-menu-digital-restaurant",
    label: "Tarifs Vistaire"
  },
  sampleMenu: { href: "/demo", label: "Voir le menu exemple" },
  meeting: { href: "/prendre-rendez-vous", label: "Parler de votre menu" }
} as const;

const defaultIncluded = [
  {
    title: "Supports QR personnalisés",
    text: "Jusqu’à 20 supports QR physiques de la collection choisie, pour ouvrir votre carte depuis la table."
  },
  {
    title: "Carte mobile personnalisée",
    text: "Une carte adaptée à votre identité, consultable en français et en anglais dans le navigateur, sans application à installer."
  },
  {
    title: "Fiches plats",
    text: "Le prix, la description, les photos et les allergènes déclarés par votre restaurant réunis autour de chaque plat."
  },
  {
    title: "Photos réalisées sur place",
    text: "Vistaire photographie les plats dans votre restaurant lors de la mise en place, pour présenter votre propre cuisine."
  },
  {
    title: "Jusqu’à 5 plats en 3D",
    text: "Des plats sélectionnés avec vous, à découvrir en 3D et en réalité augmentée lorsque le plat et l’appareil le permettent."
  },
  {
    title: "Accompagnement et service",
    text: "La préparation et la mise en ligne sont accompagnées par Vistaire. L’hébergement et la maintenance font partie de l’offre."
  }
] as const;

function links(...links: SeoGeoInternalLink[]): SeoGeoInternalLink[] {
  return links;
}

const SEO_GEO_PAGE_DRAFTS: SeoGeoPageDraft[] = [
  {
    slug: "menu-qr-sans-pdf",
    path: "/menu-qr-sans-pdf",
    type: "aeo",
    cluster: "QR code sans PDF",
    commercialIntent: "very-high",
    priority: "P0",
    sitemapPriority: 0.81,
    queries: [
      "menu QR code sans PDF",
      "QR code menu digital restaurant",
      "menu sans contact QR code restaurant"
    ],
    metadataTitle: "Menu QR sans PDF pour restaurant | Vistaire",
    metadataDescription:
      "Créez un menu QR sans PDF pour restaurant : carte mobile premium, fiches plats, prix, allergènes, photos et 3D/AR sélective.",
    h1: "Un menu QR sans PDF, pensé pour la table.",
    eyebrow: "QR sans PDF",
    directAnswer:
      "Un menu QR sans PDF ouvre une vraie carte mobile au lieu d'un fichier à zoomer. Vistaire relie le QR code à une expérience premium : catégories lisibles, fiches plats, prix, allergènes, photos et 3D/AR sélective quand elle apporte une valeur réelle.",
    context: {
      heading: "Pourquoi éviter le PDF derrière le QR code ?",
      body: [
        "Le QR code règle l'accès, mais pas la qualité de lecture. Si le client arrive sur un PDF, il doit souvent pincer, zoomer et retrouver la bonne section pendant le service.",
        "Une carte mobile dédiée permet de présenter la cuisine dans un rythme plus naturel : choix par catégorie, fiches courtes, visuels utiles et informations clés au même endroit."
      ],
      points: [
        "moins de zoom et de friction sur téléphone",
        "une carte qui reste lisible en lumière de salle",
        "des plats signatures mieux mis en scène qu'une page fixe"
      ]
    },
    productProof: {
      heading: "Ce que le client voit après le scan",
      body:
        "Le scan mène vers un menu Vistaire, pas vers un document. Le client peut parcourir les catégories, ouvrir une fiche plat, lire les allergènes, comparer les prix et découvrir les contenus immersifs disponibles sans quitter le navigateur.",
      points: ["supports QR personnalisés", "carte mobile", "fiches plats", "photos des plats"]
    },
    comparison: {
      heading: "Menu QR PDF ou menu QR Vistaire ?",
      basicLabel: "QR vers PDF",
      vistaireLabel: "QR vers Vistaire",
      rows: [
        {
          label: "Lecture",
          basic: "Une page fixe à zoomer, souvent dense.",
          vistaire: "Une carte structurée pour l'écran du téléphone."
        },
        {
          label: "Image",
          basic: "Le fichier peut paraître pratique mais peu premium.",
          vistaire: "L'expérience prolonge l'ambiance et les plats du restaurant."
        },
        {
          label: "Évolution",
          basic: "Chaque changement demande un nouveau fichier à republier.",
          vistaire: "La carte peut évoluer autour des plats, photos et détails utiles."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
      alt: "Fiche plat Vistaire ouverte depuis un QR code sans PDF"
    },
    faq: [
      {
        question: "Peut-on faire un menu QR code sans PDF ?",
        answer:
          "Oui. Le QR code peut ouvrir une page de menu mobile dédiée, avec catégories, fiches plats, prix et allergènes."
      },
      {
        question: "Est-ce mieux qu'un QR code vers un PDF ?",
        answer:
          "Pour une expérience à table, oui : la lecture mobile est plus claire et la présentation peut rester premium."
      },
      {
        question: "Le client doit-il installer une application ?",
        answer:
          "Non. Vistaire s'ouvre dans le navigateur mobile après scan du QR code."
      },
      {
        question: "Peut-on garder le PDF en secours ?",
        answer:
          "Oui. Un PDF peut rester une archive interne ou un support imprimé, sans être l'expérience principale scannée par le client."
      },
      {
        question: "La 3D est-elle chargée dès l'ouverture ?",
        answer:
          "Non. Les contenus 3D/AR restent sélectifs et s'ouvrent seulement après action du client."
      }
    ],
    service: {
      name: "Menu QR sans PDF Vistaire",
      serviceType: "Menu QR code mobile premium sans PDF pour restaurants",
      description:
        "Création d'une carte mobile premium accessible par QR code, sans imposer un PDF à zoomer."
    },
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(coreLinks.qr, coreLinks.digital, coreLinks.pdf, coreLinks.pricing)
  },
  {
    slug: "menu-digital-sans-application",
    path: "/menu-digital-sans-application",
    type: "aeo",
    cluster: "Menu digital sans application",
    commercialIntent: "high",
    priority: "P0",
    sitemapPriority: 0.79,
    queries: [
      "menu digital sans application",
      "menu restaurant sur téléphone",
      "menu mobile restaurant"
    ],
    metadataTitle: "Menu digital sans application | Vistaire",
    metadataDescription:
      "Un menu digital sans application pour restaurant : QR code, navigateur mobile, fiches plats, allergènes, photos et expérience premium.",
    h1: "Un menu digital sans application à installer.",
    eyebrow: "Sans application",
    directAnswer:
      "Un menu digital sans application s'ouvre directement dans le navigateur du client après scan du QR code. Vistaire privilégie cette approche pour réduire la friction à table : pas de compte, pas de téléchargement, seulement une carte mobile claire, visuelle et adaptée au restaurant.",
    context: {
      heading: "Pourquoi le sans-application compte en salle",
      body: [
        "Au restaurant, le client veut choisir vite et confortablement. Lui demander d'installer une application crée une étape inutile, surtout pour une consultation ponctuelle à table.",
        "Vistaire garde la logique web : le QR code ouvre une expérience mobile, tandis que le restaurant conserve une présentation plus riche qu'une simple page de texte."
      ],
      points: [
        "scan QR puis ouverture navigateur",
        "pas de compte client obligatoire",
        "navigation courte pour choisir pendant le service"
      ]
    },
    productProof: {
      heading: "Une expérience web qui reste premium",
      body:
        "Le client accède à la carte, aux catégories, aux fiches plats, aux prix et aux allergènes sans passer par un app store. Les contenus visuels et 3D/AR restent intégrés au parcours lorsque le plat et l'appareil le permettent.",
      points: ["sans téléchargement", "lecture sur téléphone", "fiches visuelles", "accès par QR code"]
    },
    comparison: {
      heading: "Application dédiée ou carte web Vistaire ?",
      basicLabel: "Application",
      vistaireLabel: "Vistaire web",
      rows: [
        {
          label: "Accès",
          basic: "Téléchargement, permission ou compte possible.",
          vistaire: "Ouverture directe dans le navigateur après scan."
        },
        {
          label: "Usage",
          basic: "Adaptée aux usages récurrents, moins à une table ponctuelle.",
          vistaire: "Pensée pour la décision courte pendant le repas."
        },
        {
          label: "Perception",
          basic: "Peut paraître lourde pour simplement lire une carte.",
          vistaire: "Reste discrète et centrée sur les plats."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "Menu digital Vistaire consulté sans application à installer"
    },
    faq: [
      {
        question: "Un menu digital peut-il fonctionner sans application ?",
        answer:
          "Oui. Vistaire fonctionne comme une page web mobile ouverte après scan du QR code."
      },
      {
        question: "Le client doit-il créer un compte ?",
        answer:
          "Non. L'objectif est de consulter la carte rapidement à table."
      },
      {
        question: "Est-ce moins premium qu'une application ?",
        answer:
          "Non. La qualité vient de la carte, des visuels et des fiches plats, pas du fait d'imposer un téléchargement."
      },
      {
        question: "Le menu marche-t-il sur iPhone et Android ?",
        answer:
          "La carte web est conçue pour les navigateurs mobiles modernes. Les options AR dépendent ensuite de l'appareil."
      },
      {
        question: "Peut-on partager le menu en dehors du restaurant ?",
        answer:
          "Oui. Le lien public peut être partagé, tout en restant pensé d'abord pour la consultation à table."
      }
    ],
    service: {
      name: "Menu digital sans application Vistaire",
      serviceType: "Carte mobile web pour restaurants",
      description:
        "Menu digital accessible par QR code dans le navigateur, sans installation d'application."
    },
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(coreLinks.digital, coreLinks.qr, coreLinks.pricing)
  },
  {
    slug: "remplacer-menu-pdf-restaurant",
    path: "/remplacer-menu-pdf-restaurant",
    type: "aeo",
    cluster: "Remplacer menu PDF",
    commercialIntent: "very-high",
    priority: "P0",
    sitemapPriority: 0.83,
    queries: [
      "remplacer menu PDF restaurant",
      "arrêter menu PDF restaurant",
      "transformer menu PDF en menu digital"
    ],
    metadataTitle: "Remplacer un menu PDF restaurant | Vistaire",
    metadataDescription:
      "Remplacez un menu PDF de restaurant par une carte digitale premium : QR code, fiches plats, prix, allergènes, photos et 3D sélective.",
    h1: "Remplacer un menu PDF par une vraie carte digitale.",
    eyebrow: "PDF vers Vistaire",
    directAnswer:
      "Pour remplacer un menu PDF de restaurant, Vistaire reprend votre carte et prépare une expérience pensée pour le téléphone : catégories, prix lisibles, fiches plats, allergènes et photos. Notre équipe vous accompagne de la préparation des contenus à la mise en ligne, avec des supports QR physiques personnalisés.",
    context: {
      heading: "Le problème n'est pas seulement le fichier",
      body: [
        "Un PDF reproduit souvent la carte imprimée. Sur téléphone, cette mise en page devient fragile : zoom, colonnes petites, allergènes dispersés et visuels limités.",
        "Le passage à Vistaire consiste à reconstruire l'expérience autour de la décision du client à table, pas à copier-coller le document dans une page web."
      ],
      points: [
        "reprendre les informations fiables du menu existant",
        "prioriser les catégories et plats signatures",
        "photographier les plats et valider leur présentation avec vous"
      ]
    },
    productProof: {
      heading: "Une migration progressive",
      body:
        "Vistaire peut démarrer à partir du menu existant, puis enrichir les plats importants avec photos, descriptions courtes, allergènes et contenus 3D/AR sélectionnés. La carte garde une structure claire même si tous les visuels ne sont pas prêts au lancement.",
      points: ["audit du PDF", "structure mobile", "fiches enrichies", "mise en ligne"]
    },
    comparison: {
      heading: "PDF remplacé ou PDF simplement hébergé ?",
      basicLabel: "PDF hébergé",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Structure",
          basic: "La même page fixe apparaît sur mobile.",
          vistaire: "La carte est reconstruite en catégories et fiches."
        },
        {
          label: "Détails",
          basic: "Les allergènes et descriptions restent noyés dans le fichier.",
          vistaire: "Chaque fiche peut afficher les informations utiles au bon endroit."
        },
        {
          label: "Évolution",
          basic: "Le PDF complet doit être remplacé à chaque version.",
          vistaire: "Les informations peuvent évoluer de façon plus ciblée."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
      alt: "Dessert présenté dans une carte digitale qui remplace un PDF restaurant"
    },
    faq: [
      {
        question: "Comment remplacer un menu PDF par un menu digital ?",
        answer:
          "Il faut reprendre le contenu fiable du PDF, le structurer pour mobile, créer les fiches plats et publier un lien QR clair."
      },
      {
        question: "Faut-il refaire toutes les photos ?",
        answer:
          "La mise en place comprend une prise de photos des plats sur place par Vistaire. Si vous disposez déjà de photos, nous examinons avec vous celles qui peuvent compléter la carte."
      },
      {
        question: "Peut-on garder le PDF existant ?",
        answer:
          "Oui, comme archive ou support imprimé. La carte mobile devient l'expérience principale."
      },
      {
        question: "Combien de temps prend la transformation ?",
        answer:
          "Le délai dépend du nombre de plats, de la qualité des contenus et des validations visuelles ou 3D."
      },
      {
        question: "Comment se déroule la mise en place ?",
        answer:
          "Vistaire prépare les contenus et les photos, puis les maquettes du menu et des supports QR. Votre restaurant les valide avant la production finale. La mise en place prend généralement environ deux semaines après validation et réception des éléments nécessaires, selon la complexité du projet."
      }
    ],
    service: {
      name: "Remplacement de menu PDF Vistaire",
      serviceType: "Transformation de menu PDF en carte digitale restaurant",
      description:
        "Service de restructuration d'un menu PDF en expérience mobile premium avec QR code et fiches plats."
    },
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.pdf,
    relatedLinks: links(
      { href: "/alternative-menu-pdf-restaurant", label: "Alternative au menu PDF" },
      { href: "/menu-qr-sans-pdf", label: "Menu QR sans PDF" },
      coreLinks.pricing,
      coreLinks.sampleMenu
    )
  },
  {
    slug: "alternative-menu-pdf-restaurant",
    path: "/alternative-menu-pdf-restaurant",
    type: "aeo",
    cluster: "Alternative menu PDF",
    commercialIntent: "high",
    priority: "P0",
    sitemapPriority: 0.8,
    queries: [
      "alternative menu PDF restaurant",
      "meilleure alternative au menu PDF restaurant",
      "menu PDF pas pratique restaurant"
    ],
    metadataTitle: "Alternative menu PDF restaurant | Vistaire",
    metadataDescription:
      "Vistaire est une alternative premium au menu PDF restaurant : carte mobile, QR code, fiches plats, photos, allergènes et 3D/AR sélective.",
    h1: "L'alternative premium au menu PDF restaurant.",
    eyebrow: "Alternative au PDF",
    directAnswer:
      "La bonne alternative à un menu PDF de restaurant dépend du niveau d'expérience voulu. Une page simple peut suffire pour une carte courte. Vistaire s'adresse aux restaurants qui veulent une présentation premium : carte mobile, fiches plats, photos, allergènes et QR code sans fichier à zoomer.",
    context: {
      heading: "Quand une alternative au PDF devient utile",
      body: [
        "Le PDF est acceptable quand la carte est très simple et que la lecture mobile n'est pas centrale. Ses limites apparaissent dès que le restaurant veut mettre en valeur les plats, les allergènes ou les visuels.",
        "Vistaire accompagne les restaurants qui souhaitent une carte personnalisée, des photos de leurs plats et des supports QR adaptés à leur salle. Nous préparons le menu avec vous, puis prenons en charge sa mise en ligne."
      ],
      points: [
        "carte plus confortable à lire sur téléphone",
        "présentation cohérente avec une salle premium",
        "informations utiles sans surcharger la page"
      ]
    },
    productProof: {
      heading: "Une alternative centrée sur le plat",
      body:
        "Le client parcourt les catégories, ouvre les plats qui l’intéressent et retrouve le prix, la description et les informations utiles. Les photos mettent votre cuisine en valeur; la 3D/AR complète la présentation de certains plats lorsque disponible.",
      points: ["cuisine mise en valeur", "lecture sur téléphone", "carte personnalisée", "supports QR"]
    },
    comparison: {
      heading: "PDF, page simple ou Vistaire ?",
      basicLabel: "Alternative basique",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Confort",
          basic: "Une liste peut être lisible mais peu inspirante.",
          vistaire: "La lecture reste claire tout en valorisant les plats."
        },
        {
          label: "Contenu",
          basic: "Peu de place pour les fiches, photos et détails.",
          vistaire: "Chaque plat important peut avoir son contexte."
        },
        {
          label: "Style",
          basic: "Le rendu peut vite devenir générique.",
          vistaire: "L'interface garde une ambiance restaurant haut de gamme."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/maison-elyse-n1.png",
      alt: "Alternative premium à un menu PDF avec fiche plat Vistaire"
    },
    faq: [
      {
        question: "Quelle alternative choisir à un menu PDF ?",
        answer:
          "Pour une carte premium, privilégiez une vraie page mobile avec catégories, fiches plats, prix et allergènes."
      },
      {
        question: "Une page web simple suffit-elle ?",
        answer:
          "Parfois oui, pour une carte courte. Vistaire vise les restaurants qui veulent une expérience plus visuelle et travaillée."
      },
      {
        question: "Vistaire est-il un système de commande ?",
        answer:
          "Non. Vistaire est d'abord une expérience de carte digitale, centrée sur la présentation du menu."
      },
      {
        question: "Peut-on créer un menu QR code gratuit ?",
        answer:
          "Oui, des options gratuites existent pour pointer vers un PDF ou une page basique. Vistaire vise plutôt une carte premium accompagnée."
      },
      {
        question: "Pourquoi ne pas garder seulement le PDF ?",
        answer:
          "Le PDF reste utile pour l'impression, mais il est souvent moins confortable sur téléphone à table."
      }
    ],
    service: {
      name: "Alternative au menu PDF Vistaire",
      serviceType: "Alternative premium au menu PDF pour restaurants",
      description:
        "Carte digitale mobile pour remplacer l'expérience PDF par une présentation plus claire et visuelle."
    },
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/remplacer-menu-pdf-restaurant", label: "Remplacer un PDF" },
      coreLinks.pdf,
      coreLinks.digital,
      coreLinks.pricing
    )
  },
  {
    slug: "fiche-plat-digitale-restaurant",
    path: "/fiche-plat-digitale-restaurant",
    type: "aeo",
    cluster: "Fiche plat digitale",
    commercialIntent: "high",
    priority: "P0",
    sitemapPriority: 0.78,
    queries: [
      "fiche plat digitale restaurant",
      "menu restaurant avec fiches plats",
      "fiche plat menu digital"
    ],
    metadataTitle: "Fiche plat digitale restaurant | Vistaire",
    metadataDescription:
      "Créez des fiches plats digitales pour restaurant : photos, prix, descriptions courtes, allergènes, options et 3D/AR sélective.",
    h1: "Des fiches plats digitales qui donnent envie de choisir.",
    eyebrow: "Fiches plats",
    directAnswer:
      "Une fiche plat digitale présente un plat au-delà de son nom : photo, prix, description courte, allergènes, options et parfois 3D/AR. Vistaire l'utilise pour les créations qui méritent plus de contexte, tout en gardant la carte rapide à parcourir pendant le service.",
    context: {
      heading: "Pourquoi créer des fiches plats ?",
      body: [
        "Sur une carte mobile, tous les plats n'ont pas besoin d'une longue page. Mais les signatures, desserts, cocktails et plats complexes gagnent à être expliqués clairement.",
        "La fiche plat Vistaire sert ce moment : elle donne assez d'information pour choisir sans ralentir tout le parcours du menu."
      ],
      points: [
        "présenter les signatures sans alourdir les catégories",
        "rendre prix, allergènes et options faciles à trouver",
        "réserver l'immersion aux plats qui en bénéficient"
      ]
    },
    productProof: {
      heading: "Une page courte, mais complète",
      body:
        "Chaque fiche peut réunir photo, description, prix, allergènes, indications et options utiles. Certains plats peuvent aussi être explorés en 3D/AR. Les informations du plat restent accessibles même lorsque cette expérience n’est pas disponible.",
      points: ["photo", "prix", "allergènes", "3D sélective"]
    },
    comparison: {
      heading: "Ligne de menu ou fiche plat ?",
      basicLabel: "Ligne simple",
      vistaireLabel: "Fiche Vistaire",
      rows: [
        {
          label: "Compréhension",
          basic: "Le client lit un nom et quelques mots.",
          vistaire: "Le client voit le plat, son contexte et les détails utiles."
        },
        {
          label: "Allergènes",
          basic: "Les informations peuvent être loin du plat.",
          vistaire: "Les allergènes sont associés à la fiche concernée."
        },
        {
          label: "Immersion",
          basic: "Aucun espace pour la 3D ou l'AR.",
          vistaire: "L'immersion apparaît seulement quand elle clarifie le plat."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "Fiche plat digitale Vistaire avec prix, description et visuel"
    },
    faq: [
      {
        question: "Qu'est-ce qu'une fiche plat digitale ?",
        answer:
          "C'est une page courte dédiée à un plat, avec photo, prix, description, allergènes et options utiles."
      },
      {
        question: "Tous les plats doivent-ils avoir une fiche ?",
        answer:
          "Non. Les fiches sont surtout utiles pour les signatures, plats complexes ou créations visuelles."
      },
      {
        question: "Peut-on afficher les allergènes par plat ?",
        answer:
          "Oui. Vistaire peut afficher les allergènes au niveau de la fiche, avec un texte clair et prudent."
      },
      {
        question: "La fiche peut-elle contenir de la 3D ?",
        answer:
          "Oui. L’offre comprend jusqu’à cinq plats 3D sélectionnés avec vous. Les vues sont préparées et validées avant leur mise en ligne; la réalité augmentée dépend aussi de l’appareil utilisé."
      },
      {
        question: "Que faire si un plat n'a pas de photo ?",
        answer:
          "La fiche reste lisible avec son nom, son prix et sa description. La prise de photos sur place fait partie de la mise en place Vistaire pour enrichir la carte avec vos propres plats."
      }
    ],
    service: {
      name: "Fiches plats digitales Vistaire",
      serviceType: "Fiches plats mobiles pour menus digitaux de restaurants",
      description:
        "Création de fiches plats visuelles avec prix, allergènes, photos et immersion sélective."
    },
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/menu-restaurant-photos", label: "Menu avec photos" },
      { href: "/menu-restaurant-allergenes", label: "Menu avec allergènes" },
      coreLinks.digital,
      coreLinks.pricing
    )
  },
  {
    slug: "menu-restaurant-photos",
    path: "/menu-restaurant-photos",
    type: "aeo",
    cluster: "Menu avec photos",
    commercialIntent: "high",
    priority: "P1",
    sitemapPriority: 0.76,
    queries: [
      "menu restaurant avec photos",
      "menu digital restaurant avec photos",
      "menu restaurant avec photos et prix"
    ],
    metadataTitle: "Menu restaurant avec photos | Vistaire",
    metadataDescription:
      "Vistaire photographie vos plats sur place et les intègre à un menu digital personnalisé : fiches plats, descriptions, prix lisibles et allergènes.",
    h1: "Un menu restaurant avec photos, sans perdre l'élégance.",
    eyebrow: "Photos et plats",
    directAnswer:
      "Un menu restaurant avec photos aide le client à reconnaître les plats et à choisir selon ses envies. Vistaire réalise les photos sur place dans le cadre de la mise en place, puis les intègre à des fiches qui réunissent prix, descriptions et allergènes dans une carte mobile personnalisée.",
    context: {
      heading: "La photo doit servir le choix",
      body: [
        "Une photo peut rendre un plat plus clair, mais trop d'images faibles peuvent abîmer la perception d'un restaurant premium. Le choix des visuels doit donc rester sélectif.",
        "Vistaire met les photos au service des fiches plats : elles accompagnent le prix, la description et les informations utiles sans transformer la carte en catalogue."
      ],
      points: [
        "photos utiles pour signatures et plats visuels",
        "des photos de la cuisine réellement servie",
        "des visuels adaptés à la consultation sur téléphone"
      ]
    },
    productProof: {
      heading: "Des visuels intégrés à la carte",
      body:
        "Vistaire photographie vos plats sur place pendant la préparation du projet. Les photos existantes peuvent aussi compléter la carte après validation avec vous. Chaque image accompagne le plat concerné, avec son prix, sa description et les informations utiles.",
      points: ["photos sur place", "vos propres plats", "signatures mises en valeur", "présentation soignée"]
    },
    comparison: {
      heading: "Galerie de photos ou carte visuelle ?",
      basicLabel: "Galerie",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Rôle",
          basic: "Les images décorent sans toujours aider le choix.",
          vistaire: "Chaque visuel soutient un plat ou une fiche précise."
        },
        {
          label: "Performance",
          basic: "Beaucoup d'images peuvent ralentir le parcours.",
          vistaire: "Les photos accompagnent les fiches sans interrompre la navigation."
        },
        {
          label: "Premium",
          basic: "Un mélange de qualités peut affaiblir l'image.",
          vistaire: "Les photos et la présentation reflètent la cuisine de votre restaurant."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
      alt: "Photo de dessert intégrée dans un menu restaurant Vistaire"
    },
    faq: [
      {
        question: "Faut-il mettre une photo sur chaque plat ?",
        answer:
          "Non. Les photos sont surtout utiles pour les plats signatures, desserts, cocktails et créations visuelles."
      },
      {
        question: "Peut-on utiliser les photos existantes du restaurant ?",
        answer:
          "Oui, si elles sont assez cohérentes avec l'image du lieu et adaptées au web."
      },
      {
        question: "Que faire sans photos professionnelles ?",
        answer:
          "Vistaire réalise une prise de photos des plats sur place dans le cadre de la mise en place. Nous préparons avec vous la sélection des plats à présenter."
      },
      {
        question: "Les photos ralentissent-elles le menu ?",
        answer:
          "Le poids des photos influence le chargement. Vistaire adapte leur affichage à la lecture sur téléphone pour que le client puisse parcourir la carte confortablement."
      },
      {
        question: "Les photos remplacent-elles les descriptions ?",
        answer:
          "Non. Une photo complète la fiche, mais le prix, les allergènes et le texte court restent importants."
      }
    ],
    service: {
      name: "Menu restaurant avec photos Vistaire",
      serviceType: "Carte digitale visuelle avec photos de plats",
      description:
        "Prise de photos des plats sur place et intégration dans une carte mobile personnalisée avec fiches plats, prix et descriptions."
    },
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/fiche-plat-digitale-restaurant", label: "Fiches plats digitales" },
      { href: "/menu-restaurant-allergenes", label: "Allergènes par plat" },
      coreLinks.digital
    )
  },
  {
    slug: "menu-restaurant-allergenes",
    path: "/menu-restaurant-allergenes",
    type: "aeo",
    cluster: "Menu avec allergènes",
    commercialIntent: "high",
    priority: "P1",
    sitemapPriority: 0.76,
    queries: [
      "menu restaurant avec allergènes",
      "menu digital allergènes restaurant",
      "allergènes menu QR code"
    ],
    metadataTitle: "Menu restaurant allergènes | Vistaire",
    metadataDescription:
      "Affichez les allergènes dans un menu digital restaurant : fiches plats, mentions claires, QR code, photos et expérience mobile premium.",
    h1: "Un menu restaurant avec allergènes lisibles.",
    eyebrow: "Allergènes",
    directAnswer:
      "Un menu restaurant avec allergènes doit rendre l'information facile à trouver sans remplacer la vigilance de l'équipe. Vistaire peut afficher les allergènes par fiche plat, garder les prix et descriptions lisibles, et présenter une carte mobile plus claire qu'un PDF dense.",
    context: {
      heading: "Retrouver les allergènes près du plat",
      body: [
        "Les allergènes sont sensibles : ils doivent être présentés clairement, mais le menu ne doit pas se substituer aux procédures internes du restaurant ni au dialogue avec le service.",
        "Vistaire permet de rapprocher l'information du plat concerné, avec une formulation lisible et des fiches qui restent agréables à consulter."
      ],
      points: [
        "mentions associées aux plats",
        "informations fournies et validées par le restaurant",
        "lecture plus confortable qu'un PDF à zoomer"
      ]
    },
    productProof: {
      heading: "Des fiches plats plus informatives",
      body:
        "Les allergènes peuvent apparaître avec le prix, la description et les options du plat. Cette structure aide le client à repérer l'information, tout en laissant le restaurant valider les contenus et garder ses pratiques de service.",
      points: ["allergènes par fiche", "validation restaurant", "prix lisibles", "QR code"]
    },
    comparison: {
      heading: "Allergènes dans un PDF ou sur fiche plat ?",
      basicLabel: "PDF",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Repérage",
          basic: "L'information peut être en bas de page ou dans une légende.",
          vistaire: "Les mentions restent près du plat concerné."
        },
        {
          label: "Clarté",
          basic: "Le zoom rend la lecture plus fragile.",
          vistaire: "La fiche garde une hiérarchie mobile claire."
        },
        {
          label: "Responsabilité",
          basic: "Le fichier peut devenir obsolète sans que le client le sache.",
          vistaire: "Le restaurant valide les informations et signale les changements de recette."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
      alt: "Fiche plat Vistaire avec informations allergènes lisibles"
    },
    faq: [
      {
        question: "Peut-on afficher les allergènes dans un menu QR code ?",
        answer:
          "Oui. Vistaire peut afficher les allergènes au niveau de chaque fiche plat."
      },
      {
        question: "Le menu remplace-t-il les conseils de l'équipe ?",
        answer:
          "Non. Les allergènes doivent rester validés par le restaurant et confirmés par l'équipe si nécessaire."
      },
      {
        question: "Peut-on modifier les allergènes après publication ?",
        answer:
          "Oui. Signalez à Vistaire les changements de recette ou de composition pour préparer une mise à jour avec les informations validées par votre restaurant."
      },
      {
        question: "Les pictogrammes sont-ils obligatoires ?",
        answer:
          "Non. Le plus important est une information claire, cohérente et compréhensible sur mobile."
      },
      {
        question: "Un PDF peut-il suffire pour les allergènes ?",
        answer:
          "Il peut suffire, mais une fiche digitale rend souvent l'information plus facile à trouver à table."
      }
    ],
    service: {
      name: "Menu restaurant allergènes Vistaire",
      serviceType: "Menu digital avec allergènes par fiche plat",
      description:
        "Carte mobile avec mentions allergènes lisibles et validées au niveau des fiches plats."
    },
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/fiche-plat-digitale-restaurant", label: "Fiche plat digitale" },
      { href: "/menu-restaurant-photos", label: "Menu avec photos" },
      coreLinks.digital
    )
  },
  {
    slug: "menu-digital-restaurant-montreal",
    path: "/menu-digital-restaurant-montreal",
    type: "local",
    cluster: "Local Montréal",
    commercialIntent: "very-high",
    priority: "P0",
    sitemapPriority: 0.82,
    queries: [
      "menu digital restaurant Montréal",
      "menu QR code restaurant Montréal",
      "création menu QR code Montréal"
    ],
    metadataTitle: "Menu digital restaurant Montréal | Vistaire",
    metadataDescription:
      "Vistaire crée votre menu digital à Montréal : carte mobile français/anglais, photos sur place, supports QR personnalisés et mise en place accompagnée.",
    h1: "Menu digital premium pour restaurants à Montréal.",
    eyebrow: "Montréal",
    directAnswer:
      "Vistaire accompagne les restaurants de Montréal dans la création d’un menu digital premium. Votre carte française et anglaise, les photos de vos plats et les supports QR personnalisés forment une expérience cohérente avec votre salle. Les clients consultent le menu sur téléphone, sans application à installer, avec une sélection de plats 3D lorsque disponible.",
    context: {
      heading: "Présenter votre cuisine aux habitués comme aux visiteurs",
      body: [
        "Pour votre restaurant indépendant, votre bistro ou votre table gastronomique à Montréal, la carte est un premier contact avec la cuisine. Des descriptions françaises et anglaises, des prix lisibles et les photos de vos propres plats aident chacun à choisir confortablement.",
        "Vistaire prépare cette présentation avec vous : nous reprenons votre menu, réalisons les photos sur place et concevons la carte et les supports QR selon votre identité. Vous validez les maquettes avant leur production finale."
      ],
      points: [
        "carte française et anglaise adaptée à votre cuisine",
        "plats signatures présentés avec photos et informations utiles",
        "supports QR physiques choisis pour votre salle"
      ]
    },
    productProof: {
      heading: "Un lancement accompagné, de la photo au menu en ligne",
      body:
        "Nous préparons les contenus et les maquettes du menu et des supports. Après votre validation, Vistaire lance la fabrication et finalise la carte. L’hébergement et la maintenance font partie de l’offre. Pour découvrir différentes présentations avant de parler de votre projet, explorez les démonstrations Maison Élyse, Trouvable et Sauge Noire.",
      points: ["photos sur place", "maquettes à valider", "supports personnalisés", "mise en ligne accompagnée"]
    },
    comparison: {
      heading: "Votre menu PDF ou une carte conçue pour le téléphone ?",
      basicLabel: "PDF",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Lecture bilingue",
          basic: "Les versions peuvent être réunies dans un document dense.",
          vistaire: "Le client choisit le français ou l’anglais et parcourt les catégories."
        },
        {
          label: "Plats signatures",
          basic: "Les détails et photos sont limités par la mise en page.",
          vistaire: "Chaque fiche réunit photo, prix, description et allergènes déclarés."
        },
        {
          label: "Mise en place",
          basic: "Le restaurant prépare et republie son document.",
          vistaire: "Vistaire prépare les photos, le menu et les supports QR avec vous."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/maison-elyse-n1.png",
      alt: "Plat présenté dans une démonstration de menu Vistaire"
    },
    faq: [
      {
        question: "Vistaire sert-il les restaurants à Montréal ?",
        answer:
          "Oui. Vistaire accompagne les restaurants de Montréal pour préparer une carte digitale personnalisée et des supports QR physiques. Un premier échange permet de préciser votre menu, votre salle et le déroulement du projet."
      },
      {
        question: "Faut-il créer le menu nous-mêmes ?",
        answer:
          "La création est accompagnée. Vistaire prépare les photos sur place, les contenus et les maquettes du menu et des supports. Votre restaurant fournit sa carte et valide les éléments clés avant la production finale."
      },
      {
        question: "Le menu peut-il être bilingue ?",
        answer:
          "Oui. La carte peut proposer le français et l’anglais. Nous préparons avec vous les contenus pour que les noms, descriptions, prix et informations utiles restent cohérents dans les deux langues."
      },
      {
        question: "Vistaire convient-il aux restaurants gastronomiques montréalais ?",
        answer:
          "Oui. Les photos des créations, les descriptions courtes et les supports physiques personnalisés permettent de prolonger une présentation soignée tout en gardant le service en salle au centre."
      },
      {
        question: "La 3D/AR est-elle disponible pour tous les plats ?",
        answer:
          "L’offre comprend jusqu’à cinq plats en 3D. Ils sont sélectionnés avec vous selon la pertinence de leur présentation. La réalité augmentée dépend du plat, de l’appareil et du navigateur; les photos et informations restent consultables."
      },
      {
        question: "Quel budget prévoir pour un menu Vistaire ?",
        answer:
          "La mise en place commence à 2 000 $ CAD selon la collection de supports choisie, puis l’abonnement est de 200 $ CAD par mois, taxes en sus. L’engagement initial est de 12 mois et la mise en place est payable avant le début du projet. La page Tarifs présente les collections, les options et les conditions."
      }
    ],
    service: {
      name: "Menu digital restaurant Montréal Vistaire",
      serviceType: "Menu digital QR premium pour restaurants à Montréal",
      description:
        "Création accompagnée de menus digitaux personnalisés pour restaurants de Montréal, avec carte française et anglaise, photos sur place et supports QR physiques."
    },
    areaServed: ["Montréal", "Québec", "Canada"],
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/menu-digital-restaurant-laval", label: "Menu digital à Laval" },
      { href: "/menu-digital-restaurant-brossard", label: "Menu digital à Brossard" },
      coreLinks.digital,
      coreLinks.pricing
    )
  },
  {
    slug: "menu-digital-restaurant-laval",
    path: "/menu-digital-restaurant-laval",
    type: "local",
    cluster: "Local Laval",
    commercialIntent: "high",
    priority: "P1",
    sitemapPriority: 0.74,
    queries: [
      "menu digital restaurant Laval",
      "menu QR code restaurant Laval",
      "service menu digital restaurant Laval"
    ],
    metadataTitle: "Menu digital restaurant Laval | Vistaire",
    metadataDescription:
      "Un menu digital personnalisé pour votre restaurant à Laval : remplacez le PDF avec une carte mobile, des photos sur place et des supports QR premium.",
    h1: "Menu digital QR pour restaurants à Laval.",
    eyebrow: "Laval",
    directAnswer:
      "Pour votre restaurant à Laval, Vistaire transforme la carte existante en un menu mobile personnalisé, accessible par QR code. Notre équipe prépare les photos, les fiches plats et les supports physiques avec vous. Que vous accueilliez des groupes, des familles ou des habitués, chacun retrouve les catégories, les prix et les détails utiles sur son téléphone.",
    context: {
      heading: "Passer du PDF à une carte facile à parcourir",
      body: [
        "Si votre restaurant à Laval utilise déjà un PDF, nous partons de cette carte pour organiser les catégories, les plats et les descriptions. À table, les clients peuvent parcourir le menu à leur rythme et ouvrir les détails d’un plat sans chercher dans un document à zoomer.",
        "Pour les repas en groupe ou en famille, les photos et les informations par plat donnent des repères concrets. Les allergènes déclarés par votre restaurant restent proches du plat; votre équipe confirme les besoins alimentaires sensibles."
      ],
      points: [
        "reprise de votre carte existante",
        "catégories claires et prix lisibles sur téléphone",
        "photos et informations regroupées par plat"
      ]
    },
    productProof: {
      heading: "Une transition préparée avec votre équipe",
      body:
        "Vistaire réalise la prise de photos sur place, prépare les maquettes et vous les soumet avant la production. Les supports QR sont personnalisés dans la collection choisie. Votre menu peut être proposé en français et en anglais, et vous pouvez conserver une carte imprimée selon votre façon de servir.",
      points: ["menu existant repris", "photos sur place", "validation des maquettes", "carte bilingue"]
    },
    comparison: {
      heading: "Menu QR basique ou expérience Vistaire ?",
      basicLabel: "QR basique",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Ouverture",
          basic: "Le client tombe souvent sur un PDF ou une liste simple.",
          vistaire: "Le client arrive sur une carte mobile structurée."
        },
        {
          label: "Choix",
          basic: "Les plats importants ne ressortent pas toujours.",
          vistaire: "Les signatures peuvent recevoir une fiche dédiée."
        },
        {
          label: "Préparation",
          basic: "Le restaurant doit concevoir et maintenir sa destination QR.",
          vistaire: "Vistaire prépare la carte, les photos et les supports avec votre équipe."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
      alt: "Ravioles présentées dans un exemple de carte digitale Vistaire"
    },
    faq: [
      {
        question: "Vistaire peut-il servir un restaurant à Laval ?",
        answer:
          "Oui. Le service est disponible pour les restaurants de Laval. Nous échangeons avec vous sur votre carte, les supports et les contenus à préparer avant de cadrer la mise en place."
      },
      {
        question: "Le menu est-il adapté aux groupes ?",
        answer:
          "Chaque client peut ouvrir la carte sur son téléphone, parcourir les catégories et consulter les photos ou les détails d’un plat. Aucun compte ni téléchargement d’application n’est nécessaire."
      },
      {
        question: "Un restaurant de Laval doit-il garder un PDF ?",
        answer:
          "Vous pouvez garder votre PDF pour l’archivage ou l’impression. Le QR code ouvre la carte mobile Vistaire, et une carte papier peut rester disponible selon votre service."
      },
      {
        question: "Qui s’occupe des photos et de la création du menu ?",
        answer:
          "Vistaire photographie les plats sur place et prépare la présentation à partir de votre carte. Vous validez les maquettes et les informations avant la production finale et la mise en ligne."
      },
      {
        question: "Quels supports QR sont inclus ?",
        answer:
          "L’offre inclut jusqu’à vingt supports QR personnalisés dans la collection choisie : Acrylique, Sculpté, Carré ou Signature. Les supports supplémentaires ou de remplacement font l’objet d’une estimation selon le besoin."
      },
      {
        question: "Comment préparer les changements de carte ?",
        answer:
          "Transmettez les changements de plats, de prix ou de composition pour préparer la mise à jour avec Vistaire. L’option Pilotage, à 100 $ CAD supplémentaires par mois, permet de gérer les disponibilités depuis le dashboard et de consulter l’activité du menu."
      },
      {
        question: "Où trouver les tarifs pour mon restaurant à Laval ?",
        answer:
          "Les collections sont présentées sur la page Tarifs. La mise en place commence à 2 000 $ CAD selon le support choisi, avec un abonnement de 200 $ CAD par mois, taxes en sus. L’engagement initial est de 12 mois."
      }
    ],
    service: {
      name: "Menu digital restaurant Laval Vistaire",
      serviceType: "Menu digital QR premium pour restaurants à Laval",
      description:
        "Création accompagnée d’une carte mobile pour restaurants de Laval à partir du menu existant, avec photos sur place, fiches plats et supports QR personnalisés."
    },
    areaServed: ["Laval", "Rive-Nord", "Québec", "Canada"],
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/menu-digital-restaurant-montreal", label: "Menu digital à Montréal" },
      { href: "/menu-digital-restaurant-brossard", label: "Menu digital à Brossard" },
      coreLinks.qr,
      coreLinks.pricing
    )
  },
  {
    slug: "menu-digital-restaurant-brossard",
    path: "/menu-digital-restaurant-brossard",
    type: "local",
    cluster: "Local Brossard",
    commercialIntent: "high",
    priority: "P1",
    sitemapPriority: 0.74,
    queries: [
      "menu digital restaurant Brossard",
      "menu QR code restaurant Brossard",
      "carte digitale restaurant Brossard"
    ],
    metadataTitle: "Menu digital restaurant Brossard | Vistaire",
    metadataDescription:
      "Présentez les plats de votre restaurant à Brossard avec Vistaire : menu mobile bilingue, photos sur place, supports QR et jusqu’à cinq plats en 3D.",
    h1: "Menu digital premium pour restaurants à Brossard.",
    eyebrow: "Brossard",
    directAnswer:
      "Vistaire crée des menus digitaux premium pour les restaurants de Brossard et de la Rive-Sud. Votre cuisine est présentée dans une carte mobile française et anglaise, avec photos sur place, fiches plats et supports QR personnalisés. Jusqu’à cinq plats peuvent être proposés en 3D, avec une réalité augmentée disponible selon le plat et l’appareil.",
    context: {
      heading: "Faire découvrir vos plats signatures avant de choisir",
      body: [
        "Pour votre restaurant à Brossard, une spécialité de la maison ou un dressage soigné gagne à être présenté avec son visuel et une description claire. La fiche plat réunit ces éléments avec le prix et les allergènes déclarés par votre restaurant.",
        "Nous sélectionnons avec vous les créations à photographier et celles qui se prêtent à la 3D. Les clients choisissent le français ou l’anglais, puis consultent les détails qui les intéressent. Les photos et les informations restent accessibles même sans réalité augmentée."
      ],
      points: [
        "vos spécialités expliquées et photographiées",
        "carte française et anglaise",
        "3D sur une sélection de plats, selon leur présentation"
      ]
    },
    productProof: {
      heading: "Du support sur la table à la découverte du plat",
      body:
        "Choisissez entre les collections Acrylique, Sculpté, Carré et Signature pour placer le QR code dans votre salle. Vistaire prépare les maquettes des supports et de la carte, puis les soumet à votre validation. Les démonstrations Maison Élyse, Trouvable et Sauge Noire permettent de découvrir des styles de menus et de fiches plats avant de définir votre projet.",
      points: ["quatre collections", "supports personnalisés", "photos des plats", "exemples interactifs"]
    },
    comparison: {
      heading: "PDF QR ou carte digitale premium ?",
      basicLabel: "PDF QR",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Première impression",
          basic: "Un fichier peut sembler utilitaire.",
          vistaire: "La carte donne une impression plus proche du lieu."
        },
        {
          label: "Détails",
          basic: "Les informations restent coincées dans la mise en page.",
          vistaire: "Les fiches rapprochent photo, prix, allergènes et description."
        },
        {
          label: "3D",
          basic: "Le PDF ne permet pas d'expérience immersive.",
          vistaire: "La 3D/AR est possible uniquement pour les plats validés."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
      alt: "Dessert présenté dans une démonstration de carte Vistaire"
    },
    faq: [
      {
        question: "Vistaire est-il disponible pour Brossard ?",
        answer:
          "Oui. Vistaire accompagne les restaurants de Brossard et de la Rive-Sud. Le premier échange sert à préciser votre carte, les supports et les plats à présenter avant la mise en place."
      },
      {
        question: "Le menu peut-il remplacer un PDF QR ?",
        answer:
          "Oui. Nous reprenons les informations de votre menu pour créer une carte pensée pour le téléphone. Le QR code ouvre cette carte dans le navigateur, sans téléchargement d’application."
      },
      {
        question: "Peut-on mettre les plats signatures en avant ?",
        answer:
          "Oui. Les photos sur place et les fiches permettent de présenter vos spécialités avec leurs descriptions, leurs prix et les informations utiles. Certains plats peuvent aussi être sélectionnés pour une présentation en 3D."
      },
      {
        question: "Le menu peut-il être français et anglais ?",
        answer:
          "Oui. Vistaire prépare avec vous les contenus des deux langues. Votre restaurant valide les noms des plats, les descriptions et les informations clés avant la mise en ligne."
      },
      {
        question: "Quelles sont les limites de la réalité augmentée ?",
        answer:
          "La réalité augmentée dépend du modèle du plat, de l’appareil et du navigateur. Elle complète la fiche sans remplacer les photos ni les informations de la carte. Jusqu’à cinq plats 3D peuvent être inclus; les productions supplémentaires sont facturées séparément."
      },
      {
        question: "Quel est le prix du service à Brossard ?",
        answer:
          "La mise en place commence à 2 000 $ CAD selon la collection choisie, puis l’abonnement est de 200 $ CAD par mois, taxes en sus, avec un engagement initial de 12 mois. L’offre inclut jusqu’à vingt supports QR personnalisés. Les tarifs et les options sont présentés sur la page Tarifs."
      },
      {
        question: "Combien de temps prend le lancement ?",
        answer:
          "La mise en place complète prend généralement environ deux semaines une fois le menu et les maquettes des supports validés et les éléments nécessaires reçus. Le délai peut varier selon la complexité du projet et la production."
      }
    ],
    service: {
      name: "Menu digital restaurant Brossard Vistaire",
      serviceType: "Menu digital QR premium pour restaurants à Brossard",
      description:
        "Création accompagnée de menus mobiles français et anglais pour restaurants de Brossard, avec photos sur place, supports QR personnalisés et une sélection de plats 3D."
    },
    areaServed: ["Brossard", "Rive-Sud", "Montérégie", "Québec", "Canada"],
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/menu-digital-restaurant-montreal", label: "Menu digital à Montréal" },
      { href: "/menu-digital-restaurant-laval", label: "Menu digital à Laval" },
      coreLinks.pdf,
      coreLinks.pricing
    )
  },
  {
    slug: "menu-digital-restaurant-haut-de-gamme",
    path: "/menu-digital-restaurant-haut-de-gamme",
    type: "vertical",
    cluster: "Premium / haut de gamme",
    commercialIntent: "very-high",
    priority: "P0",
    sitemapPriority: 0.82,
    queries: [
      "menu digital restaurant haut de gamme",
      "menu QR code restaurant haut de gamme",
      "menu interactif restaurant premium"
    ],
    metadataTitle: "Menu digital restaurant haut de gamme | Vistaire",
    metadataDescription:
      "Vistaire conçoit des menus digitaux pour restaurants haut de gamme : QR code élégant, fiches plats, photos, allergènes et 3D sélective.",
    h1: "Un menu digital pour restaurant haut de gamme.",
    eyebrow: "Haut de gamme",
    directAnswer:
      "Un menu digital de restaurant haut de gamme doit rester discret, visuel et fidèle à la salle. Vistaire évite l'interface froide : le QR code ouvre une carte mobile premium avec fiches plats, prix, allergènes, photos et 3D/AR sélective quand elle enrichit vraiment le choix.",
    context: {
      heading: "Le digital ne doit pas casser l'expérience de salle",
      body: [
        "Dans un restaurant haut de gamme, le menu fait partie du service. Une interface trop utilitaire peut contredire l'ambiance, même si elle est pratique.",
        "Vistaire garde le plat au centre : hiérarchie calme, visuels soignés, textes courts, détails utiles et interactions sobres."
      ],
      points: [
        "supports QR adaptés à l’ambiance de votre salle",
        "photos de vos plats et descriptions courtes",
        "3D/AR pour une sélection de plats signatures"
      ]
    },
    productProof: {
      heading: "Un service personnalisé pour votre restaurant",
      body:
        "Vistaire prépare les photos, la carte mobile et les supports QR avec vous. Vous validez les maquettes avant la production finale, puis nous mettons le menu en ligne. Le client retrouve votre cuisine dans une présentation soignée, facile à consulter pendant le service.",
      points: ["carte personnalisée", "photos sur place", "supports QR", "lancement accompagné"]
    },
    comparison: {
      heading: "Menu digital générique ou Vistaire ?",
      basicLabel: "Générique",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Atmosphère",
          basic: "Interface souvent froide ou utilitaire.",
          vistaire: "Direction visuelle chaude, sombre et culinaire."
        },
        {
          label: "Plats",
          basic: "Les plats deviennent une liste.",
          vistaire: "Les signatures ont une vraie présence visuelle."
        },
        {
          label: "Immersion",
          basic: "Effets parfois gadgets.",
          vistaire: "3D/AR seulement si elle clarifie ou valorise le plat."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/maison-elyse-n1.png",
      alt: "Menu digital Vistaire pour restaurant haut de gamme"
    },
    faq: [
      {
        question: "Un QR code peut-il convenir à un restaurant haut de gamme ?",
        answer:
          "Oui, si l'expérience ouverte est élégante, rapide et cohérente avec la salle."
      },
      {
        question: "Faut-il créer le menu soi-même ?",
        answer:
          "Vistaire accompagne la création. Notre équipe prépare les contenus, les photos et les maquettes; votre restaurant valide les éléments clés avant la production et la mise en ligne."
      },
      {
        question: "Faut-il mettre de la 3D partout ?",
        answer:
          "Non. La 3D/AR doit rester sélective et utile."
      },
      {
        question: "Le menu peut-il garder une ambiance de marque ?",
        answer:
          "Oui. Les couleurs, la hiérarchie et les visuels sont pensés pour prolonger le restaurant."
      },
      {
        question: "Vistaire remplace-t-il le service en salle ?",
        answer:
          "Non. Il améliore la présentation de la carte, sans remplacer l'accueil humain."
      }
    ],
    service: {
      name: "Menu digital haut de gamme Vistaire",
      serviceType: "Menu digital premium pour restaurants haut de gamme",
      description:
        "Carte mobile QR premium avec fiches plats, visuels, allergènes et immersion sélective."
    },
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/menu-digital-restaurant-gastronomique", label: "Restaurant gastronomique" },
      coreLinks.digital,
      coreLinks.qr,
      coreLinks.pricing
    )
  },
  {
    slug: "menu-digital-restaurant-gastronomique",
    path: "/menu-digital-restaurant-gastronomique",
    type: "vertical",
    cluster: "Restaurant gastronomique",
    commercialIntent: "high",
    priority: "P1",
    sitemapPriority: 0.78,
    queries: [
      "menu digital restaurant gastronomique",
      "carte digitale restaurant gastronomique",
      "menu digital restaurant chic"
    ],
    metadataTitle: "Menu digital restaurant gastronomique | Vistaire",
    metadataDescription:
      "Un menu digital pour restaurant gastronomique doit rester sobre, visuel et précis : QR code, fiches plats, allergènes et 3D sélective.",
    h1: "Une carte digitale pour restaurant gastronomique.",
    eyebrow: "Gastronomique",
    directAnswer:
      "Pour un restaurant gastronomique, le menu digital doit respecter la précision du service et la mise en scène du plat. Vistaire propose une carte mobile sobre, avec fiches courtes, prix lisibles, allergènes, photos et 3D/AR sélective pour les créations qui gagnent à être vues.",
    context: {
      heading: "Préserver le rythme d'une carte gastronomique",
      body: [
        "Une carte gastronomique demande souvent peu de mots mais beaucoup de précision. Le digital doit clarifier les choix sans transformer la table en écran publicitaire.",
        "Vistaire permet de réserver les fiches détaillées aux plats qui méritent une explication, un visuel ou une immersion validée."
      ],
      points: [
        "mise en avant des signatures",
        "descriptions courtes et maîtrisées",
        "informations sensibles proches du plat"
      ]
    },
    productProof: {
      heading: "Une expérience qui reste culinaire",
      body:
        "Les sections, fiches et visuels gardent une hiérarchie calme. La 3D/AR n'est pas une obligation : elle complète seulement les plats où le volume, la texture ou le geste de dressage apporte une compréhension réelle.",
      points: ["signature", "sobriété", "prix lisible", "AR compatible"]
    },
    comparison: {
      heading: "Carte gastronomique papier, PDF ou Vistaire ?",
      basicLabel: "Papier/PDF",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Précision",
          basic: "Les détails se retrouvent parfois en note ou en annexe.",
          vistaire: "La fiche rassemble les informations utiles autour du plat."
        },
        {
          label: "Visuel",
          basic: "La photo est absente ou isolée.",
          vistaire: "Le visuel sert le plat sans devenir décoratif."
        },
        {
          label: "Innovation",
          basic: "Le support reste statique.",
          vistaire: "La 3D/AR peut enrichir quelques créations; les photos et descriptions restent accessibles."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "Carte digitale Vistaire pour restaurant gastronomique"
    },
    faq: [
      {
        question: "Un restaurant gastronomique doit-il passer au menu digital ?",
        answer:
          "Pas forcément. C'est pertinent si le digital prolonge la salle et clarifie les plats sans l'alourdir."
      },
      {
        question: "Peut-on garder une carte papier ?",
        answer:
          "Oui. Vistaire peut compléter la carte papier ou devenir l'expérience principale selon le service."
      },
      {
        question: "La 3D convient-elle à la gastronomie ?",
        answer:
          "Oui, pour quelques créations compatibles, si elle apporte de la compréhension ou du désir."
      },
      {
        question: "Les prix restent-ils visibles ?",
        answer:
          "Oui. La fiche plat garde une hiérarchie claire entre nom, prix, description et détails."
      },
      {
        question: "Qui prépare les textes et les photos du menu ?",
        answer:
          "Vistaire prépare la présentation à partir de votre carte et réalise les photos sur place. Votre restaurant valide les noms, les descriptions, les prix et les allergènes afin que le menu reflète la cuisine servie."
      }
    ],
    service: {
      name: "Menu digital restaurant gastronomique Vistaire",
      serviceType: "Carte digitale premium pour restaurants gastronomiques",
      description:
        "Menu digital sobre et visuel pour restaurants gastronomiques avec fiches plats et immersion sélective."
    },
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/menu-digital-restaurant-haut-de-gamme", label: "Restaurant haut de gamme" },
      { href: "/fiche-plat-digitale-restaurant", label: "Fiches plats" },
      coreLinks.digital,
      coreLinks.pricing
    )
  }
];

export const SEO_GEO_PAGES = withEditorialQueryEvidence(SEO_GEO_PAGE_DRAFTS);
