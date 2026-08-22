import "server-only";

import { cache } from "react";

import {
  getBoolean,
  getString,
  readSupabaseRowsByFilters
} from "@/lib/analytics/serverRows";
import { getDemoRestaurantId } from "@/lib/maisonElyseIdentity";
import {
  getAllDishes,
  getCategoryBySlug,
  getRestaurant
} from "@/lib/demoMenuData";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
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
  normalizePublicMenuLocale,
  normalizePublicMenuLocalePreference,
  publicLocaleToShortLocale,
  serializePublicMenuSettings
} from "@/lib/menu/publicMenuSettings";
import {
  MENU_PROJECTIONS,
  PUBLIC_MENU_PROJECTIONS
} from "@/lib/menu/menuSchemaProjections";
import { applyStoredPublicMenuTranslations } from "@/lib/menu/publicMenuTranslations";
import { publicMenuSettingsFallbackFromUiConfigRows } from "@/lib/owner/publicMenuSettingsFallback";

export type { PublicMenu, PublicMenuDish } from "@/lib/menu/publicMenuCore";

function isMissingDisplayOrderError(result: { ok: boolean; error?: string }): boolean {
  return !result.ok && /display_order|schema cache|does not exist/i.test(result.error ?? "");
}

// Keep public menu reads explicit. The shared menu projection contract tracks
// the deployed production schema; legacy slug fallback intentionally retains
// `*` below because older installations may not expose the relational shape.
const PUBLIC_RESTAURANT_COLUMNS = PUBLIC_MENU_PROJECTIONS.restaurants;
const PUBLIC_DISH_COLUMNS = PUBLIC_MENU_PROJECTIONS.dishes;
const PUBLIC_RESTAURANT_COLUMNS_FALLBACK =
  PUBLIC_MENU_PROJECTIONS.restaurantsFallback;
const PUBLIC_DISH_COLUMNS_FALLBACK = PUBLIC_MENU_PROJECTIONS.dishesFallback;
const PUBLIC_UI_CONFIG_COLUMNS = PUBLIC_MENU_PROJECTIONS.uiConfigs;

async function readDishRows(
  readRows: typeof readSupabaseRowsByFilters,
  filters: Record<string, string>
) {
  const ordered = await readRows({
    table: "menu_dishes",
    columns: filters.restaurant_id ? PUBLIC_DISH_COLUMNS : "*",
    filters,
    orderBy: ["display_order", "id"],
    limit: 1_000,
    fallbackColumns: filters.restaurant_id ? PUBLIC_DISH_COLUMNS_FALLBACK : undefined,
    fallbackOrderBy: "id"
  });
  if (ordered.ok || !isMissingDisplayOrderError(ordered)) return ordered;
  return readRows({
    table: "menu_dishes",
    columns: filters.restaurant_id ? PUBLIC_DISH_COLUMNS_FALLBACK : "*",
    filters,
    orderBy: ["id"],
    limit: 1_000
  });
}

const DEMO_PUBLIC_MENU_SETTINGS = serializePublicMenuSettings({
  ...DEFAULT_PUBLIC_MENU_SETTINGS,
  supportedLocales: ["fr-CA", "en-CA"],
  publicMenuStyle: "maison-elyse"
});

const TROUVABLE_PUBLIC_MENU_SETTINGS = serializePublicMenuSettings({
  ...DEFAULT_PUBLIC_MENU_SETTINGS,
  supportedLocales: ["fr-CA", "en-CA", "es-ES", "it-IT", "el-GR", "ar"],
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

type TrouvableDemoDishSource = {
  slug: string;
  nameFr: string;
  nameEn: string;
  nameEl: string;
  descriptionFr: string;
  descriptionEn: string;
  descriptionEl: string;
  categoryFr: string;
  categoryEn: string;
  categoryEl: string;
  priceCents: number;
  imageUrl: string;
  ingredientsFr: string[];
  ingredientsEn: string[];
  ingredientsEl: string[];
  allergensFr: string[];
  allergensEn: string[];
  allergensEl: string[];
  optionsFr: string[];
  optionsEn: string[];
  optionsEl: string[];
  houseNoteFr: string;
  houseNoteEn: string;
  houseNoteEl: string;
  tagsFr: string[];
  tagsEn: string[];
  tagsEl: string[];
};

const TROUVABLE_DISHES = [
  {
    slug: "dejeuner-classique-maison",
    nameFr: "Dejeuner classique maison",
    nameEn: "House classic breakfast",
    nameEl: "Σπιτικό κλασικό πρωινό",
    descriptionFr:
      "Oeufs fermiers, pommes de terre croustillantes, salade d'herbes et pain au levain grille.",
    descriptionEn:
      "Farm eggs, crisp potatoes, herb salad, and toasted sourdough.",
    descriptionEl:
      "Αυγά ελευθέρας βοσκής, τραγανές πατάτες, σαλάτα μυρωδικών και φρυγανισμένο ψωμί με προζύμι.",
    categoryFr: "Dejeuner",
    categoryEn: "Breakfast",
    categoryEl: "Πρωινό",
    priceCents: 1800,
    imageUrl: "/images/demo/dishes/maison-elyse-n1.png",
    ingredientsFr: ["Oeufs", "Pommes de terre", "Herbes fraiches", "Pain au levain"],
    ingredientsEn: ["Eggs", "Potatoes", "Fresh herbs", "Sourdough"],
    ingredientsEl: ["Αυγά", "Πατάτες", "Φρέσκα μυρωδικά", "Ψωμί με προζύμι"],
    allergensFr: ["Oeufs", "Gluten"],
    allergensEn: ["Eggs", "Gluten"],
    allergensEl: ["Αυγά", "Γλουτένη"],
    optionsFr: ["Bacon croustillant +4", "Avocat citronne +5", "Sans gluten sur demande"],
    optionsEn: ["Crisp bacon +4", "Lemon avocado +5", "Gluten-free on request"],
    optionsEl: [
      "Τραγανό μπέικον +4",
      "Αβοκάντο με λεμόνι +5",
      "Χωρίς γλουτένη κατόπιν αιτήματος"
    ],
    houseNoteFr: "Le plat signature pour tester le parcours public Trouvable.",
    houseNoteEn: "The signature plate for the Trouvable public flow.",
    houseNoteEl: "Το πιάτο-υπογραφή για τη δοκιμή της δημόσιας εμπειρίας Trouvable.",
    tagsFr: ["Signature", "Maison"],
    tagsEn: ["Signature", "House"],
    tagsEl: ["Πρόταση", "Σπιτικό"]
  },
  {
    slug: "ravioles-chevre-miel-monteregie",
    nameFr: "Ravioles chevre et miel de Monteregie",
    nameEn: "Goat cheese and Monteregie honey ravioli",
    nameEl: "Ραβιόλια με κατσικίσιο τυρί και μέλι Monteregie",
    descriptionFr:
      "Ravioles fondantes, beurre noisette, citron confit et herbes du jardin.",
    descriptionEn:
      "Silky ravioli, brown butter, preserved lemon, and garden herbs.",
    descriptionEl:
      "Απαλά ραβιόλια, καστανό βούτυρο, διατηρημένο λεμόνι και μυρωδικά κήπου.",
    categoryFr: "Entrees",
    categoryEn: "Starters",
    categoryEl: "Ορεκτικά",
    priceCents: 2400,
    imageUrl: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
    ingredientsFr: ["Chevre", "Miel", "Citron confit", "Herbes"],
    ingredientsEn: ["Goat cheese", "Honey", "Preserved lemon", "Herbs"],
    ingredientsEl: ["Κατσικίσιο τυρί", "Μέλι", "Διατηρημένο λεμόνι", "Μυρωδικά"],
    allergensFr: ["Lait", "Gluten"],
    allergensEn: ["Milk", "Gluten"],
    allergensEl: ["Γάλα", "Γλουτένη"],
    optionsFr: ["Portion partage +8"],
    optionsEn: ["Sharing portion +8"],
    optionsEl: ["Μερίδα για μοίρασμα +8"],
    houseNoteFr: "Servi chaud, ideal pour commencer en douceur.",
    houseNoteEn: "Served warm, a gentle opening plate.",
    houseNoteEl: "Σερβίρεται ζεστό, ιδανικό για ένα ήπιο ξεκίνημα.",
    tagsFr: ["Vegetarien"],
    tagsEn: ["Vegetarian"],
    tagsEl: ["Χορτοφαγικό"]
  },
  {
    slug: "tartare-saumon-label-rouge",
    nameFr: "Tartare de saumon Label Rouge",
    nameEn: "Label Rouge salmon tartare",
    nameEl: "Ταρτάρ σολομού Label Rouge",
    descriptionFr:
      "Saumon coupe minute, pomme verte, aneth, creme sure et chips fines.",
    descriptionEn:
      "Fresh-cut salmon, green apple, dill, sour cream, and thin chips.",
    descriptionEl:
      "Σολομός κομμένος την τελευταία στιγμή, πράσινο μήλο, άνηθος, ξινή κρέμα και λεπτά τσιπς.",
    categoryFr: "Entrees",
    categoryEn: "Starters",
    categoryEl: "Ορεκτικά",
    priceCents: 2600,
    imageUrl: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    ingredientsFr: ["Saumon", "Pomme verte", "Aneth", "Creme sure"],
    ingredientsEn: ["Salmon", "Green apple", "Dill", "Sour cream"],
    ingredientsEl: ["Σολομός", "Πράσινο μήλο", "Άνηθος", "Ξινή κρέμα"],
    allergensFr: ["Poisson", "Lait"],
    allergensEn: ["Fish", "Milk"],
    allergensEl: ["Ψάρι", "Γάλα"],
    optionsFr: ["Chips supplementaires +3"],
    optionsEn: ["Extra chips +3"],
    optionsEl: ["Επιπλέον τσιπς +3"],
    houseNoteFr: "Fraicheur vive, parfait avec un blanc sec.",
    houseNoteEn: "Bright and fresh, ideal with a dry white.",
    houseNoteEl: "Έντονη φρεσκάδα, ιδανικό με ξηρό λευκό κρασί.",
    tagsFr: ["Frais"],
    tagsEn: ["Fresh"],
    tagsEl: ["Φρέσκο"]
  },
  {
    slug: "risotto-cepes-parmesan",
    nameFr: "Risotto cepes et parmesan",
    nameEn: "Porcini and parmesan risotto",
    nameEl: "Ριζότο με πορτσίνι και παρμεζάνα",
    descriptionFr:
      "Riz carnaroli, cepes, parmesan affine et jus court aux champignons.",
    descriptionEn:
      "Carnaroli rice, porcini, aged parmesan, and mushroom jus.",
    descriptionEl:
      "Ρύζι carnaroli, πορτσίνι, παλαιωμένη παρμεζάνα και συμπυκνωμένος ζωμός μανιταριών.",
    categoryFr: "Plats",
    categoryEn: "Mains",
    categoryEl: "Κυρίως πιάτα",
    priceCents: 3200,
    imageUrl: "/images/demo/dishes/risotto-cepes-parmesan.png",
    ingredientsFr: ["Riz carnaroli", "Cepes", "Parmesan", "Champignons"],
    ingredientsEn: ["Carnaroli rice", "Porcini", "Parmesan", "Mushrooms"],
    ingredientsEl: ["Ρύζι carnaroli", "Πορτσίνι", "Παρμεζάνα", "Μανιτάρια"],
    allergensFr: ["Lait"],
    allergensEn: ["Milk"],
    allergensEl: ["Γάλα"],
    optionsFr: ["Truffe rapee +12"],
    optionsEn: ["Shaved truffle +12"],
    optionsEl: ["Τριμμένη τρούφα +12"],
    houseNoteFr: "Texture cremeuse, finition minute.",
    houseNoteEn: "Creamy texture, finished to order.",
    houseNoteEl: "Κρεμώδης υφή, τελείωμα στην παραγγελία.",
    tagsFr: ["Vegetarien"],
    tagsEn: ["Vegetarian"],
    tagsEl: ["Χορτοφαγικό"]
  },
  {
    slug: "souffle-chocolat-grand-cru",
    nameFr: "Souffle chocolat grand cru",
    nameEn: "Grand cru chocolate souffle",
    nameEl: "Σουφλέ σοκολάτας grand cru",
    descriptionFr:
      "Souffle chaud, coeur chocolat noir, creme anglaise vanillee.",
    descriptionEn:
      "Warm souffle, dark chocolate center, vanilla custard.",
    descriptionEl:
      "Ζεστό σουφλέ, καρδιά μαύρης σοκολάτας, κρέμα βανίλιας.",
    categoryFr: "Desserts",
    categoryEn: "Desserts",
    categoryEl: "Επιδόρπια",
    priceCents: 1600,
    imageUrl: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    ingredientsFr: ["Chocolat", "Oeufs", "Vanille", "Creme"],
    ingredientsEn: ["Chocolate", "Eggs", "Vanilla", "Cream"],
    ingredientsEl: ["Σοκολάτα", "Αυγά", "Βανίλια", "Κρέμα"],
    allergensFr: ["Oeufs", "Lait"],
    allergensEn: ["Eggs", "Milk"],
    allergensEl: ["Αυγά", "Γάλα"],
    optionsFr: ["A commander 12 minutes avant"],
    optionsEn: ["Order 12 minutes ahead"],
    optionsEl: ["Παραγγελία 12 λεπτά νωρίτερα"],
    houseNoteFr: "Dessert signature servi a la minute.",
    houseNoteEn: "Signature dessert served to order.",
    houseNoteEl: "Πιάτο-υπογραφή επιδόρπιο, σερβίρεται τη στιγμή.",
    tagsFr: ["Signature"],
    tagsEn: ["Signature"],
    tagsEl: ["Πρόταση"]
  }
] satisfies readonly TrouvableDemoDishSource[];

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

function demoCategoryFields(categorySlug: string, locale: Locale) {
  const category = getCategoryBySlug(categorySlug, locale);
  return {
    categoryId: category?.id,
    categorySlug: category?.slug ?? categorySlug,
    categoryDescription: category?.description,
    category: category?.name ?? (locale === "en" ? "Menu" : "Carte")
  };
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
    activeLocale: locale === "en" ? "en-CA" : "fr-CA",
    translationLocales: [
      { locale: "fr-CA", status: "source" },
      { locale: "en-CA", status: "up_to_date" }
    ],
    translationStatus: {
      locale: locale === "en" ? "en-CA" : "fr-CA",
      status: locale === "en" ? "up_to_date" : "source"
    },
    source: "demo",
    dishes: dishes.slice(0, 60).map((dish, index) => ({
      id: dish.slug || `demo-${index}`,
      slug: dish.slug || `demo-${index}`,
      name: dish.name,
      description: dish.description ?? "",
      ...demoCategoryFields(dish.categorySlug ?? "", locale),
      priceLabel: dish.price ? `$${dish.price}` : "",
      priceCents: parseDemoPriceCents(dish.price),
      priceCurrency: "CAD",
      baseCurrency: "CAD",
      displayPriceMode: "auto",
      imageUrl: dish.image ?? "",
      thumbnailUrl: dish.image ?? "",
      cardUrl: dish.image ?? "",
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

function publicMenuLanguageCode(locale: string): string {
  try {
    return new Intl.Locale(locale).language.toLowerCase();
  } catch {
    return locale.toLowerCase().split("-")[0] ?? "";
  }
}

function trouvableDemoMenu(
  slug: string,
  requestedLocale: unknown = TROUVABLE_PUBLIC_MENU_SETTINGS.defaultLocale
): PublicMenu {
  const activePublicLocale = normalizePublicMenuLocalePreference(
    requestedLocale,
    TROUVABLE_PUBLIC_MENU_SETTINGS
  );
  const activeLanguage = publicMenuLanguageCode(activePublicLocale);
  const isEnglish = activeLanguage === "en";
  const isGreek = activeLanguage === "el";
  // The Playwright handoff spec opts into a tracked demo model without changing production data.
  const e2eImmersiveFixture = process.env.VISTAIRE_E2E_TROUVABLE_3D === "1";

  return {
    restaurantId: "trouvable-demo",
    slug,
    name: "Trouvable",
    location: "Montreal",
    cuisineType: isGreek
      ? "Premium brunch και βραδινά πιάτα"
      : isEnglish
        ? "Premium brunch and evening plates"
        : "Brunch premium et assiettes du soir",
    googleReview: normalizeGoogleReviewConfig({
      enabled: false,
      googleReviewUrl: ""
    }),
    settings: TROUVABLE_PUBLIC_MENU_SETTINGS,
    activeLocale: activePublicLocale,
    translationStatus: {
      locale: activePublicLocale,
      status:
        activePublicLocale === TROUVABLE_PUBLIC_MENU_SETTINGS.defaultLocale
          ? "source"
          : "up_to_date"
    },
    publicMenuStyleExplicit: true,
    source: "demo",
    dishes: TROUVABLE_DISHES.map((dish) => {
      const e2eImmersiveAssets =
        e2eImmersiveFixture && dish.slug === "ravioles-chevre-miel-monteregie"
          ? {
              model3dUrl: "/models/demo/ravioles-chevre-miel-meshy.glb",
              webModel3dUrl: "/models/demo/ravioles-chevre-miel-meshopt-8a28933e.glb",
              arModel3dUrl: "/models/demo/ar-lite/ravioles-chevre-miel-ar-lite-meshy.glb",
              arUsdzUrl: "/models/demo/ar-lite/ravioles-chevre-miel-ios-quicklook-meshy.usdz"
            }
          : null;

      return {
        id: dish.slug,
        slug: dish.slug,
        name: dish.nameFr,
        description: isGreek
          ? dish.descriptionEl
          : isEnglish
            ? dish.descriptionEn
            : dish.descriptionFr,
        category: isGreek
          ? dish.categoryEl
          : isEnglish
            ? dish.categoryEn
            : dish.categoryFr,
        priceLabel: `$${(dish.priceCents / 100).toFixed(0)}`,
        priceCents: dish.priceCents,
        priceCurrency: "CAD",
        baseCurrency: "CAD",
        displayPriceMode: "auto",
        imageUrl: dish.imageUrl,
        thumbnailUrl: dish.imageUrl,
        cardUrl: dish.imageUrl,
        hasPhoto: true,
        photoStatus: "ready",
        has3d: Boolean(e2eImmersiveAssets),
        hasAr: Boolean(e2eImmersiveAssets),
        hasIosAr: Boolean(e2eImmersiveAssets),
        hasAndroidAr: Boolean(e2eImmersiveAssets),
        model3dUrl: e2eImmersiveAssets?.model3dUrl ?? "",
        webModel3dUrl: e2eImmersiveAssets?.webModel3dUrl ?? "",
        webModel3dBytes: 0,
        arModel3dUrl: e2eImmersiveAssets?.arModel3dUrl ?? "",
        arModel3dBytes: 0,
        usdzUrl: "",
        arUsdzUrl: e2eImmersiveAssets?.arUsdzUrl ?? "",
        arUsdzBytes: 0,
        posterUrl: dish.imageUrl,
        modelStatus: e2eImmersiveAssets ? "ready" : "missing",
        hasImmersive: Boolean(e2eImmersiveAssets),
        available: true,
        ingredients: isGreek
          ? dish.ingredientsEl
          : isEnglish
            ? dish.ingredientsEn
            : dish.ingredientsFr,
        allergens: isGreek
          ? dish.allergensEl
          : isEnglish
            ? dish.allergensEn
            : dish.allergensFr,
        options: isGreek
          ? dish.optionsEl
          : isEnglish
            ? dish.optionsEn
            : dish.optionsFr,
        houseNote: isGreek
          ? dish.houseNoteEl
          : isEnglish
            ? dish.houseNoteEn
            : dish.houseNoteFr,
        tags: isGreek ? dish.tagsEl : isEnglish ? dish.tagsEn : dish.tagsFr
      };
    })
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

type PublicMenuDependencies = {
  readRows: typeof readSupabaseRowsByFilters;
  nodeEnv: string | undefined;
};

export type PublicMenuReadOutcome =
  | { status: "live"; menu: PublicMenu }
  | { status: "not_found" }
  | { status: "temporarily_unavailable" };

const defaultPublicMenuDependencies: PublicMenuDependencies = {
  readRows: readSupabaseRowsByFilters,
  nodeEnv: process.env.NODE_ENV
};
const publicMenuReadFlights = new Map<
  string,
  Promise<PublicMenuReadOutcome>
>();
const publicMenuDependencyScopes = new WeakMap<
  typeof readSupabaseRowsByFilters,
  number
>();
let nextPublicMenuDependencyScope = 1;

function publicMenuDependencyScope(
  readRows: typeof readSupabaseRowsByFilters
): string {
  if (readRows === readSupabaseRowsByFilters) return "default";
  const existing = publicMenuDependencyScopes.get(readRows);
  if (existing) return `test-${existing}`;
  const created = nextPublicMenuDependencyScope++;
  publicMenuDependencyScopes.set(readRows, created);
  return `test-${created}`;
}

function publicMenuReadFlightKey(
  slug: string,
  locale: string,
  dependencies: PublicMenuDependencies
): string {
  return JSON.stringify([
    publicMenuDependencyScope(dependencies.readRows),
    slug,
    locale
  ]);
}

function coalescePublicMenuRead(
  key: string,
  read: () => Promise<PublicMenuReadOutcome>
): Promise<PublicMenuReadOutcome> {
  const active = publicMenuReadFlights.get(key);
  if (active) return active;

  const flightReference: { current?: Promise<PublicMenuReadOutcome> } = {};
  const flight = Promise.resolve()
    .then(read)
    .finally(() => {
      if (publicMenuReadFlights.get(key) === flightReference.current) {
        publicMenuReadFlights.delete(key);
      }
    });
  flightReference.current = flight;
  publicMenuReadFlights.set(key, flight);
  return flight;
}

async function getPublicMenuBySlugUncached(
  rawSlug: string,
  locale: Locale | string = DEFAULT_LOCALE,
  dependencies: PublicMenuDependencies = defaultPublicMenuDependencies
): Promise<PublicMenu | null> {
  const slug = slugifyRestaurantSlug(rawSlug);
  const resolvedPublicLocale = normalizePublicMenuLocale(locale);
  const resolvedLocale = publicLocaleToShortLocale(resolvedPublicLocale);
  if (!slug) return null;

  const localDemo = () => {
    if (
      dependencies.nodeEnv === "production" &&
      (slug !== "trouvable" || process.env.VISTAIRE_E2E_TROUVABLE_3D !== "1")
    ) {
      return null;
    }
    if (slug === "maison-elyse") {
      return demoMenu(slug, resolvedLocale);
    }
    if (slug === "trouvable") return trouvableDemoMenu(slug, locale);
    return null;
  };

  // The dedicated public-menu matrix needs the complete tracked Maison data
  // even when the shared CI Supabase fixture exposes only its landing card.
  // This explicit test fixture stays outside the shared in-flight read.
  if (
    slug === "maison-elyse" &&
    dependencies.readRows === readSupabaseRowsByFilters &&
    process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS === "1" &&
    process.env.VISTAIRE_E2E_MAISON_PUBLIC_MENU === "1"
  ) {
    return demoMenu(slug, resolvedLocale);
  }

  const readMenu = async (): Promise<PublicMenuReadOutcome> => {

    const restaurantsResult = await dependencies.readRows<PublicMenuRow>({ table: "restaurants", columns: PUBLIC_RESTAURANT_COLUMNS, fallbackColumns: PUBLIC_RESTAURANT_COLUMNS_FALLBACK, filters: { slug }, orderBy: "id", limit: 1 });
    if (!restaurantsResult.ok) return { status: "temporarily_unavailable" };
    if (restaurantsResult.rows.length === 0) return { status: "not_found" };

    const match = restaurantsResult.rows.find((row) => getPublicMenuRowSlug(row) === slug);
    if (!match) return { status: "not_found" };

    const restaurantId = getString(match, ["id", "restaurant_id"], "");
    if (!restaurantId) return { status: "temporarily_unavailable" };
    const isDemoRestaurant = restaurantId === getDemoRestaurantId();

    const [menusResult, categoriesResult, dishesResult, uiConfigsResult] = await Promise.all([
      dependencies.readRows<PublicMenuRow>({ table: "menus", columns: MENU_PROJECTIONS.menus, fallbackColumns: MENU_PROJECTIONS.legacyMenus, filters: { restaurant_id: restaurantId }, orderBy: "id", limit: 500, fallbackOrderBy: "id" }),
      dependencies.readRows<PublicMenuRow>({ table: "menu_categories", columns: MENU_PROJECTIONS.menuCategories, filters: { restaurant_id: restaurantId }, orderBy: ["display_order", "id"], limit: 1_000 }),
      readDishRows(dependencies.readRows, { restaurant_id: restaurantId }),
      dependencies.readRows<PublicMenuRow>({ table: "menu_ui_configs", columns: PUBLIC_UI_CONFIG_COLUMNS, filters: { restaurant_id: restaurantId }, orderBy: "id", limit: 1_000 })
    ]);
    if (!menusResult.ok || !categoriesResult.ok || !dishesResult.ok) {
      return { status: "temporarily_unavailable" };
    }
    const primaryMenu = findPrimaryMenu(menusResult.rows, restaurantId);
    let dishRows = dishesResult.rows;
    if (!primaryMenu && dishRows.length === 0) {
      const legacyDishesResult = await readDishRows(dependencies.readRows, {
        restaurant_slug: slug
      });
      if (legacyDishesResult.ok) dishRows = legacyDishesResult.rows;
    }
    const legacyMenuLanguages = uiConfigsResult.ok
      ? findLegacyMenuLanguages(uiConfigsResult.rows, restaurantId)
      : undefined;
    const legacyPublicMenuSettings = uiConfigsResult.ok
      ? publicMenuSettingsFallbackFromUiConfigRows(uiConfigsResult.rows, restaurantId, {
          includeDraft: false
        }) ?? undefined
      : undefined;
    const hasScopedDishRows = dishRows.length > 0;

    if (isDemoRestaurant && !primaryMenu && !hasScopedDishRows) {
      return { status: "not_found" };
    }

    if (primaryMenu) {
      const menu = buildRelationalSupabasePublicMenu({
        slug,
        restaurantRow: match,
        menuRow: primaryMenu,
        categoryRows: categoriesResult.rows,
        dishRows,
        includeUnavailableDishes: false,
        legacyPublicMenuSettings,
        legacyMenuLanguages
      });
      return {
        status: "live",
        menu: await applyStoredPublicMenuTranslations(menu, resolvedPublicLocale)
      };
    }

    const menu = buildSupabasePublicMenu(
      slug,
      match,
      dishRows,
      { includeUnavailableDishes: false, legacyPublicMenuSettings, legacyMenuLanguages }
    );
    return {
      status: "live",
      menu: await applyStoredPublicMenuTranslations(menu, resolvedPublicLocale)
    };
  };

  const outcome = await coalescePublicMenuRead(
    publicMenuReadFlightKey(slug, resolvedPublicLocale, dependencies),
    readMenu
  );
  return outcome.status === "live" ? outcome.menu : localDemo();
}

// React's request cache deduplicates metadata/page/render callers without
// sharing a menu between users or deployments. Custom dependency readers used
// by contract tests intentionally bypass this wrapper.
const getPublicMenuBySlugRequestCached = cache(
  async (slug: string, locale: string) =>
    getPublicMenuBySlugUncached(slug, locale, defaultPublicMenuDependencies)
);

export async function getPublicMenuBySlug(
  rawSlug: string,
  locale: Locale | string = DEFAULT_LOCALE,
  dependencies?: PublicMenuDependencies
): Promise<PublicMenu | null> {
  if (!dependencies) {
    const slug = slugifyRestaurantSlug(rawSlug);
    if (!slug) return null;
    return getPublicMenuBySlugRequestCached(
      slug,
      normalizePublicMenuLocale(locale)
    );
  }
  return getPublicMenuBySlugUncached(rawSlug, locale, dependencies);
}
