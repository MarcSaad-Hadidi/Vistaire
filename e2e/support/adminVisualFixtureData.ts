import { getAllDishes, getCategories } from "../../lib/demoMenuData.ts";

export const ADMIN_VISUAL_RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";
export const ADMIN_VISUAL_MENU_ID = "menu-maison-elysee";

export function buildAdminVisualFixtureTables() {
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
    is_available: dish.isAvailable,
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
  const foreign = { restaurant_id: "foreign-restaurant", menu_id: "foreign-menu", source: "demo" };
  return {
    restaurantId,
    menuId,
    restaurants: [{ id: restaurantId, name: "Maison Élysée", slug: "maison-elysee", city: "Montréal", cuisine_type: "Cuisine française contemporaine" }, { id: foreign.restaurant_id, name: "Foreign" }],
    menus: [{ id: menuId, restaurant_id: restaurantId, status: "published", is_primary: true, updated_at: "2026-07-10T10:24:00Z" }, { id: foreign.menu_id, restaurant_id: foreign.restaurant_id, status: "published" }],
    menu_categories: [...menu_categories, { id: "foreign-category", name: "Foreign", slug: "foreign", display_order: 999, ...foreign }],
    menu_dishes: [...menu_dishes, { id: "foreign-dish", name: "Foreign", slug: "foreign", category_id: "foreign-category", image_url: "", is_available: true, ...foreign }],
    foreign
  };
}
