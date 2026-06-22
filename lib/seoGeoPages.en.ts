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
    title: "QR code",
    text: "A simple table access point that opens the menu without forcing guests to install an app."
  },
  {
    title: "Mobile menu",
    text: "Categories, prices and descriptions designed for quick reading on a phone during service."
  },
  {
    title: "Dish pages",
    text: "Short pages for dishes that need a photo, concise story, allergens, options or pairing details."
  },
  {
    title: "Photos and fallback",
    text: "Validated visuals with a clean presentation even when a 3D asset is not available."
  },
  {
    title: "Allergens",
    text: "Useful information placed near the dish, while keeping the dining room team central."
  },
  {
    title: "Selective 3D/AR",
    text: "An immersive layer only for compatible dishes where volume helps the guest understand the plate."
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
      question: "Does Vistaire load 3D or AR immediately?",
      answer:
        "No. 3D and AR stay selective and open only after the guest shows intent on a compatible dish page."
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
      points: ["print-ready QR", "mobile menu", "dish pages", "photo fallback"]
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
        "Vistaire is designed as a mobile-first web experience. The guest scans the code, opens the menu, reads the dish page and moves back to the table conversation without app friction.",
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
      "Yes, if the page is designed for mobile reading, food-first visuals and a calm restaurant experience."
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
        "Vistaire keeps the useful menu content and rebuilds the presentation around the guest's phone: categories, dish pages, photo fallback and selective immersive moments.",
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
      "A restaurant PDF menu alternative should do more than open a file through a QR code. Vistaire creates a mobile-first menu experience with clear categories, dish pages, readable prices, allergens, food visuals and selective 3D/AR, while keeping the restaurant atmosphere more central than a generic utility interface.",
    context: {
      heading: "What makes a real PDF alternative?",
      body: [
        "The alternative has to improve the guest's reading experience, not simply change the file format.",
        "For premium restaurants, it should also protect the tone of the room, the food photography and the way signature dishes are introduced."
      ],
      points: [
        "mobile-first structure",
        "dish pages with useful details",
        "visual presentation that feels restaurant-led"
      ]
    },
    productProof: {
      heading: "A dedicated menu experience",
      body:
        "Vistaire replaces the PDF moment with a browsable menu that gives each dish the right amount of context, image and information without turning the meal into software.",
      points: ["mobile-first", "visual dish pages", "allergens", "premium tone"]
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
          vistaire: "Food-first visuals support the dish."
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
      "A restaurant menu with photos works best when visuals are used intentionally, not as decoration on every line. Vistaire places food photos inside a mobile hierarchy with dish pages, prices, allergens and short descriptions, so the image supports the guest's choice while the menu still feels calm and premium.",
    context: {
      heading: "How to use photos without cheapening the menu",
      body: [
        "Photos can make dishes more desirable, but too many uneven images can make a premium menu feel busy.",
        "Vistaire uses visuals where they help: signatures, dishes with texture, desserts, cocktails and items that need more explanation."
      ],
      points: [
        "food-first visuals",
        "photos inside dish pages",
        "fallback when 3D is not validated"
      ]
    },
    productProof: {
      heading: "Photos placed inside a premium menu",
      body:
        "Vistaire treats photos as part of the menu system: they support the dish page, sit near useful details and keep the rest of the menu readable.",
      points: ["dish photography", "mobile layout", "premium restraint", "fallback"]
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
          vistaire: "Photos are integrated with fallback logic."
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
      "Do all dishes need photos?",
      "No. A curated set of strong visuals is usually better than forcing every dish into the same treatment."
    ),
    service: {
      name: "Vistaire menu photos",
      serviceType: "Restaurant digital menu with photos",
      description:
        "Premium digital menu using food photos, dish pages and fallback logic for restaurant presentation."
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
      "Present restaurant menu allergens in a premium digital menu with dish pages, clear information, prices, photos and staff-friendly caveats.",
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
        "clear caveat for staff confirmation",
        "not a replacement for hospitality"
      ]
    },
    productProof: {
      heading: "Useful information without overpromising",
      body:
        "Vistaire can display allergen and option information in a clean mobile hierarchy, while avoiding medical or legal claims the menu cannot guarantee alone.",
      points: ["allergens", "options", "staff caveat", "clear hierarchy"]
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
      "Vistaire creates premium digital restaurant menus in Montreal with QR access, dish pages, photos, allergens and selective 3D/AR.",
    h1: "A premium digital menu for Montreal restaurants.",
    eyebrow: "Montreal",
    directAnswer:
      "A digital restaurant menu in Montreal should match the dining room as much as it improves mobile reading. Vistaire serves Montreal restaurants with QR access, premium mobile structure, dish pages, photos, allergens and selective 3D/AR, without claiming a physical office, reviews or local awards that have not been verified.",
    context: {
      heading: "Why Montreal restaurants need more than a PDF",
      body: [
        "Montreal guests often discover menus on their phones before or during service. A static PDF can feel weaker than the room itself.",
        "Vistaire keeps the experience mobile-first while preserving the warm, food-led tone expected from premium restaurants."
      ],
      points: [
        "service area: Montreal, Quebec and Canada",
        "no false local office claim",
        "built for premium mobile reading"
      ]
    },
    productProof: {
      heading: "A mobile menu aligned with the room",
      body:
        "Vistaire helps Montreal restaurants replace PDF or basic QR menus with a calmer, more visual experience built around dishes, prices and useful information.",
      points: ["Montreal", "QR menu", "dish pages", "selective 3D"]
    },
    comparison: {
      heading: "Basic QR menu or Vistaire in Montreal?",
      basicLabel: "Basic QR",
      vistaireLabel: "Vistaire",
      rows: [
        {
          label: "Mobile reading",
          basic: "The guest may open a generic list or PDF.",
          vistaire: "The menu is structured for the table."
        },
        {
          label: "Food image",
          basic: "Dishes can feel secondary.",
          vistaire: "Dish pages make the cuisine visible."
        },
        {
          label: "Local claim",
          basic: "Copy may overstate presence.",
          vistaire: "The page states service area without invented proof."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
      alt: "Digital restaurant menu for a premium Montreal dining room"
    },
    faq: faqEn(
      "Is Vistaire available for Montreal restaurants?",
      "Yes. Vistaire serves restaurants in Montreal, Quebec and Canada.",
      "Does Vistaire claim local reviews or awards?",
      "No. The page avoids unverified local claims, reviews, awards or client references."
    ),
    service: {
      name: "Vistaire digital menu Montreal",
      serviceType: "Premium digital restaurant menu in Montreal",
      description:
        "QR-accessible premium mobile menu for Montreal restaurants with dish pages and selective immersion."
    },
    areaServed: ["Montreal", "Quebec", "Canada"],
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links(coreLinksEn.digital, coreLinksEn.qr, coreLinksEn.pricing)
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
      "Premium digital restaurant menu for Laval restaurants: QR access, mobile dish pages, photos, allergens and selective 3D/AR.",
    h1: "A premium digital menu for Laval restaurants.",
    eyebrow: "Laval",
    directAnswer:
      "A digital restaurant menu for Laval should make QR access feel premium instead of basic. Vistaire supports restaurants in Laval, Quebec and Canada with mobile-first categories, dish pages, readable prices, allergens, photos and selective 3D/AR, while avoiding unsupported claims about offices, reviews or local clients.",
    context: {
      heading: "A better QR menu for Laval dining rooms",
      body: [
        "A QR code can feel practical, but the page that opens determines whether the experience feels premium.",
        "Vistaire focuses on readable mobile structure, food-led visuals and useful dish information that respects the rhythm of service."
      ],
      points: [
        "service area language",
        "no invented local proof",
        "premium mobile presentation"
      ]
    },
    productProof: {
      heading: "From QR access to a real menu",
      body:
        "Vistaire gives Laval restaurants a mobile menu that feels closer to the dining room than to a generic PDF or list.",
      points: ["Laval", "mobile QR menu", "dish pages", "photos"]
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
          label: "Local accuracy",
          basic: "Claims can become vague or inflated.",
          vistaire: "The page stays precise about service area."
        }
      ]
    },
    included: [...defaultIncludedEn],
    visualImage: {
      src: "/images/demo/dishes/canette-rotie-figues-epices.png",
      alt: "Digital restaurant menu for a premium Laval restaurant"
    },
    faq: faqEn(
      "Is Vistaire available for Laval restaurants?",
      "Yes. Vistaire supports Laval restaurants as part of its Quebec and Canada service area.",
      "Can Laval restaurants keep a printed menu?",
      "Yes. Vistaire can complement printed menus or replace the guest-facing PDF QR experience."
    ),
    service: {
      name: "Vistaire digital menu Laval",
      serviceType: "Premium digital restaurant menu in Laval",
      description:
        "Mobile QR menu for Laval restaurants with dish pages, visuals, allergens and selective immersion."
    },
    areaServed: ["Laval", "Quebec", "Canada"],
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links({ href: "/en/digital-restaurant-menu-montreal", label: "Montreal" }, coreLinksEn.digital, coreLinksEn.pricing)
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
      "Premium digital restaurant menu for Brossard restaurants with QR access, dish pages, photos, allergens and selective 3D/AR.",
    h1: "A premium digital menu for Brossard restaurants.",
    eyebrow: "Brossard",
    directAnswer:
      "A digital restaurant menu for Brossard can turn a QR code into a premium mobile experience instead of a static PDF. Vistaire supports Brossard restaurants with readable categories, visual dish pages, prices, allergens, photos and selective 3D/AR, using service-area language without inventing local proof.",
    context: {
      heading: "A more polished QR experience for Brossard",
      body: [
        "The South Shore dining context still demands a menu that feels aligned with the room, not a generic file after the scan.",
        "Vistaire keeps the mobile experience clear, visual and restrained so the guest can choose without friction."
      ],
      points: [
        "Brossard service area",
        "mobile-first QR menu",
        "no fabricated local claims"
      ]
    },
    productProof: {
      heading: "A QR menu that protects the restaurant image",
      body:
        "Vistaire helps Brossard restaurants move from basic QR access to a menu experience centered on dishes, images and useful information.",
      points: ["Brossard", "QR access", "dish pages", "premium mobile"]
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
      alt: "Digital restaurant menu for a Brossard restaurant"
    },
    faq: faqEn(
      "Is Vistaire available for Brossard restaurants?",
      "Yes. Vistaire supports Brossard restaurants within its Quebec and Canada service area.",
      "Does the page claim a Brossard office?",
      "No. It uses honest service-area language and avoids unsupported local office claims."
    ),
    service: {
      name: "Vistaire digital menu Brossard",
      serviceType: "Premium digital restaurant menu in Brossard",
      description:
        "Mobile QR menu for Brossard restaurants with dish pages, visuals, allergens and selective immersion."
    },
    areaServed: ["Brossard", "Quebec", "Canada"],
    primaryCta: coreLinksEn.meeting,
    secondaryCta: coreLinksEn.sampleMenu,
    relatedLinks: links({ href: "/en/digital-restaurant-menu-montreal", label: "Montreal" }, coreLinksEn.digital, coreLinksEn.pricing)
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
      "A high-end restaurant digital menu should feel like an extension of the dining room, not a cold utility screen. Vistaire uses warm dark surfaces, food-first visuals, clear dish pages, readable prices, allergens and selective 3D/AR to keep the menu premium while making mobile reading easier.",
    context: {
      heading: "Digital should not flatten a premium restaurant",
      body: [
        "High-end restaurants need digital tools that respect service, lighting, pace and brand image.",
        "Vistaire keeps the menu calm and visual, with technology supporting the food instead of taking over the experience."
      ],
      points: [
        "premium mobile structure",
        "food-first visual hierarchy",
        "selective immersive moments"
      ]
    },
    productProof: {
      heading: "Designed around the room and the dish",
      body:
        "Vistaire presents a premium menu with restrained motion, warm dark surfaces, dish pages and selective 3D/AR only where it helps.",
      points: ["premium design", "dish pages", "selective AR", "restaurant tone"]
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
          vistaire: "3D/AR can enrich a few creations with fallback."
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
