import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const hooksSymbol = Symbol.for("vistaire.test.published-settings-route-hooks");
const hooked = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const call = (name, args = "...args") =>
  `globalThis[Symbol.for("vistaire.test.published-settings-route-hooks")].${name}(${args})`;

const stubs = new Map([
  ["server-only", hooked("export default undefined;")],
  ["next/server", hooked(`
    export class NextResponse extends Response {
      static json(body, init = {}) {
        const headers = new Headers(init.headers);
        if (!headers.has("content-type")) headers.set("content-type", "application/json");
        return new NextResponse(JSON.stringify(body), { ...init, headers });
      }
    }
  `)],
  ["@/lib/auth/ownerApi", hooked(`
    export function requireVistaireOwnerApi() { return Promise.resolve({ ok: true }); }
    export function requireSameOriginOwnerMutation() { return null; }
  `)],
  ["@/lib/owner/demoCapabilities", hooked(`
    export function requireOwnerRestaurantCapability() { return Promise.resolve({ ok: true }); }
  `)],
  ["@/utils/supabase/admin", hooked(`
    export function getSupabaseAdminClient() { return { ok: true, client: {} }; }
  `)],
  ["@/lib/owner/menuMutationRevalidation", hooked(`
    export function resolvePublicMutationIdentity(args) { return ${call("resolveIdentity", "args")}; }
    export function invalidateCommittedPublicMutation(identity) { return ${call("invalidate", "identity")}; }
  `)],
  ["@/lib/menu/publicMenuSettings", hooked(`
    export function validatePublicMenuSettingsInput(value) { return { ok: true, value }; }
    export function serializePublicMenuSettings(value) { return value; }
    export function normalizePublicMenuLocale(value) { return typeof value === "string" ? value : "fr-CA"; }
  `)],
  ["@/lib/menu/menuUiConfig", hooked(`
    export function validateMenuUiConfig(value) { return { ok: true, value }; }
  `)],
  ["@/lib/owner/storageSafeIdentifier", hooked(`
    export function isCanonicalUuid() { return true; }
  `)],
  ["@/lib/menu/uniqueMenuDesign", hooked(`
    export function isUniqueMenuDesignAction() { return true; }
  `)],
  ["@/lib/owner/menuSettingsMutation", hooked(`
    export function updateOwnerMenuSettings(args) { return ${call("settingsMutation", "args")}; }
  `)],
  ["@/lib/owner/menuTranslations", hooked(`
    export function getOwnerMenuTranslationOverview() { return Promise.resolve({ ok: true }); }
    export function generateOwnerMenuTranslations(args) { return ${call("translationMutation", "args")}; }
  `)],
  ["@/lib/owner/menuUiConfigStore", hooked(`
    export function getOwnerMenuUiConfig() { return Promise.resolve({ ok: true, record: { config: {}, status: "draft", persisted: true, dataSource: "supabase", updatedAt: null } }); }
    export function getOwnerMenuUiConfigHistory() { return Promise.resolve({ ok: true, records: [] }); }
    export function saveDraftMenuUiConfig(args) { return ${call("uiMutation", '"save", args')}; }
    export function duplicatePublishedMenuUiConfigToDraft(args) { return ${call("uiMutation", '"revert", args')}; }
    export function publishMenuUiConfig(args) { return ${call("uiMutation", '"publish", args')}; }
    export function rollbackPublishedMenuUiConfig(args) { return ${call("uiMutation", '"rollback", args')}; }
  `)],
  ["@/lib/owner/uniqueMenuDesignStore", hooked(`
    export function getUniqueMenuDesignSnapshot() { return Promise.resolve({ ok: false, status: 404, error: "unused" }); }
    export function mutateUniqueMenuDesignLifecycle(args) { return ${call("uniqueMutation", "args")}; }
  `)]
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (stubs.has(specifier)) return { url: stubs.get(specifier), shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const baseUrl = new URL(specifier.slice(2), projectRootUrl);
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
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
        }).outputText,
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});

const [settingsRoute, translationRoute, uiRoute, uniqueRoute] = await Promise.all([
  import("../app/api/owner/restaurants/[restaurantId]/menu-settings/route.ts"),
  import("../app/api/owner/restaurants/[restaurantId]/menu-translations/route.ts"),
  import("../app/api/owner/menu-ui-config/route.ts"),
  import("../app/api/owner/unique-menu-design/route.ts")
]);

const RESTAURANT_ID = "22222222-2222-4222-8222-222222222222";
const identity = { restaurantId: RESTAURANT_ID, restaurantSlug: "maison-elyse" };

function hooks(events, { uniquePublished = true } = {}) {
  return {
    async resolveIdentity() { events.push("identity"); return identity; },
    async invalidate(value) { assert.equal(value, identity); events.push("invalidate"); },
    async settingsMutation(args) {
      events.push("commit:settings");
      await args.onPublicCommit?.();
      return { ok: true, restaurantId: RESTAURANT_ID, menuId: "menu-id", settings: args.settings, storage: "settings_json" };
    },
    async translationMutation(args) {
      if (!args.dryRun) {
        events.push("commit:translation");
        await args.onPublicCommit?.({ locale: args.locale });
      }
      return { ok: true, locale: args.locale, dryRun: args.dryRun === true };
    },
    async uiMutation(action, args) {
      events.push(`commit:${action}`);
      if (action === "publish" || action === "rollback") await args.onPublicCommit?.();
      return { ok: true, record: { config: {}, status: action === "save" || action === "revert" ? "draft" : "published", persisted: true, dataSource: "supabase", updatedAt: null } };
    },
    async uniqueMutation(args) {
      events.push("commit:unique");
      if (uniquePublished) await args.onPublicCommit?.();
      return { ok: true, uniqueDesign: {}, availableRenderers: [], draftPersisted: true, publishedPersisted: uniquePublished };
    }
  };
}

function request(path, body) {
  return new Request(`https://vistaire.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://vistaire.test" },
    body: JSON.stringify(body)
  });
}

test("settings and translation handlers retain identity before public commit", async () => {
  for (const [name, invoke] of [
    ["settings", () => settingsRoute.PATCH(request("/settings", { settings: {} }), { params: Promise.resolve({ restaurantId: RESTAURANT_ID }) })],
    ["translation", () => translationRoute.POST(request("/translations", { locale: "en-CA" }), { params: Promise.resolve({ restaurantId: RESTAURANT_ID }) })]
  ]) {
    const events = [];
    globalThis[hooksSymbol] = hooks(events);
    const response = await invoke();
    assert.equal(response.status, 200);
    assert.deepEqual(events, ["identity", `commit:${name}`, "invalidate"]);
  }
});

test("translation dry-run and UI draft actions do not invalidate; publish and rollback do", async () => {
  const dryEvents = [];
  globalThis[hooksSymbol] = hooks(dryEvents);
  await translationRoute.POST(request("/translations", { locale: "en-CA", dryRun: true }), { params: Promise.resolve({ restaurantId: RESTAURANT_ID }) });
  assert.equal(dryEvents.includes("invalidate"), false);

  for (const action of ["save", "revert-to-published", "publish", "rollback"]) {
    const events = [];
    globalThis[hooksSymbol] = hooks(events);
    await uiRoute.POST(request("/ui", { restaurantId: RESTAURANT_ID, action, config: {} }));
    const publicAction = action === "publish" || action === "rollback";
    assert.equal(events.includes("invalidate"), publicAction, action);
    if (publicAction) assert.ok(events.indexOf("identity") < events.indexOf("invalidate"));
  }
});

test("unique handler schedules only when the store confirms published persistence", async () => {
  for (const uniquePublished of [false, true]) {
    const events = [];
    globalThis[hooksSymbol] = hooks(events, { uniquePublished });
    await uniqueRoute.POST(request("/unique", { restaurantId: RESTAURANT_ID, action: "create-new" }));
    assert.equal(events.includes("invalidate"), uniquePublished);
    if (uniquePublished) assert.ok(events.indexOf("identity") < events.indexOf("commit:unique"));
  }
});

test.after(() => {
  delete globalThis[hooksSymbol];
});
