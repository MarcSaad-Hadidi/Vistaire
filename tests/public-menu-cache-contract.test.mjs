import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const adminClientFactorySymbol = Symbol.for(
  "vistaire.test.public-menu-cache-contract.admin-client-factory"
);
const unavailableAdminClient = () => ({ ok: false, reason: "test unavailable" });
globalThis[adminClientFactorySymbol] = unavailableAdminClient;
const adminClientModuleUrl = `data:text/javascript,${encodeURIComponent(`
  export function getSupabaseAdminClient() {
    return globalThis[Symbol.for("vistaire.test.public-menu-cache-contract.admin-client-factory")]();
  }
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export%20default%20undefined",
        shortCircuit: true
      };
    }
    if (specifier === "@/utils/supabase/admin") {
      return { url: adminClientModuleUrl, shortCircuit: true };
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

const { getPublicMenuBySlug } = await import("../lib/menu/publicMenu.ts");
const { futurePublicMenuCacheKeyParts } = await import(
  "../lib/cache/publicCachePolicy.ts"
);

test.after(() => {
  delete globalThis[adminClientFactorySymbol];
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function controlledRead(result) {
  let release;
  let calls = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  return {
    readRows: async () => {
      calls += 1;
      await gate;
      if (result instanceof Error) throw result;
      return result;
    },
    release,
    calls: () => calls
  };
}

test("canonical slug and locale callers share only the active read", async () => {
  const source = controlledRead({ ok: true, rows: [] });
  const dependencies = { readRows: source.readRows, nodeEnv: "production" };

  const first = getPublicMenuBySlug("  Café Délice  ", "fr", dependencies);
  const second = getPublicMenuBySlug("cafe-delice", "fr-CA", dependencies);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(source.calls(), 1);

  source.release();
  assert.deepEqual(await Promise.all([first, second]), [null, null]);

  assert.equal(
    await getPublicMenuBySlug("cafe-delice", "fr-CA", dependencies),
    null
  );
  assert.equal(source.calls(), 2, "a settled value must not remain cached");
});

test("live translation stays inside the active flight and settles before deletion", async () => {
  const translationStarted = deferred();
  const releaseTranslations = deferred();
  let restaurantReads = 0;

  globalThis[adminClientFactorySymbol] = () => ({
    ok: true,
    client: {
      from() {
        const query = {
          select() {
            return query;
          },
          eq() {
            return query;
          },
          in() {
            return query;
          },
          then(onFulfilled, onRejected) {
            translationStarted.resolve();
            return releaseTranslations.promise
              .then(() => ({ data: [], error: null }))
              .then(onFulfilled, onRejected);
          }
        };
        return query;
      }
    }
  });

  const readRows = async ({ table }) => {
    if (table === "restaurants") {
      restaurantReads += 1;
      return {
        ok: true,
        rows: [
          {
            id: "restaurant-live",
            slug: "live-bistro",
            name: "Live Bistro",
            location: "Montréal",
            cuisine_type: "Bistro",
            status: "active"
          }
        ]
      };
    }
    if (table === "menus") {
      return {
        ok: true,
        rows: [
          {
            id: "menu-live",
            restaurant_id: "restaurant-live",
            name: "Menu principal",
            slug: "principal",
            status: "published",
            is_primary: true,
            settings_json: {
              defaultLocale: "fr-CA",
              supportedLocales: ["fr-CA", "en-CA"],
              publicMenuStyle: "trouvable"
            }
          }
        ]
      };
    }
    return { ok: true, rows: [] };
  };
  const dependencies = { readRows, nodeEnv: "production" };

  try {
    const first = getPublicMenuBySlug("live-bistro", "en", dependencies);
    await translationStarted.promise;
    await new Promise((resolve) => setImmediate(resolve));

    const concurrent = getPublicMenuBySlug(
      "  Live Bistro  ",
      "en-CA",
      dependencies
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      restaurantReads,
      1,
      "translation must finish before the active live flight is deleted"
    );

    releaseTranslations.resolve();
    const [firstMenu, concurrentMenu] = await Promise.all([first, concurrent]);
    assert.equal(firstMenu?.source, "supabase");
    assert.equal(concurrentMenu?.source, "supabase");

    const nextMenu = await getPublicMenuBySlug(
      "live-bistro",
      "en-CA",
      dependencies
    );
    assert.equal(nextMenu?.source, "supabase");
    assert.equal(
      restaurantReads,
      2,
      "the completed live outcome must be deleted before the next read"
    );
  } finally {
    releaseTranslations.resolve();
    globalThis[adminClientFactorySymbol] = unavailableAdminClient;
  }
});

test("a rejected read is removed before a later retry", async () => {
  const source = controlledRead(new Error("temporary source failure"));
  const dependencies = { readRows: source.readRows, nodeEnv: "production" };
  const first = getPublicMenuBySlug("retry-menu", "en", dependencies);
  const second = getPublicMenuBySlug("retry-menu", "en-CA", dependencies);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(source.calls(), 1);
  source.release();

  const settled = await Promise.allSettled([first, second]);
  assert.deepEqual(settled.map(({ status }) => status), ["rejected", "rejected"]);
  await assert.rejects(
    getPublicMenuBySlug("retry-menu", "en-CA", dependencies),
    /temporary source failure/
  );
  assert.equal(source.calls(), 2);
});

test("restaurant and locale addresses cannot collide", async () => {
  let calls = 0;
  const readRows = async () => {
    calls += 1;
    return { ok: true, rows: [] };
  };
  const dependencies = { readRows, nodeEnv: "production" };

  await Promise.all([
    getPublicMenuBySlug("tenant-one", "fr-CA", dependencies),
    getPublicMenuBySlug("tenant-one", "en-CA", dependencies),
    getPublicMenuBySlug("tenant-two", "fr-CA", dependencies)
  ]);
  assert.equal(calls, 3);
});

test("not-found and unavailable demo fallbacks are never retained", async () => {
  let calls = 0;
  const readRows = async () => {
    calls += 1;
    return calls === 1
      ? { ok: false, rows: [], error: "temporary" }
      : { ok: true, rows: [] };
  };
  const dependencies = { readRows, nodeEnv: "development" };

  const unavailable = await getPublicMenuBySlug("maison-elyse", "fr", dependencies);
  const notFound = await getPublicMenuBySlug("maison-elyse", "fr-CA", dependencies);
  assert.equal(unavailable?.source, "demo");
  assert.equal(notFound?.source, "demo");
  assert.equal(calls, 2);
});

test("production menu code has typed outcomes but no durable completed-value cache", () => {
  const source = readFileSync("lib/menu/publicMenu.ts", "utf8");
  assert.match(source, /status:\s*"live"/);
  assert.match(source, /status:\s*"not_found"/);
  assert.match(source, /status:\s*"temporarily_unavailable"/);
  assert.match(source, /\.finally\(\(\) =>/);
  assert.match(source, /publicMenuReadFlights\.delete\(key\)/);
  assert.doesNotMatch(source, /unstable_cache|LOCAL_PUBLIC_MENU_CACHE_TTL_MS/);
  assert.match(source, /const getPublicMenuBySlugRequestCached = cache\(/);
});

test("tag-only keys permit stale resurrection while revision keys isolate fills", async () => {
  const shared = new Map();
  const instance = () => ({
    async fill(key, load) {
      if (shared.has(key)) return shared.get(key);
      const value = await load();
      shared.set(key, value);
      return value;
    },
    invalidate(key) {
      shared.delete(key);
    }
  });
  const a = instance();
  const b = instance();
  let releaseOld;
  const oldGate = new Promise((resolve) => {
    releaseOld = resolve;
  });
  const oldFill = a.fill("menu", async () => {
    await oldGate;
    return "old";
  });
  b.invalidate("menu");
  assert.equal(await b.fill("menu", async () => "new"), "new");
  releaseOld();
  await oldFill;
  assert.equal(shared.get("menu"), "old");

  const address = {
    restaurantId: "restaurant-a",
    menuId: "menu-a",
    menuSlug: "principal",
    locale: "fr",
    version: "v1"
  };
  const oldKey = futurePublicMenuCacheKeyParts({ ...address, revision: "41" }).join(":");
  const newKey = futurePublicMenuCacheKeyParts({ ...address, revision: "42" }).join(":");
  shared.set(newKey, "new-revision");
  shared.set(oldKey, "late-old-revision");
  assert.equal(shared.get(newKey), "new-revision");
  assert.notEqual(oldKey, newKey);
});
