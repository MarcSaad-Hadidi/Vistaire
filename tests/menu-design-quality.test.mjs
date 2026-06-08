import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MENU_UI_CONFIG,
  normalizeMenuUiConfig
} from "../lib/menu/menuUiConfig.ts";
import {
  contrastRatio,
  evaluateMenuDesignQuality,
  isReadablePair
} from "../lib/menu/menuDesignQuality.ts";

function menu(overrides = {}) {
  const dishes = overrides.dishes ?? [
    {
      id: "dish-1",
      slug: "dish-1",
      name: "Plat maison",
      description: "Un plat fourni par le restaurant.",
      category: "Plats",
      priceLabel: "18,00 $",
      imageUrl: "/images/dish.jpg",
      thumbnailUrl: "/images/dish.jpg",
      hasPhoto: true,
      photoStatus: "ready",
      hasImmersive: false,
      has3d: false,
      hasAr: false,
      hasIosAr: false,
      hasAndroidAr: false,
      model3dUrl: "",
      webModel3dUrl: "",
      arModel3dUrl: "",
      usdzUrl: "",
      arUsdzUrl: "",
      posterUrl: "",
      modelStatus: "missing",
      available: true,
      ingredients: [],
      allergens: [],
      options: [],
      houseNote: "",
      tags: []
    }
  ];

  return {
    restaurantId: overrides.restaurantId ?? "restaurant-1",
    slug: overrides.slug ?? "resto-marc",
    name: overrides.name ?? "Resto Marc",
    location: "Montreal",
    cuisineType: "maison",
    source: "supabase",
    dishes
  };
}

function evaluate(overrides = {}) {
  return evaluateMenuDesignQuality({
    restaurant: overrides.restaurant ?? {
      id: "restaurant-1",
      name: "Resto Marc",
      slug: "resto-marc"
    },
    menu: overrides.menu ?? menu(),
    config: overrides.config ?? DEFAULT_MENU_UI_CONFIG,
    publicMenuPath: overrides.publicMenuPath ?? "/menu/resto-marc",
    publicRouteOk: overrides.publicRouteOk ?? true,
    qrTargetKind: overrides.qrTargetKind ?? "menu",
    qrTargetPath: overrides.qrTargetPath ?? "/menu/resto-marc",
    configStatus: overrides.configStatus ?? "published"
  });
}

test("quality score returns blocked for empty menu", () => {
  const result = evaluate({ menu: menu({ dishes: [] }) });

  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some((item) => /menu vide|plat/i.test(item)), true);
  assert.equal(result.score < 70, true);
});

test("quality score warns for photo-grid with no photos", () => {
  const result = evaluate({
    config: normalizeMenuUiConfig({
      ...DEFAULT_MENU_UI_CONFIG,
      experience: { blueprint: "photo-grid" }
    }),
    menu: menu({
      dishes: menu().dishes.map((dish) => ({
        ...dish,
        imageUrl: "",
        thumbnailUrl: "",
        hasPhoto: false,
        photoStatus: "missing"
      }))
    })
  });

  assert.equal(result.status === "blocked", false);
  assert.equal(result.warnings.some((item) => /photo-grid|photos/i.test(item)), true);
});

test("quality score warns for immersive-first with no 3D or AR", () => {
  const result = evaluate({
    config: normalizeMenuUiConfig({
      ...DEFAULT_MENU_UI_CONFIG,
      experience: { blueprint: "immersive-first" }
    })
  });

  assert.equal(result.status === "blocked", false);
  assert.equal(result.warnings.some((item) => /immersive|3D|AR/i.test(item)), true);
});

test("quality score blocks unsafe QR admin target and owner warning exposure", () => {
  const result = evaluate({
    qrTargetKind: "admin",
    qrTargetPath: "/owner/restaurants",
    publicOwnerWarningsExposed: true
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some((item) => /QR.*admin/i.test(item)), true);
  assert.equal(result.blockers.some((item) => /owner/i.test(item)), true);
});

test("contrast helper detects low contrast", () => {
  assert.equal(contrastRatio("#000000", "#ffffff") > 20, true);
  assert.equal(isReadablePair("#ffffff", "#ffffff"), false);
});

test("quality score blocks immersive auto-load", () => {
  const unsafeConfig = normalizeMenuUiConfig(DEFAULT_MENU_UI_CONFIG);
  unsafeConfig.immersive.autoLoad = true;
  const result = evaluate({
    config: unsafeConfig
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some((item) => /auto-load|autoLoad/i.test(item)), true);
});
