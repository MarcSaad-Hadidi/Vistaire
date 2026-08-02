import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
process.env.VISTAIRE_EXCHANGE_RATES_FIXTURE_JSON =
  '{"CAD":1,"USD":0.72,"EUR":0.6225}';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export%20default%20undefined",
        shortCircuit: true
      };
    }
    if (specifier === "next/cache") {
      return {
        url: "data:text/javascript,const%20caches%3Dnew%20Map()%3Bexport%20const%20unstable_cache%3D(fn%2Ckey)%3D%3Easync(...args)%3D%3E%7Bconst%20cacheKey%3DJSON.stringify(%5Bkey%2Cargs%5D)%3Bif(!caches.has(cacheKey))caches.set(cacheKey%2CPromise.resolve().then(()%3D%3Efn(...args)))%3Breturn%20caches.get(cacheKey)%7D",
        shortCircuit: true
      };
    }
    if (specifier === "@/utils/supabase/admin") {
      return {
        url: "data:text/javascript,export%20function%20getSupabaseAdminClient()%7Breturn%20globalThis.__vistaireTranslationAdmin%3F%3F%7Bok%3Afalse%2Creason%3A%22test%20admin%20unavailable%22%7D%7D",
        shortCircuit: true
      };
    }
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
      const baseUrl = new URL(specifier, context.parentURL);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts") || url.endsWith(".tsx")) {
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022
          }
        }).outputText,
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});

test("Trouvable demo keeps source dish names while translating English copy", async () => {
  const { getPublicMenuBySlug } = await import("../lib/menu/publicMenu.ts");
  const [french, english, greek] = await Promise.all([
    getPublicMenuBySlug("trouvable", "fr-CA"),
    getPublicMenuBySlug("trouvable", "en-CA"),
    getPublicMenuBySlug("trouvable", "el-GR")
  ]);

  assert.ok(french);
  assert.ok(english);
  assert.ok(greek);
  assert.equal(english.activeLocale, "en-CA");
  assert.equal(english.dishes[0].name, french.dishes[0].name);
  assert.equal(
    english.dishes[0].description,
    "Farm eggs, crisp potatoes, herb salad, and toasted sourdough."
  );
  assert.equal(english.dishes[0].category, "Breakfast");
  assert.deepEqual(english.dishes[0].ingredients, [
    "Eggs",
    "Potatoes",
    "Fresh herbs",
    "Sourdough"
  ]);
  assert.equal(greek.dishes[0].name, french.dishes[0].name);
});

test("landing comparison copy and projected image labels follow the locale", async () => {
  const { formatLandingCopyTemplate, getLandingCopy } = await import(
    "../lib/landing/landingCopy.ts"
  );
  const { buildCurrentPublicMenuPreview } = await import(
    "../lib/landing/publicMenuPreview.ts"
  );
  const { buildPdfComparePreviewData } = await import(
    "../lib/pdfComparePreviewData.ts"
  );
  const { getPublicMenuBySlug } = await import("../lib/menu/publicMenu.ts");
  const [frenchMenu, englishMenu] = await Promise.all([
    getPublicMenuBySlug("trouvable", "fr-CA"),
    getPublicMenuBySlug("trouvable", "en-CA")
  ]);

  assert.ok(frenchMenu);
  assert.ok(englishMenu);
  const frenchCopy = getLandingCopy("fr").comparison;
  const englishCopy = getLandingCopy("en").comparison;
  assert.doesNotThrow(() => structuredClone(frenchCopy));
  assert.doesNotThrow(() => structuredClone(englishCopy));
  assert.equal(frenchCopy.pdfTitle, "Carte");
  assert.equal(
    formatLandingCopyTemplate(frenchCopy.pdfRegionLabel, {
      restaurantName: "Trouvable"
    }),
    "Menu PDF complet de Trouvable"
  );
  assert.equal(englishCopy.pdfTitle, "Menu");
  assert.equal(
    formatLandingCopyTemplate(englishCopy.pdfRegionLabel, {
      restaurantName: "Trouvable"
    }),
    "Full PDF menu for Trouvable"
  );
  assert.equal(
    englishCopy.unavailableStatus,
    "Preview temporarily unavailable"
  );
  assert.equal(englishCopy.loadingStatus, "Loading the current menu preview");

  const french = buildCurrentPublicMenuPreview({
    locale: "fr",
    menu: frenchMenu,
    preferredDishSlug: "dejeuner-classique-maison",
    theme: "trouvable"
  }).preview;
  const english = buildCurrentPublicMenuPreview({
    locale: "en",
    menu: englishMenu,
    preferredDishSlug: "dejeuner-classique-maison",
    theme: "trouvable"
  }).preview;

  assert.equal(
    french.featuredDish.imageAlt,
    "Photo du plat : Dejeuner classique maison"
  );
  assert.equal(
    english.featuredDish.imageAlt,
    "Dish photo: Dejeuner classique maison"
  );
  assert.match(
    english.categoryCards.find((category) => category.name === "Desserts")
      ?.imageAlt ?? "",
    /^Category photo for Desserts: /
  );
  assert.doesNotMatch(
    JSON.stringify(english),
    /Photo du plat|Photo de la catégorie|Catégorie /
  );

  const englishDemoPreview = buildPdfComparePreviewData({ locale: "en" });
  assert.equal(englishDemoPreview.categoryTabs[0].name, "All");
  assert.match(englishDemoPreview.vistaireDishes[0].imageAlt, /^Dish photo: /);
  assert.doesNotMatch(
    JSON.stringify(englishDemoPreview),
    /Photo du plat|Photo de la catégorie|Catégorie /
  );
});

test("stored English copy keeps the French source dish name", async () => {
  const { getPublicMenuBySlug } = await import("../lib/menu/publicMenu.ts");
  const { applyStoredPublicMenuTranslations } = await import(
    "../lib/menu/publicMenuTranslations.ts"
  );
  const {
    publicMenuCategoryTranslationSources,
    publicMenuDishTranslationFields
  } = await import("../lib/menu/publicMenuTranslationReadiness.ts");
  const { fieldHashesFor, sourceHashFor } = await import(
    "../lib/translation/menuTranslationModel.ts"
  );

  const demo = await getPublicMenuBySlug("trouvable", "fr-CA");
  assert.ok(demo);
  const sourceDish = {
    ...demo.dishes[0],
    isSignature: true,
    isRecommended: true,
    tags: [...demo.dishes[0].tags, "Signature", "Recommande"]
  };
  const sourceMenu = {
    ...demo,
    menuId: "menu-runtime-translation",
    source: "supabase",
    settings: {
      ...demo.settings,
      defaultLocale: "fr-CA",
      supportedLocales: ["fr-CA", "en-CA"]
    },
    dishes: [sourceDish]
  };
  const dishFields = publicMenuDishTranslationFields(sourceDish);
  const producerDishFields = {
    ...dishFields,
    tags: [...dishFields.tags, "Signature", "Recommande"]
  };
  const category = publicMenuCategoryTranslationSources(sourceMenu)[0];
  assert.ok(category);

  const translationRows = {
    menu_translations: [],
    menu_category_translations: [
      {
        category_id: category.id,
        locale: "en-CA",
        translation_status: "up_to_date",
        source_hash: sourceHashFor(category.fields),
        field_hashes: fieldHashesFor(category.fields),
        content: {
          name: "Breakfast",
          description: "House breakfast classics"
        }
      }
    ],
    menu_dish_translations: [
      {
        dish_id: sourceDish.id,
        locale: "en-CA",
        translation_status: "up_to_date",
        source_hash: sourceHashFor(producerDishFields),
        field_hashes: fieldHashesFor(producerDishFields),
        content: {
          ...dishFields,
          description: "Farm eggs with crisp potatoes and herb salad.",
          ingredients: ["Farm eggs", "Crisp potatoes", "Herb salad", "Sourdough"],
          allergens: ["Eggs", "Gluten"],
          options: ["Crisp bacon", "Lemon avocado", "Gluten-free on request"],
          houseNote: "Served warm for the table.",
          tags: ["Signature", "House favourite"],
          name: "Stored house breakfast"
        }
      }
    ]
  };

  globalThis.__vistaireTranslationAdmin = {
    ok: true,
    client: {
      from(table) {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async in() {
            return {
              data: translationRows[table],
              error: null
            };
          }
        };
      }
    }
  };

  try {
    const english = await applyStoredPublicMenuTranslations(
      sourceMenu,
      "en-CA"
    );

    assert.equal(english.activeLocale, "en-CA");
    assert.equal(english.dishes[0].name, sourceMenu.dishes[0].name);
    assert.equal(sourceMenu.dishes[0].name, "Dejeuner classique maison");
    assert.deepEqual(english.dishes[0].tags, [
      "House favourite",
      "Signature",
      "Recommande"
    ]);
    assert.notStrictEqual(english.dishes[0], sourceMenu.dishes[0]);
  } finally {
    delete globalThis.__vistaireTranslationAdmin;
  }
});

test("Maison English requests stay on the source locale when translation storage is unavailable", async () => {
  const { getPublicMenuBySlug } = await import("../lib/menu/publicMenu.ts");
  const { applyStoredPublicMenuTranslations } = await import(
    "../lib/menu/publicMenuTranslations.ts"
  );

  const demo = await getPublicMenuBySlug("maison-elyse", "fr-CA");
  assert.ok(demo);
  const sourceDish = demo.dishes.find(
    (dish) => dish.slug === "ravioles-romarin"
  );
  assert.ok(sourceDish);

  const sourceMenu = {
    ...demo,
    menuId: "menu-maison-fallback",
    source: "supabase",
    dishes: [
      {
        ...sourceDish,
        id: "live-ravioles",
        slug: "ravioles-de-chevre-frais-miel-de-monteregie",
        name: "Ravioles de chèvre frais & miel de Montérégie"
      }
    ]
  };

  const english = await applyStoredPublicMenuTranslations(
    sourceMenu,
    "en-CA"
  );

  assert.equal(english.activeLocale, "fr-CA");
  assert.equal(english.translationStatus?.status, "source");
  assert.equal(
    english.dishes[0].name,
    "Ravioles de chèvre frais & miel de Montérégie"
  );
  assert.equal(english.dishes[0].description, sourceDish.description);
});

test("Sauge browser fixture resolves complete stored English menus for all landing cards", async () => {
  const { rows } = await import(
    "../e2e/support/sauge-noire-fixture-data.mjs"
  );
  const { getPublicMenuBySlug } = await import("../lib/menu/publicMenu.ts");

  const readRows = async ({ table, filters, orderBy, limit }) => {
    const filtered = (rows[table] ?? [])
      .filter((row) =>
        Object.entries(filters).every(
          ([field, value]) => String(row[field] ?? "") === value
        )
      )
      .sort((left, right) => {
        for (const field of Array.isArray(orderBy) ? orderBy : [orderBy]) {
          const comparison = String(left[field] ?? "").localeCompare(
            String(right[field] ?? "")
          );
          if (comparison) return comparison;
        }
        return 0;
      });
    return { ok: true, rows: filtered.slice(0, limit) };
  };

  globalThis.__vistaireTranslationAdmin = {
    ok: true,
    client: {
      from(table) {
        const filters = {};
        return {
          select() {
            return this;
          },
          eq(field, value) {
            filters[field] = String(value);
            return this;
          },
          async in(field, values) {
            return {
              data: (rows[table] ?? []).filter(
                (row) =>
                  Object.entries(filters).every(
                    ([filterField, value]) =>
                      String(row[filterField] ?? "") === value
                  ) && values.includes(row[field])
              ),
              error: null
            };
          }
        };
      }
    }
  };

  try {
    const menuPairs = await Promise.all(
      ["maison-elyse", "trouvable", "sauge-noire"].map(async (slug) => ({
        slug,
        french: await getPublicMenuBySlug(slug, "fr-CA", {
          readRows,
          nodeEnv: "production"
        }),
        english: await getPublicMenuBySlug(slug, "en-CA", {
          readRows,
          nodeEnv: "production"
        })
      }))
    );

    for (const { slug, french, english } of menuPairs) {
      assert.ok(french, `missing French fixture menu for ${slug}`);
      assert.ok(english, `missing English fixture menu for ${slug}`);
      assert.equal(english.activeLocale, "en-CA");
      assert.equal(
        english.translationStatus?.status,
        "up_to_date",
        `${slug}: ${JSON.stringify(english.translationStatus)}`
      );
      assert.notEqual(english.menuName, french.menuName);
      assert.notEqual(english.dishes[0].category, french.dishes[0].category);
      assert.equal(english.dishes[0].name, french.dishes[0].name);
      assert.notEqual(
        english.dishes[0].description,
        french.dishes[0].description
      );
      assert.notDeepEqual(
        english.dishes[0].ingredients,
        french.dishes[0].ingredients
      );
      assert.notDeepEqual(english.dishes[0].options, french.dishes[0].options);
    }

    const maison = menuPairs.find(({ slug }) => slug === "maison-elyse").english;
    assert.equal(maison.menuName, "The Menu");
    assert.equal(maison.dishes[0].category, "Starters");
    assert.equal(maison.dishes[0].name, menuPairs.find(({ slug }) => slug === "maison-elyse").french.dishes[0].name);
    assert.match(maison.dishes[0].description, /Brown butter/);

    const trouvable = menuPairs.find(({ slug }) => slug === "trouvable").english;
    assert.equal(trouvable.dishes[0].category, "Mains");
    assert.equal(trouvable.dishes[0].name, menuPairs.find(({ slug }) => slug === "trouvable").french.dishes[0].name);
    assert.match(trouvable.dishes[0].description, /fresh herbs/);

    const sauge = menuPairs.find(({ slug }) => slug === "sauge-noire").english;
    const beetroot = sauge.dishes.find(
      (dish) => dish.slug === "betterave-sous-la-cendre"
    );
    assert.ok(beetroot);
    assert.equal(beetroot.category, "First bites");
    assert.equal(
      beetroot.name,
      menuPairs
        .find(({ slug }) => slug === "sauge-noire")
        .french.dishes.find((dish) => dish.slug === "betterave-sous-la-cendre")
        .name
    );
    assert.match(beetroot.description, /smoked labneh/);
    assert.ok(beetroot.ingredients.every((value) => !/[àâçéèêëîïôùûü]/i.test(value)));
    assert.ok(beetroot.options.every((value) => !/[àâçéèêëîïôùûü]/i.test(value)));
  } finally {
    delete globalThis.__vistaireTranslationAdmin;
  }
});

test("concurrent French and English landing resolution stays isolated per restaurant", async () => {
  const { getLandingExperiences } = await import(
    "../lib/landing/menuExperiences.ts"
  );

  const [french, english] = await Promise.all([
    getLandingExperiences("fr"),
    getLandingExperiences("en")
  ]);

  assert.equal(french.length, 3);
  assert.equal(english.length, 3);

  for (const englishExperience of english) {
    const frenchExperience = french.find(
      (candidate) => candidate.id === englishExperience.id
    );
    assert.ok(frenchExperience, `missing French ${englishExperience.id}`);
    assert.equal(
      englishExperience.featuredDish.name,
      frenchExperience.featuredDish.name,
      `${englishExperience.id} dish name must stay in the source language`
    );
    assert.notEqual(
      englishExperience.featuredDish.description,
      frenchExperience.featuredDish.description,
      `${englishExperience.id} dish description leaked across locales`
    );
    assert.notEqual(
      englishExperience.featuredDish.imageAlt,
      frenchExperience.featuredDish.imageAlt,
      `${englishExperience.id} dish alt leaked across locales`
    );

    const englishUrl = new URL(
      englishExperience.featuredDish.href,
      "https://vistaire.test"
    );
    const frenchUrl = new URL(
      frenchExperience.featuredDish.href,
      "https://vistaire.test"
    );
    assert.equal(englishUrl.searchParams.get("lang"), "en-CA");
    assert.equal(frenchUrl.searchParams.get("lang"), "fr-CA");
    assert.notEqual(englishUrl.href, frenchUrl.href);
    assert.equal(
      englishExperience.preview.featuredDish?.name,
      englishExperience.featuredDish.name,
      `${englishExperience.id} kept a stale English preview`
    );
    assert.equal(
      frenchExperience.preview.featuredDish?.name,
      frenchExperience.featuredDish.name,
      `${englishExperience.id} kept a stale French preview`
    );
  }
});

test("landing preview rejects an effective French fallback for an English request", async () => {
  const { assertLandingMenuPreviewReady } = await import(
    "../lib/landing/menuExperiences.ts"
  );

  assert.throws(
    () =>
      assertLandingMenuPreviewReady(
        {
          locale: "fr",
          publicLocale: "fr-CA",
          query: { lang: "fr-CA" },
          menu: {
            activeLocale: "fr-CA",
            translationStatus: { locale: "fr-CA", status: "source" },
            dishes: [{ id: "dish-1" }]
          }
        },
        "en"
      ),
    (error) => {
      assert.equal(error.code, "landing_locale_mismatch");
      assert.deepEqual(error.details, {
        requestedLocale: "en",
        expectedPublicLocale: "en-CA",
        actualPublicLocale: "fr-CA",
        actualActiveLocale: "fr-CA",
        queryLang: "fr-CA"
      });
      return true;
    }
  );
});

test("landing fallback catch is limited to readiness failures and endpoint errors stay structured", () => {
  const landingSource = readFileSync(
    "lib/landing/menuExperiences.ts",
    "utf8"
  );
  const endpointSource = readFileSync(
    "app/api/public/landing-menu-preview/[experienceId]/route.ts",
    "utf8"
  );

  assert.match(
    landingSource,
    /catch \(error\) \{[\s\S]{0,180}error instanceof LandingMenuPreviewError[\s\S]{0,100}return experience/
  );
  assert.doesNotMatch(landingSource, /catch \{\s*return experience/);
  assert.match(endpointSource, /LandingMenuPreviewError/);
  assert.match(endpointSource, /code: "landing_menu_preview_unavailable"/);
  assert.match(endpointSource, /code: error\.code/);
});
