import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MENU_UI_CONFIG,
  MENU_DETAIL_PRESENTATION_VALUES,
  MENU_DISH_LIST_PRESENTATION_VALUES,
  MENU_EXPERIENCE_BLUEPRINT_IDS,
  MENU_HOME_LAYOUT_VALUES,
  MENU_SECTION_ORDER_VALUES,
  MENU_UI_THEME_IDS,
  normalizeMenuUiConfig,
  validateMenuUiConfig
} from "../lib/menu/menuUiConfig.ts";

test("default menu UI config is safe for public rendering", () => {
  assert.equal(DEFAULT_MENU_UI_CONFIG.theme, "fresh-homemade");
  assert.equal(DEFAULT_MENU_UI_CONFIG.experience.blueprint, "classic-tabs");
  assert.equal(DEFAULT_MENU_UI_CONFIG.welcomeEnabled, true);
  assert.equal(DEFAULT_MENU_UI_CONFIG.defaultView, "all");
  assert.equal(DEFAULT_MENU_UI_CONFIG.show3dBadges, true);
  assert.equal(DEFAULT_MENU_UI_CONFIG.showArBadges, true);
  assert.equal(MENU_UI_THEME_IDS.includes(DEFAULT_MENU_UI_CONFIG.theme), true);
  assert.equal(DEFAULT_MENU_UI_CONFIG.immersive.autoLoad, false);
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

test("normalizes legacy configs with classic-tabs experience fallback", () => {
  const config = normalizeMenuUiConfig({
    theme: "premium-gastronomic",
    navigation: { style: "minimal" },
    cards: { variant: "editorial" },
    detail: { style: "editorial-detail", dishOpenMode: "route" }
  });

  assert.equal(config.experience.blueprint, "classic-tabs");
  assert.equal(config.experience.homeLayout, "compact-welcome");
  assert.equal(config.experience.sectionOrder, "categories-then-featured");
  assert.equal(config.experience.featuredMode, "signature-first");
  assert.equal(config.experience.categoryPresentation, "tabs");
  assert.equal(config.experience.dishListPresentation, "grouped-cards");
  assert.equal(config.experience.detailPresentation, "bottom-sheet");
});

test("validates whitelisted experience options and rejects invalid blueprint", () => {
  const accepted = validateMenuUiConfig({
    theme: "fresh-homemade",
    experience: {
      blueprint: "photo-grid",
      homeLayout: "visual-home",
      sectionOrder: "featured-then-categories",
      featuredMode: "photo-led",
      categoryPresentation: "visual-grid",
      dishListPresentation: "photo-grid",
      detailPresentation: "photo-hero"
    }
  });

  assert.equal(accepted.ok, true);
  assert.equal(accepted.value.experience.blueprint, "photo-grid");
  assert.equal(MENU_EXPERIENCE_BLUEPRINT_IDS.includes("photo-grid"), true);
  assert.equal(MENU_HOME_LAYOUT_VALUES.includes("visual-home"), true);
  assert.equal(MENU_SECTION_ORDER_VALUES.includes("featured-then-categories"), true);
  assert.equal(MENU_DISH_LIST_PRESENTATION_VALUES.includes("photo-grid"), true);
  assert.equal(MENU_DETAIL_PRESENTATION_VALUES.includes("photo-hero"), true);

  const rejected = validateMenuUiConfig({
    theme: "fresh-homemade",
    experience: {
      blueprint: "saas-dashboard",
      dishListPresentation: "spreadsheet"
    }
  });

  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /experience.*blueprint/i);
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

