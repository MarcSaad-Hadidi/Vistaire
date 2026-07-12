import { getAllDishes, getCategories } from "../../lib/demoMenuData.ts";

export const ADMIN_VISUAL_RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
export const ADMIN_VISUAL_MENU_ID = "menu-maison-elysee";

export type AdminVisualFixtureScenario = "pixel-reference" | "full-menu";

const periodTotals = {
  current: { menu_opened: 1286, dish_opened: 3742, search_used: 562, immersive: 412 },
  previous: { menu_opened: 1090, dish_opened: 3018, search_used: 502, immersive: 315 }
} as const;

const searchTerms = ["homard bleu", "risotto cèpes", "sole meunière", "tartare de saumon", "dessert chocolat", "menu végétarien"];

export function filterAdminVisualFixtureRows<T extends Record<string, unknown>>(rows: T[], filters: Iterable<[string, string]>): T[] {
  let filtered = rows;
  for (const [column, raw] of filters) {
    const separator = raw.indexOf(".");
    const operator = separator < 0 ? raw : raw.slice(0, separator);
    const value = separator < 0 ? "" : raw.slice(separator + 1);
    if (operator === "eq") filtered = filtered.filter((row) => String(row[column] ?? "") === value);
    if (operator === "gte") filtered = filtered.filter((row) => String(row[column] ?? "") >= value);
    if (operator === "lt") filtered = filtered.filter((row) => String(row[column] ?? "") < value);
  }
  return filtered;
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
  const menu_dishes = getAllDishes().map((dish, index) => ({
    id: dish.id,
    category_id: dish.categorySlug,
    name: dish.name,
    slug: dish.slug,
    price_cents: Math.round(dish.price * 100),
    image_url: dish.image,
    // Full-menu QA deliberately covers both final states without altering the
    // canonical pixel-reference fixture or production/demo menu data.
    is_available: scenario === "full-menu" ? index % 5 !== 3 : dish.isAvailable,
    restaurant_id: restaurantId,
    menu_id: menuId,
    currency: "CAD",
    short_description: dish.shortDescription,
    description: dish.description,
    is_signature: dish.isSignature,
    is_recommended: dish.isRecommended,
    has_immersive_view: Boolean(dish.model3dUrl || dish.usdzUrl),
    metadata: {},
    created_at: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`
  }));
  const analytics_events: Record<string, string>[] = [];
  const addEvents = (period: keyof typeof periodTotals, startDay: number, month: number) => {
    const totals = periodTotals[period];
    const timestamp = (index: number) => new Date(Date.UTC(2026, month, startDay + (index % 7), 13 + (index % 10), index % 60)).toISOString();
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
      const dish = menu_dishes[index % menu_dishes.length];
      const category = menu_categories.find((candidate) => candidate.id === dish.category_id)!;
      analytics_events.push({ ...common("dish_opened", index), dish_id: dish.id, dish_slug: dish.slug, category_slug: category.slug });
    }
    for (let index = 0; index < totals.search_used; index++) analytics_events.push({ ...common("search_used", index), search_query: searchTerms[index % searchTerms.length] });
    for (let index = 0; index < totals.immersive; index++) {
      const dish = menu_dishes[index % menu_dishes.length];
      analytics_events.push({ ...common(index % 2 === 0 ? "dish_3d_clicked" : "dish_ar_clicked", index), dish_id: dish.id, dish_slug: dish.slug });
    }
  };
  addEvents("previous", 26, 5);
  addEvents("current", 3, 6);
  const foreign = { restaurant_id: "foreign-restaurant", menu_id: "foreign-menu", source: "demo" };
  analytics_events.push({ id: "foreign-event", event_name: "menu_opened", created_at: "2026-07-09T12:00:00Z", ...foreign });
  analytics_events.push({ id: "foreign-menu-event", restaurant_id: restaurantId, menu_id: foreign.menu_id, source: "production", event_name: "menu_opened", created_at: "2026-07-09T12:00:00Z" });
  return {
    restaurantId,
    menuId,
    restaurants: [{ id: restaurantId, name: "Maison Élysée", slug: "maison-elysee", city: "Montréal", cuisine_type: "Cuisine française contemporaine" }, { id: foreign.restaurant_id, name: "Foreign" }],
    menus: [{ id: menuId, restaurant_id: restaurantId, status: "published", is_primary: true, updated_at: "2026-07-10T10:24:00Z" }, { id: foreign.menu_id, restaurant_id: foreign.restaurant_id, status: "published" }],
    menu_categories: [...menu_categories, { id: "foreign-category", name: "Foreign", slug: "foreign", display_order: 999, ...foreign }],
    menu_dishes: [...menu_dishes, { id: "foreign-dish", name: "Foreign", slug: "foreign", category_id: "foreign-category", image_url: "", is_available: true, ...foreign }],
    analytics_events,
    foreign
  };
}
