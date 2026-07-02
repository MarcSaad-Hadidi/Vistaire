import "server-only";

import {
  getBoolean,
  getString,
  readSupabaseRows
} from "@/lib/analytics/serverRows";
import { getDemoRestaurantId } from "@/lib/analytics/insights";
import {
  getAllDishes,
  getCategoryBySlug,
  getRestaurant
} from "@/lib/demoMenuData";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "@/lib/i18n";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import {
  buildRelationalSupabasePublicMenu,
  buildSupabasePublicMenu,
  getPublicMenuRowSlug,
  normalizeGoogleReviewConfig,
  type PublicMenu,
  type PublicMenuRow
} from "@/lib/menu/publicMenuCore";
import {
  DEFAULT_PUBLIC_MENU_SETTINGS,
  serializePublicMenuSettings
} from "@/lib/menu/publicMenuSettings";
import { applyStoredPublicMenuTranslations } from "@/lib/menu/publicMenuTranslations";
import { publicMenuSettingsFromUiConfigRows } from "@/lib/owner/publicMenuSettingsFallback";

export type { PublicMenu, PublicMenuDish } from "@/lib/menu/publicMenuCore";

const DEMO_PUBLIC_MENU_SETTINGS = serializePublicMenuSettings({
  ...DEFAULT_PUBLIC_MENU_SETTINGS,
  supportedLocales: ["fr-CA", "en-CA"],
  publicMenuStyle: "maison-elyse"
});

const TROUVABLE_PUBLIC_MENU_SETTINGS = serializePublicMenuSettings({
  ...DEFAULT_PUBLIC_MENU_SETTINGS,
  supportedLocales: ["fr-CA", "en-CA", "es-ES", "it-IT", "ar"],
  supportedCurrencies: ["CAD", "USD", "EUR"],
  defaultCurrency: "CAD",
  baseCurrency: "CAD",
  publicMenuStyle: "trouvable",
  defaultThemeMode: "dark",
  allowThemeToggle: true,
  allowCurrencySelector: true,
  allowLanguageSelector: true,
  taxIncluded: true
});

const TROUVABLE_DISHES = [
  {
    slug: "dejeuner-classique-maison",
    nameFr: "Dejeuner classique maison",
    nameEn: "House classic breakfast",
    descriptionFr:
      "Oeufs fermiers, pommes de terre croustillantes, salade d'herbes et pain au levain grille.",
    descriptionEn:
      "Farm eggs, crisp potatoes, herb salad, and toasted sourdough.",
    categoryFr: "Dejeuner",
    categoryEn: "Breakfast",
    priceCents: 1800,
    imageUrl: "/images/demo/dishes/maison-elyse-n1.png",
    ingredientsFr: ["Oeufs", "Pommes de terre", "Herbes fraiches", "Pain au levain"],
    ingredientsEn: ["Eggs", "Potatoes", "Fresh herbs", "Sourdough"],
    allergensFr: ["Oeufs", "Gluten"],
    allergensEn: ["Eggs", "Gluten"],
    optionsFr: ["Bacon croustillant +4", "Avocat citronne +5", "Sans gluten sur demande"],
    optionsEn: ["Crisp bacon +4", "Lemon avocado +5", "Gluten-free on request"],
    houseNoteFr: "Le plat signature pour tester le parcours public Trouvable.",
    houseNoteEn: "The signature plate for the Trouvable public flow.",
    tagsFr: ["Signature", "Maison"],
    tagsEn: ["Signature", "House"]
  },
  {
    slug: "ravioles-chevre-miel-monteregie",
    nameFr: "Ravioles chevre et miel de Monteregie",
    nameEn: "Goat cheese and Monteregie honey ravioli",
    descriptionFr:
      "Ravioles fondantes, beurre noisette, citron confit et herbes du jardin.",
    descriptionEn:
      "Silky ravioli, brown butter, preserved lemon, and garden herbs.",
    categoryFr: "Entrees",
    categoryEn: "Starters",
    priceCents: 2400,
    imageUrl: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
    ingredientsFr: ["Chevre", "Miel", "Citron confit", "Herbes"],
    ingredientsEn: ["Goat cheese", "Honey", "Preserved lemon", "Herbs"],
    allergensFr: ["Lait", "Gluten"],
    allergensEn: ["Milk", "Gluten"],
    optionsFr: ["Portion partage +8"],
    optionsEn: ["Sharing portion +8"],
    houseNoteFr: "Servi chaud, ideal pour commencer en douceur.",
    houseNoteEn: "Served warm, a gentle opening plate.",
    tagsFr: ["Vegetarien"],
    tagsEn: ["Vegetarian"]
  },
  {
    slug: "tartare-saumon-label-rouge",
    nameFr: "Tartare de saumon Label Rouge",
    nameEn: "Label Rouge salmon tartare",
    descriptionFr:
      "Saumon coupe minute, pomme verte, aneth, creme sure et chips fines.",
    descriptionEn:
      "Fresh-cut salmon, green apple, dill, sour cream, and thin chips.",
    categoryFr: "Entrees",
    categoryEn: "Starters",
    priceCents: 2600,
    imageUrl: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    ingredientsFr: ["Saumon", "Pomme verte", "Aneth", "Creme sure"],
    ingredientsEn: ["Salmon", "Green apple", "Dill", "Sour cream"],
    allergensFr: ["Poisson", "Lait"],
    allergensEn: ["Fish", "Milk"],
    optionsFr: ["Chips supplementaires +3"],
    optionsEn: ["Extra chips +3"],
    houseNoteFr: "Fraicheur vive, parfait avec un blanc sec.",
    houseNoteEn: "Bright and fresh, ideal with a dry white.",
    tagsFr: ["Frais"],
    tagsEn: ["Fresh"]
  },
  {
    slug: "risotto-cepes-parmesan",
    nameFr: "Risotto cepes et parmesan",
    nameEn: "Porcini and parmesan risotto",
    descriptionFr:
      "Riz carnaroli, cepes, parmesan affine et jus court aux champignons.",
    descriptionEn:
      "Carnaroli rice, porcini, aged parmesan, and mushroom jus.",
    categoryFr: "Plats",
    categoryEn: "Mains",
    priceCents: 3200,
    imageUrl: "/images/demo/dishes/risotto-cepes-parmesan.png",
    ingredientsFr: ["Riz carnaroli", "Cepes", "Parmesan", "Champignons"],
    ingredientsEn: ["Carnaroli rice", "Porcini", "Parmesan", "Mushrooms"],
    allergensFr: ["Lait"],
    allergensEn: ["Milk"],
    optionsFr: ["Truffe rapee +12"],
    optionsEn: ["Shaved truffle +12"],
    houseNoteFr: "Texture cremeuse, finition minute.",
    houseNoteEn: "Creamy texture, finished to order.",
    tagsFr: ["Vegetarien"],
    tagsEn: ["Vegetarian"]
  },
  {
    slug: "souffle-chocolat-grand-cru",
    nameFr: "Souffle chocolat grand cru",
    nameEn: "Grand cru chocolate souffle",
    descriptionFr:
      "Souffle chaud, coeur chocolat noir, creme anglaise vanillee.",
    descriptionEn:
      "Warm souffle, dark chocolate center, vanilla custard.",
    categoryFr: "Desserts",
    categoryEn: "Desserts",
    priceCents: 1600,
    imageUrl: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    ingredientsFr: ["Chocolat", "Oeufs", "Vanille", "Creme"],
    ingredientsEn: ["Chocolate", "Eggs", "Vanilla", "Cream"],
    allergensFr: ["Oeufs", "Lait"],
    allergensEn: ["Eggs", "Milk"],
    optionsFr: ["A commander 12 minutes avant"],
    optionsEn: ["Order 12 minutes ahead"],
    houseNoteFr: "Dessert signature servi a la minute.",
    houseNoteEn: "Signature dessert served to order.",
    tagsFr: ["Signature"],
    tagsEn: ["Signature"]
  }
];

function parseDemoPriceCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
  }
  return 0;
}

function demoMenu(slug: string, locale: Locale = "fr"): PublicMenu {
  const restaurant = getRestaurant(locale);
  const dishes = getAllDishes(locale);
  const recommendedTag = locale === "en" ? "Recommended" : "Recommandé";
  const unavailableTag = locale === "en" ? "Unavailable" : "Indisponible";

  return {
    restaurantId: getDemoRestaurantId(),
    slug,
    name: restaurant.name,
    location: restaurant.location,
    cuisineType: restaurant.cuisineType,
    googleReview: normalizeGoogleReviewConfig(restaurant.googleReview),
    settings: DEMO_PUBLIC_MENU_SETTINGS,
    source: "demo",
    dishes: dishes.slice(0, 60).map((dish, index) => ({
      id: dish.slug || `demo-${index}`,
      slug: dish.slug || `demo-${index}`,
      name: dish.name,
      description: dish.description ?? "",
      category:
        getCategoryBySlug(dish.categorySlug ?? "", locale)?.name ??
        (locale === "en" ? "Menu" : "Carte"),
      priceLabel: dish.price ? `$${dish.price}` : "",
      priceCents: parseDemoPriceCents(dish.price),
      priceCurrency: "CAD",
      baseCurrency: "CAD",
      displayPriceMode: "auto",
      imageUrl: dish.image ?? "",
      thumbnailUrl: dish.image ?? "",
      hasPhoto: Boolean(dish.image),
      photoStatus: dish.image ? "ready" : "missing",
      has3d: Boolean(
        dish.model3dUrl || dish.webModel3dUrl || dish.arModel3dUrl
      ),
      hasAr: Boolean(dish.arModel3dUrl || dish.usdzUrl || dish.arUsdzUrl),
      hasIosAr: Boolean(dish.usdzUrl || dish.arUsdzUrl),
      hasAndroidAr: Boolean(dish.arModel3dUrl),
      model3dUrl: dish.model3dUrl ?? "",
      webModel3dUrl: dish.webModel3dUrl ?? dish.model3dUrl ?? "",
      webModel3dBytes: 0,
      arModel3dUrl: dish.arModel3dUrl ?? "",
      arModel3dBytes: 0,
      usdzUrl: dish.usdzUrl ?? "",
      arUsdzUrl: dish.arUsdzUrl ?? dish.usdzUrl ?? "",
      arUsdzBytes: 0,
      posterUrl: dish.image ?? "",
      modelStatus:
        dish.model3dUrl ||
        dish.webModel3dUrl ||
        dish.arModel3dUrl ||
        dish.usdzUrl ||
        dish.arUsdzUrl
          ? "ready"
          : "missing",
      hasImmersive: Boolean(
        dish.model3dUrl ||
          dish.webModel3dUrl ||
          dish.arModel3dUrl ||
          dish.usdzUrl ||
          dish.arUsdzUrl
      ),
      available: dish.isAvailable,
      ingredients: dish.ingredients,
      allergens: dish.allergens,
      options: dish.options,
      houseNote: dish.chefRecommendation,
      tags: [
        dish.isSignature ? "Signature" : "",
        dish.isRecommended ? recommendedTag : "",
        dish.isAvailable ? "" : unavailableTag
      ].filter(Boolean)
    }))
  };
}

function trouvableDemoMenu(slug: string, locale: Locale = "fr"): PublicMenu {
  const isEnglish = locale === "en";

  return {
    restaurantId: "trouvable-demo",
    slug,
    name: "Trouvable",
    location: "Montreal",
    cuisineType: isEnglish ? "Premium brunch and evening plates" : "Brunch premium et assiettes du soir",
    googleReview: normalizeGoogleReviewConfig({
      enabled: false,
      googleReviewUrl: ""
    }),
    settings: TROUVABLE_PUBLIC_MENU_SETTINGS,
    publicMenuStyleExplicit: true,
    source: "demo",
    dishes: TROUVABLE_DISHES.map((dish) => ({
      id: dish.slug,
      slug: dish.slug,
      name: isEnglish ? dish.nameEn : dish.nameFr,
      description: isEnglish ? dish.descriptionEn : dish.descriptionFr,
      category: isEnglish ? dish.categoryEn : dish.categoryFr,
      priceLabel: `$${(dish.priceCents / 100).toFixed(0)}`,
      priceCents: dish.priceCents,
      priceCurrency: "CAD",
      baseCurrency: "CAD",
      displayPriceMode: "auto",
      imageUrl: dish.imageUrl,
      thumbnailUrl: dish.imageUrl,
      hasPhoto: true,
      photoStatus: "ready",
      has3d: false,
      hasAr: false,
      hasIosAr: false,
      hasAndroidAr: false,
      model3dUrl: "",
      webModel3dUrl: "",
      webModel3dBytes: 0,
      arModel3dUrl: "",
      arModel3dBytes: 0,
      usdzUrl: "",
      arUsdzUrl: "",
      arUsdzBytes: 0,
      posterUrl: dish.imageUrl,
      modelStatus: "missing",
      hasImmersive: false,
      available: true,
      ingredients: isEnglish ? dish.ingredientsEn : dish.ingredientsFr,
      allergens: isEnglish ? dish.allergensEn : dish.allergensFr,
      options: isEnglish ? dish.optionsEn : dish.optionsFr,
      houseNote: isEnglish ? dish.houseNoteEn : dish.houseNoteFr,
      tags: isEnglish ? dish.tagsEn : dish.tagsFr
    }))
  };
}

function findPrimaryMenu(
  rows: PublicMenuRow[],
  restaurantId: string
): PublicMenuRow | null {
  const scoped = rows.filter((row) => getString(row, ["restaurant_id", "restaurantId"], "") === restaurantId);
  const published = scoped.filter((row) => getString(row, ["status"], "") !== "archived");
  return (
    published.find((row) => getBoolean(row, ["is_primary", "isPrimary"], false) && getString(row, ["status"], "") === "published") ??
    published.find((row) => getBoolean(row, ["is_primary", "isPrimary"], false)) ??
    published.find((row) => getString(row, ["slug"], "") === "principal") ??
    published[0] ??
    null
  );
}

function getObject(row: PublicMenuRow, key: string): PublicMenuRow {
  const value = row[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as PublicMenuRow;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as PublicMenuRow;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function findLegacyMenuLanguages(
  rows: PublicMenuRow[],
  restaurantId: string
): unknown {
  const scoped = rows.filter(
    (row) => getString(row, ["restaurant_id", "restaurantId"], "") === restaurantId
  );
  const preferred =
    scoped.find((row) => getString(row, ["status"], "") === "published") ??
    scoped.find((row) => getString(row, ["status"], "") === "draft") ??
    scoped[0];
  if (!preferred) return undefined;
  const configJson = getObject(preferred, "config_json");
  return configJson.menuLanguages ?? configJson.menu_languages;
}

export async function getPublicMenuBySlug(
  rawSlug: string,
  locale: Locale | string = DEFAULT_LOCALE
): Promise<PublicMenu | null> {
  const slug = slugifyRestaurantSlug(rawSlug);
  const resolvedLocale = normalizeLocale(locale);
  if (!slug) return null;

  if (slug === "maison-elyse") {
    return demoMenu(slug, resolvedLocale);
  }

  const restaurantsResult = await readSupabaseRows("restaurants", 200);
  if (!restaurantsResult.ok || restaurantsResult.rows.length === 0) {
    if (slug === "trouvable") {
      return trouvableDemoMenu(slug, resolvedLocale);
    }
    return null;
  }

  const match = restaurantsResult.rows.find((row) => getPublicMenuRowSlug(row) === slug);
  if (!match) return null;

  const restaurantId = getString(match, ["id", "restaurant_id"], "");
  if (restaurantId === getDemoRestaurantId()) {
    return demoMenu(slug, resolvedLocale);
  }

  const [menusResult, categoriesResult, dishesResult, uiConfigsResult] = await Promise.all([
    readSupabaseRows<PublicMenuRow>("menus", 500),
    readSupabaseRows<PublicMenuRow>("menu_categories", 1_000),
    readSupabaseRows<PublicMenuRow>("menu_dishes", 1_000),
    readSupabaseRows<PublicMenuRow>("menu_ui_configs", 1_000)
  ]);
  const primaryMenu = menusResult.ok ? findPrimaryMenu(menusResult.rows, restaurantId) : null;
  const legacyMenuLanguages = uiConfigsResult.ok
    ? findLegacyMenuLanguages(uiConfigsResult.rows, restaurantId)
    : undefined;
  const legacyPublicMenuSettings = uiConfigsResult.ok
    ? publicMenuSettingsFromUiConfigRows(uiConfigsResult.rows, restaurantId) ?? undefined
    : undefined;

  if (primaryMenu) {
    const menu = buildRelationalSupabasePublicMenu({
      slug,
      restaurantRow: match,
      menuRow: primaryMenu,
      categoryRows: categoriesResult.ok ? categoriesResult.rows : [],
      dishRows: dishesResult.ok ? dishesResult.rows : [],
      legacyPublicMenuSettings,
      legacyMenuLanguages
    });
    return applyStoredPublicMenuTranslations(menu, locale);
  }

  const menu = buildSupabasePublicMenu(
    slug,
    match,
    dishesResult.ok ? dishesResult.rows : [],
    { legacyPublicMenuSettings, legacyMenuLanguages }
  );
  return applyStoredPublicMenuTranslations(menu, locale);
}
