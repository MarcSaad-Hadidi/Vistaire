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
          options: ["sans lactose sur demande"],
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
  assert.deepEqual(menu.dishes[0].ingredients, ["Betterave"]);
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

test("relational public menu uses persisted dish display order instead of UUID order", () => {
  const menu = buildRelationalSupabasePublicMenu({
    slug: "sauge-noire",
    restaurantRow: {
      id: restaurantId,
      name: "Sauge Noire",
      slug: "sauge-noire"
    },
    menuRow: {
      id: menuId,
      restaurant_id: restaurantId,
      settings_json: { baseCurrency: "CAD", defaultLocale: "fr-CA" }
    },
    categoryRows: [
      {
        id: entreeId,
        restaurant_id: restaurantId,
        menu_id: menuId,
        name: "Cru & frais",
        display_order: 1
      }
    ],
    dishRows: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        restaurant_id: restaurantId,
        menu_id: menuId,
        category_id: entreeId,
        name: "Deuxième plat",
        slug: "deuxieme-plat",
        display_order: 2,
        is_available: true
      },
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        restaurant_id: restaurantId,
        menu_id: menuId,
        category_id: entreeId,
        name: "Premier plat",
        slug: "premier-plat",
        display_order: 1,
        is_available: true
      }
    ]
  });

  assert.deepEqual(
    menu.dishes.map((dish) => dish.name),
    ["Premier plat", "Deuxième plat"]
  );
});

test("relational public menu keeps zero-valued legacy dishes in stable id order", () => {
  const menu = buildRelationalSupabasePublicMenu({
    slug: "sauge-noire",
    restaurantRow: { id: restaurantId, name: "Sauge Noire", slug: "sauge-noire" },
    menuRow: { id: menuId, restaurant_id: restaurantId, settings_json: {} },
    categoryRows: [
      { id: entreeId, restaurant_id: restaurantId, menu_id: menuId, name: "Cru & frais", display_order: 1 }
    ],
    dishRows: [
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", restaurant_id: restaurantId, menu_id: menuId, category_id: entreeId, name: "Deuxième", is_available: true, display_order: 0 },
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", restaurant_id: restaurantId, menu_id: menuId, category_id: entreeId, name: "Premier", is_available: true, display_order: 0 }
    ]
  });

  assert.deepEqual(menu.dishes.map((dish) => dish.name), ["Premier", "Deuxième"]);
});

test("buildRelationalSupabasePublicMenu reads settings from menu metadata fallback", () => {
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
      metadata: {
        publicMenuSettings: {
          defaultLocale: "en-CA",
          supportedLocales: ["fr-CA", "en-CA"],
          baseCurrency: "CAD",
          defaultCurrency: "USD",
          supportedCurrencies: ["CAD", "USD"],
          publicMenuStyle: "maison-elyse",
          timezone: "America/Toronto",
          defaultThemeMode: "dark",
          allowThemeToggle: true,
          allowCurrencySelector: true,
          allowLanguageSelector: true,
          taxIncluded: true,
          priceDisplayMode: "auto"
        }
      }
    },
    categoryRows: [],
    dishRows: []
  });

  assert.equal(menu.settings.defaultLocale, "en-CA");
  assert.deepEqual(menu.settings.supportedCurrencies, ["CAD", "USD"]);
  assert.equal(menu.settings.defaultCurrency, "USD");
  assert.equal(menu.settings.publicMenuStyle, "maison-elyse");
  assert.equal(menu.publicMenuStyleExplicit, true);
});

test("buildRelationalSupabasePublicMenu reads localized UI copy from menu settings by locale", () => {
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
        defaultLocale: "fr-CA",
        supportedLocales: ["fr-CA", "de-DE"],
        localizedUiCopy: {
          "de-DE": {
            filterButton: "Filtern",
            swipeLabel: "Wischen",
            threeD: "IN 3D ANSEHEN"
          }
        }
      }
    },
    categoryRows: [],
    dishRows: []
  });

  assert.deepEqual(menu.localizedUiCopy?.["de-DE"], {
    filterButton: "Filtern",
    swipeLabel: "Wischen",
    threeD: "IN 3D ANSEHEN"
  });
  assert.deepEqual(menu.settings.supportedLocales, ["fr-CA", "de-DE"]);
});

test("buildRelationalSupabasePublicMenu preserves legacy flat UI copy from menu settings", () => {
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
        defaultLocale: "pt-BR",
        supportedLocales: ["pt-BR"],
        uiCopy: {
          filterButton: "Filtrar",
          greeting: {
            morning: "Bom dia"
          },
          threeD: "VER EM 3D",
          waiterTopics: {
            selection: "Pedir minha seleção"
          }
        }
      }
    },
    categoryRows: [],
    dishRows: []
  });

  assert.deepEqual(menu.localizedUiCopy, {
    filterButton: "Filtrar",
    greeting: {
      morning: "Bom dia"
    },
    threeD: "VER EM 3D",
    waiterTopics: {
      selection: "Pedir minha seleção"
    }
  });
});

test("buildRelationalSupabasePublicMenu reads settings from menu_ui_configs fallback", () => {
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
      is_primary: true
    },
    legacyPublicMenuSettings: {
      defaultLocale: "en-CA",
      supportedLocales: ["fr-CA", "en-CA"],
      baseCurrency: "USD",
      defaultCurrency: "USD",
      supportedCurrencies: ["USD", "CAD"],
      publicMenuStyle: "trouvable",
      timezone: "America/Toronto",
      defaultThemeMode: "light",
      allowThemeToggle: true,
      allowCurrencySelector: true,
      allowLanguageSelector: true,
      taxIncluded: false,
      priceDisplayMode: "decimal"
    },
    categoryRows: [],
    dishRows: []
  });

  assert.equal(menu.settings.defaultLocale, "en-CA");
  assert.equal(menu.settings.baseCurrency, "USD");
  assert.equal(menu.settings.defaultCurrency, "USD");
  assert.deepEqual(menu.settings.supportedCurrencies, ["CAD", "USD"]);
  assert.equal(menu.settings.publicMenuStyle, "trouvable");
});

test("buildRelationalSupabasePublicMenu reads localized UI copy from menu_ui_configs fallback", () => {
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
      is_primary: true
    },
    legacyPublicMenuSettings: {
      source: "menu_ui_configs",
      settings: {
        defaultLocale: "fr-CA",
        supportedLocales: ["fr-CA", "pt-BR"],
        baseCurrency: "CAD",
        defaultCurrency: "CAD",
        supportedCurrencies: ["CAD"],
        publicMenuStyle: "trouvable",
        timezone: "America/Toronto",
        defaultThemeMode: "dark",
        allowThemeToggle: true,
        allowCurrencySelector: true,
        allowLanguageSelector: true,
        taxIncluded: true,
        priceDisplayMode: "auto"
      },
      localizedUiCopy: {
        pt: {
          filterButton: "Filtrar",
          swipeLabel: "Deslizar"
        }
      }
    },
    categoryRows: [],
    dishRows: []
  });

  assert.deepEqual(menu.localizedUiCopy?.pt, {
    filterButton: "Filtrar",
    swipeLabel: "Deslizar"
  });
  assert.deepEqual(menu.settings.supportedLocales, ["fr-CA", "pt-BR"]);
});

test("buildRelationalSupabasePublicMenu keeps meaningful menu settings canonical over newer legacy settings", () => {
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
      updated_at: "2026-07-01T12:00:00.000Z",
      settings_json: {
        defaultLocale: "fr-CA",
        supportedLocales: ["fr-CA", "en-CA"],
        baseCurrency: "CAD",
        defaultCurrency: "CAD",
        supportedCurrencies: ["CAD"],
        publicMenuStyle: "maison-elyse",
        allowCurrencySelector: false,
        allowLanguageSelector: false
      }
    },
    legacyPublicMenuSettings: {
      source: "menu_ui_configs",
      updatedAt: "2026-07-02T12:00:00.000Z",
      settings: {
        defaultLocale: "fr-CA",
        supportedLocales: ["fr-CA", "en-CA", "es-ES", "it-IT", "de-DE", "ar"],
        baseCurrency: "CAD",
        defaultCurrency: "CAD",
        supportedCurrencies: ["CAD", "USD", "EUR", "GBP"],
        publicMenuStyle: "trouvable",
        timezone: "America/Toronto",
        defaultThemeMode: "dark",
        allowThemeToggle: true,
        allowCurrencySelector: true,
        allowLanguageSelector: true,
        taxIncluded: true,
        priceDisplayMode: "auto"
      }
    },
    categoryRows: [],
    dishRows: []
  });

  assert.deepEqual(menu.settings.supportedLocales, ["fr-CA", "en-CA"]);
  assert.deepEqual(menu.settings.supportedCurrencies, ["CAD"]);
  assert.equal(menu.settings.allowLanguageSelector, false);
  assert.equal(menu.settings.allowCurrencySelector, false);
  assert.equal(menu.settings.publicMenuStyle, "maison-elyse");
  assert.equal(menu.publicMenuStyleExplicit, true);
});

test("buildRelationalSupabasePublicMenu prefers fresh menu settings over older menu_ui_configs fallback", () => {
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
      updated_at: "2026-07-03T12:00:00.000Z",
      settings_json: {
        defaultLocale: "fr-CA",
        supportedLocales: ["fr-CA", "en-CA", "es-ES", "it-IT", "de-DE", "ar"],
        baseCurrency: "CAD",
        defaultCurrency: "CAD",
        supportedCurrencies: ["CAD", "USD", "EUR", "GBP"],
        publicMenuStyle: "trouvable",
        timezone: "America/Toronto",
        defaultThemeMode: "dark",
        allowThemeToggle: true,
        allowCurrencySelector: true,
        allowLanguageSelector: true,
        taxIncluded: true,
        priceDisplayMode: "auto"
      }
    },
    legacyPublicMenuSettings: {
      source: "menu_ui_configs",
      updatedAt: "2026-07-02T12:00:00.000Z",
      settings: {
        defaultLocale: "fr-CA",
        supportedLocales: ["fr-CA", "en-CA"],
        baseCurrency: "CAD",
        defaultCurrency: "CAD",
        supportedCurrencies: ["CAD"],
        publicMenuStyle: "maison-elyse",
        allowCurrencySelector: false,
        allowLanguageSelector: false
      }
    },
    categoryRows: [],
    dishRows: []
  });

  assert.deepEqual(menu.settings.supportedLocales, [
    "fr-CA",
    "en-CA",
    "es-ES",
    "it-IT",
    "de-DE",
    "ar"
  ]);
  assert.deepEqual(menu.settings.supportedCurrencies, ["CAD", "USD", "EUR", "GBP"]);
  assert.equal(menu.settings.allowLanguageSelector, true);
  assert.equal(menu.settings.allowCurrencySelector, true);
  assert.equal(menu.settings.publicMenuStyle, "trouvable");
  assert.equal(menu.publicMenuStyleExplicit, true);
});
