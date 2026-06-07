import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MENU_UI_CONFIG,
  MENU_UI_THEME_IDS,
  normalizeMenuUiConfig,
  validateMenuUiConfig
} from "../lib/menu/menuUiConfig.ts";

test("default menu UI config is safe for public rendering", () => {
  assert.equal(DEFAULT_MENU_UI_CONFIG.theme, "fresh-homemade");
  assert.equal(DEFAULT_MENU_UI_CONFIG.welcomeEnabled, true);
  assert.equal(DEFAULT_MENU_UI_CONFIG.defaultView, "all");
  assert.equal(DEFAULT_MENU_UI_CONFIG.show3dBadges, true);
  assert.equal(DEFAULT_MENU_UI_CONFIG.showArBadges, true);
  assert.equal(MENU_UI_THEME_IDS.includes(DEFAULT_MENU_UI_CONFIG.theme), true);
});

test("rejects invalid menu UI themes and unsafe option values", () => {
  const result = validateMenuUiConfig({
    theme: "neon-dashboard",
    motion: "spin",
    categoryNavigation: "mega-menu",
    dishCardStyle: "spreadsheet",
    detailStyle: "new-window",
    density: "tiny"
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /theme/i);
});

test("normalizes booleans, whitelisted options, and text lengths", () => {
  const config = normalizeMenuUiConfig({
    theme: "premium-gastronomic",
    welcomeEnabled: false,
    welcomeTitle: "x".repeat(150),
    welcomeSubtitle: "y".repeat(220),
    motion: "none",
    categoryNavigation: "cards",
    dishCardStyle: "minimal-list",
    detailStyle: "simple-card",
    density: "compact",
    showPhotoPlaceholders: false,
    show3dBadges: "truthy",
    showArBadges: 0
  });

  assert.equal(config.theme, "premium-gastronomic");
  assert.equal(config.welcomeEnabled, false);
  assert.equal(config.welcomeTitle.length, 120);
  assert.equal(config.welcomeSubtitle.length, 180);
  assert.equal(config.motion, "none");
  assert.equal(config.categoryNavigation, "cards");
  assert.equal(config.dishCardStyle, "minimal-list");
  assert.equal(config.detailStyle, "simple-card");
  assert.equal(config.density, "compact");
  assert.equal(config.showPhotoPlaceholders, false);
  assert.equal(config.show3dBadges, true);
  assert.equal(config.showArBadges, false);
});

