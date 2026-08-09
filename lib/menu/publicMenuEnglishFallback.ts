import { getAllDishes, getCategories } from "@/lib/demoMenuData";
import type { PublicMenu, PublicMenuDish } from "@/lib/menu/publicMenuCore";

const MAISON_LIVE_TO_DEMO_SLUG = Object.freeze({
  "risotto-aux-cepes-parmesan-reggiano": "risotto-cepe",
  "homard-bleu-bisque-corsee-fenouil": "homard-bisque",
  "souffle-tiede-au-chocolat-grand-cru": "souffle-chocolat",
  "tartare-de-saumon-label-rouge": "tartare-saumon",
  "tarte-citron-confit-basilic-pourpre": "tarte-citron-basilic",
  "negroni-vieilli-en-fut": "negroni-fut",
  "canette-rotie-aux-figues-epices-douces": "canette-aux-figues",
  "bar-de-ligne-artichaut-poivrade-emulsion-citron-beldi": "bar-ligne",
  "pave-de-b-uf-mature-puree-ratte-jus-bordelaise": "pave-boeuf",
  "elixir-bergamote-the-earl-grey": "mocktail-bergamote",
  "maison-elyse-n-1": "cocktail-maison-elyse",
  "ravioles-de-chevre-frais-miel-de-monteregie": "ravioles-romarin"
});

const MAISON_CANONICAL_FRENCH_NAMES = new Map(
  getAllDishes("fr").map((dish) => [dish.slug, dish.name] as const)
);

function maisonDemoSlug(dishSlug: string): string {
  return (
    MAISON_LIVE_TO_DEMO_SLUG[
      dishSlug as keyof typeof MAISON_LIVE_TO_DEMO_SLUG
    ] ?? dishSlug
  );
}

const MAISON_NAME_CONNECTORS = new Set([
  "a",
  "au",
  "aux",
  "d",
  "de",
  "des",
  "du",
  "et",
  "l",
  "la",
  "le",
  "les"
]);

function canonicalNameTokens(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !MAISON_NAME_CONNECTORS.has(token));
}

function sourceNameMatchesStableSlug(dish: PublicMenuDish): boolean {
  const nameTokens = canonicalNameTokens(dish.name);
  const slugTokens = canonicalNameTokens(dish.slug);
  return (
    nameTokens.length > 0 &&
    nameTokens.length === slugTokens.length &&
    nameTokens.every((token, index) => token === slugTokens[index])
  );
}

function canonicalMaisonEnglishName(
  dish: PublicMenuDish,
  demoSlug: string,
  englishName: string
): string {
  const canonicalFrenchName = MAISON_CANONICAL_FRENCH_NAMES.get(demoSlug);
  return canonicalFrenchName &&
    (dish.name === canonicalFrenchName || sourceNameMatchesStableSlug(dish))
    ? englishName
    : dish.name;
}

type EnglishCategoryPresentation = {
  name: string;
  description?: string;
};

const ENGLISH_CATEGORY_PRESENTATIONS: Readonly<
  Record<string, EnglishCategoryPresentation>
> = Object.freeze({
  // Trouvable source and translated labels.
  "classiques-reinventes": { name: "Reinvented Classics" },
  "reinvented-classics": { name: "Reinvented Classics" },
  "ouverture-de-table": { name: "Table Openers" },
  "table-openers": { name: "Table Openers" },
  "feu-assiettes-maison": { name: "Fire & House Plates" },
  "fire-house-plates": { name: "Fire & House Plates" },
  "voyage-a-l-assiette": { name: "Around the World" },
  "around-the-world": { name: "Around the World" },
  "forno-pasta": { name: "Forno & Pasta" },
  "matin-dore": { name: "Golden Morning" },
  "golden-morning": { name: "Golden Morning" },
  "derniere-note": { name: "Final Note" },
  "final-note": { name: "Final Note" },
  "fraicheur-maison": { name: "House Refreshments" },
  "house-refreshments": { name: "House Refreshments" },
  "verres-bulles": { name: "Glasses & Bubbles" },
  "glasses-bubbles": { name: "Glasses & Bubbles" },
  // Sauge Noire source and canonical English labels.
  "premiers-gestes": {
    name: "First bites",
    description: "Small plates, bites, and opening seasonal flavors to share."
  },
  "first-bites": {
    name: "First bites",
    description: "Small plates, bites, and opening seasonal flavors to share."
  },
  "cru-frais": {
    name: "Raw & fresh",
    description: "Seafood, raw preparations, and bright fresh compositions."
  },
  "raw-fresh": {
    name: "Raw & fresh",
    description: "Seafood, raw preparations, and bright fresh compositions."
  },
  "du-feu": {
    name: "From the fire",
    description: "Meat, fish, and vegetables cooked over embers or flame."
  },
  "from-the-fire": {
    name: "From the fire",
    description: "Meat, fish, and vegetables cooked over embers or flame."
  },
  "terre-grains": {
    name: "Earth & grains",
    description: "Generous grains, vegetables, pasta, and plant-forward plates."
  },
  "earth-grains": {
    name: "Earth & grains",
    description: "Generous grains, vegetables, pasta, and plant-forward plates."
  },
  "a-cote-desserts": {
    name: "Sides & desserts",
    description: "House accompaniments and sweet creations."
  },
  "sides-desserts": {
    name: "Sides & desserts",
    description: "House accompaniments and sweet creations."
  },
  "cocktails-signatures": {
    name: "Signature cocktails",
    description: "Original cocktails inspired by sage, fire, and the seasons."
  },
  "signature-cocktails": {
    name: "Signature cocktails",
    description: "Original cocktails inspired by sage, fire, and the seasons."
  },
  "sans-alcool": {
    name: "Alcohol-free",
    description: "Fresh, layered creations without alcohol."
  },
  "alcohol-free": {
    name: "Alcohol-free",
    description: "Fresh, layered creations without alcohol."
  }
});

function canonicalEnglishCategoryForDish(
  dish: PublicMenuDish,
  menuSlug: string
): EnglishCategoryPresentation | undefined {
  if (menuSlug !== "trouvable" && menuSlug !== "sauge-noire") return undefined;
  const keys = [dish.categorySlug, dish.category]
    .filter(Boolean)
    .map((value) => normalizeMenuKey(value ?? ""));
  return keys.map((key) => ENGLISH_CATEGORY_PRESENTATIONS[key]).find(Boolean);
}

/**
 * Completes legacy English menu rows whose translation status is trusted by
 * the public compatibility path but whose translated category labels were not
 * persisted. Dish names intentionally remain the source/menu names; only the
 * surrounding editorial content is localized.
 */
export function applyCanonicalEnglishPresentation(menu: PublicMenu): PublicMenu {
  const menuSlug = menu.slug.toLowerCase();
  if (menuSlug !== "trouvable" && menuSlug !== "sauge-noire") return menu;

  let changed = false;
  const dishes = menu.dishes.map((dish) => {
    const category = canonicalEnglishCategoryForDish(dish, menuSlug);
    if (!category) return dish;

    const nextDish = {
      ...dish,
      ...(category
        ? {
            category: category.name,
            ...(category.description
              ? { categoryDescription: category.description }
              : {})
          }
        : {})
    };
    if (
      nextDish.category !== dish.category ||
      nextDish.categoryDescription !== dish.categoryDescription
    ) {
      changed = true;
    }
    return nextDish;
  });

  return changed ? { ...menu, dishes } : menu;
}

function normalizeMenuKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function categoryForDish(
  dish: PublicMenuDish,
  demoCategorySlug: string,
  categories: ReturnType<typeof getCategories>
) {
  const liveKeys = [dish.categorySlug, dish.category]
    .filter(Boolean)
    .map((value) => normalizeMenuKey(value ?? "").replace(/^cat-/, ""));

  return (
    categories.find((category) => liveKeys.includes(normalizeMenuKey(category.slug))) ??
    categories.find((category) => liveKeys.includes(normalizeMenuKey(category.name))) ??
    categories.find((category) => category.slug === demoCategorySlug)
  );
}

function translatedMaisonDish(
  dish: PublicMenuDish,
  demoDishes: ReturnType<typeof getAllDishes>,
  categories: ReturnType<typeof getCategories>
): PublicMenuDish {
  const demoSlug = maisonDemoSlug(dish.slug);
  const demoDish = demoDishes.find((candidate) => candidate.slug === demoSlug);
  if (!demoDish) return dish;

  const category = categoryForDish(dish, demoDish.categorySlug, categories);
  const tags = [
    dish.isSignature ? "Signature" : "",
    dish.isRecommended ? "Recommended" : "",
    dish.available ? "" : "Unavailable"
  ].filter(Boolean);

  return {
    ...dish,
    name: canonicalMaisonEnglishName(dish, demoSlug, demoDish.name),
    description: demoDish.description,
    ...(category
      ? {
          category: category.name,
          categoryDescription: category.description,
          categorySlug: category.slug
        }
      : {}),
    ingredients: demoDish.ingredients,
    allergens: demoDish.allergens,
    options: demoDish.options,
    houseNote: demoDish.chefRecommendation,
    tags
  };
}

/**
 * Maison's stored translation schema treats dish names as identity, but the
 * restaurant's canonical bilingual menu already provides verified English
 * display names. Project only those display names here so owner-managed
 * descriptions, prices, media, availability, IDs and slugs remain authoritative.
 */
export function applyMaisonEnglishDishNames(menu: PublicMenu): PublicMenu {
  if (menu.slug.toLowerCase() !== "maison-elyse" || menu.activeLocale !== "en-CA") {
    return menu;
  }

  const englishNames = new Map(
    getAllDishes("en").map((dish) => [dish.slug, dish.name] as const)
  );
  let changed = false;
  const dishes = menu.dishes.map((dish) => {
    const demoSlug = maisonDemoSlug(dish.slug);
    const name = englishNames.get(demoSlug);
    if (!name) return dish;
    const translatedName = canonicalMaisonEnglishName(dish, demoSlug, name);
    if (translatedName === dish.name) return dish;
    changed = true;
    return { ...dish, name: translatedName };
  });

  return changed ? { ...menu, dishes } : menu;
}

/**
 * Compatibility data for the live Maison Élyse menu while its owner-managed
 * English translation rows are being backfilled. The live IDs, prices,
 * photos, availability and immersive assets remain authoritative.
 */
export function buildMaisonEnglishPublicMenu(menu: PublicMenu): PublicMenu {
  const demoDishes = getAllDishes("en");
  const categories = getCategories("en");
  const dishes = menu.dishes.map((dish) =>
    translatedMaisonDish(dish, demoDishes, categories)
  );
  const supportedLocales = Array.from(
    new Set([...menu.settings.supportedLocales, "fr-CA", "en-CA"])
  ) as typeof menu.settings.supportedLocales;
  const translationLocales = [
    ...(menu.translationLocales ?? []).filter(
      (status) => status.locale !== "en-CA"
    ),
    { locale: "en-CA", status: "up_to_date" as const }
  ];

  return {
    ...menu,
    menuName: "Main Menu",
    settings: {
      ...menu.settings,
      supportedLocales,
      defaultLocale: menu.settings.defaultLocale
    },
    activeLocale: "en-CA",
    translationLocales,
    translationStatus: { locale: "en-CA", status: "up_to_date" },
    dishes
  };
}
