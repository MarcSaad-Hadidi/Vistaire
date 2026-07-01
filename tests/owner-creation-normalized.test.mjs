import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createRestaurantRecord,
  validateCreateRestaurantInput
} from "../lib/owner/restaurantCreation.ts";

const restaurantId = "11111111-2222-4333-8444-555555555555";
const menuId = "22222222-3333-4444-8555-666666666666";

const workflowInput = {
  name: "Le Comptoir Decimal",
  slug: "le-comptoir-decimal",
  location: "Montreal",
  cuisineType: "Cuisine de saison",
  status: "setup_needed",
  contactName: "Camille",
  contactEmail: "camille@example.com",
  contactPhone: "+1 514 555 0123",
  googleReviewUrl: "https://search.google.com/local/writereview?placeid=abc123",
  notes: "Creation relationnelle",
  menuLanguages: ["fr", "en"],
  publicMenuSettings: {
    defaultLocale: "en-CA",
    supportedLocales: ["fr-CA", "en-CA"],
    baseCurrency: "CAD",
    defaultCurrency: "USD",
    supportedCurrencies: ["CAD", "USD"],
    publicMenuStyle: "maison-elyse",
    timezone: "America/Toronto",
    defaultThemeMode: "light",
    allowThemeToggle: true,
    allowCurrencySelector: true,
    allowLanguageSelector: true,
    taxIncluded: true,
    priceDisplayMode: "auto"
  },
  sections: [
    { id: "section-entrees", name: "Entrees", description: "Ouvertures de saison", order: 1 },
    { id: "section-desserts", name: "Desserts", description: "Finir doucement", order: 2 }
  ],
  dishes: [
    {
      name: "Betteraves roties",
      section: "Entrees",
      price: "14,99",
      displayPriceMode: "decimal",
      description: "Creme crue, vinaigrette aux agrumes.",
      ingredients: ["betterave"],
      allergens: ["lait"],
      tags: ["Signature", "Recommande"],
      options: ["Sans lactose sur demande"],
      chefNote: "Servir frais.",
      available: true,
      photoStatus: "planned"
    },
    {
      name: "Madeleine maison",
      section: "Desserts",
      price: "15",
      displayPriceMode: "integer",
      description: "Beurre noisette, sucre glace.",
      ingredients: ["beurre", "farine"],
      allergens: [],
      tags: ["Maison"],
      options: [],
      chefNote: "",
      available: true,
      photoStatus: "missing"
    }
  ]
};

function rpcClient({ onRpc = () => {}, data, error = null } = {}) {
  return {
    async rpc(name, params) {
      onRpc(name, params);
      return { data, error };
    }
  };
}

test("restaurant creation validates string prices and display modes", () => {
  const result = validateCreateRestaurantInput(workflowInput);

  assert.equal(result.ok, true);
  assert.equal(result.value.dishes[0].price, "14,99");
  assert.equal(result.value.dishes[0].displayPriceMode, "decimal");
  assert.equal(result.value.dishes[1].price, "15");
  assert.equal(result.value.dishes[1].displayPriceMode, "integer");

  assert.deepEqual(
    validateCreateRestaurantInput({
      ...workflowInput,
      dishes: [{ ...workflowInput.dishes[0], price: "14.999" }]
    }),
    {
      ok: false,
      error: "Prix invalide : maximum 2 decimales."
    }
  );
});

test("restaurant creation calls transactional RPC with normalized menu graph", async () => {
  let rpcName = "";
  let payload;
  const result = await createRestaurantRecord(workflowInput, {
    admin: {
      ok: true,
      client: rpcClient({
        onRpc(name, params) {
          rpcName = name;
          payload = params.p_payload;
        },
        data: {
          ok: true,
          restaurantPersisted: true,
          menuPersisted: true,
          categoriesPersisted: true,
          dishesPersisted: true,
          uiConfigPersisted: true,
          persistedCategoryCount: 2,
          persistedDishCount: 2,
          mediaBasePath: `restaurants/${restaurantId}/photos/`,
          qrCodesHref: `/owner/restaurants/${restaurantId}/qr`,
          warnings: [],
          restaurant: {
            id: restaurantId,
            name: "Le Comptoir Decimal",
            slug: "le-comptoir-decimal",
            status: "setup_needed",
            location: "Montreal",
            cuisine_type: "Cuisine de saison",
            contact_name: "Camille",
            contact_email: "camille@example.com"
          },
          menu: {
            id: menuId,
            restaurant_id: restaurantId,
            name: "Menu principal",
            slug: "principal",
            status: "published",
            is_primary: true
          }
        }
      })
    },
    getColumns: async () => new Set(),
    env: { NEXT_PUBLIC_SITE_URL: "https://vistaire.test" }
  });

  assert.equal(result.ok, true);
  assert.equal(rpcName, "create_owner_restaurant_with_menu");
  assert.equal(payload.restaurant.slug, "le-comptoir-decimal");
  assert.equal(payload.menu.status, "published");
  assert.equal(payload.menu.is_primary, true);
  assert.equal(payload.menu.settings_json.defaultLocale, "en-CA");
  assert.equal(payload.menu.settings_json.defaultCurrency, "USD");
  assert.deepEqual(payload.menu.settings_json.supportedCurrencies, ["CAD", "USD"]);
  assert.equal(payload.menu.settings_json.publicMenuStyle, "maison-elyse");
  assert.equal(payload.ui_config.config_json.publicMenuStyle, "maison-elyse");
  assert.equal(payload.categories.length, 2);
  assert.equal(payload.categories[0].name, "Entrees");
  assert.equal(payload.categories[1].name, "Desserts");
  assert.equal(payload.dishes.length, 2);
  assert.equal(payload.dishes[0].category_slug, payload.categories[0].slug);
  assert.equal(payload.dishes[0].price_cents, 1499);
  assert.equal(payload.dishes[0].currency, "CAD");
  assert.equal(payload.dishes[0].is_signature, true);
  assert.equal(payload.dishes[0].is_recommended, true);
  assert.equal(payload.dishes[0].has_immersive_view, false);
  assert.equal(payload.dishes[0].metadata.originalPriceInput, "14,99");
  assert.equal(payload.dishes[0].metadata.displayPriceMode, "decimal");
  assert.equal(payload.dishes[1].price_cents, 1500);
  assert.equal(payload.dishes[1].metadata.displayPriceMode, "integer");
  assert.deepEqual(payload.dishes[0].metadata.menuLanguages, ["fr", "en"]);
  assert.equal(result.menuPersisted, true);
  assert.equal(result.categoriesPersisted, true);
  assert.equal(result.persistedCategoryCount, 2);
  assert.equal(result.persistedDishCount, 2);
});

test("restaurant creation rejects settings defaults outside enabled options", () => {
  const result = validateCreateRestaurantInput({
    ...workflowInput,
    publicMenuSettings: {
      ...workflowInput.publicMenuSettings,
      supportedLocales: ["fr-CA"],
      defaultLocale: "en-CA"
    }
  });

  assert.deepEqual(result, {
    ok: false,
    error: "La langue par defaut doit etre activee."
  });
});

test("restaurant creation treats child persistence failure as API failure", async () => {
  const result = await createRestaurantRecord(workflowInput, {
    admin: {
      ok: true,
      client: rpcClient({
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint"
        }
      })
    },
    getColumns: async () => new Set()
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.match(result.error, /creation transactionnelle/i);
});

test("transactional restaurant creation migration defines RPC and menu graph writes", async () => {
  const sql = await readFile(
    "supabase/migrations/0013_create_owner_restaurant_with_menu.sql",
    "utf8"
  );

  assert.match(sql, /create or replace function public\.create_owner_restaurant_with_menu/i);
  assert.match(sql, /insert into public\.restaurants/i);
  assert.match(sql, /insert into public\.menus/i);
  assert.match(sql, /'published'/i);
  assert.match(sql, /insert into public\.menu_categories/i);
  assert.match(sql, /insert into public\.menu_dishes/i);
  assert.match(sql, /price_cents/i);
  assert.match(sql, /insert into public\.menu_ui_configs/i);
  assert.match(sql, /revoke execute on function public\.create_owner_restaurant_with_menu/i);
  assert.match(sql, /grant execute on function public\.create_owner_restaurant_with_menu/i);
});

test("menu settings migration adds settings_json and persists it in RPC", async () => {
  const sql = await readFile(
    "supabase/migrations/20260701031742_menu_settings_and_rpc.sql",
    "utf8"
  );

  assert.match(sql, /alter table public\.menus\s+add column if not exists settings_json jsonb/i);
  assert.match(sql, /menus_settings_json_is_object/i);
  assert.match(sql, /settings_json/i);
  assert.match(sql, /v_menu -> 'settings_json'/i);
  assert.match(sql, /notify pgrst, 'reload schema'/i);
});
