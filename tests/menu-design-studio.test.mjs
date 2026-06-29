import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  MENU_EXPERIENCE_BLUEPRINT_IDS,
  MENU_UI_THEME_IDS,
  normalizeMenuUiConfig,
  validateMenuUiConfig
} from "../lib/menu/menuUiConfig.ts";
import {
  MENU_EXPERIENCE_BLUEPRINTS,
  getMenuExperienceBlueprint
} from "../lib/menu/menuExperienceBlueprints.ts";
import {
  MENU_THEME_PRESETS,
  buildConfigFromTheme,
  createMenuThemeVariation,
  getMenuThemePreset,
  mergeCustomConfig
} from "../lib/menu/menuThemePresets.ts";

const REQUIRED_THEMES = [
  "fresh-homemade",
  "premium-gastronomic",
  "street-casual",
  "cafe-brunch",
  "minimal-clean",
  "mediterranean-fresh",
  "sushi-minimal",
  "retro-diner",
  "fast-fresh-bowls",
  "patisserie-sweet",
  "bbq-smokehouse",
  "night-market"
];

test("menu design studio exposes at least 12 required theme presets", () => {
  assert.ok(MENU_UI_THEME_IDS.length >= 12);
  assert.deepEqual(
    REQUIRED_THEMES.filter((theme) => !MENU_UI_THEME_IDS.includes(theme)),
    []
  );
  assert.deepEqual(
    REQUIRED_THEMES.filter((theme) => !getMenuThemePreset(theme)),
    []
  );
});

test("menu design studio exposes at least 12 required experience blueprints", () => {
  const requiredBlueprints = [
    "classic-tabs",
    "editorial-magazine",
    "photo-grid",
    "fast-board",
    "bento-showcase",
    "story-first",
    "minimal-list",
    "lounge-cocktail",
    "family-comfort",
    "immersive-first",
    "tasting-journey",
    "compact-qr"
  ];

  assert.ok(MENU_EXPERIENCE_BLUEPRINT_IDS.length >= 12);
  assert.equal(
    MENU_EXPERIENCE_BLUEPRINTS.length,
    MENU_EXPERIENCE_BLUEPRINT_IDS.length
  );
  assert.deepEqual(
    requiredBlueprints.filter(
      (blueprint) => !MENU_EXPERIENCE_BLUEPRINT_IDS.includes(blueprint)
    ),
    []
  );
  for (const blueprint of requiredBlueprints) {
    assert.equal(getMenuExperienceBlueprint(blueprint).id, blueprint);
  }
});

test("each required theme has a complete distinct visual default set", () => {
  const signatures = new Set();

  for (const theme of REQUIRED_THEMES) {
    const preset = getMenuThemePreset(theme);
    assert.ok(preset, `missing preset ${theme}`);
    assert.equal(preset.id, theme);
    assert.ok(preset.name.length > 0);
    assert.ok(preset.description.length > 0);
    assert.match(preset.palette.background, /^#[0-9a-f]{6}$/i);
    assert.match(preset.palette.accent, /^#[0-9a-f]{6}$/i);
    assert.equal(preset.immersive.autoLoad, false);
    assert.equal(preset.immersive.posterUntilClick, true);
    assert.ok(preset.immersive.cta3d.length > 0);
    assert.ok(preset.immersive.ctaAr.length > 0);
    signatures.add(
      JSON.stringify({
        backgroundStyle: preset.global.backgroundStyle,
        radius: preset.global.radius,
        shadow: preset.global.shadow,
        headingStyle: preset.typography.headingStyle,
        navigation: preset.navigation.style,
        card: preset.cards.variant,
        photoShape: preset.cards.photoShape,
        detail: preset.detail.style,
        modelPanelStyle: preset.detail.modelPanelStyle
      })
    );
  }

  assert.ok(signatures.size >= 10);
  assert.equal(MENU_THEME_PRESETS.length, MENU_UI_THEME_IDS.length);
});

test("custom config accepts valid hex palette and rejects invalid colors", () => {
  const accepted = validateMenuUiConfig({
    theme: "fresh-homemade",
    custom: true,
    palette: {
      background: "#101010",
      surface: "#ffffff",
      text: "#f8f2e8",
      muted: "#a0a0a0",
      accent: "#e8cf9b",
      accent2: "#2fa866",
      accent3: "#f05d3d",
      border: "#333333",
      success: "#35a862",
      warning: "#f6c453",
      danger: "#e75b4e"
    }
  });

  assert.equal(accepted.ok, true);
  assert.equal(accepted.value.palette.background, "#101010");
  assert.equal(accepted.value.custom, true);

  const rejected = validateMenuUiConfig({
    theme: "fresh-homemade",
    custom: true,
    palette: {
      background: "javascript:alert(1)"
    }
  });

  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /color|palette/i);
});

test("advanced config normalizes whitelisted options and forces 3D auto load off", () => {
  const config = normalizeMenuUiConfig({
    theme: "night-market",
    global: {
      backgroundStyle: "pattern-light",
      density: "compact",
      radius: "organic",
      shadow: "strong"
    },
    typography: {
      headingStyle: "editorial",
      bodyStyle: "compact",
      priceStyle: "large",
      titleScale: "dramatic"
    },
    welcome: {
      layout: "editorial",
      backgroundShapes: "neon"
    },
    navigation: {
      style: "rail",
      showAll: false,
      showDishCounts: false,
      showIcons: true
    },
    experience: {
      blueprint: "immersive-first",
      homeLayout: "immersive-poster",
      sectionOrder: "immersive-then-menu",
      featuredMode: "immersive-ready",
      categoryPresentation: "compact-pills",
      dishListPresentation: "immersive-showcase",
      detailPresentation: "modal-card"
    },
    cards: {
      variant: "price-forward",
      photoShape: "organic",
      descriptionLength: "short",
      priceStyle: "badge",
      showTags: false
    },
    detail: {
      style: "editorial-detail",
      photoHero: "full-bleed",
      showShare: true,
      modelPanelStyle: "premium-panel",
      dishOpenMode: "hybrid"
    },
    photos: {
      placeholderStyle: "pattern",
      ownerMissingWarnings: false,
      publicMissingBehavior: "text-only"
    },
    immersive: {
      show3dBadge: true,
      showArBadge: true,
      autoLoad: true,
      posterUntilClick: false,
      cta3d: "Voir le volume en 3D avec un libelle beaucoup trop long",
      ctaAr: "Voir a table"
    }
  });

  assert.equal(config.theme, "night-market");
  assert.equal(config.global.backgroundStyle, "pattern-light");
  assert.equal(config.typography.headingStyle, "editorial");
  assert.equal(config.navigation.style, "rail");
  assert.equal(config.experience.blueprint, "immersive-first");
  assert.equal(config.experience.dishListPresentation, "immersive-showcase");
  assert.equal(config.cards.variant, "price-forward");
  assert.equal(config.detail.dishOpenMode, "hybrid");
  assert.equal(config.photos.publicMissingBehavior, "text-only");
  assert.equal(config.immersive.autoLoad, false);
  assert.equal(config.immersive.posterUntilClick, false);
  assert.ok(config.immersive.cta3d.length <= 40);
});

test("theme builders merge custom config without mutating menu data", () => {
  const menuDishes = [
    { id: "dish-1", name: "Bol maison", priceLabel: "17,99 $" },
    { id: "dish-2", name: "Tarte", priceLabel: "8,50 $" }
  ];
  const originalDishes = structuredClone(menuDishes);
  const base = buildConfigFromTheme("sushi-minimal", {
    name: "Sushi Test",
    slug: "sushi-test"
  });
  const merged = mergeCustomConfig(base, {
    palette: { accent: "#ff0000" },
    detail: { dishOpenMode: "route" },
    immersive: { autoLoad: true }
  });
  const variation = createMenuThemeVariation(merged, "stable-seed");

  assert.equal(base.theme, "sushi-minimal");
  assert.equal(merged.palette.accent, "#ff0000");
  assert.equal(merged.detail.dishOpenMode, "route");
  assert.equal(merged.immersive.autoLoad, false);
  assert.equal(variation.immersive.autoLoad, false);
  assert.deepEqual(menuDishes, originalDishes);
});

test("public renderer supports route, hybrid and builder inline dish opening", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  assert.match(source, /dishOpenMode/);
  assert.match(source, /buildPublicDishPath\(menu\.slug,\s*dish\.slug,\s*query\)/);
  assert.match(source, /mode === "public"/);
  assert.match(source, /<Link[\s\S]*href=\{dishHref\}[\s\S]*prefetch=\{false\}/);
  assert.match(source, /openDish\(dish\)/);
  assert.match(source, /mode === "builder-preview"/);
});

test("owner missing photo warning badge is scoped to builder preview", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  assert.match(
    source,
    /mode === "builder-preview" &&\s*config\.photos\.ownerMissingWarnings &&\s*!dish\.hasPhoto/
  );
  assert.doesNotMatch(
    source,
    /\{config\.photos\.ownerMissingWarnings && !dish\.hasPhoto \? \(\s*<span className=\{styles\.warningBadge\}>Photo a faire<\/span>/
  );
});

test("public renderer has class support for the expanded theme set", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");
  const css = await readFile("components/menu/PublicMenuRenderer.module.css", "utf8");

  for (const token of [
    "themeBbq",
    "themeBowls",
    "themeMediterranean",
    "themeNight",
    "themePatisserie",
    "themePremium",
    "themeDiner",
    "themeSushi",
    "themeStreet",
    "themeCafe",
    "themeMinimal",
    "themeFresh"
  ]) {
    assert.match(source + css, new RegExp(token));
  }

  assert.match(source, /data-theme=\{config\.theme\}/);
  assert.match(source, /menuStyleVars\(config\)/);
});

test("dish detail route is shareable for any scoped public menu slug", async () => {
  const source = await readFile("app/menu/[slug]/dishes/[dishSlug]/page.tsx", "utf8");

  assert.match(source, /getPublicMenuBySlug/);
  assert.match(source, /getPublicMenuDishBySlug/);
  assert.doesNotMatch(source, /isFreshHomemadeMenu/);
  assert.match(source, /notFound\(\)/);
});

test("dish detail component preserves QR query context with intent-gated 3D", async () => {
  const source = await readFile("components/menu/PublicDishDetailExperience.tsx", "utf8");

  assert.match(source, /query\?: PublicMenuContextQuery/);
  assert.match(source, /buildPublicMenuPath\(menu\.slug, query\)/);
  assert.match(source, /type DishModelViewerComponent = ComponentType<DishModelViewerProps>/);
  assert.match(source, /setModelViewerComponent/);
  assert.match(source, /import\("@\/components\/dish\/DishModelViewer"\)/);
  assert.doesNotMatch(source, /dynamic<DishModelViewerProps>/);
  assert.match(source, /showModelViewer/);
  assert.match(source, /Voir en 3D/);
  assert.match(source, /hasPublicArAsset \? "3D \/ AR" : "3D"/);
  assert.doesNotMatch(source, /modelActionButtonSecondary/);
  assert.doesNotMatch(source, /<model-viewer/);
  assert.doesNotMatch(source, /["'`](?:https?:\/\/|\/)[^"'`]*\.glb/);
  assert.doesNotMatch(source, /["'`](?:https?:\/\/|\/)[^"'`]*\.usdz/);
});

test("builder exposes advanced studio controls without heavy model imports", async () => {
  const source = await readFile("components/owner/MenuUiBuilder.tsx", "utf8");

  for (const label of [
    "Menu Design Studio",
    "Style preset",
    "Structure du menu",
    "Experience blueprint",
    "Home layout",
    "Category presentation",
    "Dish list presentation",
    "Detail presentation",
    "Featured dishes mode",
    "Custom couleurs",
    "Typography",
    "Background",
    "Navigation",
    "Cards plats",
    "Fiche detail",
    "Photos",
    "Me conseiller avec Mistral",
    "Analyse du restaurant",
    "Voir variation",
    "Ignorer",
    "3D / AR",
    "Créer variation unique",
    "Variation locale non sauvegardée"
  ]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(source, /MENU_THEME_PRESETS/);
  assert.match(source, /MENU_EXPERIENCE_BLUEPRINTS/);
  assert.match(source, /\/api\/owner\/menu-style-advisor/);
  assert.match(source, /createMenuThemeVariation/);
  assert.doesNotMatch(source, /DishModelViewer/);
  assert.doesNotMatch(source, /model-viewer/);
  assert.doesNotMatch(source, /\.glb/);
  assert.doesNotMatch(source, /\.usdz/);
});
