import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;

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
        url: "data:text/javascript,export%20const%20unstable_cache%3D(fn)%3D%3Efn",
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

const localizationPath = "lib/menu/maisonElyseLocalization.ts";
const menuPath = "components/menu/MaisonElyseQrMenu.tsx";

const unavailableRows = async () => ({
  ok: false,
  rows: [],
  error: "controlled Maison demo fallback"
});

async function getMaisonDemoMenu(locale) {
  const { getPublicMenuBySlug } = await import("../lib/menu/publicMenu.ts");
  const menu = await getPublicMenuBySlug("maison-elyse", locale, {
    readRows: unavailableRows,
    nodeEnv: "development"
  });
  assert.ok(menu, `Maison Elyse ${locale} menu should resolve`);
  return menu;
}

test("Maison category labels use exact shared aliases in menu and dish detail", async () => {
  const { getMaisonElyseCategoryKind, getMaisonElyseCategoryLabel } =
    await import("../lib/menu/maisonElyseLocalization.ts");

  assert.equal(getMaisonElyseCategoryLabel("Entrées", "en-CA"), "Starters");
  assert.equal(getMaisonElyseCategoryLabel("Starters", "fr-CA"), "Entrées");
  assert.equal(
    getMaisonElyseCategoryLabel("Plats signatures", "en-CA"),
    "Signature dishes"
  );
  assert.equal(getMaisonElyseCategoryKind("Signatures"), "signature");
  assert.equal(
    getMaisonElyseCategoryLabel("Signatures", "en-CA"),
    "Signature dishes"
  );
  assert.equal(getMaisonElyseCategoryKind("Signatures du chef"), null);
  assert.equal(getMaisonElyseCategoryLabel("Cocktails", "en-CA"), "Cocktails");
  assert.equal(getMaisonElyseCategoryLabel("Boissons", "en-CA"), "Drinks");
  assert.equal(getMaisonElyseCategoryLabel("Drinks", "fr-CA"), "Boissons");
  assert.equal(getMaisonElyseCategoryKind("Cocktails signatures"), "cocktail");
  assert.equal(
    getMaisonElyseCategoryLabel("Cocktails signatures", "en-CA"),
    "Cocktails"
  );
  assert.equal(getMaisonElyseCategoryKind("Signature cocktails du chef"), null);
  assert.equal(
    getMaisonElyseCategoryLabel("Signature cocktails du chef", "en-CA"),
    "Signature cocktails du chef"
  );
});

test("Maison normalizes the persisted English starter mistranslation exactly", async () => {
  const { getMaisonElyseCategoryKind, getMaisonElyseCategoryLabel } =
    await import("../lib/menu/maisonElyseLocalization.ts");

  assert.equal(getMaisonElyseCategoryKind("Inputs"), "starter");
  assert.equal(getMaisonElyseCategoryLabel("Inputs", "en-CA"), "Starters");
  assert.equal(getMaisonElyseCategoryKind("Inputs du chef"), null);
});

test("Maison category descriptions fall back to the active locale without explicit content", async () => {
  const localization = await import("../lib/menu/maisonElyseLocalization.ts");
  const resolveDescription =
    localization.resolveMaisonElyseCategoryDescription;

  assert.equal(typeof resolveDescription, "function");
  assert.equal(
    resolveDescription(
      [{ categoryDescription: "" }, {}],
      "The first house plates: precise, generous and seasonal."
    ),
    "The first house plates: precise, generous and seasonal."
  );
  assert.equal(
    resolveDescription(
      [
        { categoryDescription: "Ouvertures de saison" },
        { categoryDescription: "Seasonal openings" }
      ],
      "The first house plates: precise, generous and seasonal."
    ),
    "Seasonal openings"
  );
});

function homardContract(menu) {
  const dish = menu.dishes.find((candidate) => candidate.slug === "homard-bisque");
  assert.ok(dish, "homard-bisque should remain addressable by its stable slug");
  return {
    activeLocale: menu.activeLocale,
    id: dish.id,
    slug: dish.slug,
    categoryId: dish.categoryId,
    categorySlug: dish.categorySlug,
    name: dish.name,
    category: dish.category,
    description: dish.description
  };
}

test("Maison demo keeps dish and category identities stable across French and English", async () => {
  const [french, english] = await Promise.all([
    getMaisonDemoMenu("fr-CA"),
    getMaisonDemoMenu("en-CA")
  ]);
  const englishBySlug = new Map(english.dishes.map((dish) => [dish.slug, dish]));

  assert.equal(english.dishes.length, french.dishes.length);
  for (const frenchDish of french.dishes) {
    const englishDish = englishBySlug.get(frenchDish.slug);
    assert.ok(englishDish, `${frenchDish.slug}: missing English dish`);
    assert.equal(englishDish.id, frenchDish.id, `${frenchDish.slug}: id changed`);
    assert.equal(englishDish.slug, frenchDish.slug, `${frenchDish.slug}: slug changed`);
    assert.ok(frenchDish.categoryId, `${frenchDish.slug}: missing stable categoryId`);
    assert.equal(
      englishDish.categoryId,
      frenchDish.categoryId,
      `${frenchDish.slug}: categoryId changed`
    );
    assert.ok(frenchDish.categorySlug, `${frenchDish.slug}: missing stable categorySlug`);
    assert.equal(
      englishDish.categorySlug,
      frenchDish.categorySlug,
      `${frenchDish.slug}: categorySlug changed`
    );
  }
});

test("Maison demo localizes the representative dish name and restores it in French", async () => {
  const [french, english] = await Promise.all([
    getMaisonDemoMenu("fr-CA"),
    getMaisonDemoMenu("en-CA")
  ]);

  assert.equal(
    homardContract(french).name,
    "Homard bleu, bisque corsée & fenouil"
  );
  assert.equal(
    homardContract(english).name,
    "Blue lobster, deep bisque & fennel"
  );
});

test("Maison live English fallback recognizes a renamed known dish by slug and preserves its identity", async () => {
  const [{ buildMaisonEnglishPublicMenu }, french] = await Promise.all([
    import("../lib/menu/publicMenuEnglishFallback.ts"),
    getMaisonDemoMenu("fr-CA")
  ]);
  const demoHomard = french.dishes.find((dish) => dish.slug === "homard-bisque");
  assert.ok(demoHomard);
  const liveDish = {
    ...demoHomard,
    id: "44444444-4444-4444-8444-000000000003",
    slug: "homard-bleu-bisque-corsee-fenouil",
    name: "Homard prestige du chef",
    categoryId: "33333333-3333-4333-8333-000000000002",
    categorySlug: "plats-signatures",
    category: "Plats signatures",
    categoryDescription: "Les signatures du chef, pensées pour marquer les esprits."
  };

  const english = buildMaisonEnglishPublicMenu({
    ...french,
    source: "supabase",
    dishes: [liveDish]
  });

  assert.deepEqual(
    {
      id: english.dishes[0].id,
      slug: english.dishes[0].slug,
      name: english.dishes[0].name,
      category: english.dishes[0].category,
      categoryDescription: english.dishes[0].categoryDescription,
      description: english.dishes[0].description
    },
    {
      id: "44444444-4444-4444-8444-000000000003",
      slug: "homard-bleu-bisque-corsee-fenouil",
      name: "Homard prestige du chef",
      category: "Signature dishes",
      categoryDescription: "Chef signatures designed to stay in memory.",
      description:
        "Pearled lobster served with a reduced shellfish bisque and glazed pantry vegetables. A final touch of pastis reveals the confit fennel without masking the sea."
    }
  );
});

test("Maison fr and en aliases produce their canonical public contracts", async () => {
  const [frenchAlias, frenchCanonical, englishAlias, englishCanonical] =
    await Promise.all([
      getMaisonDemoMenu("fr"),
      getMaisonDemoMenu("fr-CA"),
      getMaisonDemoMenu("en"),
      getMaisonDemoMenu("en-CA")
    ]);

  assert.deepEqual(homardContract(frenchAlias), homardContract(frenchCanonical));
  assert.deepEqual(homardContract(englishAlias), homardContract(englishCanonical));
  assert.deepEqual(homardContract(englishAlias), {
    activeLocale: "en-CA",
    id: "homard-bisque",
    slug: "homard-bisque",
    categoryId: "cat-signatures",
    categorySlug: "plats-signatures",
    name: "Blue lobster, deep bisque & fennel",
    category: "Signature dishes",
    description:
      "Pearled lobster served with a reduced shellfish bisque and glazed pantry vegetables. A final touch of pastis reveals the confit fennel without masking the sea."
  });
});

test("Maison locale resolution never pairs English copy with a French menu", async () => {
  const { resolveMaisonElyseLocalizedMenu } = await import(
    "../lib/menu/maisonElyseLocalization.ts"
  );
  assert.equal(
    typeof resolveMaisonElyseLocalizedMenu,
    "function",
    "Maison needs one display-safe locale/menu resolver"
  );

  const [french, english] = await Promise.all([
    getMaisonDemoMenu("fr-CA"),
    getMaisonDemoMenu("en-CA")
  ]);
  const mismatchedEnglishBucket = {
    ...french,
    activeLocale: "fr-CA"
  };

  assert.deepEqual(
    resolveMaisonElyseLocalizedMenu({
      fallbackLocale: "fr-CA",
      fallbackMenu: french,
      localizedMenus: { "fr-CA": french, "en-CA": english },
      requestedLocale: "en"
    }),
    { locale: "en-CA", menu: english }
  );
  assert.deepEqual(
    resolveMaisonElyseLocalizedMenu({
      fallbackLocale: "fr-CA",
      fallbackMenu: french,
      localizedMenus: {
        "fr-CA": french,
        "en-CA": mismatchedEnglishBucket
      },
      requestedLocale: "en-CA"
    }),
    { locale: "fr-CA", menu: french }
  );
});

test("Maison Elyse language options use configured ready locales only", async () => {
  const [localization, menu] = await Promise.all([
    readFile(localizationPath, "utf8"),
    readFile(menuPath, "utf8")
  ]);

  assert.match(localization, /getMaisonElyseLanguageOptions/);
  assert.match(localization, /status === "up_to_date"/);
  assert.match(localization, /status === "source"/);
  assert.match(menu, /getMaisonElyseLanguageOptions\(/);
  assert.doesNotMatch(menu, /const LANGUAGE_OPTIONS\s*=/);
});

test("Maison Elyse UI copy resolves exact/base/pack sources with diagnostics", async () => {
  const [source, resolverSource] = await Promise.all([
    readFile(localizationPath, "utf8"),
    readFile("components/menu/trouvableMenuControls.ts", "utf8")
  ]);

  assert.match(source, /resolveTrouvableCopy/);
  assert.match(resolverSource, /requestedLocale/);
  assert.match(resolverSource, /dynamicSource/);
  assert.match(resolverSource, /usedNeutralFallback/);
});

test("Maison Elyse keeps its branded collection cover copy", async () => {
  const source = await readFile(menuPath, "utf8");

  // The shared Trouvable resolver owns generic navigation copy. Its
  // `categories` and `activeCategoryAll` values must not replace Maison's
  // cover lockup, which is part of the public restaurant experience.
  assert.doesNotMatch(source, /collectionKicker:\s*resolved\.categories/);
  assert.doesNotMatch(source, /collectionTitle:\s*resolved\.activeCategoryAll/);
  assert.doesNotMatch(source, /collectionBody:\s*resolved\.heroBlurb/);
  assert.match(source, /collectionKicker:\s*"LA COLLECTION"/);
  assert.match(source, /collectionKicker:\s*"THE COLLECTION"/);
});

test("Maison Elyse detail keeps its restaurant-specific return label", async () => {
  const source = await readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8");

  assert.doesNotMatch(source, /backToMenu:\s*resolved\.backToMenu/);
  assert.match(source, /backToMenu:\s*"Retour à la carte"/);
  assert.match(source, /backToMenu:\s*"Back to menu"/);
});

test("Maison demo showcase projects localized menus by canonical public locale", async () => {
  const [showcase, demo, englishDemo, projection, landingData] = await Promise.all([
    readFile("components/vistaire-preview/DemoPhoneShowcase.tsx", "utf8"),
    readFile("app/demo/page.tsx", "utf8"),
    readFile("app/en/vistaire-menu/page.tsx", "utf8"),
    readFile("lib/landing/landingMenuUiPreview.ts", "utf8"),
    readFile("lib/landing/menuExperiences.ts", "utf8")
  ]);

  assert.match(showcase, /experiences: LandingExperience\[\]/);
  assert.match(demo, /getLandingExperiences/);
  assert.match(englishDemo, /getLandingExperiences/);
  assert.match(projection, /Partial<Record<PublicMenuLocale, LandingMenuUiMenu>>/);
  assert.match(landingData, /locale !== context\.publicLocale/);
  assert.match(landingData, /getMaisonElyseIdentity/);
});

test("Maison Elyse server context loads every ready locale for reload persistence", async () => {
  const source = await readFile("lib/menu/publicMenuRenderContext.ts", "utf8");

  assert.match(source, /lang: hasLangParam \? publicLocale : undefined/);
  assert.match(source, /translationLocales/);
  assert.match(source, /settings\.supportedLocales\.filter/);
  assert.match(source, /status === "up_to_date"/);
  assert.match(source, /getPublicMenuBySlug\(slug, candidate\)/);
});

test("Maison menu root and text zones follow the resolved menu direction", async () => {
  const source = await readFile(menuPath, "utf8");

  assert.match(source, /data-text-direction=\{textDirection\}/);
  assert.match(source, /dir=\{textDirection\}/);
  assert.doesNotMatch(source, /dir="rtl"/);
});
