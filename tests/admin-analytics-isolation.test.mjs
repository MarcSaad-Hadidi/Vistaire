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
      return { url: "data:text/javascript,export%20default%20undefined", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
      for (const extension of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const url = new URL(`${baseUrl.href}${extension}`);
        if (existsSync(url)) {
          return { url: url.href, shortCircuit: true };
        }
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

test("restaurant-scoped Supabase reads filter before applying limits", async () => {
  const source = await readFile("lib/analytics/serverRows.ts", "utf8");
  const scopedReader =
    source.match(
      /export async function readSupabaseRowsByColumn[\s\S]*?\n}/
    )?.[0] ?? "";

  assert.match(scopedReader, /\.eq\(column, value\)/);
  assert.match(scopedReader, /\.limit\(limit\)/);
  assert.ok(
    scopedReader.indexOf(".eq(column, value)") <
      scopedReader.indexOf(".limit(limit)")
  );
});

test("restaurant insights scope every table in the database and use real menu identity", async () => {
  const source = await readFile("lib/analytics/insights.ts", "utf8");

  for (const [table, column] of [
    ["restaurants", "id"],
    ["menu_categories", "restaurant_id"],
    ["menu_dishes", "restaurant_id"],
  ]) {
    assert.match(
      source,
      new RegExp(
        `readSupabaseRowsByColumn\\(\\s*["']${table}["'],\\s*["']${column}["'],\\s*(?:restaurantId|scopedRestaurantId)`
      ),
      `${table} must be scoped with ${column} before its limit`
    );
  }

  assert.match(source, /readRestaurantDailyAnalyticsForPeriod\(\{\s*restaurantId:/);
  assert.match(source, /readAnalyticsEventsForPeriod\(\{\s*restaurantId:/);

  assert.doesNotMatch(source, /filterRowsByRestaurantId/);
  assert.match(source, /generatedFor:\s*restaurantName/);
  assert.match(source, /menuDishRows/);
  assert.match(source, /menuCategoryRows/);
  assert.doesNotMatch(source, /generatedFor:\s*["']Maison Élyse["']/);
});

test("production analytics never substitute Maison Elyse preview data", async () => {
  const source = await readFile("lib/analytics/insights.ts", "utf8");
  const fallbackSection = source.slice(source.indexOf("export async function getRestaurantInsights"));

  assert.match(
    fallbackSection,
    /process\.env\.NODE_ENV\s*!==\s*["']production["'][\s\S]*(?:restaurantId|scopedRestaurantId)\s*===\s*DEMO_RESTAURANT_ID[\s\S]*getDemoAdminInsights\(\)/
  );
  assert.match(fallbackSection, /source:\s*["']empty["']/);
  assert.doesNotMatch(
    fallbackSection,
    /return\s*\{\s*insights:\s*getDemoAdminInsights\(\),\s*source:\s*["'](?:fallback|empty)["']/
  );
});

test("admin dashboard loader receives one trusted restaurant id for every data read", async () => {
  const page = await readFile("app/admin/page.tsx", "utf8");
  const loader = await readFile("lib/admin/data/loadAdminData.ts", "utf8");

  assert.match(page, /loadAdminDataBundle\(access, range\)/);
  assert.match(page, /const params = await searchParams/);
  assert.match(page, /parseAdminPageSearchParams\(params[\s\S]*\)/);
  assert.doesNotMatch(page, /searchParams\?\.|searchParams\[|restaurantId\s*=/);
  assert.match(loader, /readRestaurant\(\{ restaurantId: input\.access\.restaurantId \}\)/);
  assert.match(loader, /readMenu\(\{ restaurantId: input\.access\.restaurantId \}\)/);
  assert.match(loader, /restaurantId: input\.access\.restaurantId/);
  assert.match(loader, /readCatalog\(scope\)/);
  assert.match(loader, /readEvents\(\{ scope,/);
  assert.doesNotMatch(loader, /searchParams|query\.restaurant|params\.restaurant/);
});

test("admin dashboard fails closed before menu reads when the restaurant lookup fails", async () => {
  const page = await readFile("app/admin/page.tsx", "utf8");
  const loader = await readFile("lib/admin/data/loadAdminData.ts", "utf8");
  const restaurantRead = loader.indexOf("const restaurantRead");
  const failedGuard = loader.indexOf("if (!restaurantRead.ok");
  const menuRead = loader.indexOf("const menuRead");
  const catalogRead = loader.indexOf("dependencies.readCatalog(scope)");

  assert.ok(restaurantRead >= 0);
  assert.ok(failedGuard > restaurantRead && failedGuard < menuRead);
  assert.ok(menuRead > failedGuard && menuRead < catalogRead);
  assert.doesNotMatch(loader, /Votre restaurant/);
  assert.match(loader, /return \{ ok: false as const, error: \{ code: "configuration" as const, retryable: false \} \}/);
  assert.match(page, /if\s*\(!result\.ok\)/);
  assert.ok(
    page.indexOf("if (!result.ok)") <
      page.indexOf("<AdminTodayPage")
  );
});

test("public menus scope every Supabase read and keep local demos out of production", async () => {
  const { getPublicMenuBySlug } = await import("../lib/menu/publicMenu.ts");
  const calls = [];
  const scoped = await getPublicMenuBySlug("chez-vistaire", "fr", {
    nodeEnv: "production",
    readRows: async (args) => {
      calls.push(args);
      if (args.table === "restaurants") return { ok: true, rows: [{ id: "restaurant-1", slug: "chez-vistaire", name: "Chez Vistaire" }] };
      return { ok: true, rows: [] };
    }
  });
  assert.ok(scoped);
  assert.deepEqual(calls[0].filters, { slug: "chez-vistaire" });
  assert.equal(calls[0].limit, 1);
  assert.deepEqual(calls.slice(1).map(({ table, filters }) => ({ table, filters })), [
    { table: "menus", filters: { restaurant_id: "restaurant-1" } },
    { table: "menu_categories", filters: { restaurant_id: "restaurant-1" } },
    { table: "menu_dishes", filters: { restaurant_id: "restaurant-1" } },
    { table: "menu_ui_configs", filters: { restaurant_id: "restaurant-1" } },
    { table: "menu_dishes", filters: { restaurant_slug: "chez-vistaire" } }
  ]);

  const unavailable = async () => ({ ok: false, error: "database unavailable", rows: [] });
  assert.equal(await getPublicMenuBySlug("maison-elyse", "fr", { nodeEnv: "production", readRows: unavailable }), null);
  assert.ok(await getPublicMenuBySlug("maison-elyse", "fr", { nodeEnv: "development", readRows: unavailable }));

  const failedCore = await getPublicMenuBySlug("chez-vistaire", "fr", {
    nodeEnv: "production",
    readRows: async (args) => args.table === "restaurants"
      ? { ok: true, rows: [{ id: "restaurant-1", slug: "chez-vistaire", name: "Chez Vistaire" }] }
      : args.table === "menu_dishes"
        ? { ok: false, error: "dish read failed", rows: [] }
        : { ok: true, rows: [] }
  });
  assert.equal(failedCore, null);
});

test("public menus preserve legacy dishes scoped only by restaurant slug", async () => {
  const { getPublicMenuBySlug } = await import("../lib/menu/publicMenu.ts");
  const dishFilters = [];
  const menu = await getPublicMenuBySlug("chez-vistaire", "fr", {
    nodeEnv: "production",
    readRows: async (args) => {
      if (args.table === "restaurants") {
        return {
          ok: true,
          rows: [{ id: "restaurant-1", slug: "chez-vistaire", name: "Chez Vistaire" }]
        };
      }
      if (args.table === "menu_dishes") {
        dishFilters.push(args.filters);
        return args.filters.restaurant_id
          ? { ok: true, rows: [] }
          : {
              ok: true,
              rows: [{
                id: "legacy-dish-1",
                restaurant_slug: "chez-vistaire",
                name: "Plat historique",
                slug: "plat-historique",
                price_cents: 2400,
                is_available: true
              }]
            };
      }
      return { ok: true, rows: [] };
    }
  });

  assert.ok(menu);
  assert.deepEqual(menu.dishes.map(({ id }) => id), ["legacy-dish-1"]);
  assert.deepEqual(dishFilters, [
    { restaurant_id: "restaurant-1" },
    { restaurant_slug: "chez-vistaire" }
  ]);
});

test("admin dashboard fails closed when the scoped menu lookup fails", async () => {
  const { loadAdminDashboardDataWithDependencies } = await import(
    "../lib/admin/dashboardData.ts"
  );
  const calls = [];
  const result = await loadAdminDashboardDataWithDependencies("restaurant-1", "7d", {
    readRows: async ({ table }) => {
      calls.push(table);
      if (table === "restaurants") {
        return { ok: true, rows: [{ id: "restaurant-1", name: "Chez Vistaire" }] };
      }
      if (table === "menus") {
        return { ok: false, rows: [] };
      }
      throw new Error(`unexpected downstream read: ${table}`);
    },
    readEvents: async () => {
      calls.push("analytics");
      throw new Error("analytics must not be read after a failed menu lookup");
    },
    now: () => new Date("2026-07-10T00:00:00.000Z")
  });

  assert.deepEqual(result, { ok: false, reason: "menu-lookup-failed" });
  assert.deepEqual(calls, ["restaurants", "menus"]);
});

test("Maison Elysee preview does not substitute fictional analytics", async () => {
  const { loadAdminDashboardDataWithDependencies } = await import(
    "../lib/admin/dashboardData.ts"
  );
  let nowCalls = 0;
  const result = await loadAdminDashboardDataWithDependencies(
    "11111111-1111-1111-1111-111111111111",
    "7d",
    {
      readRows: async ({ table }) => {
        if (table === "restaurants") return { ok: true, rows: [{ id: "11111111-1111-1111-1111-111111111111", name: "Maison Élysée", slug: "maison-elysee" }] };
        if (table === "menus") return { ok: true, rows: [{ id: "menu-demo", status: "published", is_primary: true }] };
        if (table === "menu_categories") return { ok: true, rows: [{ id: "cat-1", menu_id: "menu-demo", name: "Signatures", slug: "signatures" }] };
        if (table === "menu_dishes") return { ok: true, rows: [{ id: "dish-1", menu_id: "menu-demo", category_id: "cat-1", name: "Homard bleu", slug: "homard-bleu", price_cents: 10400, is_available: true }] };
        throw new Error(`unexpected table: ${table}`);
      },
      readEvents: async () => ({ ok: true, rows: [], truncated: false }),
      now: () => { nowCalls += 1; return new Date("2026-07-10T12:00:00.000Z"); }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.analytics.kind, "insufficient");
  assert.equal(result.data.analytics.reason, "instrumentation-unproven");
  assert.equal(nowCalls, 1);
});

test("dashboard reads current and previous periods independently and fails closed if either read truncates", async () => {
  const { loadAdminDashboardDataWithDependencies } = await import("../lib/admin/dashboardData.ts");
  const periods = [];
  const result = await loadAdminDashboardDataWithDependencies("restaurant-1", "7d", {
    readRows: async ({ table }) => {
      if (table === "restaurants") return { ok: true, rows: [{ id: "restaurant-1", name: "Chez Vistaire", slug: "chez-vistaire" }] };
      if (table === "menus") return { ok: true, rows: [{ id: "menu-1", status: "published", is_primary: true }] };
      if (table === "menu_categories") return { ok: true, rows: [] };
      if (table === "menu_dishes") return { ok: true, rows: [] };
      throw new Error(`unexpected table: ${table}`);
    },
    readEvents: async (args) => {
      periods.push(args);
      return { ok: true, rows: [], truncated: args.fromIso === "2026-06-26T00:00:00.000Z" };
    },
    now: () => new Date("2026-07-10T00:00:00.000Z")
  });
  assert.equal(periods.length, 2);
  assert.deepEqual(periods.map(({ restaurantId, menuId }) => ({ restaurantId, menuId })), [
    { restaurantId: "restaurant-1", menuId: "menu-1" },
    { restaurantId: "restaurant-1", menuId: "menu-1" }
  ]);
  assert.deepEqual(periods.map(({ maxRows }) => maxRows), [12_000, 12_000]);
  assert.deepEqual(periods.map(({ fromIso, toIso }) => [fromIso, toIso]), [
    ["2026-07-03T00:00:00.000Z", "2026-07-10T00:00:00.000Z"],
    ["2026-06-26T00:00:00.000Z", "2026-07-03T00:00:00.000Z"]
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.data.analytics.kind, "unavailable");
  assert.equal(result.data.analytics.completeness, "truncated");
});

test("dashboard loader contains no fictional analytics fallback", async () => {
  const loader = await readFile("lib/admin/dashboardData.ts", "utf8");
  assert.doesNotMatch(loader, /buildMaisonElyseeDemoEvents|MAISON_ELYSEE_DEMO_ID/);
});
