import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
      for (const extension of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
      const baseUrl = new URL(specifier, context.parentURL);
      for (const extension of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
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

const policy = await import("../lib/cache/publicCachePolicy.ts");

test("cache policy canonicalizes only explicit public locales and bounded components", () => {
  assert.equal(policy.LANDING_DATA_CACHE_SECONDS, 900);
  assert.equal(policy.STATIC_LANDING_FALLBACK_RETRY_SECONDS, 60);
  assert.equal(policy.normalizePublicCacheLocale(" FR "), "fr");
  assert.equal(policy.normalizePublicCacheLocale("eN"), "en");
  assert.equal(policy.normalizePublicCacheExperience(" Maison Élyse "), "maison-elyse");
  assert.equal(policy.normalizePublicCacheSlug(" Dîner / Été "), "diner-ete");
  assert.equal(policy.normalizePublicCacheRestaurantKey(" Restaurant_A.2 "), "restaurant_a.2");
  assert.equal(policy.normalizePublicCacheMenu(" MENU-01 "), "menu-01");
  assert.equal(policy.normalizePublicCacheVersion(" V12 "), "v12");
  assert.equal(policy.normalizePublicCacheRevision(" REV_0042 "), "rev_0042");

  for (const invalidLocale of [undefined, null, "", "fr-CA", "de", 1]) {
    assert.throws(
      () => policy.normalizePublicCacheLocale(invalidLocale),
      /public cache locale/i
    );
  }
  for (const invalidIdentifier of ["", "restaurant:a", "restaurant/a", "bad\u0000id", 7]) {
    assert.throws(
      () => policy.normalizePublicCacheRestaurantKey(invalidIdentifier),
      /restaurant/i
    );
  }
  assert.equal(policy.normalizePublicCacheRestaurantKey("r".repeat(64)), "r".repeat(64));
  assert.throws(
    () => policy.normalizePublicCacheRestaurantKey("r".repeat(65)),
    /restaurant/i
  );
  assert.equal(policy.normalizePublicCacheSlug("s".repeat(80)), "s".repeat(80));
  assert.throws(() => policy.normalizePublicCacheSlug("s".repeat(81)), /slug/i);
});

test("landing key parts are deterministic, versioned and collision-safe across every scope", () => {
  const address = {
    restaurantKey: "restaurant-a",
    experienceId: "Maison Élyse",
    locale: " FR ",
    version: "V12",
    epoch: 0
  };
  assert.deepEqual(policy.landingExperienceCacheKeyParts(address), [
    "vistaire-public",
    "v1",
    "landing",
    "experience",
    "version=v12",
    "restaurant=restaurant-a",
    "experience=maison-elyse",
    "locale=fr",
    "epoch=0"
  ]);
  assert.deepEqual(policy.landingPayloadCacheKeyParts(address), [
    "vistaire-public",
    "v1",
    "landing",
    "payload",
    "version=v12",
    "restaurant=restaurant-a",
    "experience=maison-elyse",
    "locale=fr",
    "epoch=0"
  ]);
  assert.deepEqual(
    policy.landingPayloadCacheKeyParts({ ...address }),
    policy.landingPayloadCacheKeyParts(address)
  );

  const baseline = policy.landingPayloadCacheKeyParts(address).join("|");
  for (const changed of [
    { restaurantKey: "restaurant-b" },
    { experienceId: "trouvable" },
    { locale: "en" },
    { version: "v13" },
    { epoch: 1 }
  ]) {
    assert.notEqual(
      policy.landingPayloadCacheKeyParts({ ...address, ...changed }).join("|"),
      baseline
    );
  }
  assert.throws(
    () => policy.landingPayloadCacheKeyParts({ ...address, epoch: undefined }),
    /epoch/i
  );
  assert.throws(
    () => policy.landingPayloadCacheKeyParts({ ...address, version: "" }),
    /version/i
  );
});

test("landing cache epochs change exactly at the fifteen-minute boundary", () => {
  assert.equal(policy.landingCacheEpoch(0), 0);
  assert.equal(policy.landingCacheEpoch(899_999), 0);
  assert.equal(policy.landingCacheEpoch(900_000), 1);
  assert.equal(policy.landingCacheEpoch(1_799_999), 1);
  assert.equal(policy.landingCacheEpoch(1_800_000), 2);

  for (const invalidTime of [-1, Number.NaN, Number.POSITIVE_INFINITY, 0.5, "900000"]) {
    assert.throws(() => policy.landingCacheEpoch(invalidTime), /timestamp/i);
  }
  assert.throws(
    () => policy.landingCacheEpoch(Number.MAX_SAFE_INTEGER + 1),
    /timestamp/i
  );
});

test("landing tags are epoch-independent and scoped by restaurant, experience and locale", () => {
  const args = {
    restaurantKey: "restaurant-a",
    experienceId: "maison-elyse",
    locale: "fr"
  };
  assert.equal(
    policy.landingCacheTag(args),
    "vistaire-public:v1:landing:restaurant=restaurant-a:experience=maison-elyse:locale=fr"
  );
  const baseline = policy.landingCacheTag(args);
  assert.notEqual(policy.landingCacheTag({ ...args, restaurantKey: "restaurant-b" }), baseline);
  assert.notEqual(policy.landingCacheTag({ ...args, experienceId: "trouvable" }), baseline);
  assert.notEqual(policy.landingCacheTag({ ...args, locale: "en" }), baseline);
  assert.ok(baseline.length <= 256);

  assert.ok(
    policy.landingCacheTag({
      restaurantKey: "r".repeat(64),
      experienceId: "e".repeat(64),
      locale: "fr"
    }).length <= 256
  );
});

test("future menu helpers require a revision without enabling a durable cache", () => {
  const args = {
    restaurantId: "restaurant-a",
    menuId: "menu-a",
    menuSlug: "Dîner Été",
    locale: "en",
    version: "v2",
    revision: "rev-42"
  };
  assert.deepEqual(policy.futurePublicMenuCacheKeyParts(args), [
    "vistaire-public",
    "v1",
    "menu",
    "version=v2",
    "restaurant=restaurant-a",
    "menu=menu-a",
    "slug=diner-ete",
    "locale=en",
    "revision=rev-42"
  ]);
  assert.equal(
    policy.futurePublicMenuCacheTag(args),
    "vistaire-public:v1:menu:version=v2:restaurant=restaurant-a:menu=menu-a:slug=diner-ete:locale=en:revision=rev-42"
  );
  assert.throws(
    () => policy.futurePublicMenuCacheKeyParts({ ...args, revision: undefined }),
    /revision/i
  );
  assert.throws(
    () => policy.futurePublicMenuCacheTag({ ...args, revision: "" }),
    /revision/i
  );
  assert.throws(
    () =>
      policy.futurePublicMenuCacheTag({
        restaurantId: "r".repeat(64),
        menuId: "m".repeat(64),
        menuSlug: "s".repeat(80),
        locale: "en",
        version: "v".repeat(32),
        revision: "q".repeat(64)
      }),
    /tag length/i
  );
});
