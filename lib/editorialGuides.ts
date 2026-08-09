export type EditorialGuideKey =
  | "premium-menu-anatomy"
  | "mobile-qr-without-app"
  | "restaurant-3d-decision";

export type EditorialGuideLocale = "fr" | "en";

export type EditorialGuideTable = {
  caption: string;
  headers: [string, string, string];
  rows: Array<[string, string, string]>;
};

export type EditorialGuideSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  table?: EditorialGuideTable;
};

export type EditorialGuide = {
  key: EditorialGuideKey;
  locale: EditorialGuideLocale;
  path: string;
  alternatePath: string;
  eyebrow: string;
  metadataTitle: string;
  metadataDescription: string;
  h1: string;
  dek: string;
  definition: string;
  cardTitle: string;
  cardDescription: string;
  sections: EditorialGuideSection[];
  checklist: {
    title: string;
    introduction: string;
    items: string[];
  };
  relatedTitle: string;
  relatedPaths: string[];
  cta: {
    eyebrow: string;
    title: string;
    text: string;
    label: string;
    href: string;
  };
};

export const EDITORIAL_GUIDES: EditorialGuide[] = [
  {
    key: "premium-menu-anatomy",
    locale: "fr",
    path: "/guides/anatomie-menu-digital-premium",
    alternatePath: "/en/guides/premium-digital-menu-anatomy",
    eyebrow: "Guide de conception",
    metadataTitle: "Anatomie d’un menu digital premium | Vistaire",
    metadataDescription:
      "Comprendre la hiérarchie, les fiches plats, les photos, les allergènes, la vitesse et la 3D sélective qui composent un menu digital premium.",
    h1: "L’anatomie d’un menu digital premium",
    dek:
      "Un menu digital premium ne se résume ni à un PDF placé derrière un QR code ni à une galerie de photos. Il organise la décision du convive sur un petit écran, rend chaque plat compréhensible et prolonge l’identité du restaurant sans ralentir le service.",
    definition:
      "Un menu digital premium est une carte mobile structurée comme un parcours de choix : catégories lisibles, plats bien nommés, informations utiles au bon moment, visuels maîtrisés et interactions suffisamment discrètes pour laisser la cuisine au centre.",
    cardTitle: "L’anatomie d’un menu digital premium",
    cardDescription:
      "Une méthode concrète pour hiérarchiser catégories, fiches plats, prix, visuels, allergènes et 3D sélective.",
    sections: [
      {
        id: "hierarchie",
        title: "La hiérarchie doit répondre avant de séduire",
        paragraphs: [
          "La première responsabilité de la carte est d’orienter. Le convive doit comprendre où il se trouve, quelles familles de plats sont disponibles et comment revenir à son point de départ. Une mise en scène raffinée ne compense pas une navigation ambiguë. Sur mobile, une catégorie visible, un titre court et un ordre cohérent réduisent les hésitations inutiles.",
          "L’ordre des catégories traduit aussi le rythme du repas. Il peut suivre l’expérience de table — à partager, entrées, plats, desserts — ou un usage propre à l’établissement. Ce choix mérite d’être éditorial, pas automatique. Les catégories les plus importantes doivent apparaître sans obliger le convive à décoder une taxonomie interne."
        ],
        bullets: [
          "Une catégorie active clairement identifiable.",
          "Des intitulés familiers au convive, cohérents avec la salle.",
          "Un retour simple vers la carte après la lecture d’un plat.",
          "Une profondeur limitée : catégorie, liste, fiche plat."
        ]
      },
      {
        id: "fiche-plat",
        title: "La fiche plat transforme une ligne en choix éclairé",
        paragraphs: [
          "Le nom du plat ouvre la promesse; la description donne les repères qui permettent de choisir. Une bonne description nomme les éléments distinctifs, la préparation ou la sensation principale sans réciter toute la recette. Elle évite les superlatifs génériques et préfère les détails observables : une cuisson, une origine réellement connue, un condiment ou une texture.",
          "Le prix reste proche du nom et ne doit pas être relégué dans un écran secondaire. Les options, suppléments et formats doivent être présentés avant la commande, avec des libellés explicites. Les signatures de la maison peuvent recevoir un badge sobre, à condition que ce badge ait un sens constant sur toute la carte."
        ],
        table: {
          caption: "Rôle des éléments essentiels d’une fiche plat",
          headers: ["Élément", "Question du convive", "Bonne réponse éditoriale"],
          rows: [
            ["Nom", "Qu’est-ce que c’est ?", "Un intitulé distinctif, lisible et stable."],
            ["Description", "Qu’est-ce qui le caractérise ?", "Quelques repères concrets, dans la voix du restaurant."],
            ["Prix", "Quel est le choix réel ?", "Un montant visible avec formats et suppléments explicites."],
            ["Badge", "Pourquoi le remarquer ?", "Une information utile : signature, végétal ou recommandation." ]
          ]
        }
      },
      {
        id: "photos",
        title: "Les photos soutiennent l’appétit sans uniformiser la cuisine",
        paragraphs: [
          "Une photo de plat est utile lorsqu’elle aide à imaginer une portion, une composition ou une présentation difficile à décrire. Elle doit correspondre à ce qui arrive en salle. Une image trop retouchée ou une banque d’images crée une dette de confiance, même si elle est spectaculaire.",
          "La cohérence visuelle compte davantage que l’accumulation. Lumière, cadrage, arrière-plan et température de couleur peuvent former une grammaire commune, tandis que chaque plat garde sa personnalité. Une carte incomplète mais cohérente peut signaler honnêtement les plats sans visuel au lieu d’utiliser des remplacements génériques."
        ]
      },
      {
        id: "allergenes",
        title: "Allergènes, régimes et badges : informer sans diagnostiquer",
        paragraphs: [
          "Les allergènes et préférences alimentaires doivent être faciles à trouver, formulés de façon constante et reliés à une procédure réelle en cuisine. Une interface ne peut pas déduire l’absence de contamination croisée ni remplacer l’échange avec l’équipe. Le menu doit donc distinguer une information déclarée sur les ingrédients d’une garantie que le restaurant n’est pas en mesure de donner.",
          "Les badges gagnent à rester peu nombreux. Végétarien, végétalien, épicé ou signature peuvent accélérer la lecture si leurs définitions sont partagées par la cuisine et la salle. Une légende accessible vaut mieux qu’une rangée d’icônes décoratives dont le sens varie d’un écran à l’autre."
        ],
        bullets: [
          "Employer le même vocabulaire dans le menu, en cuisine et en salle.",
          "Prévoir un texte invitant les personnes allergiques à parler à l’équipe.",
          "Ne pas transformer une préférence alimentaire en promesse médicale.",
          "Associer les icônes à des libellés textuels compréhensibles."
        ]
      },
      {
        id: "marque-vitesse",
        title: "La marque se reconnaît aussi dans la vitesse",
        paragraphs: [
          "Le caractère premium vient d’une somme de décisions retenues : typographie lisible, palette fidèle, rythme généreux, microcopies précises et transitions calmes. Copier les codes d’un palace n’aide pas un bistrot contemporain à devenir lui-même. Le bon système visuel traduit le lieu, le ton du service et la cuisine.",
          "La vitesse fait partie de cette perception. Le texte, les catégories et les prix doivent rester disponibles même si une image tarde. Les visuels sont dimensionnés pour le mobile, les mouvements respectent les préférences de réduction d’animation et les composants essentiels ne dépendent pas d’un long chargement. Une carte élégante qui bloque l’accès à l’information contredit sa propre promesse."
        ]
      },
      {
        id: "3d-selective",
        title: "La 3D n’a de valeur que lorsqu’elle lève une hésitation",
        paragraphs: [
          "La 3D peut servir un plat signature dont le volume, le dressage ou la construction échappe à une photographie unique. Elle n’a pas à couvrir toute la carte. Une sélection éditoriale protège la vitesse, concentre l’effort de production et donne un vrai motif d’explorer.",
          "Le modèle se charge après une intention claire, jamais comme condition pour lire la fiche. Une photo reste disponible en repli et le plat conserve son nom, sa description, son prix et ses informations alimentaires sur tous les appareils. Pour approfondir ce choix, le guide sur la 3D utile propose un cadre de décision séparé de l’effet de nouveauté."
        ],
        bullets: [
          "Choisir les plats dont la forme apporte une information.",
          "Déclencher le chargement après l’action du convive.",
          "Conserver une photo et tout le contenu textuel en solution de repli.",
          "Tester sur les appareils réellement utilisés en salle."
        ]
      }
    ],
    checklist: {
      title: "Checklist d’une carte prête pour la salle",
      introduction:
        "Avant publication, relire la carte comme un convive pressé, puis comme une personne qui a besoin d’informations précises.",
      items: [
        "Les catégories sont compréhensibles sans explication de l’équipe.",
        "Chaque plat a un nom, une description et un prix cohérents.",
        "Les photos correspondent au service réel et gardent une direction commune.",
        "Les allergènes et badges utilisent des mots et des règles partagés.",
        "La carte reste lisible à une main et sans zoom forcé.",
        "Le contenu essentiel apparaît avant les médias lourds.",
        "La 3D reste sélective et dispose d’une photo de repli.",
        "Les changements de carte peuvent être vérifiés avant leur mise en ligne."
      ]
    },
    relatedTitle: "Poursuivre avec un guide pratique",
    relatedPaths: [
      "/guides/menu-qr-mobile-sans-application",
      "/guides/3d-restaurant-utile-vs-gadget",
      "/menu-digital-restaurant",
      "/demo"
    ],
    cta: {
      eyebrow: "Voir le principe en contexte",
      title: "Comparer cette anatomie à votre carte actuelle",
      text: "Une conversation de travail permet de distinguer les informations à préserver, celles à clarifier et les plats qui méritent une présentation plus riche.",
      label: "Prendre rendez-vous",
      href: "/prendre-rendez-vous"
    }
  },
  {
    key: "premium-menu-anatomy",
    locale: "en",
    path: "/en/guides/premium-digital-menu-anatomy",
    alternatePath: "/guides/anatomie-menu-digital-premium",
    eyebrow: "Design guide",
    metadataTitle: "Premium digital menu anatomy | Vistaire",
    metadataDescription:
      "Learn how hierarchy, dish pages, pricing, photography, allergen notes, speed, brand expression and selective 3D shape a premium digital menu.",
    h1: "The anatomy of a premium digital restaurant menu",
    dek:
      "A premium digital menu is neither a PDF hidden behind a QR code nor a gallery of polished food pictures. It organizes a guest’s decision on a small screen, makes dishes understandable and carries the restaurant’s identity without getting in the way of service.",
    definition:
      "A premium digital menu is a mobile-first path through the restaurant’s offer: clear categories, precise dish information, intentional imagery and restrained interactions that keep the food—not the interface—at the centre.",
    cardTitle: "The anatomy of a premium digital menu",
    cardDescription:
      "A practical structure for categories, dish pages, prices, photography, allergen notes and selective 3D.",
    sections: [
      {
        id: "hierarchy",
        title: "Hierarchy should answer before it tries to impress",
        paragraphs: [
          "The menu’s first job is orientation. A guest should know which category is active, what other parts of the menu are available and how to return after opening a dish. A refined visual treatment cannot repair ambiguous navigation. On a phone, concise labels and a predictable order reduce avoidable searching.",
          "Category order also expresses the rhythm of the meal. It may follow the sequence of service or a structure unique to the restaurant. That decision should be editorial rather than generated by a database. The most important choices need familiar guest-facing language, not internal kitchen terminology."
        ],
        bullets: [
          "A visibly active category.",
          "Names that match the language used by the dining-room team.",
          "A clear return from a dish to its place in the menu.",
          "A shallow path from category to list to dish detail."
        ]
      },
      {
        id: "dish-page",
        title: "A dish page turns a line item into an informed choice",
        paragraphs: [
          "The dish name opens the promise; the description provides the clues needed to choose. Strong copy identifies the defining ingredients, preparation or sensory character without reproducing the full recipe. It avoids generic praise and favours details a guest can understand: a cooking method, a known origin, a condiment or a texture.",
          "Price belongs beside the name, not behind another interaction. Formats, additions and supplements should be clear before ordering. House signatures can carry a restrained badge when that badge has a consistent meaning throughout the menu rather than acting as decoration."
        ],
        table: {
          caption: "The role of essential dish-page elements",
          headers: ["Element", "Guest question", "Useful editorial answer"],
          rows: [
            ["Name", "What is it?", "A distinctive, readable and stable title."],
            ["Description", "What defines it?", "A few concrete cues in the restaurant’s voice."],
            ["Price", "What is the actual choice?", "A visible amount with formats and extras explained."],
            ["Badge", "Why should I notice it?", "Useful meaning such as signature, plant-based or recommended."]
          ]
        }
      },
      {
        id: "photography",
        title: "Photography should support appetite without standardizing the food",
        paragraphs: [
          "A dish photograph earns its place when it clarifies portion, composition or a presentation that words cannot easily convey. It should represent what arrives at the table. Excessive retouching and stock imagery create a trust gap, even when the result looks dramatic.",
          "Consistency matters more than volume. Light, framing, background and colour temperature can form a common grammar while dishes keep their character. An incomplete but honest photo set is preferable to generic placeholders that imply something the kitchen does not serve."
        ]
      },
      {
        id: "allergens",
        title: "Allergens, dietary preferences and badges need careful language",
        paragraphs: [
          "Allergen and dietary information should be easy to find, consistently worded and connected to a real kitchen process. An interface cannot infer cross-contact conditions or replace a conversation with staff. The menu should distinguish declared ingredient information from assurances the restaurant is not equipped to make.",
          "A small badge vocabulary is easier to understand. Vegetarian, vegan, spicy or signature markers can speed up reading when kitchen and service teams share their definitions. Text labels and an accessible legend communicate more reliably than decorative icons whose meaning shifts between screens."
        ],
        bullets: [
          "Use the same vocabulary in the menu, kitchen and dining room.",
          "Invite guests with allergies to speak directly with the team.",
          "Do not turn a dietary preference into a medical assurance.",
          "Pair icons with understandable text labels."
        ]
      },
      {
        id: "brand-performance",
        title: "Brand expression includes performance",
        paragraphs: [
          "Premium character comes from restrained decisions: readable typography, a faithful palette, generous rhythm, precise microcopy and calm transitions. Borrowing luxury clichés does not make a contemporary neighbourhood restaurant more itself. The right system reflects the room, the manner of service and the food.",
          "Speed is part of that impression. Text, categories and prices remain available while an image is loading. Visuals are prepared for mobile delivery, motion respects reduced-motion preferences and essential content does not wait for a heavy interaction. An elegant menu that withholds information undermines its own promise."
        ]
      },
      {
        id: "selective-3d",
        title: "3D is useful only when it resolves uncertainty",
        paragraphs: [
          "A three-dimensional view can help with a signature dish whose height, assembly or plating is hard to read in one photograph. It does not need to cover the full menu. Editorial selection protects loading behaviour, focuses production effort and gives guests a genuine reason to explore.",
          "The model should load after clear intent, never as a condition for reading the dish page. A photograph remains available as fallback, and the name, description, price and dietary information work on every supported device. The dedicated restaurant 3D guide provides a fuller decision framework."
        ],
        bullets: [
          "Choose dishes whose shape conveys useful information.",
          "Start model loading after a guest action.",
          "Keep a photo and complete text as fallback.",
          "Test the experience on devices actually used in the dining room."
        ]
      }
    ],
    checklist: {
      title: "A service-ready menu checklist",
      introduction:
        "Before publishing, read the menu once as a guest in a hurry and again as someone who needs precise information.",
      items: [
        "Categories make sense without an explanation from staff.",
        "Every dish has a consistent name, description and price.",
        "Photography reflects actual service and shares a coherent direction.",
        "Allergen notes and badges use shared language and rules.",
        "The menu is readable one-handed without forced zooming.",
        "Essential content appears before heavier media.",
        "3D is selective and every model has a photo fallback.",
        "Menu changes can be reviewed before they are published."
      ]
    },
    relatedTitle: "Continue with a practical guide",
    relatedPaths: [
      "/en/guides/mobile-qr-menu-without-app",
      "/en/guides/restaurant-3d-useful-vs-gimmick",
      "/en/digital-restaurant-menu",
      "/en/vistaire-menu"
    ],
    cta: {
      eyebrow: "See the principles in context",
      title: "Compare this anatomy with your current menu",
      text: "A working conversation can separate the information worth preserving from what needs clarification and identify dishes that deserve a richer presentation.",
      label: "Book a call",
      href: "/en/book-a-call"
    }
  },
  {
    key: "mobile-qr-without-app",
    locale: "fr",
    path: "/guides/menu-qr-mobile-sans-application",
    alternatePath: "/en/guides/mobile-qr-menu-without-app",
    eyebrow: "Guide d’exploitation",
    metadataTitle: "Menu QR mobile sans application | Vistaire",
    metadataDescription:
      "Concevoir un parcours QR qui s’ouvre dans le navigateur, reste lisible, maintenable et accessible, avec un lien stable, un repli réseau et des contrôles utiles.",
    h1: "Un menu QR mobile sans application",
    dek:
      "Le parcours le plus simple part de la table : le convive scanne un code, son téléphone ouvre une adresse web et la carte apparaît dans le navigateur. Aucune installation ne doit s’interposer. Cette simplicité visible repose pourtant sur des décisions précises de placement, de lien, de lecture et de maintenance.",
    definition:
      "Un menu QR sans application est une page web mobile accessible depuis l’appareil photo ou le lecteur QR du téléphone. Le QR contient une adresse stable; le contenu de la carte évolue derrière cette adresse sans demander au restaurant de réimprimer le code à chaque changement.",
    cardTitle: "Le menu QR mobile sans application",
    cardDescription:
      "Du scan au navigateur : placement à table, lien stable, lisibilité, maintenance, réseau, repli et sécurité opérationnelle.",
    sections: [
      {
        id: "parcours",
        title: "Le parcours réel : scanner, vérifier, ouvrir, lire",
        paragraphs: [
          "L’appareil photo reconnaît le code et propose une adresse. Le convive choisit de l’ouvrir dans son navigateur; il garde donc les commandes familières du téléphone, comme revenir en arrière, agrandir le texte ou partager le lien. Le menu n’a pas besoin de simuler une application pour être fluide.",
          "Le premier écran doit confirmer immédiatement le restaurant et rendre les catégories accessibles. Une redirection incompréhensible, une demande de compte ou une bannière envahissante introduit un doute au moment exact où la personne veut simplement consulter la carte."
        ],
        bullets: [
          "Le QR ouvre une adresse web reconnaissable.",
          "La page identifie le restaurant dès le premier écran.",
          "La carte ne demande ni compte ni installation.",
          "Les commandes normales du navigateur restent disponibles."
        ]
      },
      {
        id: "placement",
        title: "Le placement à table est une décision de service",
        paragraphs: [
          "Un QR fonctionne quand il peut être cadré sans déplacer la vaisselle ni se pencher dans une position inconfortable. Le support doit résister à la lumière du lieu : contraste suffisant, surface peu réfléchissante et espace libre autour du motif. Un code minuscule posé sous un verre devient un problème de salle, pas un problème technique abstrait.",
          "Le texte voisin explique l’action avec sobriété et nomme une solution de repli. L’équipe doit savoir où se trouve chaque support, comment reconnaître une version abîmée et comment proposer une carte physique ou verbaliser l’offre à une personne qui ne peut ou ne souhaite pas scanner."
        ]
      },
      {
        id: "lien-stable",
        title: "Un lien stable sépare le support imprimé du contenu",
        paragraphs: [
          "Le code placé sur les tables devrait pointer vers une adresse durable contrôlée par le restaurant ou son service de menu. Les changements de saison, de prix ou de disponibilité se font derrière ce point d’entrée. Un lien vers un fichier daté ou une adresse temporaire transforme chaque correction en campagne de réimpression.",
          "La stabilité ne signifie pas l’absence de contrôle. Après une mise à jour, une personne vérifie le lien public depuis un téléphone qui n’est pas connecté à l’outil d’administration. Les anciens favoris et les codes déjà imprimés font partie du parcours à tester."
        ],
        table: {
          caption: "Séparer ce qui doit rester stable de ce qui doit évoluer",
          headers: ["Élément", "Rôle", "Contrôle utile"],
          rows: [
            ["QR imprimé", "Point d’entrée à table", "Scanner chaque lot avant installation."],
            ["Adresse publique", "Destination durable", "Surveiller les redirections et le certificat HTTPS."],
            ["Contenu", "Carte, prix et disponibilité", "Relire puis vérifier la version publique."],
            ["Support de repli", "Accès quand le scan ne convient pas", "Le garder à jour avec l’équipe de salle."]
          ]
        }
      },
      {
        id: "lisibilite",
        title: "Lisibilité et accessibilité ne sont pas des options de finition",
        paragraphs: [
          "La carte doit fonctionner en orientation verticale, avec un texte suffisamment contrasté et des zones tactiles espacées. Les catégories restent compréhensibles sans couleur seule. Les prix, options et allergènes ne sont pas cachés dans des gestes difficiles à découvrir. Le zoom du navigateur demeure possible.",
          "Les lecteurs d’écran ont besoin de titres ordonnés, de liens nommés et d’un contenu textuel réel. Une image de menu, même nette, ne remplit pas ce rôle. Les photos de plats portent des descriptions utiles lorsqu’elles transmettent une information; les ornements peuvent rester silencieux."
        ],
        bullets: [
          "Une structure de titres logique et un seul titre principal.",
          "Des contrôles utilisables au clavier et avec les technologies d’assistance.",
          "Un contraste et une taille de texte adaptés à la salle.",
          "Aucune information essentielle enfermée dans une image."
        ]
      },
      {
        id: "reseau-repli",
        title: "Le réseau peut varier; le service doit garder une issue",
        paragraphs: [
          "Une salle en sous-sol, une terrasse ou un réseau mobile chargé peuvent rendre l’ouverture plus lente. La réponse raisonnable n’est pas de promettre une disponibilité absolue. Elle consiste à garder la page légère, à faire apparaître le texte avant les médias et à vérifier la réception aux tables dans les conditions du service.",
          "Le repli peut être une carte imprimée tenue à jour, une tablette de l’établissement ou l’aide de l’équipe. Son existence ne diminue pas la valeur du menu numérique; elle reconnaît que l’hospitalité doit continuer lorsque le téléphone est déchargé, incompatible ou simplement non souhaité."
        ]
      },
      {
        id: "maintenance-securite",
        title: "Maintenance et sécurité sont des habitudes observables",
        paragraphs: [
          "Le restaurant doit savoir qui peut modifier la carte, comment les changements sont relus et comment revenir à une version correcte. L’adresse publique utilise HTTPS et le domaine affiché inspire confiance. Les permissions de l’outil d’édition restent limitées aux personnes qui en ont besoin.",
          "Le support physique mérite aussi une inspection. Un autocollant placé sur un QR peut détourner le scan vers une autre adresse. L’équipe peut comparer régulièrement l’URL proposée avec l’adresse attendue et remplacer tout support altéré. Aucune de ces pratiques n’élimine tous les risques; elles rendent les anomalies plus faciles à détecter et à corriger."
        ],
        bullets: [
          "Nommer les personnes autorisées à publier.",
          "Relire prix, disponibilité et allergènes avant la mise en ligne.",
          "Vérifier l’adresse proposée par les QR présents en salle.",
          "Prévoir un moyen documenté de corriger ou restaurer le contenu."
        ]
      }
    ],
    checklist: {
      title: "Checklist avant de poser les QR sur les tables",
      introduction:
        "Tester le parcours avec le support, la lumière, les téléphones et le réseau réellement rencontrés par les convives.",
      items: [
        "Le code est net, contrasté, dégagé et peu réfléchissant.",
        "Le scan propose le domaine attendu avant l’ouverture.",
        "La page identifie immédiatement le restaurant et la carte.",
        "Le menu reste lisible sans installer une application ni créer un compte.",
        "Le texte apparaît avant les photos ou médias plus lourds.",
        "Les changements utilisent la même adresse publique stable.",
        "L’équipe connaît le support de repli et le garde à jour.",
        "Les QR physiques et les droits de publication sont revus régulièrement."
      ]
    },
    relatedTitle: "Approfondir le menu mobile",
    relatedPaths: [
      "/guides/anatomie-menu-digital-premium",
      "/guides/3d-restaurant-utile-vs-gadget",
      "/menu-qr-code-restaurant",
      "/menu-digital-sans-application"
    ],
    cta: {
      eyebrow: "Préparer le parcours de table",
      title: "Évaluer votre menu QR dans ses conditions réelles",
      text: "Le support, l’adresse publique et la carte mobile peuvent être examinés ensemble pour repérer les frictions avant leur arrivée en salle.",
      label: "Prendre rendez-vous",
      href: "/prendre-rendez-vous"
    }
  },
  {
    key: "mobile-qr-without-app",
    locale: "en",
    path: "/en/guides/mobile-qr-menu-without-app",
    alternatePath: "/guides/menu-qr-mobile-sans-application",
    eyebrow: "Operations guide",
    metadataTitle: "Mobile QR menu without an app | Vistaire",
    metadataDescription:
      "Design a browser-based QR menu with thoughtful table placement, a stable link, readable content, practical maintenance, network fallback and security checks.",
    h1: "A mobile QR menu without an app",
    dek:
      "The simplest journey begins at the table: a guest scans a code, the phone opens a web address and the menu appears in the browser. No installation gets in the way. That visible simplicity still depends on careful choices about placement, links, readability and maintenance.",
    definition:
      "An app-free QR menu is a mobile web page reached through the phone’s camera or QR reader. The code contains a stable address; the restaurant can change the menu behind that address without printing a new code for every edit.",
    cardTitle: "A mobile QR menu without an app",
    cardDescription:
      "From scan to browser: table placement, stable links, readability, maintenance, network fallback and operational security.",
    sections: [
      {
        id: "journey",
        title: "The real journey: scan, verify, open, read",
        paragraphs: [
          "The camera recognizes the code and proposes an address. The guest chooses to open it in the browser, preserving familiar phone controls such as back navigation, text enlargement and link sharing. The menu does not need to imitate an installed application to feel direct.",
          "The first screen should confirm the restaurant and expose useful categories immediately. An unclear redirect, account request or intrusive banner introduces doubt at the moment someone simply wants to read."
        ],
        bullets: [
          "The QR opens a recognizable web address.",
          "The first screen identifies the restaurant.",
          "The menu asks for neither an account nor an installation.",
          "Normal browser controls remain available."
        ]
      },
      {
        id: "placement",
        title: "Table placement is a service decision",
        paragraphs: [
          "A QR works when guests can frame it without moving glassware or leaning awkwardly. The support must suit the room’s light: enough contrast, limited glare and clear space around the pattern. A tiny code hidden under a glass becomes a dining-room problem rather than an abstract technical issue.",
          "Nearby copy explains the action briefly and names a fallback. Staff should know where supports are placed, how to recognize damage and how to offer a physical menu or verbal help to anyone who cannot or does not want to scan."
        ]
      },
      {
        id: "stable-link",
        title: "A stable link separates printed material from changing content",
        paragraphs: [
          "The code on the table should point to a durable address controlled by the restaurant or its menu service. Seasonal dishes, prices and availability can change behind that entry point. A dated file or temporary address turns every correction into another print run.",
          "Stability does not remove the need for checks. After an update, someone should open the public link on a phone that is not signed into the editing tool. Existing bookmarks and already printed codes belong in that test."
        ],
        table: {
          caption: "Separate what stays stable from what changes",
          headers: ["Element", "Role", "Useful control"],
          rows: [
            ["Printed QR", "Entry point at the table", "Scan every print batch before placement."],
            ["Public address", "Durable destination", "Review redirects and the HTTPS certificate."],
            ["Content", "Menu, prices and availability", "Proofread, publish, then check the public version."],
            ["Fallback", "Access when scanning is unsuitable", "Keep it current with the service team."]
          ]
        }
      },
      {
        id: "readability",
        title: "Readability and accessibility are not finishing touches",
        paragraphs: [
          "The menu should work in portrait orientation with strong text contrast and comfortably separated touch targets. Categories remain understandable without colour alone. Prices, options and allergen notes do not hide behind hard-to-discover gestures, and browser zoom remains available.",
          "Screen readers need ordered headings, named links and real text. Even a sharp image of a menu cannot provide that structure. Dish photographs carry useful descriptions when they communicate information; decorative elements can stay silent."
        ],
        bullets: [
          "A logical heading structure with one main heading.",
          "Controls that work with keyboards and assistive technology.",
          "Text size and contrast suited to dining-room conditions.",
          "No essential information trapped inside an image."
        ]
      },
      {
        id: "network-fallback",
        title: "Network conditions vary; service still needs a way forward",
        paragraphs: [
          "A basement dining room, terrace or busy mobile network can delay opening. The responsible answer is not a promise of absolute availability. It is a light page, text that appears before media and reception checks at actual tables under service conditions.",
          "Fallback may be an updated physical menu, a restaurant tablet or help from the team. Its presence does not weaken the digital menu. It recognizes that hospitality must continue when a phone is out of power, incompatible or simply unwanted."
        ]
      },
      {
        id: "maintenance-security",
        title: "Maintenance and security are observable habits",
        paragraphs: [
          "The restaurant should know who can edit the menu, how changes are reviewed and how correct content can be restored. The public address uses HTTPS and displays a domain guests can recognize. Editing permissions stay limited to people who need them.",
          "Physical supports also deserve inspection. A sticker placed over a QR can send a scan to another address. Staff can compare the proposed URL with the expected destination and replace altered materials. These practices do not remove every risk; they make anomalies easier to notice and correct."
        ],
        bullets: [
          "Name the people allowed to publish.",
          "Review prices, availability and allergen notes before release.",
          "Check the address proposed by codes in the dining room.",
          "Document how to correct or restore menu content."
        ]
      }
    ],
    checklist: {
      title: "Checklist before placing QR codes on tables",
      introduction:
        "Test the journey with the support, lighting, phones and network conditions guests will actually encounter.",
      items: [
        "The code is sharp, high-contrast, unobstructed and low-glare.",
        "The scan proposes the expected domain before opening.",
        "The page immediately identifies the restaurant and menu.",
        "Guests can read without installing an app or creating an account.",
        "Text appears before heavier photographs or media.",
        "Menu changes keep the same stable public address.",
        "Staff know the fallback and keep it current.",
        "Physical codes and publishing permissions receive regular review."
      ]
    },
    relatedTitle: "Go deeper on the mobile menu",
    relatedPaths: [
      "/en/guides/premium-digital-menu-anatomy",
      "/en/guides/restaurant-3d-useful-vs-gimmick",
      "/en/qr-code-restaurant-menu",
      "/en/digital-menu-without-app"
    ],
    cta: {
      eyebrow: "Prepare the table journey",
      title: "Review your QR menu in real service conditions",
      text: "The support, public address and mobile menu can be considered together to identify friction before it reaches the dining room.",
      label: "Book a call",
      href: "/en/book-a-call"
    }
  },
  {
    key: "restaurant-3d-decision",
    locale: "fr",
    path: "/guides/3d-restaurant-utile-vs-gadget",
    alternatePath: "/en/guides/restaurant-3d-useful-vs-gimmick",
    eyebrow: "Guide de décision",
    metadataTitle: "3D au restaurant : utile ou gadget ? | Vistaire",
    metadataDescription:
      "Décider quels plats méritent la 3D avec un cadre concret : utilité pour le choix, qualité du modèle, chargement à la demande, repli photo et compatibilité.",
    h1: "La 3D au restaurant : utile ou gadget ?",
    dek:
      "La 3D devient utile lorsqu’elle aide à comprendre un plat qu’une image seule raconte mal. Elle devient un gadget lorsqu’elle monopolise l’attention, ralentit la carte ou promet plus que l’expérience servie. Le bon choix commence donc par le plat et la question du convive, pas par la technologie.",
    definition:
      "La 3D restaurant est une représentation interactive d’un plat que le convive peut observer sous plusieurs angles. Sa valeur dépend de l’information qu’elle ajoute, de sa fidélité au service réel et de sa capacité à rester optionnelle sur un menu rapide et accessible.",
    cardTitle: "La 3D au restaurant : utile ou gadget ?",
    cardDescription:
      "Un cadre de décision pour choisir les plats, charger les modèles à la demande et préserver une excellente expérience sans 3D.",
    sections: [
      {
        id: "question",
        title: "Commencer par l’hésitation à résoudre",
        paragraphs: [
          "Avant de produire un modèle, il faut pouvoir nommer l’incertitude. Le convive comprend-il mal la hauteur d’un dessert, le partage d’une assiette ou la disposition d’un plat signature? Un tour interactif peut alors apporter un renseignement que le texte et la photo ne donnent pas ensemble.",
          "Si la réponse est seulement « attirer l’attention », la 3D manque de rôle éditorial. Une animation spectaculaire peut générer un premier geste sans améliorer le choix. L’expérience premium ne se mesure pas au nombre d’effets, mais à la précision avec laquelle chacun soutient la carte."
        ],
        bullets: [
          "Quelle question concrète le modèle aide-t-il à résoudre?",
          "Le dressage réel est-il assez stable pour être représenté fidèlement?",
          "Le plat est-il important dans le récit et le service du restaurant?",
          "La fiche reste-t-elle complète si la 3D n’est jamais ouverte?"
        ]
      },
      {
        id: "cas-positifs",
        title: "Les cas où la 3D apporte une information",
        paragraphs: [
          "Les meilleurs candidats possèdent une forme lisible et distinctive : pièce montée, dessert architectural, plat à partager ou présentation avec plusieurs niveaux. Le modèle peut révéler la relation entre les éléments, aider à comprendre le volume ou montrer un détail caché dans un cadrage fixe.",
          "Un plat signature est aussi un bon candidat lorsque la cuisine peut maintenir une présentation cohérente. La 3D documente alors une intention réelle. Elle ne doit pas transformer une variation artisanale normale en promesse visuelle impossible à tenir."
        ]
      },
      {
        id: "cas-negatifs",
        title: "Les cas où la photo et le texte sont supérieurs",
        paragraphs: [
          "Une soupe, une assiette très changeante ou un plat dont l’intérêt principal est la couleur et la texture gagne souvent davantage avec une excellente photographie. La 3D peut aplatir les matières, vieillir rapidement si le dressage évolue ou donner une précision trompeuse.",
          "La couverture systématique de la carte est rarement un objectif éditorial défendable. Elle augmente les modèles à produire, contrôler et mettre à jour, même pour des plats dont la vue arrière ne révèle rien. La sélection doit pouvoir exclure un plat sans diminuer son statut."
        ],
        table: {
          caption: "Choisir le média selon l’information recherchée",
          headers: ["Situation", "Média principal", "Raison"],
          rows: [
            ["Volume ou assemblage distinctif", "3D sélective", "Plusieurs angles rendent la structure compréhensible."],
            ["Texture, brillance ou couleur", "Photographie", "La lumière réelle traduit mieux la matière."],
            ["Composition simple", "Texte et photo", "L’interaction n’ajoute pas d’information décisive."],
            ["Dressage très variable", "Photo maintenue", "Elle peut être renouvelée avec moins d’ambiguïté."]
          ]
        }
      },
      {
        id: "performance",
        title: "Le chargement à la demande protège toute la carte",
        paragraphs: [
          "Le texte, le prix, les allergènes et la photo doivent apparaître sans attendre le fichier 3D. Le chargement commence après une action explicite, par exemple lorsque le convive choisit d’explorer le plat. Cette hiérarchie évite de faire payer à toute la carte le poids d’une fonction que certaines personnes n’utiliseront pas.",
          "L’interface indique que l’expérience est en préparation et laisse la personne continuer à lire. Si le modèle échoue, la fiche ne devient pas vide. La performance est ainsi traitée comme une qualité éditoriale : l’information la plus importante arrive d’abord."
        ],
        bullets: [
          "Ne pas précharger les modèles au simple affichage de la carte.",
          "Dimensionner et contrôler chaque fichier avant publication.",
          "Montrer un état de chargement compréhensible et non bloquant.",
          "Mesurer sur le réseau et les téléphones réellement ciblés."
        ]
      },
      {
        id: "repli-compatibilite",
        title: "La photo de repli est une version complète, pas un lot de consolation",
        paragraphs: [
          "Chaque plat enrichi conserve une photographie optimisée. Elle sert aux appareils ou navigateurs où la fonction n’est pas adaptée, aux connexions difficiles et aux personnes qui préfèrent ne pas interagir. Le bouton 3D peut disparaître ou expliquer son indisponibilité sans laisser un cadre cassé.",
          "La compatibilité se vérifie par capacités, pas par hypothèse sur la marque du téléphone. Le menu principal reste web, lisible et navigable partout dans le périmètre pris en charge. Les expériences de réalité augmentée éventuelles sont des prolongements séparés, jamais le seul moyen de voir le plat."
        ]
      },
      {
        id: "gouvernance",
        title: "La sélectivité doit survivre aux changements de carte",
        paragraphs: [
          "Un modèle a un propriétaire éditorial. Lorsqu’un dressage, une garniture ou une vaisselle change, l’équipe décide si le fichier reste fidèle, doit être refait ou doit être retiré. Le statut « signature » ne dispense pas de cette revue.",
          "Une petite collection suivie est plus crédible qu’une grande galerie oubliée. La cuisine, la salle et la personne qui gère la carte partagent les critères de sélection. Ainsi, l’ajout d’un nouveau modèle répond au même cadre que les précédents au lieu de dépendre de l’enthousiasme du moment."
        ]
      }
    ],
    checklist: {
      title: "Checklist de décision pour un plat en 3D",
      introduction:
        "Un oui convaincant à l’ensemble de ces questions indique un cas utile; une réponse faible invite à privilégier le texte ou la photographie.",
      items: [
        "Le modèle répond à une hésitation précise du convive.",
        "La forme du plat apporte plus que sa seule couleur ou texture.",
        "Le dressage réel est suffisamment stable et fidèle au modèle.",
        "Le plat reste entièrement compréhensible sans ouvrir la 3D.",
        "Le chargement ne commence qu’après une intention explicite.",
        "Une photo optimisée sert de repli sur chaque appareil.",
        "Le fichier est contrôlé sur les téléphones et réseaux ciblés.",
        "Une personne sait quand revoir, remplacer ou retirer le modèle."
      ]
    },
    relatedTitle: "Replacer la 3D dans l’expérience complète",
    relatedPaths: [
      "/guides/anatomie-menu-digital-premium",
      "/guides/menu-qr-mobile-sans-application",
      "/menu-3d-ar-restaurant",
      "/demo"
    ],
    cta: {
      eyebrow: "Décider avant de produire",
      title: "Identifier les plats qui justifient réellement la 3D",
      text: "Une revue de la carte peut classer les candidats selon l’utilité, la fidélité possible et la qualité du repli, avant d’engager la production.",
      label: "Prendre rendez-vous",
      href: "/prendre-rendez-vous"
    }
  },
  {
    key: "restaurant-3d-decision",
    locale: "en",
    path: "/en/guides/restaurant-3d-useful-vs-gimmick",
    alternatePath: "/guides/3d-restaurant-utile-vs-gadget",
    eyebrow: "Decision guide",
    metadataTitle: "Restaurant 3D: useful or gimmick? | Vistaire",
    metadataDescription:
      "Decide which dishes merit 3D using a practical framework for guest value, model fidelity, lazy loading, photo fallback, device compatibility and upkeep.",
    h1: "Restaurant 3D: useful tool or gimmick?",
    dek:
      "3D becomes useful when it helps a guest understand a dish that one image cannot fully explain. It becomes a gimmick when it takes over the experience, slows the menu or promises more than service delivers. The right decision starts with the dish and the guest’s question, not the technology.",
    definition:
      "Restaurant 3D is an interactive representation of a dish that guests can inspect from different angles. Its value depends on the information it adds, its fidelity to the served plate and its ability to remain optional within a fast, accessible menu.",
    cardTitle: "Restaurant 3D: useful tool or gimmick?",
    cardDescription:
      "A decision framework for choosing dishes, loading models on demand and preserving a complete experience without 3D.",
    sections: [
      {
        id: "question",
        title: "Start with the uncertainty you want to resolve",
        paragraphs: [
          "Before producing a model, name the uncertainty. Is it difficult to understand a dessert’s height, the sharing format of a plate or the construction of a signature dish? An interactive view can add information that words and one photograph do not communicate together.",
          "If the only answer is attracting attention, 3D lacks an editorial role. A dramatic interaction may earn an initial gesture without improving the choice. Premium experience is not measured by the number of effects but by how precisely each one supports the menu."
        ],
        bullets: [
          "Which concrete guest question does the model answer?",
          "Is the real plating consistent enough to represent faithfully?",
          "Does the dish matter to the restaurant’s story and service?",
          "Is the dish page complete if nobody opens the model?"
        ]
      },
      {
        id: "positive-cases",
        title: "Where 3D adds useful information",
        paragraphs: [
          "Strong candidates have readable, distinctive form: a layered dessert, an architectural signature plate, a sharing arrangement or a presentation with several levels. The model can reveal relationships between elements, explain volume or expose a detail hidden by fixed framing.",
          "A signature dish also fits when the kitchen can maintain a coherent presentation. The model then documents a real intention. It should not turn normal handcrafted variation into a visual promise the team cannot maintain."
        ]
      },
      {
        id: "negative-cases",
        title: "Where photography and writing are stronger",
        paragraphs: [
          "Soup, highly variable plates and dishes valued mainly for colour or texture often benefit more from excellent photography. A model may flatten materials, age quickly when plating changes or imply misleading precision.",
          "Systematic menu coverage is rarely a defensible editorial goal. It creates more models to produce, review and update even when a rear view reveals nothing. Selection should be able to exclude a dish without implying that the dish is less important."
        ],
        table: {
          caption: "Choose media according to the information needed",
          headers: ["Situation", "Primary medium", "Reason"],
          rows: [
            ["Distinctive volume or assembly", "Selective 3D", "Multiple angles make structure understandable."],
            ["Texture, shine or colour", "Photography", "Real light communicates material more faithfully."],
            ["Simple composition", "Text and photo", "Interaction does not add decisive information."],
            ["Highly variable plating", "Maintained photo", "It can be renewed with less ambiguity."]
          ]
        }
      },
      {
        id: "performance",
        title: "On-demand loading protects the whole menu",
        paragraphs: [
          "Text, price, allergens and photography should appear without waiting for the model file. Loading begins after an explicit action, such as choosing to explore the dish. This hierarchy prevents every visitor from paying the cost of a feature only some will use.",
          "The interface explains that the experience is preparing while allowing the guest to keep reading. If the model fails, the dish page does not become empty. Performance is treated as an editorial quality: the most important information arrives first."
        ],
        bullets: [
          "Do not preload models when the menu first appears.",
          "Prepare and inspect every file before publishing.",
          "Show a clear, non-blocking loading state.",
          "Measure on the networks and phones the restaurant actually targets."
        ]
      },
      {
        id: "fallback-compatibility",
        title: "A photo fallback is a complete version, not a consolation prize",
        paragraphs: [
          "Every enhanced dish retains an optimized photograph. It serves devices or browsers where the feature is unsuitable, difficult connections and guests who prefer not to interact. The 3D control can disappear or explain unavailability without leaving a broken frame.",
          "Compatibility is checked through capabilities rather than assumptions about a phone brand. The main menu remains a readable, navigable web experience throughout the supported scope. Any augmented-reality extension is separate and never the only way to view the dish."
        ]
      },
      {
        id: "governance",
        title: "Selection must survive menu changes",
        paragraphs: [
          "A model needs an editorial owner. When plating, garnish or tableware changes, the team decides whether the file remains faithful, needs revision or should be removed. Signature status does not replace that review.",
          "A small maintained collection is more credible than a large forgotten gallery. Kitchen, dining-room and menu teams share selection criteria. A new model then answers the same framework as earlier choices instead of depending on temporary enthusiasm."
        ]
      }
    ],
    checklist: {
      title: "Decision checklist for a dish in 3D",
      introduction:
        "A convincing yes across these questions indicates a useful case; weak answers suggest relying on writing or photography.",
      items: [
        "The model answers a precise guest uncertainty.",
        "The dish’s form contributes more than colour or texture alone.",
        "The served plating is stable and faithful to the model.",
        "The dish remains fully understandable without opening 3D.",
        "Loading starts only after explicit guest intent.",
        "An optimized photograph works as fallback on every device.",
        "The file is checked on target phones and network conditions.",
        "Someone knows when to review, replace or remove the model."
      ]
    },
    relatedTitle: "Place 3D within the complete experience",
    relatedPaths: [
      "/en/guides/premium-digital-menu-anatomy",
      "/en/guides/mobile-qr-menu-without-app",
      "/en/3d-ar-restaurant-menu",
      "/en/vistaire-menu"
    ],
    cta: {
      eyebrow: "Decide before producing",
      title: "Identify the dishes that genuinely justify 3D",
      text: "A menu review can sort candidates by guest value, achievable fidelity and fallback quality before production begins.",
      label: "Book a call",
      href: "/en/book-a-call"
    }
  }
];

export type EditorialGuideRoutePair = {
  key: EditorialGuideKey;
  fr: string;
  en: string;
  changeFrequency: "monthly";
  priority: number;
};

const EDITORIAL_GUIDE_KEYS = [
  "premium-menu-anatomy",
  "mobile-qr-without-app",
  "restaurant-3d-decision"
] as const satisfies readonly EditorialGuideKey[];

const EDITORIAL_GUIDE_PRIORITIES: Record<EditorialGuideKey, number> = {
  "premium-menu-anatomy": 0.75,
  "mobile-qr-without-app": 0.74,
  "restaurant-3d-decision": 0.73
};

function editorialGuidePath(
  key: EditorialGuideKey,
  locale: EditorialGuideLocale
): string {
  const guide = EDITORIAL_GUIDES.find(
    (candidate) => candidate.key === key && candidate.locale === locale
  );

  if (!guide) {
    throw new Error(`Missing editorial guide route: ${key} (${locale})`);
  }

  return guide.path;
}

export const EDITORIAL_GUIDE_ROUTE_PAIRS: EditorialGuideRoutePair[] =
  EDITORIAL_GUIDE_KEYS.map((key) => ({
    key,
    fr: editorialGuidePath(key, "fr"),
    en: editorialGuidePath(key, "en"),
    changeFrequency: "monthly",
    priority: EDITORIAL_GUIDE_PRIORITIES[key]
  }));

export function getEditorialGuide(
  key: EditorialGuideKey,
  locale: EditorialGuideLocale = "fr"
): EditorialGuide {
  const guide = EDITORIAL_GUIDES.find(
    (candidate) => candidate.key === key && candidate.locale === locale
  );

  if (!guide) {
    throw new Error(`Unknown editorial guide: ${key} (${locale})`);
  }

  return guide;
}

export function getEditorialGuides(
  locale: EditorialGuideLocale = "fr"
): EditorialGuide[] {
  return EDITORIAL_GUIDES.filter((guide) => guide.locale === locale);
}

export function getEditorialGuideByPath(path: string): EditorialGuide | null {
  return EDITORIAL_GUIDES.find((guide) => guide.path === path) ?? null;
}
