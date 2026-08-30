import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const previewDependencyStubUrl = "vistaire-test:landing-preview-dependency";
const requireDependency = createRequire(import.meta.url);
const nextCacheUrl = pathToFileURL(requireDependency.resolve("next/cache")).href;
const nextServerUrl = pathToFileURL(requireDependency.resolve("next/server")).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export%20default%20undefined",
        shortCircuit: true
      };
    }
    if (specifier === "next/server") {
      return { url: nextServerUrl, shortCircuit: true };
    }
    if (specifier === "next/cache") {
      return { url: nextCacheUrl, shortCircuit: true };
    }
    if (
      specifier === "@/lib/landing/menuExperiences" &&
      context.parentURL?.includes("landing-menu-preview")
    ) {
      return { url: previewDependencyStubUrl, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url) && statSync(url).isFile()) return { url: url.href, shortCircuit: true };
      }
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
      const baseUrl = new URL(specifier, context.parentURL);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url) && statSync(url).isFile()) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === previewDependencyStubUrl) {
      return {
        format: "module",
        source: `
          export class LandingMenuPreviewError extends Error {
            constructor(code, message, details = {}) {
              super(message);
              this.code = code;
              this.details = details;
              this.status = 424;
            }
          }
          export const isLandingExperienceId = (value) =>
            ["maison-elyse", "trouvable", "sauge-noire"].includes(value);
          export async function getLandingMenuPreviewPayload(experienceId, locale) {
            const state = globalThis.__vistaireLandingPreviewRouteState;
            if (state.mode === "typed-error") {
              throw new LandingMenuPreviewError(
                "landing_translation_not_ready",
                "Landing preview is not ready.",
                { locale }
              );
            }
            if (state.mode === "unexpected-error") {
              throw new Error("synthetic-private-sentinel");
            }
            if (state.mode === "missing") return null;
            return { kind: "test", experienceId, locale };
          }
        `,
        shortCircuit: true
      };
    }
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

const landingModule = await import("../lib/landing/menuExperiences.ts");
const { arePublicMenuTranslationsReadyForStableCache } = await import(
  "../lib/menu/publicMenuRenderContext.ts"
);
const [{ getPublicMenuBySlug }, { menuUiConfigForRestaurant }, { resolvePublicMenuExperience }] =
  await Promise.all([
    import("../lib/menu/publicMenu.ts"),
    import("../lib/menu/menuUiConfig.ts"),
    import("../lib/menu/publicMenuExperienceRoute.ts")
  ]);

const unavailableRows = async () => ({
  ok: false,
  rows: [],
  error: "controlled landing cache fixture"
});
const demoMaisonMenu = await getPublicMenuBySlug("maison-elyse", "fr-CA", {
  readRows: unavailableRows,
  nodeEnv: "development"
});
assert.ok(demoMaisonMenu);
const maisonConfig = menuUiConfigForRestaurant({
  name: demoMaisonMenu.name,
  slug: demoMaisonMenu.slug
});
const liveMaisonContext = {
  menu: {
    ...demoMaisonMenu,
    source: "supabase"
  },
  config: maisonConfig,
  context: "",
  query: {
    lang: "fr-CA",
    currency: undefined,
    table: undefined,
    view: undefined,
    zone: undefined
  },
  locale: "fr",
  publicLocale: "fr-CA",
  localizedMenus: {},
  stableCacheReadiness: {
    publishedUiConfig: true,
    localizedMenusComplete: true
  },
  experience: resolvePublicMenuExperience(demoMaisonMenu, maisonConfig)
};

function fakeCacheBackend() {
  const calls = [];
  const values = new Map();
  return {
    calls,
    values,
    backend(load, keyParts, options) {
      const address = JSON.stringify(keyParts);
      calls.push({ keyParts, options });
      return async () => {
        if (values.has(address)) return values.get(address);
        const value = await load();
        values.set(address, value);
        return value;
      };
    }
  };
}

function cacheInput(overrides = {}) {
  return {
    restaurantKey: "maison-elyse",
    experienceId: "maison-elyse",
    locale: "fr",
    version: "v12",
    ...overrides
  };
}

function richDishLists(suffix, translated) {
  const list = (name, count) =>
    Array.from({ length: count }, (_, index) => `${name}-${suffix}-${index}`);
  return {
    ingredients: list("ingredient", translated ? 80 : 24),
    allergens: list("allergen", translated ? 80 : 24),
    customAllergens: list("custom-allergen", 16),
    allergenDeclarations: Array.from({ length: 14 }, () => ({
      allergenId: "gluten",
      status: "contains"
    })),
    allergenLegacyValues: list("legacy-allergen", 64),
    options: list("option", translated ? 80 : 72),
    tags: list("tag", translated ? 82 : 48)
  };
}

function scaledMenuDishes(menu, count, suffix, translated) {
  return Array.from({ length: count }, (_, index) => {
    const source = menu.dishes[index % menu.dishes.length];
    return {
      ...source,
      ...(index < menu.dishes.length
        ? {}
        : {
            id: `${source.id}-${suffix}-${index}`,
            slug: `${source.slug}-${suffix}-${index}`
          }),
      ...richDishLists(`${suffix}-${index}`, translated)
    };
  });
}

test("landing cache reuses fulfilled live values inside an epoch and isolates every address dimension", async () => {
  const fake = fakeCacheBackend();
  let now = 899_999;
  let loads = 0;
  const cache = landingModule.createLandingLiveCache({
    cacheBackend: fake.backend,
    now: () => now
  });
  const load = async () => ({ serial: ++loads });

  assert.deepEqual(await cache.readExperience(cacheInput({ load })), { serial: 1 });
  assert.deepEqual(await cache.readExperience(cacheInput({ load })), { serial: 1 });
  assert.equal(loads, 1);

  await cache.readExperience(cacheInput({ experienceId: "trouvable", restaurantKey: "trouvable", load }));
  await cache.readExperience(cacheInput({ locale: "en", load }));
  await cache.readPayload(cacheInput({ load }));
  assert.equal(loads, 4, "experience, locale and payload kind must not collide");

  now = 900_000;
  assert.deepEqual(await cache.readExperience(cacheInput({ load })), { serial: 5 });
  assert.equal(loads, 5, "the exact fifteen-minute boundary must address a new entry");

  const first = fake.calls[0];
  assert.equal(first.options.revalidate, 900);
  assert.deepEqual(first.options.tags, [
    "vistaire-public:v1:landing:restaurant=maison-elyse:experience=maison-elyse:locale=fr"
  ]);
  assert.ok(first.keyParts.includes("epoch=0"));
  assert.ok(fake.calls.at(-1).keyParts.includes("epoch=1"));
});

test("landing cache accepts the supported rich 200-dish bilingual projection", async () => {
  const fake = fakeCacheBackend();
  const frenchDishes = scaledMenuDishes(
    liveMaisonContext.menu,
    200,
    "fr",
    false
  );
  const englishDishes = scaledMenuDishes(
    liveMaisonContext.menu,
    200,
    "en",
    true
  );
  const bilingualContext = {
    ...liveMaisonContext,
    menu: { ...liveMaisonContext.menu, dishes: frenchDishes },
    localizedMenus: {
      "en-CA": {
        ...liveMaisonContext.menu,
        activeLocale: "en-CA",
        translationStatus: { locale: "en-CA", status: "up_to_date" },
        dishes: englishDishes
      }
    }
  };
  const reader = landingModule.createLandingDataReader({
    cacheBackend: fake.backend,
    now: () => 0,
    resolveContext: async ({ slug }) =>
      slug === "maison-elyse" ? bilingualContext : null,
    resolveRates: async () => ({ base: "CAD", rates: { CAD: 1 } })
  });

  const payload = await reader.getPreviewPayload("maison-elyse", "fr");
  assert.equal(payload?.menuUi.menu.dishes.length, 200);
  assert.equal(payload?.menuUi.localizedMenus["en-CA"]?.dishes.length, 200);
  assert.equal(fake.values.size, 1);
});

test("landing cache never stores a rejected fill and cannot reuse the prior epoch", async () => {
  const fake = fakeCacheBackend();
  let now = 0;
  let attempts = 0;
  let fail = true;
  const cache = landingModule.createLandingLiveCache({
    cacheBackend: fake.backend,
    now: () => now
  });
  const load = async () => {
    attempts += 1;
    if (fail) throw new landingModule.LandingLiveDataUnavailableError("landing_source_unavailable");
    return { live: attempts };
  };

  await assert.rejects(cache.readExperience(cacheInput({ load })), {
    name: "LandingLiveDataUnavailableError"
  });
  fail = false;
  assert.deepEqual(await cache.readExperience(cacheInput({ load })), { live: 2 });
  assert.equal(attempts, 2, "the fallback-producing rejection must not be cached");

  now = 900_000;
  fail = true;
  await assert.rejects(cache.readExperience(cacheInput({ load })), {
    name: "LandingLiveDataUnavailableError"
  });
  assert.equal(attempts, 3, "a new epoch must not receive the previous live value");
});

test("the real preview reader preserves typed readiness errors for the API 424 boundary", async () => {
  const fake = fakeCacheBackend();
  const reader = landingModule.createLandingDataReader({
    cacheBackend: fake.backend,
    now: () => 0,
    resolveContext: async ({ slug }) =>
      slug === "maison-elyse"
        ? {
            ...liveMaisonContext,
            menu: {
              ...liveMaisonContext.menu,
              translationStatus: { locale: "fr-CA", status: "pending" }
            }
          }
        : null,
    resolveRates: async () => ({ base: "CAD", rates: { CAD: 1 } })
  });

  await assert.rejects(reader.getPreviewPayload("maison-elyse", "fr"), {
    name: "LandingMenuPreviewError",
    code: "landing_translation_not_ready",
    status: 424
  });
  assert.equal(fake.values.size, 0, "a typed readiness failure must not be stored");
});

test("translation read provenance stays incomplete after supported locales are filtered", () => {
  const filteredAfterReadFailure = {
    settings: {
      defaultLocale: "fr-CA",
      supportedLocales: ["fr-CA"]
    },
    translationLocales: [
      { locale: "fr-CA", status: "source" },
      { locale: "en-CA", status: "missing" }
    ]
  };
  assert.equal(
    arePublicMenuTranslationsReadyForStableCache(filteredAfterReadFailure),
    false
  );
  assert.equal(
    arePublicMenuTranslationsReadyForStableCache({
      ...filteredAfterReadFailure,
      translationLocales: [
        { locale: "fr-CA", status: "source" },
        { locale: "en-CA", status: "up_to_date" }
      ]
    }),
    true
  );
});

test("real landing builders keep every non-live outcome outside cache and recover immediately", async () => {
  const cases = [
    { label: "null source", invalidContext: () => null, preview: "null" },
    {
      label: "demo source",
      invalidContext: () => ({
        ...liveMaisonContext,
        menu: { ...liveMaisonContext.menu, source: "demo" }
      }),
      preview: "null"
    },
    {
      label: "translation not ready",
      invalidContext: () => ({
        ...liveMaisonContext,
        menu: {
          ...liveMaisonContext.menu,
          translationStatus: { locale: "fr-CA", status: "pending" }
        }
      }),
      preview: "landing_translation_not_ready"
    },
    {
      label: "wrong identity",
      invalidContext: () => ({
        ...liveMaisonContext,
        menu: { ...liveMaisonContext.menu, slug: "wrong-restaurant" }
      }),
      preview: "landing_identity_mismatch"
    },
    {
      label: "unsafe payload",
      invalidContext: () => ({
        ...liveMaisonContext,
        config: {
          ...liveMaisonContext.config,
          syntheticUnsafeCard: { token: "never-cache-this-sentinel" }
        }
      }),
      preview: "null"
    },
    {
      label: "unpublished UI config fallback",
      invalidContext: () => ({
        ...liveMaisonContext,
        stableCacheReadiness: {
          ...liveMaisonContext.stableCacheReadiness,
          publishedUiConfig: false
        }
      }),
      preview: "null"
    },
    {
      label: "ready alternate locale resolved from demo fallback",
      invalidContext: () => ({
        ...liveMaisonContext,
        localizedMenus: {
          "en-CA": {
            ...liveMaisonContext.menu,
            activeLocale: "en-CA",
            source: "demo",
            translationStatus: { locale: "en-CA", status: "up_to_date" }
          }
        },
        stableCacheReadiness: {
          ...liveMaisonContext.stableCacheReadiness,
          localizedMenusComplete: false
        }
      }),
      preview: "null"
    },
    {
      label: "ready alternate locale resolved for the wrong tenant",
      invalidContext: () => ({
        ...liveMaisonContext,
        localizedMenus: {
          "en-CA": {
            ...liveMaisonContext.menu,
            activeLocale: "en-CA",
            restaurantId: "wrong-tenant",
            translationStatus: { locale: "en-CA", status: "up_to_date" }
          }
        },
        stableCacheReadiness: {
          ...liveMaisonContext.stableCacheReadiness,
          localizedMenusComplete: false
        }
      }),
      preview: "null"
    },
    {
      label: "ready alternate locale resolved with stale translation metadata",
      invalidContext: () => ({
        ...liveMaisonContext,
        localizedMenus: {
          "en-CA": {
            ...liveMaisonContext.menu,
            activeLocale: "en-CA",
            translationStatus: { locale: "en-CA", status: "pending" }
          }
        },
        stableCacheReadiness: {
          ...liveMaisonContext.stableCacheReadiness,
          localizedMenusComplete: false
        }
      }),
      preview: "null"
    },
    {
      label: "translation read failure filtered the missing alternate locale",
      invalidContext: () => ({
        ...liveMaisonContext,
        menu: {
          ...liveMaisonContext.menu,
          settings: {
            ...liveMaisonContext.menu.settings,
            supportedLocales: ["fr-CA"]
          },
          translationLocales: [
            { locale: "fr-CA", status: "source" },
            { locale: "en-CA", status: "missing" }
          ]
        },
        stableCacheReadiness: {
          ...liveMaisonContext.stableCacheReadiness,
          localizedMenusComplete: false
        }
      }),
      preview: "null"
    }
  ];

  for (const { label, invalidContext, preview } of cases) {
    const fake = fakeCacheBackend();
    let recovered = false;
    const reader = landingModule.createLandingDataReader({
      cacheBackend: fake.backend,
      now: () => 0,
      resolveContext: async ({ slug }) => {
        if (slug !== "maison-elyse") return null;
        return recovered ? liveMaisonContext : invalidContext();
      },
      resolveRates: async () => ({ base: "CAD", rates: { CAD: 1 } })
    });

    const fallbackExperiences = await reader.getExperiences("fr");
    const fallbackMaison = fallbackExperiences.find(
      (experience) => experience.id === "maison-elyse"
    );
    assert.equal(fallbackMaison?.hasLiveData, false, label);
    if (preview === "null") {
      assert.equal(
        await reader.getPreviewPayload("maison-elyse", "fr"),
        null,
        label
      );
    } else {
      await assert.rejects(reader.getPreviewPayload("maison-elyse", "fr"), {
        name: "LandingMenuPreviewError",
        code: preview
      });
    }
    assert.equal(fake.values.size, 0, `${label} must not be stored`);

    recovered = true;
    const liveExperiences = await reader.getExperiences("fr");
    const liveMaison = liveExperiences.find(
      (experience) => experience.id === "maison-elyse"
    );
    assert.equal(liveMaison?.hasLiveData, true, `${label} experience recovery`);
    assert.ok(liveMaison?.renderPayload, `${label} Maison payload recovery`);
    assert.ok(
      await reader.getPreviewPayload("maison-elyse", "fr"),
      `${label} preview recovery`
    );
    assert.equal(fake.values.size, 2, `${label} stores only recovered live values`);
  }
});

test("a live experience with only an editorial dish photo is not cached and recovers", async () => {
  const fake = fakeCacheBackend();
  let recovered = false;
  const reader = landingModule.createLandingDataReader({
    cacheBackend: fake.backend,
    now: () => 0,
    resolveContext: async ({ slug }) => {
      if (slug !== "maison-elyse") return null;
      if (recovered) return liveMaisonContext;
      return {
        ...liveMaisonContext,
        menu: {
          ...liveMaisonContext.menu,
          dishes: liveMaisonContext.menu.dishes.map((dish) => ({
            ...dish,
            cardUrl: "",
            imageUrl: "",
            thumbnailUrl: "",
            posterUrl: "",
            hasPhoto: false,
            photoStatus: "missing"
          }))
        }
      };
    },
    resolveRates: async () => ({ base: "CAD", rates: { CAD: 1 } })
  });

  const fallback = await reader.getExperiences("fr");
  assert.equal(
    fallback.find((experience) => experience.id === "maison-elyse")?.hasLiveData,
    false
  );
  assert.equal(fake.values.size, 0, "an editorial photo must stay outside cache");

  recovered = true;
  const live = await reader.getExperiences("fr");
  assert.equal(
    live.find((experience) => experience.id === "maison-elyse")?.hasLiveData,
    true
  );
  assert.equal(fake.values.size, 1, "only the recovered live experience is stored");
});

test("exchange rates refresh outside a warm stable preview cache entry", async () => {
  const fake = fakeCacheBackend();
  let stableReads = 0;
  let usdRate = 0.72;
  let rateReads = 0;
  const reader = landingModule.createLandingDataReader({
    cacheBackend: fake.backend,
    now: () => 0,
    resolveContext: async ({ slug }) => {
      if (slug !== "maison-elyse") return null;
      stableReads += 1;
      return liveMaisonContext;
    },
    resolveRates: async () => {
      rateReads += 1;
      return { base: "CAD", rates: { CAD: 1, USD: usdRate } };
    }
  });

  const first = await reader.getPreviewPayload("maison-elyse", "fr");
  assert.equal(first?.menuUi.exchangeRates.rates.USD, 0.72);
  usdRate = 0.75;
  const second = await reader.getPreviewPayload("maison-elyse", "fr");
  assert.equal(second?.menuUi.exchangeRates.rates.USD, 0.75);
  assert.equal(stableReads, 1, "the stable fill must stay warm");
  assert.equal(rateReads, 2, "volatile rates must resolve after every cache hit");
  assert.doesNotMatch(
    JSON.stringify([...fake.values.values()]),
    /exchangeRates/,
    "the stable cache candidate must not contain provider state"
  );
});

test("landing runtime source keeps fallbacks and exchange state outside the live cache", () => {
  const landingSource = readFileSync("lib/landing/menuExperiences.ts", "utf8");
  const resolverSource = readFileSync("lib/menu/publicMenuRenderContext.ts", "utf8");
  const facadeSource = readFileSync("lib/landing/publicLandingMenuData.ts", "utf8");

  assert.match(landingSource, /landingCacheEpoch/);
  assert.match(landingSource, /landingExperienceCacheKeyParts/);
  assert.match(landingSource, /landingPayloadCacheKeyParts/);
  assert.match(landingSource, /assertPublicCacheSafe/);
  assert.match(landingSource, /LandingLiveDataUnavailableError/);
  assert.doesNotMatch(landingSource, /\{\s*revalidate:\s*60\s*\}/);
  assert.match(resolverSource, /resolvePublicMenuStableRenderContext/);
  assert.match(resolverSource, /resolvePublicMenuExchangeRates/);
  assert.match(resolverSource, /configRecord\.status === "published"/);
  assert.match(resolverSource, /resolved\.source === "supabase"/);
  assert.match(resolverSource, /resolved\.restaurantId === renderContext\.menu\.restaurantId/);
  assert.match(resolverSource, /resolved\.menuId === renderContext\.menu\.menuId/);
  assert.match(resolverSource, /translationReady/);
  assert.match(facadeSource, /resolvePublicMenuStableRenderContext/);
  assert.match(facadeSource, /resolvePublicMenuExchangeRates/);
  assert.deepEqual(
    [
      ...new Set(
        [...facadeSource.matchAll(/from\s+["']([^"']+)["']/g)].map(
          (match) => match[1]
        )
      )
    ],
    ["@/lib/menu/publicMenuRenderContext"]
  );
});

test("landing stable query projection omits every absent request field", () => {
  assert.deepEqual(
    landingModule.projectLandingMenuQuery({
      lang: "fr-CA",
      currency: undefined,
      table: undefined,
      view: "sauge-2",
      zone: undefined
    }),
    { lang: "fr-CA", view: "sauge-2" }
  );
});

test("the six landing consumers retain a literal sixty-second ISR retry interval", () => {
  const pages = [
    "app/(fr)/page.tsx",
    "app/(en)/en/page.tsx",
    "app/(fr)/(seo)/menu-digital-restaurant/page.tsx",
    "app/(fr)/(seo)/menu-pdf-vs-menu-digital/page.tsx",
    "app/(en)/en/digital-restaurant-menu/page.tsx",
    "app/(en)/en/pdf-vs-digital-menu/page.tsx"
  ];
  for (const page of pages) {
    const source = readFileSync(page, "utf8");
    assert.match(source, /export const revalidate\s*=\s*60\s*;/, page);
    assert.equal((source.match(/export const revalidate/g) ?? []).length, 1, page);
  }
});

test("landing preview success and every error response are private and no-store", async () => {
  const [{ GET }, { NextRequest }] = await Promise.all([
    import("../app/api/public/landing-menu-preview/[experienceId]/route.ts"),
    import("next/server")
  ]);
  const scenarios = [
    { id: "unknown", locale: "fr", mode: "success", status: 400 },
    { id: "maison-elyse", locale: "invalid", mode: "success", status: 400 },
    { id: "maison-elyse", locale: "fr", mode: "missing", status: 404 },
    { id: "maison-elyse", locale: "fr", mode: "typed-error", status: 424 },
    { id: "maison-elyse", locale: "fr", mode: "unexpected-error", status: 503 },
    { id: "maison-elyse", locale: "fr", mode: "success", status: 200 }
  ];

  const originalConsoleError = console.error;
  const errorLogs = [];
  console.error = (...args) => errorLogs.push(args);
  try {
    for (const scenario of scenarios) {
      globalThis.__vistaireLandingPreviewRouteState = { mode: scenario.mode };
      const request = new NextRequest(
        `https://vistaire.test/api/public/landing-menu-preview/${scenario.id}?locale=${scenario.locale}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ experienceId: scenario.id })
      });
      assert.equal(response.status, scenario.status, JSON.stringify(scenario));
      assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
      assert.equal(response.headers.get("cdn-cache-control"), "private, no-store");
      assert.equal(response.headers.get("vercel-cdn-cache-control"), "private, no-store");
    }
    assert.deepEqual(errorLogs, [
      [
        "Landing menu preview resolution failed.",
        {
          errorType: "Error",
          experienceId: "maison-elyse",
          locale: "fr"
        }
      ]
    ]);
    assert.doesNotMatch(JSON.stringify(errorLogs), /synthetic-private-sentinel/);
  } finally {
    console.error = originalConsoleError;
    delete globalThis.__vistaireLandingPreviewRouteState;
  }
});

test("the installed Next cache explicitly returns stale data when refresh fails", () => {
  const source = readFileSync(
    requireDependency.resolve("next/dist/server/web/spec-extension/unstable-cache.js"),
    "utf8"
  );
  assert.match(
    source,
    /\.catch\(\(err\)=>\{[\s\S]{0,500}Return the stale value on error[\s\S]{0,200}return cachedResponse/
  );
});
