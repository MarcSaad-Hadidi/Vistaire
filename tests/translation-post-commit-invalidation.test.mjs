import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const runtimeSymbol = Symbol.for("vistaire.test.translation-post-commit-runtime");
const hooked = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

const stubs = new Map([
  ["server-only", hooked("export default undefined;")],
  [
    "@/utils/supabase/admin",
    hooked(`
      export function getSupabaseAdminClient() {
        return globalThis[Symbol.for("vistaire.test.translation-post-commit-runtime")].admin;
      }
    `)
  ],
  [
    "@/lib/owner/publicMenuSettingsFallback",
    hooked(`
      export async function readPublicMenuSettingsBundleWithFallbacks() {
        return globalThis[Symbol.for("vistaire.test.translation-post-commit-runtime")].settingsBundle;
      }
      export async function persistGeneratedLocalizedUiCopy() {
        throw new Error("unexpected-ui-copy-write");
      }
    `)
  ],
  [
    "@/lib/translation/serverTranslator",
    hooked(`
      export function resolveTranslationProviderStatus() {
        return { ok: true, provider: "test" };
      }
      export function getServerTranslator() {
        return {
          provider: "test",
          async translateTexts({ texts }) { return texts.map((text) => "EN:" + text); }
        };
      }
    `)
  ],
  [
    "@/lib/translation/menuTranslationFields",
    hooked(`
      export function menuTranslationFieldsFromNames({ menuName }) { return { menuName }; }
      export function canonicalDishTranslationFields() { return {}; }
      export function canonicalDishDerivedTags() { return []; }
    `)
  ],
  [
    "@/lib/translation/menuTranslationModel",
    hooked(`
      export function estimateChangedCharacters(entity) {
        return Object.values(entity.fields).join("").length;
      }
      export function fieldHashesFor(fields) {
        return Object.fromEntries(Object.keys(fields).map((key) => [key, "hash"]));
      }
      export function objectInput(value) {
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
      }
      export function resolveEntityTranslationStatus() { return { status: "missing" }; }
      export function sourceHashFor() { return "source-hash"; }
      export function stringInput(value) { return typeof value === "string" ? value : ""; }
      export function stringListInput(value) { return Array.isArray(value) ? value : []; }
      export function translationValueIsSourceIdentical() { return false; }
      export function summarizeLocaleTranslationStatus() { return { status: "up_to_date" }; }
      export function translationRowCanRepairMetadata() { return false; }
    `)
  ],
  [
    "@/lib/translation/publicMenuUiCopyTranslation",
    hooked(`
      export function buildPublicMenuUiCopyTranslationPlan() {
        return { entries: [], estimatedCharacters: 0, sourceLocale: "fr-CA" };
      }
      export function buildPublicMenuLocalizedUiCopyPack() { return {}; }
      export function estimatePublicMenuUiCopyCharacters() { return 0; }
      export function mergeGeneratedLocalizedUiCopy(value) { return value; }
      export function publicMenuUiCopyReadiness() { return { ready: true, missingKeys: [] }; }
    `)
  ]
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (stubs.has(specifier)) {
      return { url: stubs.get(specifier), shortCircuit: true };
    }
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
          compilerOptions: {
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

const { generateOwnerMenuTranslations } = await import(
  "../lib/owner/menuTranslations.ts"
);

const RESTAURANT_ID = "22222222-2222-4222-8222-222222222222";
const MENU_ID = "33333333-3333-4333-8333-333333333333";
const CONTROLLED_ERROR = "Generation traduction echouee.";

function translationClient(mode, events) {
  let menuTranslationRead = 0;

  return {
    from(table) {
      let operation = "read";
      let row = null;
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        in() {
          return builder;
        },
        order() {
          return builder;
        },
        insert(value) {
          operation = "insert";
          row = value;
          return builder;
        },
        update(value) {
          operation = "update";
          row = value;
          return builder;
        },
        upsert(value) {
          operation = "upsert";
          row = value;
          return builder;
        },
        async maybeSingle() {
          if (table === "restaurants") {
            return { data: { id: RESTAURANT_ID }, error: null };
          }
          if (table === "menus") {
            return {
              data: { id: MENU_ID, restaurant_id: RESTAURANT_ID, name: "Carte" },
              error: null
            };
          }
          return { data: null, error: null };
        },
        async single() {
          assert.equal(table, "menu_translation_jobs");
          assert.equal(operation, "insert");
          events.push("job:running");
          return { data: { id: "job-id" }, error: null };
        },
        then(resolve, reject) {
          const execute = async () => {
            if (table === "menu_categories" || table === "menu_dishes") {
              return { data: [], error: null };
            }
            if (
              table === "menu_translations" ||
              table === "menu_category_translations" ||
              table === "menu_dish_translations"
            ) {
              if (operation === "upsert") {
                events.push("commit:translation");
                return { data: null, error: null };
              }
              if (table === "menu_translations") {
                menuTranslationRead += 1;
                if (mode === "final-read-throws" && menuTranslationRead === 2) {
                  events.push("read:final:throw");
                  throw new Error("private-final-read-sentinel");
                }
              }
              return { data: [], error: null };
            }
            if (table === "menu_translation_jobs" && operation === "update") {
              if (row.status === "succeeded") {
                events.push("job:succeeded");
                if (mode === "failed-job-throws") {
                  throw new Error("private-later-work-sentinel");
                }
                return { data: null, error: null };
              }
              events.push("job:failed:throw");
              throw new Error("private-failed-job-sentinel");
            }
            throw new Error(`Unexpected query: ${table}:${operation}`);
          };
          return execute().then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

function runtime(mode, events) {
  return {
    admin: { ok: true, client: translationClient(mode, events) },
    settingsBundle: {
      settings: {
        defaultLocale: "fr-CA",
        supportedLocales: ["fr-CA", "en-CA"]
      },
      localizedUiCopy: {}
    }
  };
}

async function runPostCommitFailure(mode) {
  const events = [];
  globalThis[runtimeSymbol] = runtime(mode, events);
  const result = await generateOwnerMenuTranslations({
    restaurantId: RESTAURANT_ID,
    locale: "en-CA",
    onPublicCommit: async () => events.push("invalidate")
  });
  return { result, events };
}

test("a throwing failed-job write after a public commit stays controlled and reschedules", async () => {
  const { result, events } = await runPostCommitFailure("failed-job-throws");

  assert.deepEqual(result, { ok: false, status: 503, error: CONTROLLED_ERROR });
  assert.deepEqual(events, [
    "job:running",
    "commit:translation",
    "invalidate",
    "job:succeeded",
    "job:failed:throw",
    "invalidate"
  ]);
  assert.doesNotMatch(JSON.stringify(result), /private-|sentinel/);
});

test("a throwing final translation read after a public commit stays controlled and reschedules", async () => {
  const { result, events } = await runPostCommitFailure("final-read-throws");

  assert.deepEqual(result, { ok: false, status: 503, error: CONTROLLED_ERROR });
  assert.deepEqual(events.slice(-3), [
    "job:succeeded",
    "read:final:throw",
    "invalidate"
  ]);
  assert.equal(events.filter((event) => event === "invalidate").length, 2);
  assert.doesNotMatch(JSON.stringify(result), /private-|sentinel/);
});

test.after(() => {
  delete globalThis[runtimeSymbol];
});
