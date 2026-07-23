import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createRestaurantRecord,
  validateCreateRestaurantInput
} from "../lib/owner/restaurantCreation.ts";
import { buildMenuUiConfigForRestaurant } from "../lib/menu/menuAppearance.ts";
import { createPendingUniqueMenuDesign } from "../lib/menu/uniqueMenuDesign.ts";
import { normalizeMenuUiConfig } from "../lib/menu/menuUiConfig.ts";

function uniqueWorkflowInput(name, slug) {
  return {
    name,
    slug,
    location: "Montreal",
    cuisineType: "Cuisine de saison",
    status: "setup_needed",
    contactName: "Camille",
    contactEmail: "camille@example.com",
    contactPhone: "+1 514 555 0123",
    notes: "Creation unique",
    menuLanguages: ["fr", "en"],
    publicMenuSettings: {
      defaultLocale: "fr-CA",
      supportedLocales: ["fr-CA", "en-CA"],
      baseCurrency: "CAD",
      defaultCurrency: "CAD",
      supportedCurrencies: ["CAD"],
      publicMenuStyle: "unique",
      timezone: "America/Toronto",
      defaultThemeMode: "dark",
      allowThemeToggle: true,
      allowCurrencySelector: true,
      allowLanguageSelector: true,
      taxIncluded: true,
      priceDisplayMode: "auto"
    },
    menuAppearance: {
      template: "unique",
      presetId: "noir-champagne",
      primaryColor: "#e8cf9b",
      secondaryColor: "#c69252",
      themeMode: "dark"
    },
    sections: [
      { id: "section-entrees", name: "Entrees", description: "Ouvertures", order: 1 }
    ],
    dishes: [
      {
        name: "Soupe du jour",
        section: "Entrees",
        price: "12",
        description: "Legumes de saison.",
        available: true,
        photoStatus: "planned",
        tags: [],
        ingredients: [],
        options: [],
        allergens: [],
        allergenDeclarations: null
      }
    ]
  };
}

test("rejects conflict between publicMenuStyle and menuAppearance.template", () => {
  const input = uniqueWorkflowInput("Conflict Bistro", "conflict-bistro");
  input.menuAppearance = {
    ...input.menuAppearance,
    template: "trouvable"
  };
  const result = validateCreateRestaurantInput(input);
  assert.equal(result.ok, false);
  assert.match(result.error, /Conflit/i);
});

test("rejects client-submitted unique identity fields", () => {
  const input = {
    ...uniqueWorkflowInput("Client Id Bistro", "client-id-bistro"),
    designId: "11111111-1111-4111-8111-111111111111"
  };
  const result = validateCreateRestaurantInput(input);
  assert.equal(result.ok, false);
  assert.match(result.error, /serveur/i);
});

test("unique creation payload generates distinct server designIds", async () => {
  const captured = [];

  async function runOnce(name, slug) {
    const rpc = async (_fn, args) => {
      captured.push(args.p_payload);
      const designId = args.p_payload.ui_config.config_json.uniqueDesign.designId;
      return {
        data: {
          ok: true,
          restaurant: {
            id: crypto.randomUUID(),
            name,
            slug,
            location: "Montreal",
            cuisine_type: "Cuisine de saison",
            status: "setup_needed",
            contact_name: "Camille",
            contact_email: "camille@example.com",
            public_menu_url: `https://example.com/menu/${slug}`
          },
          uiConfigPersisted: true,
          menuPersisted: true,
          categoriesPersisted: true,
          dishesPersisted: true,
          persistedDishCount: 1,
          persistedCategoryCount: 1,
          mediaBasePath: `restaurants/${designId}/photos/`,
          warnings: []
        },
        error: null
      };
    };

    const result = await createRestaurantRecord(uniqueWorkflowInput(name, slug), {
      admin: {
        ok: true,
        client: { rpc }
      },
      getColumns: async () => new Set(),
      env: { NEXT_PUBLIC_SITE_URL: "https://example.com" }
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.uniqueDesignPersisted, true);
      assert.ok(result.uniqueDesignId);
      assert.equal(result.uniqueDesignStatus, "pending");
    }
  }

  await runOnce("Restaurant A Unique", "restaurant-a-unique");
  await runOnce("Restaurant B Unique", "restaurant-b-unique");

  const designA = captured[0].ui_config.config_json.uniqueDesign;
  const designB = captured[1].ui_config.config_json.uniqueDesign;
  assert.equal(designA.status, "pending");
  assert.equal(designB.status, "pending");
  assert.equal(designA.rendererKey, null);
  assert.equal(designB.rendererKey, null);
  assert.notEqual(designA.designId, designB.designId);
});

test("mutating unique config A does not alter config B instances", () => {
  const designA = createPendingUniqueMenuDesign({
    designId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  });
  const designB = createPendingUniqueMenuDesign({
    designId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  });
  const configA = buildMenuUiConfigForRestaurant({
    name: "A",
    slug: "a-unique",
    appearance: {
      template: "unique",
      presetId: "noir-champagne",
      primaryColor: "#e8cf9b",
      secondaryColor: "#c69252",
      themeMode: "dark"
    },
    uniqueDesign: designA
  });
  const configB = buildMenuUiConfigForRestaurant({
    name: "B",
    slug: "b-unique",
    appearance: {
      template: "unique",
      presetId: "espresso-creme",
      primaryColor: "#b9794e",
      secondaryColor: "#e8c9a7",
      themeMode: "dark"
    },
    uniqueDesign: designB
  });

  const mutatedA = normalizeMenuUiConfig({
    ...configA,
    welcomeTitle: "Mutated A",
    uniqueDesign: {
      ...configA.uniqueDesign,
      status: "draft",
      version: 2
    }
  });

  assert.equal(configB.uniqueDesign?.designId, designB.designId);
  assert.equal(configB.uniqueDesign?.status, "pending");
  assert.equal(configB.uniqueDesign?.version, 1);
  assert.notEqual(mutatedA.uniqueDesign?.designId, configB.uniqueDesign?.designId);
  assert.notEqual(mutatedA.welcomeTitle, configB.welcomeTitle);
  assert.notEqual(mutatedA.palette.accent, configB.palette.accent);
});

test("create form exposes Nouveau UI unique card", async () => {
  const source = await readFile(
    new URL("../components/owner/RestaurantCreateForm.tsx", import.meta.url),
    "utf8"
  );
  assert.match(source, /Nouveau UI unique/);
  assert.match(source, /SUR MESURE/);
  assert.match(source, /Design unique à construire/);
  assert.match(source, /APERÇU DE SECOURS/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /Identité visuelle de secours/);
});

test("no slug-based unique renderer switches in menu libs", async () => {
  const routeHelper = await readFile(
    new URL("../lib/menu/publicMenuExperienceRoute.ts", import.meta.url),
    "utf8"
  );
  const registry = await readFile(
    new URL("../lib/menu/uniqueMenuRendererRegistry.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(routeHelper, /slug\s*===/);
  assert.doesNotMatch(registry, /import\s*\(\s*[`'"].*\$\{/);
  assert.match(registry, /UNIQUE_MENU_RENDERERS/);
});
