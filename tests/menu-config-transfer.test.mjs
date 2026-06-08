import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_MENU_UI_CONFIG } from "../lib/menu/menuUiConfig.ts";
import {
  exportMenuDesignConfig,
  importMenuDesignConfig,
  duplicateMenuDesignConfig,
  MENU_DESIGN_CONFIG_TRANSFER_KEYS
} from "../lib/menu/menuConfigTransfer.ts";

test("export config excludes dishes and restaurant business data", () => {
  const exported = exportMenuDesignConfig({
    ...DEFAULT_MENU_UI_CONFIG,
    dishes: [{ name: "Invented", price: "99" }],
    prices: ["99"],
    restaurantSecret: "sk_live_hidden"
  });
  const parsed = JSON.parse(exported);

  assert.equal(parsed.schema, "vistaire.menu-design-config.v1");
  assert.equal("dishes" in parsed.config, false);
  assert.equal("prices" in parsed.config, false);
  assert.equal("restaurantSecret" in parsed.config, false);
  assert.deepEqual(Object.keys(parsed.config).sort(), MENU_DESIGN_CONFIG_TRANSFER_KEYS.slice().sort());
});

test("import invalid JSON fails", () => {
  const result = importMenuDesignConfig("{not-json");

  assert.equal(result.ok, false);
  assert.match(result.error, /JSON/i);
});

test("import unsafe config fails", () => {
  const result = importMenuDesignConfig(
    JSON.stringify({
      schema: "vistaire.menu-design-config.v1",
      config: {
        ...DEFAULT_MENU_UI_CONFIG,
        apiKey: "sk_live_hidden",
        generatedDishes: [{ name: "Invented" }]
      }
    })
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /unsafe|menu data|secret/i);
});

test("import valid config normalizes and preserves design only", () => {
  const result = importMenuDesignConfig(
    JSON.stringify({
      schema: "vistaire.menu-design-config.v1",
      config: {
        ...DEFAULT_MENU_UI_CONFIG,
        theme: "premium-gastronomic",
        experience: { blueprint: "editorial-magazine" }
      }
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.config.theme, "premium-gastronomic");
  assert.equal(result.config.experience.blueprint, "editorial-magazine");
  assert.equal("dishes" in result.config, false);
});

test("duplicate config preserves design only", () => {
  const duplicate = duplicateMenuDesignConfig({
    ...DEFAULT_MENU_UI_CONFIG,
    theme: "night-market",
    menuItems: [{ name: "Invented" }],
    price: "12"
  });

  assert.equal(duplicate.theme, "night-market");
  assert.equal("menuItems" in duplicate, false);
  assert.equal("price" in duplicate, false);
});
