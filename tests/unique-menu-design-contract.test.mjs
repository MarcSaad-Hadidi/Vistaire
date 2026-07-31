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
  getUniqueMenuRendererForDesign,
  getUniqueMenuRendererForDesignVersion,
  __setUniqueMenuRendererTestRegistry,
  isRegisteredUniqueMenuRendererKey
} from "../lib/menu/uniqueMenuRendererRegistry.ts";
import { resolvePublicMenuExperience } from "../lib/menu/publicMenuExperienceRoute.ts";
import { importMenuDesignConfig } from "../lib/menu/menuConfigTransfer.ts";
import {
  applyUniqueMenuDesignLifecycleAction,
  FORBIDDEN_PUBLIC_UNIQUE_TERMS
} from "../lib/menu/uniqueMenuDesign.ts";

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
  const [menuSource, renderContextSource] = await Promise.all([
    readFile(
      new URL("../app/menu/[slug]/page.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../lib/menu/publicMenuRenderContext.ts", import.meta.url),
      "utf8"
    )
  ]);
  const dishSource = await readFile(
    new URL("../app/menu/[slug]/dishes/[dishSlug]/page.tsx", import.meta.url),
    "utf8"
  );
  assert.match(menuSource, /resolvePublicMenuRenderContext/);
  assert.match(renderContextSource, /resolvePublicMenuExperience/);
  assert.match(dishSource, /resolvePublicDishRenderContext/);
  assert.doesNotMatch(menuSource, /if\s*\(\s*menu\.slug\s*===/);
  assert.doesNotMatch(dishSource, /if\s*\(\s*menu\.slug\s*===/);
  assert.doesNotMatch(menuSource, /import\s*\(\s*[`'"].*\$\{/);
  assert.doesNotMatch(dishSource, /import\s*\(\s*[`'"].*\$\{/);
});

test("lifecycle transitions enforce allowlist and concurrency", () => {
  const pending = createPendingUniqueMenuDesign({
    designId: "11111111-1111-4111-8111-111111111111"
  });
  const started = applyUniqueMenuDesignLifecycleAction({
    current: pending,
    action: "start",
    expectedDesignId: pending.designId,
    expectedVersion: 1
  });
  assert.equal(started.ok, true);
  if (!started.ok) return;

  const stale = applyUniqueMenuDesignLifecycleAction({
    current: started.value,
    action: "mark-ready",
    expectedDesignId: started.value.designId,
    expectedVersion: 1,
    rendererKey: "test-renderer",
    rendererVersion: 1
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.status, 409);

  const skipPublish = applyUniqueMenuDesignLifecycleAction({
    current: started.value,
    action: "publish",
    expectedDesignId: started.value.designId,
    expectedVersion: started.value.version
  });
  assert.equal(skipPublish.ok, false);

  const ready = applyUniqueMenuDesignLifecycleAction({
    current: started.value,
    action: "mark-ready",
    expectedDesignId: started.value.designId,
    expectedVersion: started.value.version,
    rendererKey: "test-renderer",
    rendererVersion: 2
  });
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  assert.equal(ready.value.rendererVersion, 2);
  assert.equal(ready.value.rendererKey, "test-renderer");

  const published = applyUniqueMenuDesignLifecycleAction({
    current: ready.value,
    action: "publish",
    expectedDesignId: ready.value.designId,
    expectedVersion: ready.value.version
  });
  assert.equal(published.ok, true);
  if (!published.ok) return;
  assert.equal(published.value.status, "published");
  assert.equal(published.value.rendererVersion, 2);
  assert.equal(published.value.rendererKey, "test-renderer");
});

test("registry binds renderer to designId and requires menu+dish", () => {
  const designId = "77777777-7777-4777-8777-777777777777";
  const Menu = () => null;
  const Dish = () => null;
  __setUniqueMenuRendererTestRegistry([
    {
      key: "fixture-unique-a",
      designId,
      version: 3,
      displayName: "Fixture A",
      menu: Menu,
      dishDetail: Dish
    }
  ]);
  try {
    assert.ok(getUniqueMenuRendererForDesign(designId, "fixture-unique-a"));
    assert.ok(
      getUniqueMenuRendererForDesignVersion(designId, "fixture-unique-a", 3)
    );
    assert.equal(
      getUniqueMenuRendererForDesignVersion(designId, "fixture-unique-a", 2),
      null
    );
    assert.equal(
      getUniqueMenuRendererForDesign(
        "88888888-8888-4888-8888-888888888888",
        "fixture-unique-a"
      ),
      null
    );
    assert.equal(getUniqueMenuRenderer("fixture-unique-a")?.version, 3);

    const readyConfig = normalizeMenuUiConfig({
      theme: "fresh-homemade",
      uniqueDesign: {
        mode: "unique",
        designId,
        status: "ready",
        rendererKey: "fixture-unique-a",
        rendererVersion: 3,
        version: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    const readyExperience = resolvePublicMenuExperience(
      {
        slug: "fixture",
        name: "Fixture",
        publicMenuStyleExplicit: true,
        settings: { publicMenuStyle: "unique" }
      },
      readyConfig
    );
    assert.equal(readyExperience.kind, "generic");

    const publishedMatchingConfig = normalizeMenuUiConfig({
      ...readyConfig,
      uniqueDesign: {
        ...readyConfig.uniqueDesign,
        status: "published",
        version: 3
      }
    });
    const publishedMatching = resolvePublicMenuExperience(
      {
        slug: "fixture",
        name: "Fixture",
        publicMenuStyleExplicit: true,
        settings: { publicMenuStyle: "unique" }
      },
      publishedMatchingConfig
    );
    assert.equal(publishedMatching.kind, "unique-registered");
    assert.equal(publishedMatching.renderer?.key, "fixture-unique-a");
    assert.equal(publishedMatching.rendererVersion, 3);

    const publishedWrongVersionConfig = normalizeMenuUiConfig({
      ...readyConfig,
      uniqueDesign: {
        ...readyConfig.uniqueDesign,
        status: "published",
        rendererVersion: 1,
        version: 3
      }
    });
    const publishedWrongVersion = resolvePublicMenuExperience(
      {
        slug: "fixture",
        name: "Fixture",
        publicMenuStyleExplicit: true,
        settings: { publicMenuStyle: "unique" }
      },
      publishedWrongVersionConfig
    );
    assert.equal(publishedWrongVersion.kind, "generic");
    assert.equal(publishedWrongVersion.useGenericFallback, true);
    assert.equal(publishedWrongVersion.renderer, null);
    assert.match(
      publishedWrongVersion.ownerDiagnostic ?? "",
      /obsolete renderer version/i
    );
  } finally {
    __setUniqueMenuRendererTestRegistry(null);
  }
});

test("published with matching rendererVersion uses unique-registered", () => {
  const designId = "99999999-9999-4999-8999-999999999999";
  const Menu = () => null;
  const Dish = () => null;
  __setUniqueMenuRendererTestRegistry([
    {
      key: "fixture-unique-b",
      designId,
      version: 5,
      displayName: "Fixture B",
      menu: Menu,
      dishDetail: Dish
    }
  ]);
  try {
    const config = normalizeMenuUiConfig({
      theme: "fresh-homemade",
      uniqueDesign: {
        mode: "unique",
        designId,
        status: "published",
        rendererKey: "fixture-unique-b",
        rendererVersion: 5,
        version: 4,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    const experience = resolvePublicMenuExperience(
      {
        slug: "fixture-b",
        name: "Fixture B",
        publicMenuStyleExplicit: true,
        settings: { publicMenuStyle: "unique" }
      },
      config
    );
    assert.equal(experience.kind, "unique-registered");
    assert.equal(experience.renderer?.key, "fixture-unique-b");
    assert.equal(experience.rendererVersion, 5);
  } finally {
    __setUniqueMenuRendererTestRegistry(null);
  }
});

test("published with wrong rendererVersion falls back to generic", () => {
  const designId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const Menu = () => null;
  const Dish = () => null;
  __setUniqueMenuRendererTestRegistry([
    {
      key: "fixture-unique-c",
      designId,
      version: 4,
      displayName: "Fixture C",
      menu: Menu,
      dishDetail: Dish
    }
  ]);
  try {
    const config = normalizeMenuUiConfig({
      theme: "fresh-homemade",
      uniqueDesign: {
        mode: "unique",
        designId,
        status: "published",
        rendererKey: "fixture-unique-c",
        rendererVersion: 2,
        version: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    const experience = resolvePublicMenuExperience(
      {
        slug: "fixture-c",
        name: "Fixture C",
        publicMenuStyleExplicit: true,
        settings: { publicMenuStyle: "unique" }
      },
      config
    );
    assert.equal(experience.kind, "generic");
    assert.equal(experience.useGenericFallback, true);
    assert.equal(experience.renderer, null);
    assert.match(
      experience.ownerDiagnostic ?? "",
      /obsolete renderer version.*mark-ready/i
    );
  } finally {
    __setUniqueMenuRendererTestRegistry(null);
  }
});

test("forbidden public unique terms stay out of public appearance copy", async () => {
  const appearance = await readFile(
    new URL("../lib/menu/menuAppearance.ts", import.meta.url),
    "utf8"
  );
  const config = buildMenuUiConfigForRestaurant({
    name: "Public Check",
    slug: "public-check",
    appearance: {
      template: "unique",
      presetId: "noir-champagne",
      primaryColor: "#e8cf9b",
      secondaryColor: "#c69252",
      themeMode: "dark"
    },
    uniqueDesign: createPendingUniqueMenuDesign()
  });
  const publicFacing = [
    config.welcomeTitle,
    config.welcomeSubtitle,
    config.restaurantName,
    config.experience?.blueprint
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const term of FORBIDDEN_PUBLIC_UNIQUE_TERMS) {
    assert.equal(
      publicFacing.includes(term.toLowerCase()),
      false,
      `public-facing copy should not include ${term}`
    );
  }
  assert.match(appearance, /Découvrez la carte de notre restaurant/);
  assert.doesNotMatch(appearance, /en attendant le design/i);
});
