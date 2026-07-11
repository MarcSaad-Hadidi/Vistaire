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
  const loader = await readFile("lib/admin/dashboardData.ts", "utf8");

  assert.match(page, /loadAdminDashboardData\(access\.restaurantId, range\)/);
  assert.match(page, /parseAdminPageSearchParams\(await searchParams\)/);
  assert.doesNotMatch(page, /searchParams\?\.|searchParams\[|restaurantId\s*=/);
  assert.match(loader, /readEvents\(\{ restaurantId, menuId: selectedMenu\.id/);
  assert.match(
    loader,
    /table:\s*["']restaurants["'][\s\S]*?filters:\s*\{\s*id:\s*restaurantId/
  );
  assert.match(
    loader,
    /table:\s*["']menu_dishes["'][\s\S]*?filters,\s*orderBy/
  );
});

test("admin dashboard fails closed before menu reads when the restaurant lookup fails", async () => {
  const page = await readFile("app/admin/page.tsx", "utf8");
  const loader = await readFile("lib/admin/dashboardData.ts", "utf8");
  const restaurantRead = loader.indexOf("const restaurantResult");
  const failedGuard = loader.indexOf("if (!restaurantResult.ok)");
  const missingGuard = loader.indexOf("if (!restaurantRow)");
  const dishRead = loader.indexOf('"menu_dishes"');

  assert.ok(restaurantRead >= 0);
  assert.ok(failedGuard > restaurantRead && failedGuard < dishRead);
  assert.ok(missingGuard > failedGuard && missingGuard < dishRead);
  assert.doesNotMatch(loader, /Votre restaurant/);
  assert.match(loader, /reason:\s*["']restaurant-(?:lookup-failed|not-found)["']/);
  assert.match(page, /if\s*\(!result\.ok\)/);
  assert.ok(
    page.indexOf("if (!result.ok)") <
      page.indexOf("<AdminRestaurantDashboard")
  );
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
      now: () => new Date("2026-07-10T12:00:00.000Z")
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.analytics.kind, "insufficient");
  assert.equal(result.data.analytics.reason, "instrumentation-unproven");
});

test("dashboard loader contains no fictional analytics fallback", async () => {
  const loader = await readFile("lib/admin/dashboardData.ts", "utf8");
  assert.doesNotMatch(loader, /buildMaisonElyseeDemoEvents|MAISON_ELYSEE_DEMO_ID/);
});
