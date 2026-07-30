import type { Locale } from "@/lib/i18n";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import {
  buildPdfComparePreviewData,
  type PdfComparePreviewData
} from "@/lib/pdfComparePreviewData";

export type LandingExperienceId =
  | "maison-elyse"
  | "trouvable"
  | "sauge-noire";

export type LandingExperience = {
  id: LandingExperienceId;
  name: "Maison Élyse" | "Trouvable" | "Sauge Noire";
  label: string;
  href: string;
  image: string;
  imageAlt: string;
  imagePosition: string;
  preview: PdfComparePreviewData;
};

type ManualPreviewCopy = {
  theme: Exclude<LandingExperienceId, "maison-elyse">;
  restaurantName: string;
  tagline: string;
  location: string;
  title: string;
  eyebrow: string;
  description: string;
  featuredKicker: string;
  featuredTitle: string;
  cta: string;
  image: string;
  categoryNames: readonly [string, string, string];
  categoryDescriptions: readonly [string, string, string];
  dishes: readonly [
    { name: string; price: string; description: string; image?: string },
    { name: string; price: string; description: string; image?: string },
    { name: string; price: string; description: string; image?: string }
  ];
};

function buildManualPreview(copy: ManualPreviewCopy): PdfComparePreviewData {
  const categoryCards = copy.categoryNames.map((name, index) => ({
    id: `${copy.theme}-category-${index}`,
    slug: `${copy.theme}-category-${index}`,
    name,
    description: copy.categoryDescriptions[index],
    image: copy.image,
    imageAlt: "",
    imageObjectPosition: ["center 28%", "center 50%", "center 72%"][index] ?? "center"
  }));

  const vistaireDishes = copy.dishes.map((dish, index) => ({
    slug: `${copy.theme}-dish-${index}`,
    name: dish.name,
    price: dish.price,
    shortDescription: dish.description,
    image: dish.image ?? null,
    imageAlt: "",
    imageObjectPosition: "center",
    allergens: [],
    isSignature: index === 0,
    isRecommended: index === 0,
    has3d: false,
    isAvailable: true
  }));

  return {
    restaurant: {
      name: copy.restaurantName,
      tagline: copy.tagline,
      location: copy.location,
      logoMonogram: copy.restaurantName
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2),
      currency: "CAD"
    },
    pdfSections: copy.categoryNames.map((name, index) => ({
      title: name,
      rows: [
        {
          name: copy.dishes[index].name,
          price: copy.dishes[index].price.replace("$", " $")
        }
      ]
    })),
    categoryTabs: [
      { id: `${copy.theme}-all`, slug: "all", name: "All" },
      ...categoryCards.map(({ id, slug, name }) => ({ id, slug, name }))
    ],
    categoryCards,
    activeCategorySlug: categoryCards[0]?.slug ?? "all",
    vistaireDishes,
    featuredDish: vistaireDishes[0],
    presentation: {
      theme: copy.theme,
      eyebrow: copy.eyebrow,
      title: copy.title,
      tagline: copy.description,
      featuredKicker: copy.featuredKicker,
      featuredTitle: copy.featuredTitle,
      cta: copy.cta
    }
  };
}

function buildMaisonPreview(locale: Locale): PdfComparePreviewData {
  const preview = buildPdfComparePreviewData({ locale });
  return {
    ...preview,
    presentation:
      locale === "en"
        ? {
            theme: "maison-elyse",
            eyebrow: "At-table menu",
            title: "Welcome to Maison Élyse",
            tagline:
              "An editorial menu for discovering the house selection directly at the table.",
            featuredKicker: "Chef’s selection",
            featuredTitle: "Tonight’s highlight",
            cta: "View the full menu"
          }
        : {
            theme: "maison-elyse",
            eyebrow: "Carte à table",
            title: "Bienvenue chez Maison Élyse",
            tagline:
              "Une carte éditoriale pour découvrir la sélection de la maison directement à table.",
            featuredKicker: "Suggestion du chef",
            featuredTitle: "À découvrir ce soir",
            cta: "Voir toute la carte"
          }
  };
}

function buildTrouvablePreview(locale: Locale): PdfComparePreviewData {
  return buildManualPreview(
    locale === "en"
      ? {
          theme: "trouvable",
          restaurantName: "Trouvable",
          tagline: "Premium brunch and evening plates",
          location: "Montreal",
          eyebrow: "Interactive menu",
          title: "A warm, modern bistro",
          description:
            "Browse breakfast, starters and evening plates through a fluid, visual menu.",
          featuredKicker: "House selection",
          featuredTitle: "Made to be explored",
          cta: "View the full menu",
          image: "/images/landing/trouvable-experience.jpg",
          categoryNames: ["Breakfast", "Starters", "Evening plates"],
          categoryDescriptions: [
            "Comforting house classics",
            "Fresh plates to begin",
            "A warm evening selection"
          ],
          dishes: [
            {
              name: "House classic breakfast",
              price: "$18",
              description: "Farm eggs, crisp potatoes and toasted sourdough.",
              image: "/images/demo/dishes/maison-elyse-n1.png"
            },
            {
              name: "Goat cheese ravioli",
              price: "$24",
              description: "Brown butter, preserved lemon and garden herbs.",
              image: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png"
            },
            {
              name: "Porcini risotto",
              price: "$32",
              description: "Carnaroli rice, porcini and aged parmesan.",
              image: "/images/demo/dishes/risotto-cepes-parmesan.png"
            }
          ]
        }
      : {
          theme: "trouvable",
          restaurantName: "Trouvable",
          tagline: "Brunch premium et assiettes du soir",
          location: "Montréal",
          eyebrow: "Carte interactive",
          title: "Un bistro chaleureux et moderne",
          description:
            "Parcourez déjeuners, entrées et assiettes du soir dans une carte fluide et visuelle.",
          featuredKicker: "Sélection de la maison",
          featuredTitle: "Pensée pour être explorée",
          cta: "Voir toute la carte",
          image: "/images/landing/trouvable-experience.jpg",
          categoryNames: ["Déjeuner", "Entrées", "Plats du soir"],
          categoryDescriptions: [
            "Les classiques réconfortants",
            "Des assiettes fraîches pour commencer",
            "Une sélection chaleureuse"
          ],
          dishes: [
            {
              name: "Déjeuner classique maison",
              price: "$18",
              description:
                "Œufs fermiers, pommes de terre et pain au levain.",
              image: "/images/demo/dishes/maison-elyse-n1.png"
            },
            {
              name: "Ravioles chèvre et miel",
              price: "$24",
              description: "Beurre noisette, citron confit et herbes.",
              image: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png"
            },
            {
              name: "Risotto cèpes et parmesan",
              price: "$32",
              description: "Riz carnaroli, cèpes et parmesan affiné.",
              image: "/images/demo/dishes/risotto-cepes-parmesan.png"
            }
          ]
        }
  );
}

function buildSaugePreview(locale: Locale): PdfComparePreviewData {
  return buildManualPreview(
    locale === "en"
      ? {
          theme: "sauge-noire",
          restaurantName: "Sauge Noire",
          tagline: "A dark botanical signature",
          location: "Quebec",
          eyebrow: "Editorial menu",
          title: "A signature reading experience",
          description:
            "Raw materials, botanical detail and a low-light menu designed as a distinct world.",
          featuredKicker: "Signature plate",
          featuredTitle: "From the fire",
          cta: "Open the full experience",
          image: "/images/landing/sauge-noire-experience.jpg",
          categoryNames: ["First gestures", "Raw & fresh", "From the fire"],
          categoryDescriptions: [
            "Small plates to share",
            "Fresh, precise compositions",
            "Flame-worked plates"
          ],
          dishes: [
            {
              name: "Betterave sous la cendre",
              price: "$16",
              description: "Smoked labneh, blackcurrant and pistachio."
            },
            {
              name: "Truite des Laurentides",
              price: "$22",
              description: "Redcurrant, lovage, cucumber and pine oil."
            },
            {
              name: "Canard à l’érable noir",
              price: "$39",
              description: "Fermented carrot, grilled chicory and thyme jus."
            }
          ]
        }
      : {
          theme: "sauge-noire",
          restaurantName: "Sauge Noire",
          tagline: "Une signature botanique et sombre",
          location: "Québec",
          eyebrow: "Carte éditoriale",
          title: "Une lecture signature et immersive",
          description:
            "Matières brutes, détails botaniques et lumière basse composent un univers distinct.",
          featuredKicker: "Plat signature",
          featuredTitle: "Du feu",
          cta: "Ouvrir l’expérience complète",
          image: "/images/landing/sauge-noire-experience.jpg",
          categoryNames: ["Premiers gestes", "Cru & frais", "Du feu"],
          categoryDescriptions: [
            "Petites assiettes à partager",
            "Compositions fraîches et précises",
            "Plats travaillés à la flamme"
          ],
          dishes: [
            {
              name: "Betterave sous la cendre",
              price: "$16",
              description: "Labneh fumé, cassis et pistache."
            },
            {
              name: "Truite des Laurentides",
              price: "$22",
              description: "Groseille, livèche, concombre et huile de pin."
            },
            {
              name: "Canard à l’érable noir",
              price: "$39",
              description: "Carotte fermentée, chicorée grillée et jus au thym."
            }
          ]
        }
  );
}

export function getLandingExperiences(locale: Locale): LandingExperience[] {
  const lang = locale === "en" ? "en-CA" : "fr-CA";

  return [
    {
      id: "maison-elyse",
      name: "Maison Élyse",
      label:
        locale === "en"
          ? "Editorial and gastronomic"
          : "Éditoriale et gastronomique",
      href: locale === "en" ? "/en/vistaire-menu" : "/demo",
      image: "/images/landing/maison-elyse-experience.jpg",
      imageAlt:
        locale === "en"
          ? "Bright, refined dining-room atmosphere"
          : "Ambiance de salle claire et raffinée",
      imagePosition: "center 45%",
      preview: buildMaisonPreview(locale)
    },
    {
      id: "trouvable",
      name: "Trouvable",
      label:
        locale === "en" ? "Modern and interactive" : "Moderne et interactive",
      href: buildPublicMenuPath("trouvable", { lang }),
      image: "/images/landing/trouvable-experience.jpg",
      imageAlt:
        locale === "en"
          ? "Warm bistro and bar atmosphere with plants"
          : "Ambiance de bistro chaleureux avec bar et végétation",
      imagePosition: "center 52%",
      preview: buildTrouvablePreview(locale)
    },
    {
      id: "sauge-noire",
      name: "Sauge Noire",
      label:
        locale === "en"
          ? "Distinctive and immersive"
          : "Signature et immersive",
      href: buildPublicMenuPath("sauge-noire", { lang }),
      image: "/images/landing/sauge-noire-experience.jpg",
      imageAlt:
        locale === "en"
          ? "Dark botanical dining-room atmosphere"
          : "Ambiance de salle sombre et botanique",
      imagePosition: "center 42%",
      preview: buildSaugePreview(locale)
    }
  ];
}
