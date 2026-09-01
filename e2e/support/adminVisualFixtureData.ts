import { getAllDishes, getCategories } from "../../lib/demoMenuData.ts";

export const ADMIN_VISUAL_RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
export const ADMIN_VISUAL_MENU_ID = "menu-maison-elysee";
export const ADMIN_VISUAL_QR_ID = "15000000-0000-0000-0000-000000000150";
export const ADMIN_VISUAL_OTHER_MENU_ID = "other-menu-same-restaurant";

// Full-menu media coverage uses real UUIDs so the browser exercises the same
// canonical admin photo route as production. The pixel-reference fixture keeps
// its historical demo IDs and static image URLs for visual-regression parity.
export const ADMIN_VISUAL_FULL_MENU_DISH_IDS = Array.from(
  { length: 12 },
  (_, index) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
);

export function adminVisualFullMenuPhotoVersion(index: number): string {
  return `${index.toString(16).padStart(2, "0")}${"a".repeat(62)}`;
}

export type AdminVisualFixtureScenario = "pixel-reference" | "full-menu";

const periodTotals = {
  current: { menu_opened: 1286, dish_opened: 3742, search_used: 562, immersive: 412 },
  previous: { menu_opened: 1090, dish_opened: 3018, search_used: 502, immersive: 315 }
} as const;

const searchTerms = ["homard bleu", "risotto cèpes", "tartare saumon", "ravioles chèvre", "canette figues", "sole meunière", "dessert chocolat", "menu végétarien", "cocktail maison"];

const fullMenuDishWeights = [18, 16, 14, 12, 10, 9, 7, 5, 4, 2, 2, 1];
const pixelDishWeights = [812, 652, 498, 381, 412, 35, ...Array.from({ length: 28 }, () => 34)];
const searchWeights = [128, 96, 74, 62, 51, 40, 38, 37, 36];
const currentDayWeights = [6, 8, 10, 12, 14, 22, 28];
const previousDayWeights = [6, 11, 12, 17, 20, 22, 12];
const serviceHours = [12, 13, 19, 20, 14, 18, 21, 11, 15, 17];
const serviceWeights = [7, 13, 18, 17, 10, 14, 9, 3, 5, 4];

function weightedIndex(index: number, weights: readonly number[]): number {
  const cycle = weights.reduce((total, weight) => total + weight, 0);
  const cursor = index % cycle;
  let boundary = 0;
  for (let candidate = 0; candidate < weights.length; candidate++) {
    boundary += weights[candidate];
    if (cursor < boundary) return candidate;
  }
  return weights.length - 1;
}

export function filterAdminVisualFixtureRows<T extends Record<string, unknown>>(rows: T[], filters: Iterable<[string, string]>): T[] {
  let filtered = rows;
  for (const [column, raw] of filters) {
    const separator = raw.indexOf(".");
    const operator = separator < 0 ? raw : raw.slice(0, separator);
    const value = separator < 0 ? "" : raw.slice(separator + 1);
    if (operator === "eq") filtered = filtered.filter((row) => String(row[column] ?? "") === value);
    if (operator === "gte") filtered = filtered.filter((row) => String(row[column] ?? "") >= value);
    if (operator === "lt") filtered = filtered.filter((row) => String(row[column] ?? "") < value);
    if (operator === "in") {
      const allowed = value.replace(/^\(/, "").replace(/\)$/, "").split(",").map((item) => item.trim().replace(/^"(.*)"$/, "$1"));
      filtered = filtered.filter((row) => allowed.includes(String(row[column] ?? "")));
    }
  }
  return filtered;
}

export function paginateAdminVisualFixtureRows<T>(rows: T[], rangeHeader: string | undefined, query: { offset?: string | null; limit?: string | null } = {}): { rows: T[]; contentRange: string } {
  const rangeMatch = /^(\d+)-(\d+)$/.exec(rangeHeader ?? "");
  const queryOffset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const queryLimit = Math.max(0, Number.parseInt(query.limit ?? "0", 10) || 0);
  const rangeStart = rangeMatch ? Number(rangeMatch[1]) : queryOffset;
  const rangeEnd = rangeMatch ? Number(rangeMatch[2]) : queryLimit > 0 ? rangeStart + queryLimit - 1 : Math.max(0, rows.length - 1);
  const page = rows.slice(rangeStart, rangeEnd + 1);
  const contentRange = rows.length ? `${rangeStart}-${Math.max(rangeStart, rangeStart + page.length - 1)}/${rows.length}` : "*/0";
  return { rows: page, contentRange };
}

export function buildAdminVisualFixtureTables({ scenario = "pixel-reference" }: { scenario?: AdminVisualFixtureScenario } = {}) {
  const restaurantId = ADMIN_VISUAL_RESTAURANT_ID;
  const menuId = ADMIN_VISUAL_MENU_ID;
  const menu_categories = getCategories().map((category, index) => ({
    id: category.slug,
    name: category.name,
    slug: category.slug,
    display_order: index + 1,
    restaurant_id: restaurantId,
    menu_id: menuId
  }));
  const canonicalDishes = getAllDishes();
  const pixelExtras = Array.from({ length: 22 }, (_, extraIndex) => {
    const source = canonicalDishes[extraIndex % canonicalDishes.length];
    const position = canonicalDishes.length + extraIndex;
    return {
      ...source,
      id: `pixel-dish-${position + 1}`,
      slug: `creation-saisonniere-${position + 1}`,
      name: `Création saisonnière ${position + 1}`,
      categorySlug: "cocktails",
      price: 24 + extraIndex,
    };
  });
  const fixtureDishes = scenario === "pixel-reference" ? [...canonicalDishes, ...pixelExtras] : canonicalDishes;
  const pixelUnavailable = new Set([3, 8, 12, 16, 20, 24, 28, 32]);
  const menu_dishes = fixtureDishes.map((dish, index) => {
    const usesAdminPhotoRoute = scenario === "full-menu";
    const id = usesAdminPhotoRoute
      ? ADMIN_VISUAL_FULL_MENU_DISH_IDS[index]
      : dish.id;
    const photoVersion = usesAdminPhotoRoute
      ? adminVisualFullMenuPhotoVersion(index)
      : "";
    const imageUrl = usesAdminPhotoRoute
      ? `/api/public/menu-dishes/${id}/photo?v=${photoVersion}`
      : dish.image;
    const metadata = usesAdminPhotoRoute
      ? {
          chefNote: dish.chefRecommendation,
          photoStorageBucket: "vistaire-media",
          photoStoragePath: `restaurants/${restaurantId}/photos/originals/${dish.slug}.png`,
          photoContentType: "image/png",
          photoSha256: photoVersion
        }
      : {
          chefNote: dish.chefRecommendation
        };
    return {
    id,
    category_id: dish.categorySlug,
    name: dish.name,
    slug: dish.slug,
    price_cents: Math.round(dish.price * 100),
    image_url: imageUrl,
    // Full-menu QA deliberately covers both final states without altering the
    // canonical pixel-reference fixture or production/demo menu data.
    is_available: scenario === "full-menu" ? index % 5 !== 3 : !pixelUnavailable.has(index),
    restaurant_id: restaurantId,
    menu_id: menuId,
    currency: "CAD",
    short_description: dish.shortDescription,
    description: dish.description,
    is_signature: dish.isSignature,
    is_recommended: dish.isRecommended,
    has_immersive_view: Boolean(dish.model3dUrl || dish.usdzUrl),
    model3d_url: dish.model3dUrl,
    web_model_3d_url: dish.webModel3dUrl ?? dish.model3dUrl,
    ar_model_3d_url: dish.arModel3dUrl ?? dish.model3dUrl,
    usdz_url: dish.usdzUrl,
    ar_usdz_url: dish.arUsdzUrl ?? dish.usdzUrl,
    ingredients: dish.ingredients,
    allergens: dish.allergens,
    options: dish.options,
    metadata,
    created_at: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`
  };
  });
  const analytics_events: Record<string, string>[] = [];
  const dishWeights = scenario === "pixel-reference" ? pixelDishWeights : fullMenuDishWeights;
  const addEvents = (period: keyof typeof periodTotals, startDay: number, month: number) => {
    const totals = periodTotals[period];
    const dayWeights = period === "current" ? currentDayWeights : previousDayWeights;
    const timestamp = (index: number) => {
      const dayIndex = weightedIndex(index, dayWeights);
      const serviceHour = serviceHours[weightedIndex(index * 37 + Math.floor(index / 7), serviceWeights)];
      const hour = dayIndex === 0 ? Math.max(12, serviceHour) : serviceHour;
      return new Date(Date.UTC(2026, month, startDay + dayIndex, hour, index % 60)).toISOString();
    };
    const common = (eventName: string, index: number) => ({
      id: `${period}-${eventName}-${index}`,
      restaurant_id: restaurantId,
      menu_id: menuId,
      source: "production",
      session_id: `${period}-session-${index}`,
      event_name: eventName,
      created_at: timestamp(index)
    });
    for (let index = 0; index < totals.menu_opened; index++) analytics_events.push(common("menu_opened", index));
    for (let index = 0; index < totals.dish_opened; index++) {
      const dish = menu_dishes[weightedIndex(index, dishWeights)];
      const category = menu_categories.find((candidate) => candidate.id === dish.category_id)!;
      analytics_events.push({ ...common("dish_opened", index), dish_id: dish.id, dish_slug: dish.slug, category_slug: category.slug });
    }
    for (let index = 0; index < totals.search_used; index++) analytics_events.push({ ...common("search_used", index), search_query: searchTerms[weightedIndex(index, searchWeights)] });
    for (let index = 0; index < totals.immersive; index++) {
      const dish = menu_dishes[weightedIndex(index, dishWeights)];
      analytics_events.push({ ...common(index % 2 === 0 ? "dish_3d_clicked" : "dish_ar_clicked", index), dish_id: dish.id, dish_slug: dish.slug });
    }
  };
  addEvents("previous", 26, 5);
  addEvents("current", 3, 6);
  const foreign = { restaurant_id: "foreign-restaurant", menu_id: "foreign-menu", source: "demo" };
  analytics_events.push({ id: "foreign-event", event_name: "menu_opened", created_at: "2026-07-09T12:00:00Z", ...foreign });
  analytics_events.push({ id: "foreign-menu-event", restaurant_id: restaurantId, menu_id: foreign.menu_id, source: "production", event_name: "menu_opened", created_at: "2026-07-09T12:00:00Z" });
  const unavailableDishes = menu_dishes.filter((dish) => !dish.is_available);
  const scheduledReturns = [
    { hour: "20:00:00.000Z", status: "pending" },
    { hour: "21:30:00.000Z", status: "pending" },
    { hour: "22:15:00.000Z", status: "failed" }
  ];
  const admin_dish_availability_schedules = scheduledReturns.flatMap((item, index) => {
    const dish = unavailableDishes[index];
    return dish ? [{
      id: `schedule-${index + 1}`,
      restaurant_id: restaurantId,
      menu_id: menuId,
      dish_id: dish.id,
      final_available: true,
      scheduled_for: `2026-07-10T${item.hour}`,
      timezone: "America/Toronto",
      status: item.status
    }] : [];
  });
  const historyActors = ["admin_qr", "schedule_worker", "admin_qr", "admin_qr"] as const;
  const historyTimes = ["2026-07-09T22:12:00.000Z", "2026-07-09T20:40:00.000Z", "2026-07-09T18:05:00.000Z", "2026-07-08T23:18:00.000Z"];
  const admin_dish_availability_events = unavailableDishes.length === 0 ? [] : historyTimes.map((created_at, index) => ({
    id: `history-${index + 1}`,
    restaurant_id: restaurantId,
    menu_id: menuId,
    dish_id: unavailableDishes[index % unavailableDishes.length].id,
    previous_available: true,
    final_available: false,
    actor_kind: historyActors[index],
    created_at
  }));
  return {
    restaurantId,
    menuId,
    restaurants: [{ id: restaurantId, name: "Maison Élysée", slug: "maison-elyse", city: "Montréal", location: "Montréal", cuisine_type: "Cuisine française contemporaine" }, { id: foreign.restaurant_id, name: "Foreign" }],
    menus: [{ id: menuId, restaurant_id: restaurantId, status: "published", is_primary: true, settings_json: { timezone: "America/Toronto" }, updated_at: "2026-07-10T10:24:00Z" }, { id: ADMIN_VISUAL_OTHER_MENU_ID, restaurant_id: restaurantId, status: "draft", is_primary: false }, { id: foreign.menu_id, restaurant_id: foreign.restaurant_id, status: "published" }],
    qr_codes: [{ id: ADMIN_VISUAL_QR_ID, restaurant_id: restaurantId, target_kind: "admin", target_path: "/admin", status: "active" }],
    menu_categories: [...menu_categories, { id: "other-menu-category", name: "Autre menu", slug: "other-menu", display_order: 1, restaurant_id: restaurantId, menu_id: ADMIN_VISUAL_OTHER_MENU_ID }, { id: "foreign-category", name: "Foreign", slug: "foreign", display_order: 999, ...foreign }],
    menu_dishes: [...menu_dishes, { id: "other-menu-dish", name: "Plat d’un autre menu", slug: "other-menu-dish", category_id: "other-menu-category", image_url: "", is_available: true, restaurant_id: restaurantId, menu_id: ADMIN_VISUAL_OTHER_MENU_ID }, { id: "foreign-dish", name: "Foreign", slug: "foreign", category_id: "foreign-category", image_url: "", is_available: true, ...foreign }],
    analytics_events,
    admin_dish_availability_schedules,
    admin_dish_availability_events,
    foreign
  };
}
