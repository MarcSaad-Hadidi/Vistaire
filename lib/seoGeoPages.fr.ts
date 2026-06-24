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
    title: "QR code",
    text: "Un accès simple à imprimer ou placer sur table, sans forcer le client à installer une application."
  },
  {
    title: "Carte mobile",
    text: "Des catégories, prix et descriptions pensés pour une lecture rapide sur téléphone."
  },
  {
    title: "Fiches plats",
    text: "Des pages courtes pour les plats qui demandent photo, récit, allergènes ou options."
  },
  {
    title: "Photos et fallback",
    text: "Des visuels fournis ou validés, avec une présentation propre même lorsqu'un asset 3D n'est pas disponible."
  },
  {
    title: "Allergènes",
    text: "Des informations visibles au bon endroit, sans remplacer le dialogue avec l'équipe de salle."
  },
  {
    title: "3D/AR sélective",
    text: "Une couche immersive uniquement pour les plats compatibles et utiles à montrer en volume."
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
      points: ["QR imprimable", "carte mobile", "fiches plats", "fallback photo"]
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
      points: ["sans téléchargement", "mobile-first", "fiches visuelles", "CTA clair"]
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
      "Pour remplacer un menu PDF de restaurant, il ne suffit pas de changer le lien du QR code. Il faut restructurer la carte pour le mobile : catégories, prix lisibles, fiches plats, allergènes, photos et contenus immersifs utiles. Vistaire accompagne cette transformation sans promettre de résultats non mesurés.",
    context: {
      heading: "Le problème n'est pas seulement le fichier",
      body: [
        "Un PDF reproduit souvent la carte imprimée. Sur téléphone, cette mise en page devient fragile : zoom, colonnes petites, allergènes dispersés et visuels limités.",
        "Le passage à Vistaire consiste à reconstruire l'expérience autour de la décision du client à table, pas à copier-coller le document dans une page web."
      ],
      points: [
        "reprendre les informations fiables du menu existant",
        "prioriser les catégories et plats signatures",
        "garder un fallback propre pour les visuels incomplets"
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
          "Non. Vistaire peut intégrer les photos disponibles et prévoir des placeholders ou fallbacks propres."
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
        question: "La transformation garantit-elle plus de ventes ?",
        answer:
          "Non. Vistaire améliore la présentation et la lecture, sans promettre un résultat commercial chiffré non prouvé."
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
        "Vistaire se positionne pour les maisons qui veulent une carte plus désirable sans basculer vers un outil froid de commande ou de réservation."
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
        "L'expérience ne transforme pas le menu en logiciel. Elle met en avant les catégories, les plats, les prix, les détails utiles et les signatures visuelles, avec une 3D/AR réservée aux contenus réellement compatibles.",
      points: ["food-first", "sans commande forcée", "structure premium", "QR code"]
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
        "Chaque fiche peut réunir visuel, description, prix, allergènes, badges, options et accès 3D/AR sélectif. Si un asset n'est pas validé, la fiche reste lisible avec un fallback photo ou une présentation sobre.",
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
          "Oui, seulement pour les plats compatibles et après validation de l'asset."
      },
      {
        question: "Que faire si un plat n'a pas de photo ?",
        answer:
          "La fiche peut utiliser une présentation sobre ou un fallback, sans ajouter d'image trompeuse."
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
      "Un menu restaurant avec photos peut rester premium : visuels food-first, fiches plats, prix lisibles, allergènes et fallback propre.",
    h1: "Un menu restaurant avec photos, sans perdre l'élégance.",
    eyebrow: "Photos et plats",
    directAnswer:
      "Un menu restaurant avec photos aide le client à comprendre et désirer les plats, à condition que les images soient utiles et cohérentes. Vistaire privilégie des visuels food-first, des fiches plats sobres et des fallbacks propres plutôt qu'une galerie lourde ou décorative.",
    context: {
      heading: "La photo doit servir le choix",
      body: [
        "Une photo peut rendre un plat plus clair, mais trop d'images faibles peuvent abîmer la perception d'un restaurant premium. Le choix des visuels doit donc rester sélectif.",
        "Vistaire met les photos au service des fiches plats : elles accompagnent le prix, la description et les informations utiles sans transformer la carte en catalogue."
      ],
      points: [
        "photos utiles pour signatures et plats visuels",
        "pas d'image trompeuse ou décorative inutile",
        "poids et affichage contrôlés pour le mobile"
      ]
    },
    productProof: {
      heading: "Des visuels intégrés à la carte",
      body:
        "Les photos existantes peuvent être intégrées lorsqu'elles sont cohérentes avec le niveau du restaurant. Lorsqu'une photo manque, Vistaire garde une fiche propre plutôt que d'ajouter un asset lourd ou générique.",
      points: ["alt text utile", "formats web", "priorité aux signatures", "fallback"]
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
          vistaire: "Les visuels sont intégrés avec prudence dans la lecture mobile."
        },
        {
          label: "Premium",
          basic: "Un mélange de qualités peut affaiblir l'image.",
          vistaire: "La direction visuelle reste cohérente et food-first."
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
          "Vistaire peut garder une fiche sobre et recommander les plats à photographier en priorité."
      },
      {
        question: "Les photos ralentissent-elles le menu ?",
        answer:
          "Elles peuvent le faire si elles sont lourdes. Vistaire privilégie des assets web raisonnables et sélectifs."
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
        "Intégration de photos utiles dans un menu digital premium avec fiches plats et fallback propre."
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
      heading: "Rendre l'information visible sans surpromettre",
      body: [
        "Les allergènes sont sensibles : ils doivent être présentés clairement, mais le menu ne doit pas se substituer aux procédures internes du restaurant ni au dialogue avec le service.",
        "Vistaire permet de rapprocher l'information du plat concerné, avec une formulation lisible et des fiches qui restent agréables à consulter."
      ],
      points: [
        "mentions associées aux plats",
        "texte court et prudent",
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
          vistaire: "Le contenu publié reste à valider et à maintenir par le restaurant."
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
          "Oui, les informations peuvent évoluer lorsque le restaurant valide une modification."
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
      "Vistaire crée des menus digitaux premium pour restaurants à Montréal : QR code, fiches plats, photos, allergènes et 3D/AR sélective.",
    h1: "Menu digital premium pour restaurants à Montréal.",
    eyebrow: "Montréal",
    directAnswer:
      "À Montréal, un menu digital restaurant doit fonctionner dans des salles variées : bistro premium, restaurant gastronomique, lounge, terrasse ou table de quartier. Vistaire propose une carte mobile QR premium avec fiches plats, photos, allergènes et 3D/AR sélective, sans se présenter comme un annuaire local.",
    context: {
      heading: "Une carte mobile pour la réalité montréalaise",
      body: [
        "Montréal réunit des restaurants très visuels, des clientèles locales et touristiques, et des quartiers où l'image du lieu compte autant que la rapidité de lecture.",
        "Vistaire rassemble les besoins des restaurants de Vieux-Montréal, Griffintown, Plateau, Outremont, Westmount et Saint-Laurent dans un guide commun tant qu'un contenu de quartier vraiment utile n'est pas justifié."
      ],
      points: [
        "adapté aux restaurants indépendants et premium",
        "utile pour les menus QR sans PDF",
        "approche bilingue possible sans créer de correspondance fragile"
      ]
    },
    productProof: {
      heading: "Ce que Vistaire peut apporter à Montréal",
      body:
        "La carte peut présenter les plats signatures, les allergènes et les visuels dans une interface mobile sobre. La 3D/AR reste réservée aux plats compatibles, afin de protéger la performance et l'image du restaurant.",
      points: ["Montréal", "quartiers premium", "mobile-first", "QR code"]
    },
    comparison: {
      heading: "PDF local ou expérience Vistaire ?",
      basicLabel: "PDF local",
      vistaireLabel: "Vistaire Montréal",
      rows: [
        {
          label: "Clientèle",
          basic: "Même fichier pour tous les contextes.",
          vistaire: "Parcours clair pour clients locaux, visiteurs et tables pressées."
        },
        {
          label: "Image",
          basic: "Le support peut paraître plus faible que la salle.",
          vistaire: "La carte prolonge l'ambiance haut de gamme du lieu."
        },
        {
          label: "Quartiers",
          basic: "Une page par quartier serait vite répétitive.",
          vistaire: "Une page Montréal forte couvre les quartiers tant que le contenu reste unique."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/maison-elyse-n1.png",
      alt: "Menu digital premium Vistaire pour restaurant à Montréal"
    },
    faq: [
      {
        question: "Vistaire sert-il les restaurants à Montréal ?",
        answer:
          "Oui. Vistaire positionne son service pour Montréal, le Québec et le Canada."
      },
      {
        question: "Faut-il une page différente par quartier de Montréal ?",
        answer:
          "Pas au départ. Il vaut mieux éviter les pages dupliquées si chaque quartier n'a pas un contenu réellement distinct."
      },
      {
        question: "Le menu peut-il être bilingue ?",
        answer:
          "Oui, si le contenu français et anglais est réellement disponible et maintenu."
      },
      {
        question: "Vistaire convient-il aux restaurants gastronomiques montréalais ?",
        answer:
          "Oui, lorsque l'objectif est une carte mobile sobre, visuelle et fidèle à la salle."
      },
      {
        question: "La 3D/AR est-elle disponible pour tous les plats ?",
        answer:
          "Non. Elle reste sélective et dépend des assets validés et de la compatibilité de l'appareil."
      }
    ],
    service: {
      name: "Menu digital restaurant Montréal Vistaire",
      serviceType: "Menu digital QR premium pour restaurants à Montréal",
      description:
        "Création de cartes mobiles premium pour restaurants montréalais avec QR code, fiches plats et immersion sélective."
    },
    areaServed: [
      "Montréal",
      "Vieux-Montréal",
      "Griffintown",
      "Le Plateau-Mont-Royal",
      "Outremont",
      "Westmount",
      "Saint-Laurent"
    ],
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
      "Vistaire accompagne les restaurants de Laval avec menus digitaux QR premium : carte mobile, fiches plats, photos, allergènes et 3D sélective.",
    h1: "Menu digital QR pour restaurants à Laval.",
    eyebrow: "Laval",
    directAnswer:
      "Pour un restaurant à Laval, un menu digital QR doit rester rapide, clair et valorisant pour des repas en famille, sorties de groupe ou tables premium. Vistaire transforme le menu en carte mobile avec fiches plats, photos, allergènes et 3D/AR sélective quand elle est pertinente.",
    context: {
      heading: "Un usage mobile fréquent et concret",
      body: [
        "À Laval, beaucoup de sorties se décident en groupe et se consultent sur téléphone. Une carte QR doit donc être simple à ouvrir, mais assez soignée pour refléter le niveau du restaurant.",
        "La page Laval reste distincte de Montréal par son contexte de destination, de stationnement et de repas de groupe, sans inventer une présence locale non prouvée."
      ],
      points: [
        "lecture rapide pour groupes et familles",
        "QR code simple à placer sur table ou support",
        "fiches plats utiles pour les signatures"
      ]
    },
    productProof: {
      heading: "Une carte claire pour le service",
      body:
        "Vistaire aide à organiser la carte en catégories, fiches et détails utiles. Les restaurants peuvent mettre en avant photos, prix, allergènes et options sans forcer une application ou un PDF lourd.",
      points: ["Laval", "groupes", "QR mobile", "photos utiles"]
    },
    comparison: {
      heading: "Menu QR basique ou expérience Vistaire ?",
      basicLabel: "QR basique",
      vistaireLabel: "Vistaire Laval",
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
          label: "Mobile",
          basic: "La lecture dépend de la mise en page d'origine.",
          vistaire: "La carte est pensée pour l'écran dès le départ."
        }
      ]
    },
    included: [...defaultIncluded],
    visualImage: {
      src: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
      alt: "Carte digitale Vistaire pour restaurant à Laval"
    },
    faq: [
      {
        question: "Vistaire peut-il servir un restaurant à Laval ?",
        answer:
          "Oui. Vistaire accompagne les restaurants au Québec et peut cadrer un menu digital pour Laval."
      },
      {
        question: "Le menu est-il adapté aux groupes ?",
        answer:
          "Oui. La structure mobile facilite la lecture rapide par plusieurs clients à table."
      },
      {
        question: "Un restaurant de Laval doit-il garder un PDF ?",
        answer:
          "Il peut le garder en secours, mais Vistaire vise une carte mobile plus confortable."
      },
      {
        question: "Les photos sont-elles obligatoires ?",
        answer:
          "Non, mais elles améliorent fortement les fiches des plats importants."
      },
      {
        question: "Le QR code est-il inclus ?",
        answer:
          "Oui. Vistaire prévoit un lien public et un QR code prêt à utiliser."
      }
    ],
    service: {
      name: "Menu digital restaurant Laval Vistaire",
      serviceType: "Menu digital QR premium pour restaurants à Laval",
      description:
        "Carte mobile QR pour restaurants lavallois avec fiches plats, prix, photos et allergènes."
    },
    areaServed: ["Laval", "Rive-Nord", "Québec", "Canada"],
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/menu-digital-restaurant-montreal", label: "Menu digital à Montréal" },
      { href: "/menu-digital-restaurant-brossard", label: "Menu digital à Brossard" },
      coreLinks.qr
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
      "Vistaire crée des menus digitaux QR premium pour restaurants à Brossard : carte mobile, fiches plats, photos, allergènes et 3D sélective.",
    h1: "Menu digital premium pour restaurants à Brossard.",
    eyebrow: "Brossard",
    directAnswer:
      "À Brossard, un menu digital restaurant doit servir des tables rapides, des sorties premium et une clientèle souvent mobile. Vistaire remplace le PDF par une carte QR claire : catégories, fiches plats, photos, allergènes, prix lisibles et 3D/AR sélective pour les signatures compatibles.",
    context: {
      heading: "Une carte utile dans un contexte de destination",
      body: [
        "Brossard attire des restaurants de destination, des sorties autour du DIX30 et une clientèle qui consulte beaucoup sur téléphone. La carte doit donc être rapide sans paraître générique.",
        "Vistaire garde une présentation food-first, avec des surfaces sombres, des accents champagne et une hiérarchie adaptée à la lecture à table."
      ],
      points: [
        "consultation rapide après scan QR",
        "présentation premium pour restaurants de destination",
        "informations clés visibles sans PDF"
      ]
    },
    productProof: {
      heading: "Un menu mobile qui reste désirable",
      body:
        "Les catégories guident la lecture, les fiches mettent en scène les plats importants, et les contenus 3D/AR ne s'ouvrent qu'après action du client afin de préserver le chargement initial.",
      points: ["Brossard", "DIX30", "Rive-Sud", "3D sélective"]
    },
    comparison: {
      heading: "PDF QR ou carte digitale premium ?",
      basicLabel: "PDF QR",
      vistaireLabel: "Vistaire Brossard",
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
      alt: "Menu digital premium Vistaire pour restaurant à Brossard"
    },
    faq: [
      {
        question: "Vistaire est-il disponible pour Brossard ?",
        answer:
          "Oui. Vistaire peut accompagner des restaurants de Brossard, de la Rive-Sud et du Québec."
      },
      {
        question: "Le menu peut-il remplacer un PDF QR ?",
        answer:
          "Oui. Le QR peut pointer vers une vraie carte mobile plutôt qu'un fichier."
      },
      {
        question: "Peut-on mettre les plats signatures en avant ?",
        answer:
          "Oui. Les fiches plats servent justement à mieux présenter les signatures."
      },
      {
        question: "La carte convient-elle aux restaurants premium ?",
        answer:
          "Oui, si l'objectif est une présentation sobre, visuelle et cohérente avec la salle."
      },
      {
        question: "Les contenus 3D chargent-ils immédiatement ?",
        answer:
          "Non. Ils restent déclenchés après action du client."
      }
    ],
    service: {
      name: "Menu digital restaurant Brossard Vistaire",
      serviceType: "Menu digital QR premium pour restaurants à Brossard",
      description:
        "Création de cartes digitales QR pour restaurants de Brossard avec fiches plats et présentation premium."
    },
    areaServed: ["Brossard", "Rive-Sud", "Montérégie", "Québec", "Canada"],
    primaryCta: coreLinks.meeting,
    secondaryCta: coreLinks.sampleMenu,
    relatedLinks: links(
      { href: "/menu-digital-restaurant-montreal", label: "Menu digital à Montréal" },
      { href: "/menu-digital-restaurant-laval", label: "Menu digital à Laval" },
      coreLinks.pdf
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
        "surfaces sombres et accents champagne",
        "photos food-first et fiches courtes",
        "3D/AR comme détail sélectif, pas comme promesse universelle"
      ]
    },
    productProof: {
      heading: "Une carte premium, pas un tableau de bord",
      body:
        "Le client voit une carte élégante et mobile-first. Le restaurateur bénéficie d'une structure claire pour présenter les plats, sans transformer Vistaire en POS, en système de réservation ou en outil de commande.",
      points: ["premium", "food-first", "mobile", "sans SaaS froid"]
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
        question: "Vistaire ressemble-t-il à un logiciel SaaS ?",
        answer:
          "Non. L'interface publique est conçue comme une carte restaurant premium, pas comme un tableau de bord."
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
          vistaire: "La 3D/AR peut enrichir quelques créations, avec fallback."
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
        question: "Vistaire invente-t-il des avis ou distinctions ?",
        answer:
          "Non. La page ne doit pas afficher de prix, avis ou clients non vérifiés."
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
