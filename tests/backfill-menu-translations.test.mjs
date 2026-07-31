import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlan,
  buildMenuSettingsPlan,
  TROUVABLE_CANONICAL_NAMES,
  run,
  parseArgs,
  projectRefFromUrl,
  redactError,
  sourceDishFields,
  validateArgs,
  assertExplicitBinding
} from "../scripts/backfill-menu-translations.mjs";
import { getDishBySlug } from "../lib/demoMenuData.ts";
import {
  fieldHashesFor,
  hashTranslationValue,
  sourceHashFor
} from "../lib/translation/menuTranslationModel.ts";

function snapshot({ targetSlug = "trouvable", rows = [], dish = {} } = {}) {
  const result = {
    targetSlug,
    sourceLocale: "fr-CA",
    defaultLocale: "fr-CA",
    locale: "en-CA",
    restaurant: {
      id: `${targetSlug}-restaurant-id`,
      name: targetSlug === "sauge-noire" ? "Sauge Noire" : targetSlug,
      slug: targetSlug
    },
    menu: {
      id: `${targetSlug}-menu-id`,
      restaurant_id: `${targetSlug}-restaurant-id`,
      name: targetSlug === "sauge-noire" ? "Sauge Noire" : targetSlug === "trouvable" ? "Trouvable" : "Menu principal",
      slug: "principal"
    },
    categories: [
      {
        id: `${targetSlug}-category-id`,
        restaurant_id: `${targetSlug}-restaurant-id`,
        menu_id: `${targetSlug}-menu-id`,
        name: targetSlug === "sauge-noire" ? "Premiers gestes" : "Entrées",
        slug: targetSlug === "sauge-noire" ? "premiers-gestes" : "classiques-reinventes",
        description: "Petites assiettes."
      }
    ],
    dishes: [
      {
        id: `${targetSlug}-dish-id`,
        restaurant_id: `${targetSlug}-restaurant-id`,
        menu_id: `${targetSlug}-menu-id`,
        category_id: `${targetSlug}-category-id`,
        slug: targetSlug === "sauge-noire" ? "pain-de-seigle-chaud" : "smoked-meat-saint-laurent",
        name: targetSlug === "sauge-noire" ? "Pain de seigle chaud" : "Smoked Meat Saint-Laurent",
        short_description: "Une description réelle.",
        description: "Une description réelle.",
        allergens: [],
        metadata: { ingredients: ["Ingredient réel"], options: ["Option réelle"] }
      }
    ],
    rows
  };
  if (targetSlug === "trouvable") {
    result.categories[0].name = TROUVABLE_CANONICAL_NAMES.categories["classiques-reinventes"].fr;
    result.dishes[0].name = TROUVABLE_CANONICAL_NAMES.dishes["smoked-meat-saint-laurent"].fr;
  }
  return result;
}

test("production hash helpers are used for stable source and field hashes", () => {
  const fields = { name: "Plat officiel", ingredients: ["Un", "Deux"] };
  assert.equal(sourceHashFor(fields).length, 64);
  assert.deepEqual(Object.keys(fieldHashesFor(fields)).sort(), ["ingredients", "name"]);
  assert.equal(sourceHashFor(fields), sourceHashFor({ ingredients: ["Un", "Deux"], name: "Plat officiel" }));
});

test("source dish fields follow the production contract and only include non-empty fields", () => {
  assert.deepEqual(
    sourceDishFields({
      name: "Plat officiel",
      short_description: "Description courte",
      description: "Description longue",
      allergens: ["gluten"],
      metadata: {
        ingredients: ["Ingredient réel"],
        options: ["Option réelle"],
        chefNote: "Note maison",
        tags: ["Signature"]
      }
    }),
    {
      name: "Plat officiel",
      description: "Description courte",
      ingredients: ["Ingredient réel"],
      allergens: ["gluten"],
      options: ["Option réelle"],
      houseNote: "Note maison",
      tags: ["Signature"]
    }
  );
});

test("Trouvable and Sauge plans write an explicit canonical name without placeholders", () => {
  for (const targetSlug of ["trouvable", "sauge-noire"]) {
    const plan = buildPlan(snapshot({ targetSlug }));
    assert.equal(plan.ok, true, JSON.stringify(plan.errors));
    const dish = plan.operations.find((operation) => operation.entityType === "dish");
    assert.equal(dish.patch.content.name, targetSlug === "sauge-noire" ? "Pain de seigle chaud" : "Smoked Meat Saint-Laurent");
    assert.ok(!/placeholder|tbd|test/i.test(dish.patch.content.name));
    assert.equal(dish.patch.source_hash.length, 64);
    assert.equal(dish.patch.field_hashes.name.length, 64);
  }
});

test("Trouvable refuses an unlisted slug instead of falling back to French", () => {
  const current = snapshot();
  current.dishes[0].slug = "dish-not-in-canonical-map";
  current.dishes[0].name = "Nom français non vérifié";
  const plan = buildPlan(current);
  assert.equal(plan.ok, false);
  assert.match(plan.errors.join(" "), /canonical English name mapping is incomplete/i);
  assert.equal(plan.canonicalCoverage.complete, false);
});

test("complete new canonical rows are public-ready immediately", () => {
  const current = snapshot();
  current.categories[0].description = "";
  current.dishes[0].short_description = "";
  current.dishes[0].description = "";
  current.dishes[0].metadata = {};
  const plan = buildPlan(current);
  assert.equal(plan.ok, true, JSON.stringify(plan.errors));
  assert.ok(
    plan.operations.every((operation) => operation.patch.translation_status === "up_to_date"),
    JSON.stringify(plan.operations.map((operation) => ({ type: operation.entityType, fields: operation.requiredFields, missing: operation.missingFields, status: operation.patch.translation_status })))
  );
});

test("Trouvable only plans readiness when all nine categories and 36 dishes are mapped", () => {
  const current = snapshot();
  current.categories = Object.keys(TROUVABLE_CANONICAL_NAMES.categories).map((slug, index) => ({
    id: `category-${index}`,
    restaurant_id: current.restaurant.id,
    menu_id: current.menu.id,
    slug,
    name: TROUVABLE_CANONICAL_NAMES.categories[slug].fr,
    description: "Description de section"
  }));
  current.dishes = Object.keys(TROUVABLE_CANONICAL_NAMES.dishes).map((slug, index) => ({
    id: `dish-${index}`,
    restaurant_id: current.restaurant.id,
    menu_id: current.menu.id,
    category_id: current.categories[index % current.categories.length].id,
    slug,
    name: TROUVABLE_CANONICAL_NAMES.dishes[slug].fr,
    short_description: "Description réelle",
    allergens: [],
    metadata: { ingredients: ["Ingredient réel"] }
  }));
  const menuFields = { menuName: current.menu.name };
  current.rows = [
    {
      id: "menu-translation",
      entityType: "menu",
      entityId: current.menu.id,
      translation_status: "up_to_date",
      provider: "canonical-backfill",
      source_hash: sourceHashFor(menuFields),
      field_hashes: fieldHashesFor(menuFields),
      content: { menuName: current.menu.name },
      manual_overrides: {}
    },
    ...current.categories.map((category) => {
      const fields = { name: category.name, description: category.description };
      return {
        id: `translation-${category.id}`,
        entityType: "category",
        entityId: category.id,
        translation_status: "up_to_date",
        provider: "canonical-backfill",
        source_hash: sourceHashFor(fields),
        field_hashes: fieldHashesFor(fields),
        content: { name: TROUVABLE_CANONICAL_NAMES.categories[category.slug].en, description: "English section description" },
        manual_overrides: {}
      };
    }),
    ...current.dishes.map((dish) => {
      const fields = sourceDishFields(dish);
      return {
        id: `translation-${dish.id}`,
        entityType: "dish",
        entityId: dish.id,
        translation_status: "up_to_date",
        provider: "canonical-backfill",
        source_hash: sourceHashFor(fields),
        field_hashes: fieldHashesFor(fields),
        content: { ...fields, name: TROUVABLE_CANONICAL_NAMES.dishes[dish.slug].en },
        manual_overrides: {}
      };
    })
  ];
  const plan = buildPlan(current);
  assert.equal(plan.ok, true, JSON.stringify(plan.errors));
  assert.deepEqual(plan.canonicalCoverage, { mapped: 46, required: 46, complete: true, missing: [] });
  assert.deepEqual(plan.counts.translations, { menu: 1, categories: 9, dishes: 36 });
  assert.equal(plan.operations.filter((operation) => operation.entityType === "dish").length, 36);
  assert.ok(plan.operations.every((operation) => operation.patch.translation_status === "up_to_date"));
  const smokedMeat = plan.operations.find((operation) => operation.slug === "smoked-meat-saint-laurent");
  const smokedMeatFields = sourceDishFields(current.dishes.find((dish) => dish.slug === "smoked-meat-saint-laurent"));
  assert.equal(smokedMeat.patch.source_hash, sourceHashFor(smokedMeatFields));
  assert.deepEqual(smokedMeat.patch.field_hashes, fieldHashesFor(smokedMeatFields));
});

test("Maison settings patch is preserved and idempotent", () => {
  const current = snapshot({ targetSlug: "maison-elyse" });
  current.menu.settings_json = { allowThemeToggle: true, supportedLocales: ["fr-CA"] };
  const first = buildMenuSettingsPlan(current);
  assert.equal(first.changed, true);
  assert.deepEqual(first.desired, {
    allowThemeToggle: true,
    supportedLocales: ["fr-CA", "en-CA"],
    defaultLocale: "fr-CA"
  });
  assert.equal(first.currentHash, hashTranslationValue({ allowThemeToggle: true, supportedLocales: ["fr-CA"] }));
  assert.equal(first.desiredHash, hashTranslationValue(first.desired));
  current.menu.settings_json = first.desired;
  const second = buildMenuSettingsPlan(current);
  assert.equal(second.changed, false);
  assert.equal(second.currentHash, second.desiredHash);
});

test("manual overrides are preserved while hashes are recalculated", () => {
  const existing = {
    id: "existing-row",
    entityType: "dish",
    entityId: "maison-elyse-dish-id",
    translation_status: "up_to_date",
    provider: "human",
    content: { name: "Nom éditorial validé" },
    manual_overrides: { name: true }
  };
  const source = getDishBySlug("ravioles-romarin", "fr");
  const frenchSnapshot = snapshot({
    targetSlug: "maison-elyse",
    rows: [],
    dish: source
  });
  frenchSnapshot.restaurant.name = "Maison Élyse";
  frenchSnapshot.menu.name = "Maison Élyse";
  frenchSnapshot.categories[0].name = "Entrées";
  frenchSnapshot.categories[0].slug = "entrees";
  frenchSnapshot.dishes = [{
    id: "maison-elyse-dish-id",
    restaurant_id: frenchSnapshot.restaurant.id,
    menu_id: frenchSnapshot.menu.id,
    category_id: frenchSnapshot.categories[0].id,
    slug: source.slug,
    name: source.name,
    short_description: source.shortDescription,
    description: source.description,
    allergens: source.allergens,
    metadata: {
      ingredients: source.ingredients,
      options: source.options,
      chefNote: source.chefRecommendation,
      tags: ["Signature"]
    }
  }];
  frenchSnapshot.rows = [existing];

  const plan = buildPlan(frenchSnapshot);
  const dish = plan.operations.find((operation) => operation.entityType === "dish");
  assert.equal(plan.ok, true, JSON.stringify(plan.errors));
  assert.equal(dish.patch.content.name, "Nom éditorial validé");
  assert.equal(dish.patch.manual_overrides.name, true);
  assert.equal(dish.patch.provider, "human");
  assert.equal(dish.patch.source_hash, sourceHashFor(sourceDishFields(frenchSnapshot.dishes[0])));
});

test("incomplete Maison Élyse translation blocks apply planning", () => {
  const source = getDishBySlug("ravioles-romarin", "fr");
  const current = snapshot({ targetSlug: "maison-elyse" });
  current.restaurant.name = "Maison Élyse";
  current.menu.name = "Maison Élyse";
  current.categories[0].name = "Entrées";
  current.categories[0].slug = "entrees";
  current.dishes[0] = {
    ...current.dishes[0],
    slug: source.slug,
    name: source.name,
    short_description: source.shortDescription,
    description: source.description,
    allergens: source.allergens,
    metadata: { ingredients: source.ingredients, options: source.options }
  };
  current.rows = [{
    entityType: "dish",
    entityId: current.dishes[0].id,
    content: {},
    manual_overrides: { options: true }
  }];
  assert.throws(
    () => buildPlan(current),
    /manual override.*options.*usable content/i
  );
});

test("binding checks require an explicit allowlist and keep refs separate from secrets", () => {
  assert.equal(projectRefFromUrl("https://previewref123.supabase.co"), "previewref123");
  assert.equal(projectRefFromUrl("https://example.com"), "");
  const args = parseArgs([
    "--environment", "preview",
    "--project-ref", "previewref123",
    "--allow-project-ref", "previewref123"
  ]);
  assert.deepEqual(validateArgs(args), []);
  assert.match(redactError(new Error("Bearer super-secret-token")), /redacted/);
  assert.doesNotMatch(redactError(new Error("Bearer super-secret-token")), /super-secret-token/);
});

test("production apply requires a proven Vercel environment/ref binding", () => {
  const args = parseArgs([
    "--apply",
    "--environment", "production",
    "--project-ref", "productionref123",
    "--allow-project-ref", "productionref123",
    "--authorize-production",
    "--production-binding", "productionref123"
  ]);
  assert.throws(
    () => assertExplicitBinding({
      args,
      url: "https://productionref123.supabase.co",
      env: { VERCEL_ENV: "preview", VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "previewref123" }
    }),
    /VERCEL_ENV=production.*expected.*ref/i
  );
  assert.deepEqual(
    assertExplicitBinding({
      args,
      url: "https://productionref123.supabase.co",
      env: { VERCEL_ENV: "production", VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "productionref123" }
    }).proof,
    { vercelEnvironment: "production", expectedRefEnvironmentVariable: true }
  );
});

test("run reports every requested target before refusing an incomplete plan", async () => {
  const tables = new Map();
  for (const targetSlug of ["maison-elyse", "trouvable", "sauge-noire"]) {
    const restaurantId = `${targetSlug}-restaurant`;
    const menuId = `${targetSlug}-menu`;
    tables.set(`${targetSlug}:restaurants`, [{ id: restaurantId, name: targetSlug, slug: targetSlug, status: "active" }]);
    tables.set(`${targetSlug}:menus`, [{
      id: menuId,
      restaurant_id: restaurantId,
      name: "Menu principal",
      slug: "principal",
      status: "published",
      is_primary: true,
      settings_json: { defaultLocale: "fr-CA" }
    }]);
    tables.set(`${targetSlug}:menu_categories`, [{
      id: `${targetSlug}-category`,
      restaurant_id: restaurantId,
      menu_id: menuId,
      name: "Nom réel",
      slug: "category-not-in-canonical-map",
      description: "Description"
    }]);
    tables.set(`${targetSlug}:menu_dishes`, [{
      id: `${targetSlug}-dish`,
      restaurant_id: restaurantId,
      menu_id: menuId,
      category_id: `${targetSlug}-category`,
      slug: "dish-not-in-canonical-map",
      name: "Nom réel",
      short_description: "Description",
      description: "Description",
      allergens: [],
      metadata: {}
    }]);
  }

  const client = {
    from(table) {
      const state = { filters: {} };
      const query = {
        select() { return query; },
        eq(key, value) { state.filters[key] = value; return query; },
        order() { return query; },
        then(resolve, reject) {
          try {
            const candidates = [...tables.entries()].filter(([key]) => key.endsWith(`:${table}`));
            const matching = candidates.find(([, candidateRows]) => candidateRows.some((row) =>
              Object.entries(state.filters).every(([key, value]) => row[key] === value)));
            const rows = matching?.[1] ?? [];
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        }
      };
      return query;
    }
  };
  const logs = [];
  const report = await run({
    args: parseArgs([
      "--environment", "test",
      "--project-ref", "testref123",
      "--allow-project-ref", "testref123"
    ]),
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://testref123.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-key"
    },
    clientFactory: async () => client,
    log: (value) => logs.push(value)
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.targets.map((target) => target.slug), ["maison-elyse", "trouvable", "sauge-noire"]);
  assert.match(report.errors.join(" "), /canonical|Maison/i);
  assert.equal(logs.length, 1);
});
