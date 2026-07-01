import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRelationalSupabasePublicMenu,
  getVisiblePublicMenuCategories
} from "../lib/menu/publicMenuCore.ts";

const restaurantId = "11111111-2222-4333-8444-555555555555";
const menuId = "22222222-3333-4444-8555-666666666666";
const entreeId = "33333333-4444-4555-8666-777777777777";
const dessertId = "44444444-5555-4666-8777-888888888888";

test("buildRelationalSupabasePublicMenu maps categories, dishes, metadata, and price display modes", () => {
  const menu = buildRelationalSupabasePublicMenu({
    slug: "le-comptoir-decimal",
    restaurantRow: {
      id: restaurantId,
      name: "Le Comptoir Decimal",
      slug: "le-comptoir-decimal",
      location: "Montreal",
      cuisine_type: "Cuisine de saison"
    },
    menuRow: {
      id: menuId,
      restaurant_id: restaurantId,
      slug: "principal",
      status: "published",
      is_primary: true,
      settings_json: {
        defaultLocale: "en-CA",
        supportedLocales: ["en-CA"],
        baseCurrency: "USD",
        defaultCurrency: "USD",
        supportedCurrencies: ["USD"],
        publicMenuStyle: "maison-elyse",
        timezone: "America/New_York",
        defaultThemeMode: "light",
        allowThemeToggle: false,
        allowCurrencySelector: false,
        allowLanguageSelector: false,
        taxIncluded: true,
        priceDisplayMode: "decimal"
      }
    },
    categoryRows: [
      {
        id: entreeId,
        restaurant_id: restaurantId,
        menu_id: menuId,
        name: "Entrees",
        slug: "entrees",
        description: "Ouvertures de saison",
        display_order: 1
      },
      {
        id: dessertId,
        restaurant_id: restaurantId,
        menu_id: menuId,
        name: "Desserts",
        slug: "desserts",
        description: "Finir doucement",
        display_order: 2
      }
    ],
    dishRows: [
      {
        id: "55555555-6666-4777-8888-999999999999",
        restaurant_id: restaurantId,
        menu_id: menuId,
        category_id: entreeId,
        slug: "betteraves-roties",
        name: "Betteraves roties",
        short_description: "Creme crue, vinaigrette aux agrumes.",
        description: "Creme crue, vinaigrette aux agrumes.",
        price_cents: 1499,
        currency: "CAD",
        image_url: "/api/public/menu-dishes/55555555-6666-4777-8888-999999999999/photo",
        is_available: true,
        is_signature: true,
        is_recommended: true,
        has_immersive_view: false,
        allergens: ["lait"],
        metadata: {
          ingredients: ["betterave"],
          options: ["Sans lactose sur demande"],
          tags: ["Maison"],
          badges: ["Signature", "Recommande"],
          chefNote: "Servir frais.",
          photoStatus: "ready",
          displayPriceMode: "decimal",
          originalPriceInput: "14,99"
        }
      },
      {
        id: "66666666-7777-4888-8999-000000000000",
        restaurant_id: restaurantId,
        menu_id: menuId,
        category_id: dessertId,
        slug: "madeleine-maison",
        name: "Madeleine maison",
        short_description: "Beurre noisette, sucre glace.",
        price_cents: 1500,
        currency: "CAD",
        is_available: true,
        is_signature: false,
        is_recommended: false,
        has_immersive_view: true,
        allergens: [],
        metadata: {
          photoStatus: "missing",
          displayPriceMode: "integer",
          webModel3dUrl: "https://cdn.example.test/madeleine.glb",
          arUsdzUrl: "https://cdn.example.test/madeleine.usdz",
          modelStatus: "ready"
        }
      }
    ]
  });

  assert.equal(menu.dishes.length, 2);
  assert.equal(menu.settings.defaultLocale, "en-CA");
  assert.deepEqual(menu.settings.supportedCurrencies, ["USD"]);
  assert.equal(menu.settings.publicMenuStyle, "maison-elyse");
  assert.equal(menu.publicMenuStyleExplicit, true);
  assert.equal(menu.dishes[0].category, "Entrees");
  assert.equal(menu.dishes[0].categoryDescription, "Ouvertures de saison");
  assert.equal(menu.dishes[0].priceLabel, "14,99\u00a0$");
  assert.equal(menu.dishes[0].priceCurrency, "CAD");
  assert.equal(menu.dishes[0].baseCurrency, "USD");
  assert.equal(menu.dishes[0].photoStatus, "ready");
  assert.deepEqual(menu.dishes[0].ingredients, ["betterave"]);
  assert.deepEqual(menu.dishes[0].options, ["Sans lactose sur demande"]);
  assert.deepEqual(menu.dishes[0].tags, ["Maison", "Signature", "Recommande"]);
  assert.equal(menu.dishes[0].houseNote, "Servir frais.");
  assert.equal(menu.dishes[1].priceLabel, "15\u00a0$");
  assert.equal(menu.dishes[1].hasImmersive, true);
  assert.equal(menu.dishes[1].webModel3dUrl, "https://cdn.example.test/madeleine.glb");
  assert.equal(menu.dishes[1].arUsdzUrl, "https://cdn.example.test/madeleine.usdz");

  const categories = getVisiblePublicMenuCategories(menu.dishes);
  assert.deepEqual(
    categories.map((category) => [category.label, category.description]),
    [
      ["Entrees", "Ouvertures de saison"],
      ["Desserts", "Finir doucement"]
    ]
  );
});
