import { withEditorialQueryEvidence } from "./seoGeoEvidence.ts";
import type { SeoGeoInternalLink, SeoGeoPageDraft } from "./seoGeoTypes.ts";

const coreLinksEn = {
  digital: {
    href: "/en/digital-restaurant-menu",
    label: "Digital restaurant menu"
  },
  qr: {
    href: "/en/qr-code-restaurant-menu",
    label: "QR code restaurant menu"
  },
  pdf: { href: "/en/pdf-vs-digital-menu", label: "PDF vs digital menu" },
  pricing: {
    href: "/en/pricing-digital-restaurant-menu",
    label: "Vistaire pricing"
  },
  sampleMenu: { href: "/en/vistaire-menu", label: "View the sample menu" },
  meeting: { href: "/en/book-a-call", label: "Talk about your menu" }
} as const;

const defaultIncludedEn = [
  {
    title: "Personalized QR displays",
    text: "Up to 20 physical QR displays from your chosen collection, giving guests access to the menu from their table."
  },
  {
    title: "Custom mobile menu",
    text: "A menu that reflects your restaurant, available in French and English through the browser, with no app to install."
  },
  {
    title: "Dish pages",
    text: "Prices, descriptions, photos and allergen information supplied by your restaurant, gathered around each dish."
  },
  {
    title: "On-site dish photography",
    text: "Vistaire photographs dishes at your restaurant during setup so the menu presents your own food."
  },
  {
    title: "Up to 5 dishes in 3D",
    text: "Dishes selected with you for 3D viewing, with augmented reality available where the dish and device support it."
  },
  {
    title: "Guided setup and support",
    text: "Vistaire handles preparation and launch with you. Hosting and maintenance are included in the service."
  }
] as const;

function links(...links: SeoGeoInternalLink[]): SeoGeoInternalLink[] {
  return links;
}

function faqEn(
  firstQuestion: string,
  firstAnswer: string,
  secondQuestion: string,
  secondAnswer: string
) {
  return [
    { question: firstQuestion, answer: firstAnswer },
    { question: secondQuestion, answer: secondAnswer },
    {
      question: "Does the guest need to install an app?",
      answer:
        "No. Vistaire opens in the mobile browser after a QR scan, so the guest can read the menu without downloading anything."
    },
    {
      question: "Is augmented reality available for every dish?",
      answer:
        "AR is available for selected dishes and depends on the device and browser. Guests can still read the photos, prices and descriptions when AR is unavailable."
    },
    {
      question: "Can the restaurant keep a printed menu?",
      answer:
        "Yes. Vistaire can complement a printed menu or become the main QR-scanned experience depending on the service style."
    }
  ];
}

const SEO_GEO_PAGE_DRAFTS_EN: SeoGeoPageDraft[] = [
  {
    locale: "en",
    slug: "qr-menu-without-pdf",
    path: "/en/qr-menu-without-pdf",
    type: "aeo",
    cluster: "QR menu without PDF",
    commercialIntent: "very-high",
    priority: "P0",
    sitemapPriority: 0.81,
    queries: [
      "QR menu without PDF",
      "restaurant QR code menu not PDF",
      "mobile QR menu for restaurants"
    ],
    metadataTitle: "QR menu without PDF for restaurants | Vistaire",
    metadataDescription:
      "Create a restaurant QR menu without a PDF: premium mobile menu, dish pages, prices, allergens, photos and selective 3D/AR.",
    h1: "A QR menu without the PDF friction.",
    eyebrow: "QR without PDF",
    directAnswer:
      "A QR menu without PDF opens a real mobile menu instead of a file guests have to pinch and zoom. Vistaire connects the QR code to a premium experience with readable categories, dish pages, prices, allergens, photos and selective 3D/AR when it adds real value during service.",
    context: {
      heading: "Why avoid a PDF behind the QR code?",
      body: [
        "The QR code solves access, but not reading quality. If the guest lands on a PDF, they still have to zoom, scan the file and recover the right section at the table.",
        "A dedicated mobile menu lets the restaurant present the cuisine in a more natural rhythm: categories, short dish pages, useful visuals and key details in the same place."
      ],
      points: [
        "less zoom and friction on the phone",
        "a menu that stays readable in dining room light",
        "signature dishes presented better than on a fixed page"
      ]
    },
    productProof: {
      heading: "What the guest sees after the scan",
      body:
        "The scan opens a Vistaire menu, not a document. Guests can browse categories, open dish pages, read allergens, compare prices and discover available immersive content without leaving the browser.",
      points: ["personalized QR displays", "mobile menu", "dish pages", "dish photos"]
    },
    comparison: {
      heading: "QR to PDF or QR to Vistaire?",
      basicLabel: "QR to PDF",
      vistaireLabel: "QR to Vistaire",
      rows: [
        {
          label: "Reading",
          basic: "A fixed page that often requires zooming.",
          vistaire: "A menu structured for the phone screen."
        },
        {
          label: "Image",
          basic: "The file can feel practical but rarely premium.",
          vistaire: "The experience extends the restaurant atmosphere and dishes."
        },
        {
          label: "Updates",
          basic: "Every change means republishing a file.",
          vistaire: "The menu can evolve around dishes, photos and useful details."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
      alt: "Vistaire dish page opened from a QR menu without PDF"
    },
    faq: faqEn(
      "Can a QR code open a menu without a PDF?",
      "Yes. A QR code can open a dedicated mobile menu with categories, dish pages, prices and allergens.",
      "Is it better than a QR code that opens a PDF?",
      "For table-side reading, yes. The mobile experience is clearer and can preserve a premium restaurant image."
    ),
    service: {
      name: "Vistaire QR menu without PDF",
      serviceType: "Premium QR menu without PDF for restaurants",
      description:
        "Mobile restaurant menu opened by QR code with dish pages, visuals, allergens and selective immersion."
    },
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(coreLinksEn.qr, coreLinksEn.digital, coreLinksEn.pdf, coreLinksEn.pricing)
  },
  {
    locale: "en",
    slug: "digital-menu-without-app",
    path: "/en/digital-menu-without-app",
    type: "aeo",
    cluster: "Digital menu without app",
    commercialIntent: "high",
    priority: "P0",
    sitemapPriority: 0.79,
    queries: [
      "digital menu without app",
      "restaurant menu no app download",
      "browser based restaurant menu"
    ],
    metadataTitle: "Digital menu without app download | Vistaire",
    metadataDescription:
      "Vistaire creates a browser-based restaurant digital menu with no app install: QR access, dish pages, allergens and selective 3D/AR.",
    h1: "A digital menu without asking guests to download an app.",
    eyebrow: "No app download",
    directAnswer:
      "A restaurant digital menu can work without any app download when the QR code opens a fast browser experience. Vistaire keeps the journey simple for guests: scan, browse categories, open dish pages, read prices and allergens, then use selective 3D/AR only when the dish benefits from it.",
    context: {
      heading: "Why avoid an app download at the table?",
      body: [
        "A guest sitting down to eat rarely wants to install software, create an account or accept extra prompts before reading the menu.",
        "The menu should open quickly in the browser, keep the restaurant brand visible and let the service continue naturally."
      ],
      points: [
        "no store download",
        "no guest account required",
        "a mobile menu that stays focused on the meal"
      ]
    },
    productProof: {
      heading: "A menu that opens in the browser",
      body:
        "Guests scan the code, browse the menu and open dish details in the browser. They can find the information they need and return to the conversation at the table without installing an app.",
      points: ["browser-based", "fast scan", "dish details", "no app install"]
    },
    comparison: {
      heading: "App menu or browser menu?",
      basicLabel: "App flow",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Access",
          basic: "The guest may face install and permission prompts.",
          vistaire: "The menu opens directly in the browser."
        },
        {
          label: "Service",
          basic: "The digital step can interrupt the table rhythm.",
          vistaire: "The menu stays quick and discreet."
        },
        {
          label: "Brand",
          basic: "The app layer can feel generic.",
          vistaire: "The mobile page keeps the restaurant image central."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
      alt: "Browser-based Vistaire menu opened without app download"
    },
    faq: faqEn(
      "Can guests use Vistaire without an app?",
      "Yes. Vistaire opens in the mobile browser after a QR scan.",
      "Does a no-app menu still feel premium?",
      "Yes. A custom design, photographs of your own dishes and clear mobile reading can carry your restaurant’s identity without an app download."
    ),
    service: {
      name: "Vistaire no-app digital menu",
      serviceType: "Browser-based digital menu for restaurants",
      description:
        "Mobile digital restaurant menu that opens without app installation, with dish pages and selective immersion."
    },
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(coreLinksEn.digital, coreLinksEn.qr, coreLinksEn.pricing)
  },
  {
    locale: "en",
    slug: "replace-restaurant-pdf-menu",
    path: "/en/replace-restaurant-pdf-menu",
    type: "aeo",
    cluster: "Replace restaurant PDF menu",
    commercialIntent: "very-high",
    priority: "P0",
    sitemapPriority: 0.83,
    queries: [
      "replace restaurant PDF menu",
      "turn PDF menu into digital menu",
      "restaurant PDF menu replacement"
    ],
    metadataTitle: "Replace a restaurant PDF menu | Vistaire",
    metadataDescription:
      "Replace a restaurant PDF menu with a premium mobile menu: QR code, dish pages, photos, allergens, prices and selective 3D/AR.",
    h1: "Replace a restaurant PDF with a real mobile menu.",
    eyebrow: "Replace PDF",
    directAnswer:
      "Replacing a restaurant PDF menu means moving from a static file to a mobile experience built for the table. Vistaire structures the menu into readable categories, visual dish pages, prices, allergens and selective 3D/AR, so the QR code opens something clearer and more premium than a document.",
    context: {
      heading: "Where the PDF starts to fail",
      body: [
        "A PDF is easy to send and print, but it usually reproduces a paper layout on a small phone screen.",
        "When the restaurant wants a premium table-side experience, the menu needs hierarchy, visuals and concise information around each dish."
      ],
      points: [
        "less pinch-and-zoom reading",
        "dish pages instead of dense pages",
        "updates that are not tied to one file"
      ]
    },
    productProof: {
      heading: "From static document to mobile experience",
      body:
        "Vistaire starts with your existing menu, organizes the categories and prepares the dish pages. On-site photography, custom QR displays and your approval of the layouts are part of the guided setup.",
      points: ["PDF replacement", "mobile hierarchy", "photos", "allergens"]
    },
    comparison: {
      heading: "PDF menu or Vistaire menu?",
      basicLabel: "PDF menu",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Mobile",
          basic: "A file the guest has to zoom and search.",
          vistaire: "A menu designed for the screen in hand."
        },
        {
          label: "Dishes",
          basic: "Descriptions are locked into a static layout.",
          vistaire: "Each important dish can receive a visual page."
        },
        {
          label: "Premium feel",
          basic: "The file can feel detached from the room.",
          vistaire: "The experience matches the restaurant atmosphere."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "Premium dish page replacing a restaurant PDF menu"
    },
    faq: faqEn(
      "Can Vistaire replace a restaurant PDF menu?",
      "Yes. Vistaire can turn the QR experience into a structured mobile menu instead of a PDF file.",
      "Do we need to abandon the PDF immediately?",
      "No. Some restaurants keep a PDF as an archive while making the mobile menu the guest-facing experience."
    ),
    service: {
      name: "Vistaire PDF menu replacement",
      serviceType: "Premium mobile replacement for restaurant PDF menus",
      description:
        "Restaurant PDF menu replacement with QR access, dish pages, visuals, allergens and selective immersion."
    },
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(coreLinksEn.pdf, coreLinksEn.digital, coreLinksEn.qr, coreLinksEn.pricing)
  },
  {
    locale: "en",
    slug: "restaurant-pdf-menu-alternative",
    path: "/en/restaurant-pdf-menu-alternative",
    type: "aeo",
    cluster: "Restaurant PDF menu alternative",
    commercialIntent: "high",
    priority: "P0",
    sitemapPriority: 0.8,
    queries: [
      "restaurant PDF menu alternative",
      "alternative to PDF menu",
      "premium digital menu alternative"
    ],
    metadataTitle: "Restaurant PDF menu alternative | Vistaire",
    metadataDescription:
      "Vistaire is a premium restaurant PDF menu alternative with mobile reading, dish pages, prices, allergens, photos and selective 3D/AR.",
    h1: "A premium alternative to the restaurant PDF menu.",
    eyebrow: "PDF alternative",
    directAnswer:
      "Vistaire is a guided alternative to a restaurant PDF menu. We create a custom mobile menu with readable categories, dish pages, photos, prices and allergen information, then pair it with physical QR displays. Guests browse the menu in their phone’s browser, while your team approves the presentation before launch.",
    context: {
      heading: "What makes a real PDF alternative?",
      body: [
        "The alternative has to improve the guest's reading experience, not simply change the file format.",
        "For premium restaurants, it should also protect the tone of the room, the food photography and the way signature dishes are introduced."
      ],
      points: [
        "categories designed for phone screens",
        "dish pages with useful details",
        "visual presentation that feels restaurant-led"
      ]
    },
    productProof: {
      heading: "A dedicated menu experience",
      body:
        "Vistaire replaces the PDF moment with a browsable menu that gives each dish the right amount of context, image and information without turning the meal into software.",
      points: ["comfortable mobile reading", "visual dish pages", "allergens", "custom design"]
    },
    comparison: {
      heading: "PDF file or dedicated menu experience?",
      basicLabel: "PDF alternative",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Structure",
          basic: "A list or file still drives the experience.",
          vistaire: "Categories and dish pages shape the reading path."
        },
        {
          label: "Visuals",
          basic: "Images are limited or disconnected.",
          vistaire: "Photos of your food accompany the dish details."
        },
        {
          label: "Tone",
          basic: "The interface can feel generic.",
          vistaire: "The presentation stays warm and restaurant-focused."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/tartare-saumon-label-rouge.png",
      alt: "Restaurant PDF menu alternative with visual dish pages"
    },
    faq: faqEn(
      "What is a good alternative to a restaurant PDF menu?",
      "A good alternative is a mobile menu designed for phone reading, dish discovery and table-side decisions.",
      "Is a QR code alone enough?",
      "No. The QR code is only the entry point; the mobile experience behind it determines the quality."
    ),
    service: {
      name: "Vistaire restaurant PDF alternative",
      serviceType: "Premium alternative to PDF menus for restaurants",
      description:
        "Mobile menu alternative to restaurant PDF files with dish pages, visuals and useful table-side information."
    },
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(coreLinksEn.pdf, coreLinksEn.digital, coreLinksEn.pricing)
  },
  {
    locale: "en",
    slug: "digital-dish-page-restaurant",
    path: "/en/digital-dish-page-restaurant",
    type: "aeo",
    cluster: "Digital dish page",
    commercialIntent: "high",
    priority: "P0",
    sitemapPriority: 0.78,
    queries: [
      "digital dish page restaurant",
      "restaurant menu dish page",
      "visual dish page menu"
    ],
    metadataTitle: "Digital dish pages for restaurants | Vistaire",
    metadataDescription:
      "Create digital dish pages for restaurants with photos, short descriptions, prices, allergens, options and selective 3D/AR.",
    h1: "Digital dish pages that make the menu easier to choose from.",
    eyebrow: "Dish pages",
    directAnswer:
      "A digital dish page gives one restaurant item its own clear mobile presentation: name, price, concise description, photo, allergens, options and sometimes selective 3D/AR. Vistaire uses dish pages for plates that deserve more context, so guests can understand the food without reading a dense menu file.",
    context: {
      heading: "Why dish pages matter",
      body: [
        "A line on a menu cannot always explain a signature dish, a visual dessert or an item with important allergens.",
        "A mobile dish page gives the restaurant more control over what the guest sees before deciding."
      ],
      points: [
        "photo and story near the price",
        "allergens and options close to the dish",
        "selective 3D/AR only when useful"
      ]
    },
    productProof: {
      heading: "A focused page for the dish",
      body:
        "Vistaire gives important dishes a concise mobile page with the right hierarchy: image first, name and price, short description, useful details and optional immersive content.",
      points: ["photo", "price", "allergens", "selective 3D"]
    },
    comparison: {
      heading: "Menu line or digital dish page?",
      basicLabel: "Menu line",
      vistaireLabel: "Vistaire dish page",
      rows: [
        {
          label: "Understanding",
          basic: "The guest reads a name and short line.",
          vistaire: "The guest sees context, image and details."
        },
        {
          label: "Allergens",
          basic: "Important details may be far from the item.",
          vistaire: "Sensitive information is near the dish."
        },
        {
          label: "Desire",
          basic: "The dish may feel abstract.",
          vistaire: "The page helps the guest picture the plate."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "Digital dish page for a signature restaurant plate"
    },
    faq: faqEn(
      "What should a digital dish page include?",
      "It should include name, price, concise description, image, allergens and options when relevant.",
      "Does every dish need its own detailed page?",
      "No. Vistaire focuses richer pages on dishes that benefit from more context or visual presentation."
    ),
    service: {
      name: "Vistaire digital dish pages",
      serviceType: "Digital dish pages for restaurant menus",
      description:
        "Visual dish pages with photos, prices, allergens and selective 3D/AR for premium restaurant menus."
    },
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(coreLinksEn.digital, coreLinksEn.qr, coreLinksEn.pricing)
  },
  {
    locale: "en",
    slug: "restaurant-menu-photos",
    path: "/en/restaurant-menu-photos",
    type: "aeo",
    cluster: "Restaurant menu photos",
    commercialIntent: "medium",
    priority: "P1",
    sitemapPriority: 0.76,
    queries: [
      "restaurant menu with photos",
      "digital menu photos restaurant",
      "food photos in restaurant menu"
    ],
    metadataTitle: "Restaurant menu with photos | Vistaire",
    metadataDescription:
      "Use restaurant menu photos in a premium digital menu with visual dish pages, prices, descriptions, allergens and selective 3D/AR.",
    h1: "Restaurant menu photos that support the dish, not the clutter.",
    eyebrow: "Menu photos",
    directAnswer:
      "Restaurant menu photos help guests picture a dish before choosing. Vistaire photographs the food at your restaurant during setup and presents the images alongside prices, descriptions and allergen information. The custom mobile menu keeps the focus on your cuisine, with clear categories and dish details that are easy to browse at the table.",
    context: {
      heading: "How to use photos without cheapening the menu",
      body: [
        "Photos can make dishes more desirable, but too many uneven images can make a premium menu feel busy.",
        "Vistaire uses visuals where they help: signatures, dishes with texture, desserts, cocktails and items that need more explanation."
      ],
      points: [
        "photographs of your own dishes",
        "photos inside dish pages",
        "photos and details accessible without 3D"
      ]
    },
    productProof: {
      heading: "Photos placed inside a premium menu",
      body:
        "On-site dish photography is part of the Vistaire setup. We prepare the selection with you and use the photos to present the food you serve. Existing restaurant photos can also be reviewed together and used to complement the menu.",
      points: ["on-site photography", "your own dishes", "signature dishes", "custom presentation"]
    },
    comparison: {
      heading: "Photo-heavy menu or curated visual menu?",
      basicLabel: "Photo-heavy",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Visual rhythm",
          basic: "Many images compete for attention.",
          vistaire: "Images support selected dishes."
        },
        {
          label: "Quality",
          basic: "Uneven photos can weaken the brand.",
          vistaire: "Photos are reviewed with you for a consistent presentation."
        },
        {
          label: "Reading",
          basic: "The menu can become harder to scan.",
          vistaire: "Text and visuals keep a clear hierarchy."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/risotto-cepes-parmesan.png",
      alt: "Restaurant menu photo used in a Vistaire dish page"
    },
    faq: faqEn(
      "Should a restaurant digital menu include photos?",
      "Often yes, when photos are good and used to support dish choice rather than fill space.",
      "Who takes the photos for the menu?",
      "Vistaire photographs the dishes on site as part of setup. We prepare the selection with you and review the images before the menu goes live."
    ),
    service: {
      name: "Vistaire menu photos",
      serviceType: "Restaurant digital menu with photos",
      description:
        "On-site dish photography and a custom mobile menu with dish pages, prices, descriptions and allergen information."
    },
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(coreLinksEn.digital, { href: "/en/digital-dish-page-restaurant", label: "Dish pages" }, coreLinksEn.pricing)
  },
  {
    locale: "en",
    slug: "restaurant-menu-allergens",
    path: "/en/restaurant-menu-allergens",
    type: "aeo",
    cluster: "Restaurant menu allergens",
    commercialIntent: "medium",
    priority: "P1",
    sitemapPriority: 0.76,
    queries: [
      "restaurant menu allergens",
      "digital menu allergen information",
      "restaurant allergen menu QR"
    ],
    metadataTitle: "Restaurant menu allergens | Vistaire",
    metadataDescription:
      "Keep allergen information close to each dish in a custom restaurant menu, alongside photos, prices and descriptions validated by your team.",
    h1: "Restaurant allergen information inside the dish page.",
    eyebrow: "Allergens",
    directAnswer:
      "Restaurant menu allergens should be visible near the dish, but they should not replace the dining room team's guidance. Vistaire places allergen and option information inside mobile dish pages, alongside photos, prices and short descriptions, so guests can understand the menu while staff remain responsible for confirmation.",
    context: {
      heading: "Why allergens belong close to the dish",
      body: [
        "When allergen notes are far from the item, guests have to search and staff must repeat basic information more often.",
        "A digital dish page can show useful details in context while still making room for conversation with the team."
      ],
      points: [
        "allergens near the item",
        "restaurant-validated information",
        "not a replacement for hospitality"
      ]
    },
    productProof: {
      heading: "Information supplied and reviewed by your restaurant",
      body:
        "Vistaire prepares the dish pages using the composition and allergen information your restaurant supplies. Your team validates the content and reports recipe changes so the menu can be updated. Guests should confirm sensitive dietary needs with staff.",
      points: ["allergens", "dish options", "restaurant validation", "clear presentation"]
    },
    comparison: {
      heading: "Static allergen notes or dish-level information?",
      basicLabel: "Static notes",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Context",
          basic: "Information may be separate from the dish.",
          vistaire: "Details sit inside the dish page."
        },
        {
          label: "Clarity",
          basic: "Guests must search for the right note.",
          vistaire: "The page keeps useful signals together."
        },
        {
          label: "Responsibility",
          basic: "The menu may look like the only source.",
          vistaire: "Copy can remind guests to confirm with staff."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
      alt: "Digital menu dish page with restaurant allergen details"
    },
    faq: faqEn(
      "Can a digital menu show allergens?",
      "Yes. It can show allergen and option information near each dish when the restaurant provides reliable content.",
      "Does this replace staff confirmation?",
      "No. Vistaire can display useful information, but guests should still confirm sensitive dietary needs with staff."
    ),
    service: {
      name: "Vistaire allergen menu pages",
      serviceType: "Digital restaurant menu with allergen information",
      description:
        "Dish-level allergen and option information inside a premium mobile menu for restaurants."
    },
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links({ href: "/en/digital-dish-page-restaurant", label: "Dish pages" }, coreLinksEn.digital, coreLinksEn.pricing)
  },
  {
    locale: "en",
    slug: "digital-restaurant-menu-montreal",
    path: "/en/digital-restaurant-menu-montreal",
    type: "local",
    cluster: "Digital restaurant menu Montreal",
    commercialIntent: "very-high",
    priority: "P0",
    sitemapPriority: 0.82,
    queries: [
      "digital restaurant menu Montreal",
      "QR menu Montreal restaurant",
      "premium menu Montreal restaurant"
    ],
    metadataTitle: "Digital restaurant menu Montreal | Vistaire",
    metadataDescription:
      "Vistaire creates custom digital menus for Montreal restaurants with French and English content, on-site dish photography, physical QR displays and guided setup.",
    h1: "A premium digital menu for Montreal restaurants.",
    eyebrow: "Montreal",
    directAnswer:
      "Vistaire helps Montreal restaurants create a premium digital menu with a guided setup. French and English content, photographs of your food and personalized QR displays carry your restaurant’s identity from the table to the phone. Guests browse in their browser without an app download, with 3D viewing available for selected dishes.",
    context: {
      heading: "Welcome regulars and visitors to your cuisine",
      body: [
        "For your independent restaurant, bistro or fine dining room in Montreal, the menu is part of the welcome. Clear French and English descriptions, readable prices and photographs of your dishes help guests explore the food comfortably.",
        "Vistaire prepares that presentation with you. We work from your existing menu, photograph dishes on site and create layouts for the mobile menu and physical QR displays. Your restaurant approves the layouts before final production."
      ],
      points: [
        "French and English content for your menu",
        "signature dishes with photos and useful details",
        "physical QR displays chosen for your dining room"
      ]
    },
    productProof: {
      heading: "A guided launch, from photographs to the live menu",
      body:
        "We prepare the content and layouts, then finalize the menu and produce the QR displays after your approval. Hosting and maintenance are included. Explore the Maison Élyse, Trouvable and Sauge Noire demonstrations to see different menu styles before discussing your own project.",
      points: ["on-site photography", "layout approval", "personalized displays", "guided launch"]
    },
    comparison: {
      heading: "A PDF menu or a menu designed for phones?",
      basicLabel: "PDF menu",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Language",
          basic: "Multiple languages can make the document dense.",
          vistaire: "Guests choose French or English and browse the categories."
        },
        {
          label: "Signature dishes",
          basic: "The layout limits space for photos and details.",
          vistaire: "Each dish page brings together a photo, price, description and declared allergens."
        },
        {
          label: "Setup",
          basic: "Your team prepares and republishes the document.",
          vistaire: "Vistaire prepares the photography, menu and QR displays with you."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
      alt: "Signature dish shown in a Vistaire demonstration menu"
    },
    faq: [
      {
        question: "Is Vistaire available for Montreal restaurants?",
        answer:
          "Yes. Vistaire creates personalized digital menus and physical QR displays for Montreal restaurants. An initial conversation helps define your menu, your dining room and the setup process."
      },
      {
        question: "Do we have to build the menu ourselves?",
        answer:
          "Setup is guided. Vistaire photographs dishes on site and prepares the menu content and layouts for both the digital menu and QR displays. Your restaurant supplies the current menu and approves the key elements before final production."
      },
      {
        question: "Can the menu be in French and English?",
        answer:
          "Yes. We prepare the content with you so dish names, descriptions, prices and useful information stay consistent in both languages. Guests choose the language when browsing the menu."
      },
      {
        question: "Is Vistaire suitable for fine dining in Montreal?",
        answer:
          "Yes. Photographs of your creations, concise dish descriptions and personalized displays support a careful presentation while keeping your dining-room team at the centre of service."
      },
      {
        question: "Is 3D or augmented reality available for every dish?",
        answer:
          "The offer includes up to five 3D dishes selected with you. AR availability depends on the dish, device and browser. Guests can still consult photos and menu information when AR is unavailable."
      },
      {
        question: "How much does a Vistaire menu cost?",
        answer:
          "Setup starts at $2,000 CAD depending on the QR display collection, followed by a $200 CAD monthly subscription, plus taxes. The initial commitment is 12 months and setup is payable before the project begins. The pricing page lists collections, options and terms."
      }
    ],
    service: {
      name: "Vistaire digital menu Montreal",
      serviceType: "Premium digital restaurant menu in Montreal",
      description:
        "Guided creation of personalized digital menus for Montreal restaurants with French and English content, on-site dish photography and physical QR displays."
    },
    areaServed: ["Montreal", "Quebec", "Canada"],
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(
      { href: "/en/digital-restaurant-menu-laval", label: "Digital menus in Laval" },
      { href: "/en/digital-restaurant-menu-brossard", label: "Digital menus in Brossard" },
      coreLinksEn.digital,
      coreLinksEn.pricing
    )
  },
  {
    locale: "en",
    slug: "digital-restaurant-menu-laval",
    path: "/en/digital-restaurant-menu-laval",
    type: "local",
    cluster: "Digital restaurant menu Laval",
    commercialIntent: "high",
    priority: "P1",
    sitemapPriority: 0.74,
    queries: [
      "digital restaurant menu Laval",
      "QR menu Laval restaurant",
      "restaurant digital menu Laval"
    ],
    metadataTitle: "Digital restaurant menu Laval | Vistaire",
    metadataDescription:
      "Replace your Laval restaurant’s PDF with a custom mobile menu, on-site dish photography and premium physical QR displays, prepared with Vistaire.",
    h1: "A premium digital menu for Laval restaurants.",
    eyebrow: "Laval",
    directAnswer:
      "Vistaire turns your Laval restaurant’s existing menu into a custom mobile experience accessed by QR code. We prepare the photos, dish pages and physical displays with your team. Whether you welcome families, groups or regulars, guests can browse the categories, read prices and find useful dish details on their own phones.",
    context: {
      heading: "Move from a PDF to a menu guests can browse comfortably",
      body: [
        "If your restaurant in Laval already uses a PDF, we start with that menu to organize categories, dishes and descriptions for the phone. Guests can browse at their own pace and open the details they want without searching through a document they have to zoom.",
        "For family meals or group tables, photographs and dish details give guests practical reference points. Allergen information supplied by your restaurant stays close to the dish, while staff confirm sensitive dietary needs."
      ],
      points: [
        "your current menu as the starting point",
        "clear categories and readable prices",
        "photos and information gathered around each dish"
      ]
    },
    productProof: {
      heading: "Prepare the transition with your team",
      body:
        "Vistaire photographs dishes on site and prepares layouts for your approval before production. QR displays are personalized within your chosen collection. Your menu can be offered in French and English, and you can keep a printed menu to suit your service style.",
      points: ["existing menu", "on-site photos", "layout approval", "bilingual menu"]
    },
    comparison: {
      heading: "Generic QR or premium mobile menu?",
      basicLabel: "Generic QR",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Experience",
          basic: "The scan opens a file or generic list.",
          vistaire: "The scan opens a branded mobile menu."
        },
        {
          label: "Dish context",
          basic: "Important details can be hidden.",
          vistaire: "The dish page gathers image, price and details."
        },
        {
          label: "Preparation",
          basic: "Your team designs and maintains the QR destination.",
          vistaire: "Vistaire prepares the menu, photography and displays with your team."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/canette-rotie-figues-epices.png",
      alt: "Roast duck dish shown in a Vistaire demonstration menu"
    },
    faq: [
      {
        question: "Is Vistaire available for Laval restaurants?",
        answer:
          "Yes. We discuss your current menu, displays and content needs with you before defining the setup for your restaurant in Laval."
      },
      {
        question: "Can guests at a group table browse independently?",
        answer:
          "Each guest can open the menu on their phone, browse the categories and view photos or dish details. No guest account or app download is required."
      },
      {
        question: "Can we keep our PDF or printed menu?",
        answer:
          "Yes. Keep your PDF for archiving or printing if useful. The QR code opens the Vistaire mobile menu, and a printed menu can remain available to suit your service."
      },
      {
        question: "Who takes the photographs and creates the menu?",
        answer:
          "Vistaire photographs dishes on site and prepares the presentation from your current menu. You approve the layouts and information before final production and launch."
      },
      {
        question: "Which QR displays are included?",
        answer:
          "The offer includes up to twenty personalized displays from the Acrylique, Sculpté, Carré or Signature collection you choose. Additional or replacement displays are quoted according to the collection and your needs."
      },
      {
        question: "How do we prepare menu changes?",
        answer:
          "Send Vistaire your changes to dishes, prices or recipes so the update can be prepared with validated information. The optional Pilotage service, at an additional $100 CAD per month, lets you manage dish availability from the dashboard and view menu activity."
      },
      {
        question: "Where can we find pricing for our Laval restaurant?",
        answer:
          "The pricing page lists the collections and terms. Setup starts at $2,000 CAD depending on the display chosen, with a $200 CAD monthly subscription, plus taxes, and an initial 12-month commitment."
      }
    ],
    service: {
      name: "Vistaire digital menu Laval",
      serviceType: "Premium digital restaurant menu in Laval",
      description:
        "Guided creation of a custom mobile menu for Laval restaurants from their existing menu, with on-site photography, dish pages and personalized physical QR displays."
    },
    areaServed: ["Laval", "North Shore", "Quebec", "Canada"],
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(
      { href: "/en/digital-restaurant-menu-montreal", label: "Digital menus in Montreal" },
      { href: "/en/digital-restaurant-menu-brossard", label: "Digital menus in Brossard" },
      coreLinksEn.qr,
      coreLinksEn.pricing
    )
  },
  {
    locale: "en",
    slug: "digital-restaurant-menu-brossard",
    path: "/en/digital-restaurant-menu-brossard",
    type: "local",
    cluster: "Digital restaurant menu Brossard",
    commercialIntent: "high",
    priority: "P1",
    sitemapPriority: 0.74,
    queries: [
      "digital restaurant menu Brossard",
      "QR menu Brossard restaurant",
      "restaurant digital menu Brossard"
    ],
    metadataTitle: "Digital restaurant menu Brossard | Vistaire",
    metadataDescription:
      "Showcase your Brossard restaurant’s food with Vistaire: a bilingual mobile menu, on-site photography, personalized QR displays and up to five 3D dishes.",
    h1: "A premium digital menu for Brossard restaurants.",
    eyebrow: "Brossard",
    directAnswer:
      "Vistaire creates premium digital menus for restaurants in Brossard and on the South Shore. Your cuisine is presented in a French and English mobile menu with on-site dish photography, clear dish pages and personalized QR displays. Up to five dishes can be shown in 3D, with augmented reality available according to the dish and device.",
    context: {
      heading: "Introduce your signature dishes before guests choose",
      body: [
        "For your restaurant in Brossard, a house specialty or carefully plated dish can be introduced with a photograph and a clear description. The dish page brings those together with the price and allergen information supplied by your restaurant.",
        "We select the dishes to photograph and those suited to 3D presentation with you. Guests choose French or English and explore the details that interest them. Photographs and menu information remain accessible without augmented reality."
      ],
      points: [
        "your specialties photographed and explained",
        "French and English menu content",
        "3D viewing for a selection of dishes"
      ]
    },
    productProof: {
      heading: "From the table display to the dish details",
      body:
        "Choose from Acrylique, Sculpté, Carré and Signature displays to bring the QR code into your table setting. Vistaire prepares layouts for the displays and the menu for your approval. The Maison Élyse, Trouvable and Sauge Noire demonstrations let you explore menu styles and dish pages before defining your project.",
      points: ["four collections", "personalized displays", "dish photography", "interactive examples"]
    },
    comparison: {
      heading: "Brossard QR PDF or Vistaire menu?",
      basicLabel: "QR PDF",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Reading",
          basic: "The guest has to zoom and search.",
          vistaire: "The menu is designed for mobile reading."
        },
        {
          label: "Presentation",
          basic: "The support can feel utilitarian.",
          vistaire: "The menu keeps a premium restaurant tone."
        },
        {
          label: "Details",
          basic: "Allergens and options may be hard to find.",
          vistaire: "Dish pages keep details near the item."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/tartare-saumon-label-rouge.png",
      alt: "Salmon tartare shown in a Vistaire demonstration menu"
    },
    faq: [
      {
        question: "Is Vistaire available for Brossard restaurants?",
        answer:
          "Yes. Vistaire serves restaurants in Brossard and on the South Shore. The first conversation defines your menu, displays and dishes to present before setup begins."
      },
      {
        question: "Can Vistaire replace the PDF behind our QR code?",
        answer:
          "Yes. We use your menu information to create a menu designed for phones. The QR code opens it in the browser without an app download."
      },
      {
        question: "Can we highlight our signature dishes?",
        answer:
          "Yes. On-site photographs and dish pages introduce your specialties with descriptions, prices and useful information. Selected dishes can also be prepared for 3D viewing."
      },
      {
        question: "Can the menu be in French and English?",
        answer:
          "Yes. Vistaire prepares the content with you. Your restaurant approves dish names, descriptions and key details in both languages before launch."
      },
      {
        question: "What are the limits of augmented reality?",
        answer:
          "AR depends on the dish model, device and browser. It complements the photos and menu information. Up to five 3D dishes can be included, and additional productions are charged separately."
      },
      {
        question: "How much does the service cost in Brossard?",
        answer:
          "Setup starts at $2,000 CAD depending on the collection, followed by $200 CAD per month, plus taxes, with an initial 12-month commitment. The offer includes up to twenty personalized QR displays. The pricing page lists collections, options and terms."
      },
      {
        question: "How long does launch take?",
        answer:
          "Complete setup generally takes around two weeks after the menu and display layouts are approved and the required materials are received. Timing can vary with project complexity and production."
      }
    ],
    service: {
      name: "Vistaire digital menu Brossard",
      serviceType: "Premium digital restaurant menu in Brossard",
      description:
        "Guided creation of French and English mobile menus for Brossard restaurants with on-site photography, personalized QR displays and selected 3D dishes."
    },
    areaServed: ["Brossard", "South Shore", "Montérégie", "Quebec", "Canada"],
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(
      { href: "/en/digital-restaurant-menu-montreal", label: "Digital menus in Montreal" },
      { href: "/en/digital-restaurant-menu-laval", label: "Digital menus in Laval" },
      coreLinksEn.pdf,
      coreLinksEn.pricing
    )
  },
  {
    locale: "en",
    slug: "high-end-restaurant-digital-menu",
    path: "/en/high-end-restaurant-digital-menu",
    type: "vertical",
    cluster: "High-end restaurant digital menu",
    commercialIntent: "very-high",
    priority: "P0",
    sitemapPriority: 0.82,
    queries: [
      "high-end restaurant digital menu",
      "premium digital menu for restaurants",
      "luxury restaurant QR menu"
    ],
    metadataTitle: "High-end restaurant digital menu | Vistaire",
    metadataDescription:
      "Vistaire creates high-end restaurant digital menus with premium mobile design, dish pages, photos, allergens and selective 3D/AR.",
    h1: "A digital menu for high-end restaurants.",
    eyebrow: "High-end",
    directAnswer:
      "A digital menu for a high-end restaurant should carry the same care as the dining room. Vistaire creates a custom mobile menu with photographs of your dishes, concise descriptions, prices and allergen information. Physical QR displays suit the table setting, and selected dishes can be explored in 3D where it adds useful context.",
    context: {
      heading: "Digital should not flatten a premium restaurant",
      body: [
        "High-end restaurants need digital tools that respect service, lighting, pace and brand image.",
        "Vistaire keeps the menu calm and visual, with technology supporting the food instead of taking over the experience."
      ],
      points: [
        "custom mobile menu",
        "photographs of your cuisine",
        "selective immersive moments"
      ]
    },
    productProof: {
      heading: "Designed around the room and the dish",
      body:
        "Vistaire prepares the photographs, the mobile menu and personalized QR displays with you. You approve the layouts before final production. Hosting and maintenance are included, and the service begins when the menu is activated.",
      points: ["guided setup", "on-site photography", "QR displays", "custom design"]
    },
    comparison: {
      heading: "Standard digital menu or high-end Vistaire menu?",
      basicLabel: "Standard",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Tone",
          basic: "The interface can feel generic.",
          vistaire: "The design supports the restaurant identity."
        },
        {
          label: "Dishes",
          basic: "Food can become a list item.",
          vistaire: "Dish pages make signatures more desirable."
        },
        {
          label: "Technology",
          basic: "Features can feel like gimmicks.",
          vistaire: "3D/AR stays selective and intentional."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "High-end restaurant digital menu with premium dish presentation"
    },
    faq: faqEn(
      "Is a digital menu suitable for high-end restaurants?",
      "Yes, when the design stays calm, visual and faithful to the restaurant instead of feeling like a generic tool.",
      "Should every dish have 3D or AR?",
      "No. Vistaire keeps immersion selective for dishes where it adds clarity or desire."
    ),
    service: {
      name: "Vistaire high-end digital menu",
      serviceType: "Digital menu for high-end restaurants",
      description:
        "Premium digital menu for high-end restaurants with dish pages, visuals, allergens and selective immersion."
    },
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(coreLinksEn.digital, { href: "/en/fine-dining-restaurant-digital-menu", label: "Fine dining" }, coreLinksEn.pricing)
  },
  {
    locale: "en",
    slug: "fine-dining-restaurant-digital-menu",
    path: "/en/fine-dining-restaurant-digital-menu",
    type: "vertical",
    cluster: "Fine dining restaurant digital menu",
    commercialIntent: "high",
    priority: "P1",
    sitemapPriority: 0.78,
    queries: [
      "fine dining digital menu",
      "gastronomic restaurant digital menu",
      "premium menu fine dining restaurant"
    ],
    metadataTitle: "Fine dining restaurant digital menu | Vistaire",
    metadataDescription:
      "Vistaire creates fine dining digital menus with calm mobile design, dish pages, photos, prices, allergens and selective 3D/AR.",
    h1: "A digital menu for fine dining restaurants.",
    eyebrow: "Fine dining",
    directAnswer:
      "A fine dining restaurant digital menu should preserve the precision of service and the way dishes are introduced. Vistaire creates a calm mobile menu with concise dish pages, readable prices, allergens, photos and selective 3D/AR for creations that genuinely benefit from volume or visual context.",
    context: {
      heading: "Preserving the rhythm of fine dining",
      body: [
        "Fine dining menus often need fewer words but more precision. Digital should clarify choices without turning the table into an advertising screen.",
        "Vistaire reserves richer pages for dishes that deserve explanation, visual support or validated immersion."
      ],
      points: [
        "signature dishes highlighted carefully",
        "short controlled descriptions",
        "sensitive information near the dish"
      ]
    },
    productProof: {
      heading: "A culinary experience first",
      body:
        "Sections, dish pages and visuals keep a calm hierarchy. 3D/AR is optional and used only when volume, texture or plating gesture adds real understanding.",
      points: ["signature", "restraint", "readable price", "compatible AR"]
    },
    comparison: {
      heading: "Fine dining paper menu, PDF or Vistaire?",
      basicLabel: "Paper/PDF",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Precision",
          basic: "Details may live in notes or separate explanations.",
          vistaire: "The dish page gathers useful information around the plate."
        },
        {
          label: "Visual",
          basic: "The photo is absent or isolated.",
          vistaire: "The visual supports the dish without becoming decoration."
        },
        {
          label: "Innovation",
          basic: "The support remains static.",
          vistaire: "3D/AR can enrich selected creations while photos and descriptions remain available."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
      alt: "Fine dining digital menu with a premium dessert dish page"
    },
    faq: faqEn(
      "Should a fine dining restaurant use a digital menu?",
      "It can, if the digital experience extends the room and clarifies dishes without making the service feel less personal.",
      "Can fine dining keep a paper menu?",
      "Yes. Vistaire can complement a paper menu or become the main guest-facing mobile experience."
    ),
    service: {
      name: "Vistaire fine dining digital menu",
      serviceType: "Digital menu for fine dining restaurants",
      description:
        "Calm, visual digital menu for fine dining restaurants with dish pages and selective immersion."
    },
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links({ href: "/en/high-end-restaurant-digital-menu", label: "High-end restaurants" }, { href: "/en/digital-dish-page-restaurant", label: "Dish pages" }, coreLinksEn.digital, coreLinksEn.pricing)
  }
];

export const SEO_GEO_PAGES_EN = withEditorialQueryEvidence(SEO_GEO_PAGE_DRAFTS_EN);
