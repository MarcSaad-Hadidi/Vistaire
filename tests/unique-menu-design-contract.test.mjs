import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  normalizePublicMenuStyle,
  PUBLIC_MENU_STYLE_OPTIONS
} from "../lib/menu/publicMenuSettings.ts";
import {
  mapMenuUiConfigRow,
  normalizeMenuUiConfig,
  serializeMenuUiConfig,
  validateMenuUiConfig
} from "../lib/menu/menuUiConfig.ts";
import { buildMenuUiConfigForRestaurant } from "../lib/menu/menuAppearance.ts";
import { createPendingUniqueMenuDesign } from "../lib/menu/uniqueMenuDesign.ts";
import {
  assertNoDynamicUniqueRendererImport,
  getUniqueMenuRenderer,
  isRegisteredUniqueMenuRendererKey
} from "../lib/menu/uniqueMenuRendererRegistry.ts";
import { resolvePublicMenuExperience } from "../lib/menu/publicMenuExperienceRoute.ts";
import { importMenuDesignConfig } from "../lib/menu/menuConfigTransfer.ts";

test("normalizePublicMenuStyle recognizes unique and keeps safe fallback", () => {
  assert.deepEqual([...PUBLIC_MENU_STYLE_OPTIONS], [
    "trouvable",
    "maison-elyse",
    "unique"
  ]);
  assert.equal(normalizePublicMenuStyle("unique"), "unique");
  assert.equal(normalizePublicMenuStyle("trouvable"), "trouvable");
  assert.equal(normalizePublicMenuStyle("maison-elyse"), "maison-elyse");
  assert.equal(normalizePublicMenuStyle("retro"), "trouvable");
  assert.equal(normalizePublicMenuStyle(""), "trouvable");
});

test("uniqueDesign survives normalize/serialize/map roundtrip", () => {
  const design = createPendingUniqueMenuDesign({
    designId: "11111111-1111-4111-8111-111111111111"
  });
  const normalized = normalizeMenuUiConfig({
    theme: "fresh-homemade",
    uniqueDesign: design
  });
  assert.equal(normalized.uniqueDesign?.designId, design.designId);
  assert.equal(normalized.uniqueDesign?.status, "pending");
  assert.equal(normalized.uniqueDesign?.rendererKey, null);

  const serialized = serializeMenuUiConfig(normalized);
  assert.equal(serialized.uniqueDesign?.designId, design.designId);

  const mapped = mapMenuUiConfigRow(
    {
      id: "22222222-2222-4222-8222-222222222222",
      restaurant_id: "33333333-3333-4333-8333-333333333333",
      theme: "fresh-homemade",
      status: "draft",
      config_json: serialized,
      updated_at: new Date().toISOString()
    },
    normalized
  );
  assert.equal(mapped.config.uniqueDesign?.designId, design.designId);
});

test("legacy configs normalize uniqueDesign to null", () => {
  const normalized = normalizeMenuUiConfig({ theme: "fresh-homemade" });
  assert.equal(normalized.uniqueDesign, null);
});

test("registry rejects unknown renderer keys without dynamic import", () => {
  assert.equal(isRegisteredUniqueMenuRendererKey("evil-key"), false);
  assert.equal(isRegisteredUniqueMenuRendererKey("../etc/passwd"), false);
  assert.equal(isRegisteredUniqueMenuRendererKey("https://evil.example"), false);
  assert.equal(getUniqueMenuRenderer("unknown-renderer"), null);
  assert.equal(
    assertNoDynamicUniqueRendererImport("import(`./${rendererKey}`)"),
    false
  );
  assert.equal(
    assertNoDynamicUniqueRendererImport("import { Foo } from './foo'"),
    true
  );
});

test("published uniqueDesign without registered key is rejected by validate", () => {
  const result = validateMenuUiConfig({
    theme: "fresh-homemade",
    uniqueDesign: {
      mode: "unique",
      designId: "11111111-1111-4111-8111-111111111111",
      status: "published",
      rendererKey: "not-registered-key",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
  assert.equal(result.ok, false);
});

test("buildMenuUiConfigForRestaurant unique uses generic blueprint", () => {
  const design = createPendingUniqueMenuDesign({
    designId: "44444444-4444-4444-8444-444444444444"
  });
  const config = buildMenuUiConfigForRestaurant({
    name: "Atelier Nord",
    slug: "atelier-nord",
    appearance: {
      template: "unique",
      presetId: "noir-champagne",
      primaryColor: "#e8cf9b",
      secondaryColor: "#c69252",
      themeMode: "dark"
    },
    uniqueDesign: design
  });
  assert.equal(config.experience.blueprint, "classic-tabs");
  assert.equal(config.uniqueDesign?.designId, design.designId);
  assert.notEqual(config.experience.blueprint, "immersive-first");
  assert.notEqual(config.experience.blueprint, "editorial-magazine");
});

test("pending unique experience resolves to generic fallback", () => {
  const design = createPendingUniqueMenuDesign({
    designId: "55555555-5555-4555-8555-555555555555"
  });
  const config = normalizeMenuUiConfig({
    theme: "fresh-homemade",
    uniqueDesign: design
  });
  const experience = resolvePublicMenuExperience(
    {
      slug: "atelier-nord",
      name: "Atelier Nord",
      publicMenuStyleExplicit: true,
      settings: { publicMenuStyle: "unique" }
    },
    config
  );
  assert.equal(experience.kind, "generic");
  assert.equal(experience.style, "unique");
  assert.equal(experience.useGenericFallback, true);
  assert.equal(experience.renderer, null);
});

test("import/export strips uniqueDesign identity", () => {
  const design = createPendingUniqueMenuDesign({
    designId: "66666666-6666-4666-8666-666666666666"
  });
  const payload = JSON.stringify({
    schema: "vistaire.menu-design-config.v1",
    config: {
      theme: "fresh-homemade",
      uniqueDesign: design
    }
  });
  const imported = importMenuDesignConfig(payload);
  assert.equal(imported.ok, false);
});

test("public menu and dish routes share resolvePublicMenuExperience", async () => {
  const menuSource = await readFile(
    new URL("../app/menu/[slug]/page.tsx", import.meta.url),
    "utf8"
  );
  const dishSource = await readFile(
    new URL("../app/menu/[slug]/dishes/[dishSlug]/page.tsx", import.meta.url),
    "utf8"
  );
  assert.match(menuSource, /resolvePublicMenuExperience/);
  assert.match(dishSource, /resolvePublicMenuExperience/);
  assert.doesNotMatch(menuSource, /if\s*\(\s*menu\.slug\s*===/);
  assert.doesNotMatch(dishSource, /if\s*\(\s*menu\.slug\s*===/);
  assert.doesNotMatch(menuSource, /import\s*\(\s*[`'"].*\$\{/);
  assert.doesNotMatch(dishSource, /import\s*\(\s*[`'"].*\$\{/);
});
