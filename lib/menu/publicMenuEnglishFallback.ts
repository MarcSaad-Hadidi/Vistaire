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

const TROUVABLE_ENGLISH_DISH_NAMES = Object.freeze({
  "poulet-maison-sur-riz-parfume": "House Chicken with Fragrant Rice",
  "orange-pressee-soleil": "Sun-Pressed Orange",
  "rouge-selection-maison": "House Red Selection",
  "rosee-maison": "House Rosé",
  "crepes-nuage-aux-fruits": "Cloud Crepes with Fresh Fruit",
  "pesto-burrata-verde": "Green Pesto Burrata",
  "bol-fraicheur-verger": "Orchard Fruit Bowl",
  "dejeuner-du-marche": "Market Breakfast",
  "smoothie-fraise-banane": "Strawberry-Banana Smoothie",
  "smoked-meat-saint-laurent": "Smoked Meat Saint-Laurent",
  "ailes-bbq-caramelisees": "Caramelized BBQ Wings",
  "pepperoni-classico": "Pepperoni Classico",
  "saumon-des-saisons": "Seasonal Salmon",
  "fish-chips-du-quai": "Quayside Fish & Chips",
  "cesar-grillee-au-poulet": "Grilled Chicken Caesar",
  "steak-frites-au-feu": "Fire-Grilled Steak Frites",
  "plateau-sushi-horizon": "Horizon Sushi Platter",
  "lasagne-gratina": "Gratina Lasagna",
  "burrata-prosciutto-royale": "Burrata Prosciutto Royale",
  "carbonara-romaine": "Roman Carbonara",
  "poutine-du-vieux-montreal": "Old Montreal Poutine",
  "mac-cremeux-trois-fromages": "Creamy Three-Cheese Mac",
  "bol-teriyaki-tokyo": "Tokyo Teriyaki Bowl",
  "margherita-basilico": "Basilico Margherita",
  "tiramisu-milano": "Tiramisu Milano",
  "quesadilla-fondante": "Melty Quesadilla",
  "spritz-riviera": "Spritz Riviera",
  "tacos-de-b-uf-el-fuego": "El Fuego Beef Tacos",
  "alfredo-velours": "Velvet Alfredo",
  "fondant-chocolat-noir": "Dark Chocolate Fondant",
  "ipa-boreale": "Boreal IPA",
  "nachos-dores-du-comptoir": "Golden Counter Nachos",
  "panna-cotta-vanille-coulis": "Vanilla Panna Cotta & Coulis",
  "coupe-elegance": "Elegance Coupe",
  "chocolat-chaud-velours": "Velvet Hot Chocolate",
  "burger-signature-maison": "House Signature Burger"
});

const SAUGE_ENGLISH_DISH_NAMES = Object.freeze({
  "pain-de-seigle-chaud": "Warm rye bread",
  "betterave-sous-la-cendre": "Beetroot under ash",
  "croquette-de-canard-confit": "Duck confit croquette",
  "chou-pointu-braise": "Braised pointed cabbage",
  "huitres-tiedes-au-kombu": "Warm kombu oysters",
  "truite-des-laurentides": "Laurentian trout",
  "hamachi-a-la-verveine": "Hamachi with verbena",
  "boeuf-cru-au-couteau": "Hand-cut raw beef",
  "crabe-des-neiges": "Snow crab",
  "canard-a-l-erable-noir": "Black maple duck",
  "fletan-roti-au-nori": "Roasted halibut with nori",
  "cote-de-porc-du-quebec": "Quebec pork chop",
  "agneau-grille-au-sumac": "Grilled lamb with sumac",
  "poulet-de-grain-au-citron-confit": "Grain-fed chicken with preserved lemon",
  "courge-au-charbon": "Charcoal-roasted squash",
  "orge-perle-des-sous-bois": "Woodland pearl barley",
  "gnocchi-de-panais": "Parsnip gnocchi",
  "polenta-blanche-fumee": "Smoked white polenta",
  "epeautre-cremeux": "Creamy spelt",
  "pommes-de-terre-pressees": "Pressed potatoes",
  "haricots-verts-a-la-flamme": "Flame-seared green beans",
  "salade-d-herbes-fraiches": "Fresh herb salad",
  "chocolat-fume": "Smoked chocolate",
  "pomme-au-poivre-long": "Long pepper apple",
  "parfait-de-mais": "Corn parfait",
  "agrumes-au-basilic-thai": "Citrus with Thai basil",
  "fromages-du-quebec": "Quebec cheeses",
  "sauge-75": "Sage 75",
  ecorce: "Bark",
  "cendre-rose": "Pink ash",
  lisiere: "Woodland edge",
  "nuit-d-ambre": "Amber night",
  "verger-froid": "Cold orchard",
  "jardin-salin": "Salt garden",
  "the-des-bois": "Wintergreen tea",
  "citron-brule": "Charred lemon"
});

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
 * the public compatibility path but whose canonical names were not persisted.
 * All operational dish fields stay sourced from the live public menu.
 */
export function applyCanonicalEnglishPresentation(menu: PublicMenu): PublicMenu {
  const menuSlug = menu.slug.toLowerCase();
  const dishNames =
    menuSlug === "trouvable"
      ? TROUVABLE_ENGLISH_DISH_NAMES
      : menuSlug === "sauge-noire"
        ? SAUGE_ENGLISH_DISH_NAMES
        : null;
  if (!dishNames) return menu;

  let changed = false;
  const dishes = menu.dishes.map((dish) => {
    const name = dishNames[dish.slug as keyof typeof dishNames];
    const category = canonicalEnglishCategoryForDish(dish, menuSlug);
    if (!name && !category) return dish;

    const nextDish = {
      ...dish,
      ...(name && name !== dish.name ? { name } : {}),
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
      nextDish.name !== dish.name ||
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
  const demoSlug =
    MAISON_LIVE_TO_DEMO_SLUG[
      dish.slug as keyof typeof MAISON_LIVE_TO_DEMO_SLUG
    ];
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
    name: demoDish.name,
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
  const matchedDishes = dishes.filter(
    (dish, index) => dish.name !== menu.dishes[index]?.name
  ).length;

  if (matchedDishes === 0) return menu;

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
