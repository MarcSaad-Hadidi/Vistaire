import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const cleanupHooksSymbol = Symbol.for("vistaire.test.menu-content-cleanup");
const cleanupModuleUrl = `data:text/javascript,${encodeURIComponent(`
  export function cleanupReplacedDishAssets(args) {
    return globalThis[Symbol.for("vistaire.test.menu-content-cleanup")](args);
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
    if (specifier === "@/lib/owner/dishAssetReplacementCleanup") {
      return { url: cleanupModuleUrl, shortCircuit: true };
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

const mutations = await import("../lib/owner/menuMutations.ts");

function queuedClient(entries, events = []) {
  const queues = new Map(
    Object.entries(entries).map(([table, tableEntries]) => [table, [...tableEntries]])
  );

  return {
    storage: {
      from() {
        return {
          async remove() {
            return { data: [], error: null };
          }
        };
      }
    },
    from(table) {
      const entry = queues.get(table)?.shift();
      assert.ok(entry, `Unexpected query for ${table}`);
      let operation = "read";
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        neq() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        insert() { operation = "insert"; return builder; },
        update() { operation = "update"; return builder; },
        delete() { operation = "delete"; return builder; },
        async single() {
          events.push(`${operation}:${entry.label}`);
          return entry.result;
        },
        async maybeSingle() {
          events.push(`${operation}:${entry.label}`);
          return entry.result;
        },
        then(resolve, reject) {
          events.push(`${operation}:${entry.label}`);
          return Promise.resolve(entry.result).then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

test("a newly committed primary menu invalidates even when category creation later fails", async () => {
  const events = [];
  const client = queuedClient(
    {
      restaurants: [
        { label: "restaurant", result: { data: { id: "restaurant-id" }, error: null } }
      ],
      menus: [
        { label: "menu-list", result: { data: [], error: null } },
        {
          label: "primary-menu-commit",
          result: { data: { id: "menu-id", settings_json: {} }, error: null }
        }
      ],
      menu_categories: [
        { label: "slug-list", result: { data: [], error: null } },
        { label: "category-failed", result: { data: null, error: { code: "PGRST000" } } },
        { label: "order", result: { data: [], error: null } }
      ]
    },
    events
  );

  const result = await mutations.createOwnerMenuCategory({
    client,
    restaurantId: "restaurant-id",
    input: { name: "Entrées" },
    onPublicCommit: async () => {
      events.push("invalidate");
    }
  });

  assert.equal(result.ok, false);
  assert.ok(events.indexOf("insert:primary-menu-commit") < events.indexOf("invalidate"));
  assert.ok(events.indexOf("invalidate") < events.indexOf("insert:category-failed"));
  assert.equal(events.filter((event) => event === "invalidate").length, 1);
});

function categoryUpdateClient({ succeeds }, events) {
  return queuedClient(
    {
      menu_categories: [
        {
          label: "category-existing",
          result: { data: { id: "category-id", menu_id: "menu-id" }, error: null }
        },
        { label: "slug-list", result: { data: [], error: null } },
        {
          label: succeeds ? "category-commit" : "category-failed",
          result: succeeds
            ? {
                data: {
                  id: "category-id",
                  name: "Desserts",
                  slug: "desserts",
                  description: "",
                  display_order: 2
                },
                error: null
              }
            : { data: null, error: { code: "PGRST000" } }
        }
      ]
    },
    events
  );
}

test("category updates invalidate only after a confirmed write", async () => {
  for (const succeeds of [false, true]) {
    const events = [];
    const result = await mutations.updateOwnerMenuCategory({
      client: categoryUpdateClient({ succeeds }, events),
      restaurantId: "restaurant-id",
      input: { id: "category-id", name: "Desserts" },
      onPublicCommit: async () => {
        events.push("invalidate");
      }
    });

    assert.equal(result.ok, succeeds, JSON.stringify({ succeeds, events, result }));
    assert.equal(events.includes("invalidate"), succeeds);
    if (succeeds) {
      assert.ok(events.indexOf("update:category-commit") < events.indexOf("invalidate"));
    }
  }
});

test("dish deletion invalidates before cleanup and converts cleanup throws to a committed result", async () => {
  const events = [];
  const client = queuedClient(
    {
      menu_dishes: [
        {
          label: "dish-existing",
          result: {
            data: {
              id: "dish-id",
              name: "Turbot",
              slug: "turbot",
              menu_id: "menu-id",
              category_id: "category-id",
              metadata: { photoStoragePath: "private-sentinel" }
            },
            error: null
          }
        },
        {
          label: "dish-delete-commit",
          result: {
            data: {
              id: "dish-id",
              name: "Turbot",
              slug: "turbot",
              menu_id: "menu-id",
              category_id: "category-id"
            },
            error: null
          }
        }
      ]
    },
    events
  );
  globalThis[cleanupHooksSymbol] = async () => {
    events.push("cleanup");
    throw new Error("never-print-this-cleanup-sentinel");
  };

  const result = await mutations.deleteOwnerMenuDish({
    client,
    restaurantId: "restaurant-id",
    input: { id: "dish-id" },
    onPublicCommit: async ({ dishSlug }) => {
      assert.equal(dishSlug, "turbot");
      events.push("invalidate");
    }
  });

  assert.equal(result.ok, true);
  assert.ok(events.indexOf("delete:dish-delete-commit") < events.indexOf("invalidate"));
  assert.ok(events.indexOf("invalidate") < events.indexOf("cleanup"));
  assert.equal(events.filter((event) => event === "invalidate").length, 2);
  assert.equal(JSON.stringify(result).includes("never-print-this"), false);
  assert.equal(Array.isArray(result.record.mediaCleanup.warnings), true);
});

test.after(() => {
  delete globalThis[cleanupHooksSymbol];
});
