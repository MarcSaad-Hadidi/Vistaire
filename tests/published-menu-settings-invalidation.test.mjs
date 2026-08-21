import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const adminSymbol = Symbol.for("vistaire.test.published-settings-admin");
const adminModuleUrl = `data:text/javascript,${encodeURIComponent(`
  export function getSupabaseAdminClient() {
    return globalThis[Symbol.for("vistaire.test.published-settings-admin")];
  }
`)}`;
const publicSettingsModuleUrl = `data:text/javascript,${encodeURIComponent(`
  export async function readPublicMenuSettingsWithFallbacks() {
    return { publicMenuStyle: "unique" };
  }
  export async function readPublicMenuSettingsBundleWithFallbacks() {
    return { source: "settings_json", settings: { publicMenuStyle: "unique" } };
  }
  export async function persistGeneratedLocalizedUiCopy() {
    throw new Error("unexpected generated UI persistence in focused writer test");
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
      return { url: adminModuleUrl, shortCircuit: true };
    }
    if (specifier === "@/lib/owner/publicMenuSettingsFallback") {
      return { url: publicSettingsModuleUrl, shortCircuit: true };
    }
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

const fallback = await import("../lib/owner/publicMenuSettingsFallback.ts");
const translations = await import("../lib/owner/menuTranslations.ts");
const uiStore = await import("../lib/owner/menuUiConfigStore.ts");
const uniqueStore = await import("../lib/owner/uniqueMenuDesignStore.ts");
const { DEFAULT_MENU_UI_CONFIG } = await import("../lib/menu/menuUiConfig.ts");

const RESTAURANT_ID = "22222222-2222-4222-8222-222222222222";
const MENU_ID = "33333333-3333-4333-8333-333333333333";
const DESIGN_ID = "44444444-4444-4444-8444-444444444444";
const settings = {
  defaultLocale: "fr-CA",
  supportedLocales: ["fr-CA", "en-CA"],
  baseCurrency: "CAD",
  defaultCurrency: "CAD",
  supportedCurrencies: ["CAD"],
  publicMenuStyle: "trouvable",
  timezone: "America/Toronto",
  defaultThemeMode: "dark",
  allowThemeToggle: true,
  allowCurrencySelector: false,
  allowLanguageSelector: true,
  taxIncluded: true,
  priceDisplayMode: "auto"
};

function translationWriterClient(events) {
  return {
    from(table) {
      let operation = "read";
      const builder = {
        upsert() { operation = "upsert"; return builder; },
        update() { operation = "update"; return builder; },
        eq() { return builder; },
        then(resolve, reject) {
          events.push(`${operation}:${table}`);
          return Promise.resolve({ error: null }).then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

function translationContext(client) {
  return {
    client,
    restaurant: { id: RESTAURANT_ID },
    menu: { id: MENU_ID }
  };
}

test("translation upsert and metadata repair invalidate the affected locale after commit", async () => {
  for (const [name, write] of [
    ["upsert", translations.upsertEntityTranslation],
    ["repair", translations.repairEntityTranslationMetadata]
  ]) {
    const events = [];
    const entity = { type: "menu", id: MENU_ID, fields: { menuName: "Carte" } };
    await write({
      ctx: translationContext(translationWriterClient(events)),
      entity,
      locale: "en-CA",
      provider: "mock",
      content: { menuName: "Menu" },
      onPublicCommit: async ({ locale }) => events.push(`invalidate:${locale}`)
    });
    assert.deepEqual(events, [
      `${name === "repair" ? "update" : name}:menu_translations`,
      "invalidate:en-CA"
    ]);
  }
});

function generatedUiClient({ source }, events) {
  let nativeAttempted = false;
  return {
    from(table) {
      let operation = "read";
      let row = null;
      const builder = {
        update(value) { operation = "update"; row = value; return builder; },
        insert(value) { operation = "insert"; row = value; return builder; },
        select() { return builder; },
        eq() { return builder; },
        async maybeSingle() {
          if (table === "menu_ui_configs") {
            return { data: null, error: null };
          }
          return source === "menu_ui_configs"
            ? {
                data: null,
                error: {
                  code: "PGRST204",
                  message: "Could not find the 'metadata' column of 'menus' in the schema cache"
                }
              }
            : { data: { id: MENU_ID, metadata: {} }, error: null };
        },
        async single() {
          if (table === "menus" && !nativeAttempted) {
            nativeAttempted = true;
            events.push("write:settings_json");
            return source === "settings_json"
              ? { data: { id: MENU_ID, settings_json: row.settings_json }, error: null }
              : {
                  data: null,
                  error: {
                    code: "PGRST204",
                    message: "Could not find the 'settings_json' column of 'menus' in the schema cache"
                  }
                };
          }
          if (table === "menus") {
            events.push("write:metadata");
            return source === "metadata"
              ? { data: { id: MENU_ID, metadata: row.metadata }, error: null }
              : {
                  data: null,
                  error: {
                    code: "PGRST204",
                    message: "Could not find the 'metadata' column of 'menus' in the schema cache"
                  }
                };
          }
          events.push(`${operation}:menu_ui_configs`);
          return { data: { id: "config-id", config_json: row.config_json }, error: null };
        }
      };
      return builder;
    }
  };
}

test("generated UI copy invalidates only when written to the public menu", async () => {
  for (const source of ["settings_json", "metadata", "menu_ui_configs"]) {
    const events = [];
    const result = await fallback.persistGeneratedLocalizedUiCopy({
      client: generatedUiClient({ source }, events),
      restaurantId: RESTAURANT_ID,
      menuId: MENU_ID,
      settings,
      localizedUiCopy: { en: { filterButton: "Filter" } },
      onPublicCommit: async () => events.push("invalidate")
    });
    assert.equal(result.ok, true, source);
    assert.equal(result.source, source);
    assert.equal(events.includes("invalidate"), source !== "menu_ui_configs", source);
    if (source !== "menu_ui_configs") {
      assert.ok(events.indexOf(`write:${source}`) < events.indexOf("invalidate"));
    }
  }
});

function configRow(status, config = DEFAULT_MENU_UI_CONFIG) {
  return {
    id: `${status}-id`,
    restaurant_id: RESTAURANT_ID,
    theme: config.theme,
    config_json: config,
    status,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  };
}

function uiConfigClient({ published = null, archived = null } = {}, events = []) {
  return {
    from(table) {
      let operation = "read";
      let row = null;
      const filters = new Map();
      const builder = {
        select() { return builder; },
        eq(column, value) { filters.set(column, value); return builder; },
        order() { return builder; },
        limit() { return builder; },
        insert(value) { operation = "insert"; row = value; return builder; },
        update(value) { operation = "update"; row = value; return builder; },
        async maybeSingle() {
          if (table === "restaurants") return { data: { id: RESTAURANT_ID }, error: null };
          const status = filters.get("status");
          if (status === "published") return { data: published, error: null };
          if (status === "archived") return { data: archived, error: null };
          return { data: null, error: null };
        },
        async single() {
          events.push(`${operation}:${row.status}`);
          return { data: { ...configRow(row.status, row.config_json), ...row }, error: null };
        },
        then(resolve, reject) {
          if (row?.status) events.push(`${operation}:${row.status}`);
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

test("draft save does not invalidate while publish and rollback invalidate after the final published write", async () => {
  for (const mode of ["draft", "publish", "rollback"]) {
    const events = [];
    globalThis[adminSymbol] = {
      ok: true,
      client: uiConfigClient({
        published: mode === "rollback" ? configRow("published") : null,
        archived: mode === "rollback" ? configRow("archived") : null
      }, events)
    };
    const onPublicCommit = async () => events.push("invalidate");
    const result = mode === "draft"
      ? await uiStore.saveDraftMenuUiConfig({
          restaurantId: RESTAURANT_ID,
          config: DEFAULT_MENU_UI_CONFIG,
          onPublicCommit
        })
      : mode === "publish"
        ? await uiStore.publishMenuUiConfig({
            restaurantId: RESTAURANT_ID,
            config: DEFAULT_MENU_UI_CONFIG,
            onPublicCommit
          })
        : await uiStore.rollbackPublishedMenuUiConfig({
            restaurantId: RESTAURANT_ID,
            onPublicCommit
          });
    assert.equal(result.ok, true, JSON.stringify({ mode, result, events }));
    assert.equal(events.includes("invalidate"), mode !== "draft", mode);
    if (mode !== "draft") {
      assert.ok(events.lastIndexOf("update:published") < events.indexOf("invalidate") || events.lastIndexOf("insert:published") < events.indexOf("invalidate"));
    }
  }
});

function uniqueClient({ published }, events) {
  const uniqueConfig = {
    ...DEFAULT_MENU_UI_CONFIG,
    publicMenuSettings: { ...settings, publicMenuStyle: "unique" },
    uniqueDesign: null
  };
  return {
    from() {
      const filters = new Map();
      const builder = {
        select() { return builder; },
        eq(column, value) { filters.set(column, value); return builder; },
        order() { return builder; },
        limit() { return builder; },
        async maybeSingle() {
          const status = filters.get("status");
          if (status === "draft") return { data: configRow("draft", uniqueConfig), error: null };
          if (status === "published" && published) return { data: configRow("published", uniqueConfig), error: null };
          return { data: null, error: null };
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: [{ id: MENU_ID, is_primary: true, status: "published" }],
            error: null
          }).then(resolve, reject);
        }
      };
      return builder;
    },
    async rpc() {
      events.push("rpc:commit");
      return {
        data: {
          ok: true,
          uniqueDesign: {
            mode: "unique",
            designId: DESIGN_ID,
            status: "pending",
            rendererKey: null,
            rendererVersion: null,
            version: 1,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
          },
          draftPersisted: true,
          publishedPersisted: published
        },
        error: null
      };
    }
  };
}

test("unique design lifecycle invalidates only actions persisted to published identity", async () => {
  for (const published of [false, true]) {
    const events = [];
    globalThis[adminSymbol] = { ok: true, client: uniqueClient({ published }, events) };
    const result = await uniqueStore.mutateUniqueMenuDesignLifecycle({
      restaurantId: RESTAURANT_ID,
      action: "create-new",
      onPublicCommit: async () => events.push("invalidate")
    });
    assert.equal(result.ok, true, JSON.stringify({ published, result, events }));
    assert.equal(events.includes("invalidate"), published);
    if (published) assert.deepEqual(events, ["rpc:commit", "invalidate"]);
  }
});

test.after(() => {
  delete globalThis[adminSymbol];
});
