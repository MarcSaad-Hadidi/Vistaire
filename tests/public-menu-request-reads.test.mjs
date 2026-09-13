import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function measureRealServerRequests() {
  process.env.NODE_ENV = "production";
  process.env.NODE_TEST_CONTEXT = "child-v8";
  await import("./helpers/public-dish-asset-route-runtime.mjs");
  const React = await import("react");
  const { renderToReadableStream } = await import(
    "next/dist/compiled/react-server-dom-webpack/server.node.js"
  );
  const { buildRelationalSupabasePublicMenu } = await import("../lib/menu/publicMenuCore.ts");
  const {
    publicMenuDishTranslationFields,
    publicMenuTranslationMenuFields,
    publicMenuCategoryTranslationSources
  } = await import("../lib/menu/publicMenuTranslationReadiness.ts");
  const { fieldHashesFor, sourceHashFor } = await import("../lib/translation/menuTranslationModel.ts");
  const { createClient } = await import("@supabase/supabase-js");
  const { createDedupeFetch } = await import("next/dist/server/lib/dedupe-fetch.js");
  const { getPublicMenuBySlug } = await import("../lib/menu/publicMenu.ts");
  const { resolvePublicMenuStableRenderContext } = await import("../lib/menu/publicMenuRenderContext.ts");
  globalThis.fetch = async () => { throw new Error("Unexpected real network request"); };

  const tables = {};
  const add = (table, rows) => { (tables[table] ??= []).push(...rows); };
  function translation(fields, identity) {
    return {
      ...identity,
      locale: "en-CA",
      translation_status: "up_to_date",
      source_hash: sourceHashFor(fields),
      field_hashes: fieldHashesFor(fields),
      content: Object.fromEntries(Object.entries(fields).map(([key, value]) => [
        key, Array.isArray(value) ? value.map((item) => `EN ${item}`) : `EN ${value}`
      ])),
      manual_overrides: {}
    };
  }
  function restaurantFixture(prefix, slug, dishName) {
    const restaurantId = `${prefix}1111111-2222-4333-8444-555555555555`;
    const menuId = `${prefix}2222222-3333-4444-8555-666666666666`;
    const categoryId = `${prefix}3333333-4444-4555-8666-777777777777`;
    const restaurantRow = { id: restaurantId, slug, name: `${slug} fixture`, location: "Montreal", cuisine_type: "Bistro", status: "active" };
    const menuRow = {
      id: menuId, restaurant_id: restaurantId, slug: "principal", name: "Menu principal", status: "published", is_primary: true,
      settings_json: { defaultLocale: "fr-CA", supportedLocales: ["fr-CA", "en-CA"], publicMenuStyle: "maison-elyse" }
    };
    const categoryRows = [{ id: categoryId, restaurant_id: restaurantId, menu_id: menuId, name: "Entrees", slug: "entrees", description: "Cuisine de saison", display_order: 0 }];
    const dishRows = [{
      id: `${prefix}5555555-6666-4777-8888-999999999999`, restaurant_id: restaurantId, menu_id: menuId, category_id: categoryId,
      slug: dishName.toLowerCase(), name: dishName, description: `${dishName} roties`, short_description: `${dishName} roties`,
      price_cents: 1500, currency: "CAD", is_available: true, display_order: 0,
      metadata: { ingredients: [dishName.toLowerCase()], photoStatus: "missing", operatorNote: "x".repeat(4096) }
    }];
    const menu = buildRelationalSupabasePublicMenu({ slug, restaurantRow, menuRow, categoryRows, dishRows, includeUnavailableDishes: false });
    add("restaurants", [restaurantRow]);
    add("menus", [menuRow]);
    add("menu_categories", categoryRows);
    add("menu_dishes", dishRows);
    add("menu_ui_configs", [
      { id: `${prefix}6666666-6666-4777-8888-999999999999`, restaurant_id: restaurantId, status: "published", theme: "fresh-homemade", config_json: { welcomeTitle: `${slug} published`, publicMenuSettings: { defaultLocale: "fr-CA" }, localizedUiCopy: { "en-CA": { searchPlaceholder: "Find a dish" } } }, updated_at: "2026-09-01T00:00:00Z" },
      { id: `${prefix}7777777-6666-4777-8888-999999999999`, restaurant_id: restaurantId, status: "draft", theme: "fresh-homemade", config_json: { welcomeTitle: "private draft", menuLanguages: ["fr", "en"], privateDraftNote: "d".repeat(8192) }, updated_at: "2026-09-02T00:00:00Z" }
    ]);
    add("menu_translations", [translation(publicMenuTranslationMenuFields(menu), { menu_id: menuId })]);
    add("menu_category_translations", publicMenuCategoryTranslationSources(menu).map(({ id, fields }) => translation(fields, { category_id: id, menu_id: menuId })));
    add("menu_dish_translations", menu.dishes.map((dish) => translation(publicMenuDishTranslationFields(dish), { dish_id: dish.id, menu_id: menuId })));
    return { restaurantId, dish: dishRows[0] };
  }
  const firstTenant = restaurantFixture("1", "maison-elyse", "Betteraves");
  const secondTenant = restaurantFixture("2", "second-bistro", "Carottes");
  let calls = [];
  let failUiConfig = false;
  const client = createClient("http://127.0.0.1:54321", "hermetic-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createDedupeFetch(async (input, options) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "http://127.0.0.1:54321");
      assert.equal(options?.method ?? "GET", "GET");
      const table = url.pathname.split("/").at(-1);
      assert.ok(Object.hasOwn(tables, table), `unexpected table ${table}`);
      let rows = tables[table].filter((row) => [...url.searchParams].every(([key, value]) => {
        if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
        if (value.startsWith("in.(")) return value.slice(4, -1).split(",").includes(String(row[key]));
        return true;
      }));
      const columns = url.searchParams.get("select") ?? "*";
      rows = rows.slice(0, Number(url.searchParams.get("limit") ?? Infinity)).map((row) =>
        columns === "*" ? row : Object.fromEntries(columns.split(",").filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]))
      );
      const failed = failUiConfig && table === "menu_ui_configs";
      const body = JSON.stringify(failed ? { code: "42501", message: "fixture denied" } : rows);
      calls.push({ table, query: url.searchParams.toString(), bytes: Buffer.byteLength(body) });
      return new Response(body, { status: failed ? 403 : 200, headers: { "content-type": "application/json" } });
    }) }
  });
  globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN__ = { ok: true, client };
  const results = [];
  async function request(slugs, validate = true) {
    calls = [];
    let contexts;
    const errors = [];
    async function Page() {
      contexts = await Promise.all(slugs.map((slug) => resolvePublicMenuStableRenderContext({ slug, query: { lang: "fr-CA" } })));
      return null;
    }
    const stream = await renderToReadableStream(React.createElement(Page), {}, { onError(error) { errors.push(error); } });
    await new Response(stream).text();
    assert.deepEqual(errors, []);
    for (const context of validate ? contexts : []) {
      assert.equal(context.experience.kind, "maison-elyse");
      assert.deepEqual(Object.keys(context.localizedMenus), ["fr-CA", "en-CA"]);
      const source = context.localizedMenus["fr-CA"].dishes[0];
      const translated = context.localizedMenus["en-CA"].dishes[0];
      assert.equal(translated.description, `EN ${source.description}`);
      assert.equal(translated.priceCents, source.priceCents);
    }
    results.push({
      calls: calls.length,
      bytes: calls.reduce((total, call) => total + call.bytes, 0),
      uiQueries: calls.filter((call) => call.table === "menu_ui_configs").map((call) => call.query),
      tables: Object.fromEntries([...new Set(calls.map((call) => call.table))].map((table) => [table, calls.filter((call) => call.table === table).length]))
    });
    return contexts;
  }
  const published = await request(["maison-elyse"]);
  assert.equal(published[0].config.welcomeTitle, "maison-elyse published");
  assert.equal(published[0].menu.localizedUiCopy["en-CA"].searchPlaceholder, "Find a dish");
  firstTenant.dish.price_cents = 2000;
  const fresh = await request(["maison-elyse"]);
  assert.equal(fresh[0].menu.dishes[0].priceCents, 2000, "a new server request must observe committed data");
  const isolated = await request(["maison-elyse", "second-bistro"]);
  assert.equal(isolated[0].menu.restaurantId, firstTenant.restaurantId);
  assert.equal(isolated[1].menu.restaurantId, secondTenant.restaurantId);
  assert.equal(isolated[0].localizedMenus["en-CA"].dishes[0].description, "EN Betteraves roties");
  assert.equal(isolated[1].localizedMenus["en-CA"].dishes[0].description, "EN Carottes roties");
  tables.menu_ui_configs = tables.menu_ui_configs.filter((row) => row.restaurant_id !== secondTenant.restaurantId || row.status !== "published");
  tables.menus.find((row) => row.restaurant_id === secondTenant.restaurantId).settings_json = {};
  await request(["second-bistro"], false);
  // The legacy draft language list remains supported only when no public row exists.
  let legacyMenu;
  async function LegacyPage() { legacyMenu = await getPublicMenuBySlug("second-bistro", "fr-CA"); return null; }
  await new Response(await renderToReadableStream(React.createElement(LegacyPage), {})).text();
  assert.deepEqual(legacyMenu.settings.supportedLocales, ["fr-CA", "en-CA"]);
  failUiConfig = true;
  const unavailable = await request(["maison-elyse"]);
  assert.equal(unavailable[0].config.welcomeTitle.includes("private draft"), false);
  assert.equal(unavailable[0].menu.localizedUiCopy, undefined);
  return results;
}

if (process.env.VISTAIRE_TEST_PUBLIC_REQUEST_READS === "1") {
  console.log(JSON.stringify(await measureRealServerRequests()));
} else {
  test("Next transport shares the published UI config while preserving tenant, fresh, legacy and failure behavior", () => {
    const child = spawnSync(process.execPath, ["--conditions=react-server", fileURLToPath(import.meta.url)], {
      cwd: process.cwd(), encoding: "utf8", timeout: 30_000,
      env: { ...process.env, VISTAIRE_TEST_PUBLIC_REQUEST_READS: "1" }
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const measured = JSON.parse(child.stdout.trim());
    console.log(`Public menu fixture transport (GETs/JSON bytes): ${JSON.stringify(measured.map(({ calls, bytes }) => ({ calls, bytes })))}`);
    assert.deepEqual(measured.slice(0, 3).map((result) => result.calls), [8, 8, 16]);
    assert.equal(measured[0].tables.menu_ui_configs, 1);
    const publicQuery = new URLSearchParams(measured[0].uiQueries[0]);
    assert.equal(publicQuery.get("status"), "eq.published");
    assert.equal(publicQuery.get("limit"), "1");
    assert.equal(publicQuery.get("select"), "id,restaurant_id,theme,config_json,status,created_at,updated_at");
    assert.equal(measured[3].tables.menu_ui_configs, 2, "no published row preserves the legacy fallback read");
    assert.equal(measured[4].tables.menu_ui_configs, 1, "failed public config reads stay unavailable");
    for (const table of ["restaurants", "menus", "menu_categories", "menu_dishes", "menu_translations", "menu_category_translations", "menu_dish_translations"]) {
      assert.equal(measured[0].tables[table], 1, `${table} should be read once for both ready locales`);
    }
  });
}
