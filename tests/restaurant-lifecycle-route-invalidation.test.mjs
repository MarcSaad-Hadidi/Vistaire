import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const hooksSymbol = Symbol.for("vistaire.test.restaurant-lifecycle-route-hooks");
const hookedModule = (source) =>
  `data:text/javascript,${encodeURIComponent(source)}`;
const hookCall = (method, args = "...args") =>
  `globalThis[Symbol.for("vistaire.test.restaurant-lifecycle-route-hooks")].${method}(${args})`;

const moduleStubs = new Map([
  ["server-only", hookedModule("export default undefined;")],
  [
    "next/server",
    hookedModule(`
      export class NextResponse extends Response {
        static json(body, init = {}) {
          const headers = new Headers(init.headers);
          if (!headers.has("content-type")) headers.set("content-type", "application/json");
          return new NextResponse(JSON.stringify(body), { ...init, headers });
        }
      }
    `)
  ],
  [
    "@/lib/auth/ownerApi",
    hookedModule(`
      export function requireVistaireOwnerApi(...args) { return ${hookCall("ownerAuth")}; }
      export function requireSameOriginOwnerMutation(...args) { return ${hookCall("sameOrigin")}; }
    `)
  ],
  [
    "@/utils/supabase/admin",
    hookedModule(`
      export function getSupabaseAdminClient(...args) { return ${hookCall("getAdmin")}; }
    `)
  ],
  [
    "@/lib/owner/menuMutationRevalidation",
    hookedModule(`
      export function invalidateCommittedPublicMutation(...args) { return ${hookCall("invalidate")}; }
    `)
  ],
  [
    "@/lib/owner/restaurantStatus",
    hookedModule(`
      export function createRestaurantLifecyclePublicCommitHook(invalidate) {
        return (commit) => invalidate({
          restaurantId: commit.restaurantId,
          restaurantSlug: commit.restaurantSlug,
          restaurantKey: commit.restaurantSlug,
          featuredExperienceId: null,
          dishSlug: ""
        });
      }
      export function validateRestaurantStatusAction(body) {
        return { ok: true, action: body.action === "restore" ? "restore" : "archive" };
      }
      export function updateRestaurantStatusRecord(...args) { return ${hookCall("updateStatus")}; }
      export function deleteRestaurantRecord(...args) { return ${hookCall("deleteRestaurant")}; }
    `)
  ],
  [
    "@/lib/owner/data",
    hookedModule(`
      export function validateCreateRestaurantInput(body) { return { ok: true, value: body }; }
      export function createRestaurant(...args) { return ${hookCall("createRestaurant")}; }
      export function getOwnerDashboardData() { return Promise.resolve({ source: "test", restaurants: [], stats: {} }); }
    `)
  ]
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (moduleStubs.has(specifier)) {
      return { url: moduleStubs.get(specifier), shortCircuit: true };
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

const [createRoute, legacyRoute, ownerArchiveRoute, ownerDeleteRoute] =
  await Promise.all([
    import("../app/api/restaurants/route.ts"),
    import("../app/api/restaurants/[restaurantId]/route.ts"),
    import("../app/api/owner/restaurants/[restaurantId]/archive/route.ts"),
    import("../app/api/owner/restaurants/[restaurantId]/route.ts")
  ]);

const RESTAURANT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function request(method, body) {
  return new Request("https://vistaire.test/api/restaurants", {
    method,
    headers: { "content-type": "application/json", origin: "https://vistaire.test" },
    body: JSON.stringify(body)
  });
}

function baseHooks(events, options = {}) {
  return {
    ownerAuth: async () => ({ ok: true }),
    sameOrigin: () => null,
    getAdmin: () => ({ ok: true, client: {} }),
    invalidate: async (identity) => {
      events.push(`invalidate:${identity.restaurantSlug}`);
      return { attempted: 1, queuedCallReturned: 1, enqueueErrors: [] };
    },
    updateStatus: async (_restaurantId, action, dependencies) => {
      events.push(`commit:${action}`);
      await dependencies.onPublicCommit?.({
        kind: "status",
        restaurantId: RESTAURANT_ID,
        restaurantSlug: "bistro-test"
      });
      return {
        ok: true,
        restaurantId: RESTAURANT_ID,
        status: action === "archive" ? "archived" : "setup_needed"
      };
    },
    deleteRestaurant: async (_restaurantId, _confirmation, dependencies) => {
      events.push("commit:deleted");
      const commit = {
        kind: "deleted",
        restaurantId: RESTAURANT_ID,
        restaurantSlug: "bistro-test"
      };
      await dependencies.onPublicCommit?.(commit);
      if (options.cleanupThrows) {
        await dependencies.onPublicCommit?.(commit);
      }
      return {
        ok: true,
        restaurantId: RESTAURANT_ID,
        restaurantDeleted: true,
        deleted: { restaurants: 1 },
        skipped: [],
        storage: {
          attempted: options.cleanupThrows === true,
          deletedFiles: 0,
          warnings: options.cleanupThrows
            ? ["Nettoyage Storage differe apres suppression."]
            : []
        },
        warnings: []
      };
    },
    createRestaurant: async () => ({
      ok: false,
      status: 502,
      error: "Creation invalide apres commit."
    })
  };
}

test("status, archive, and both delete handlers share the lifecycle invalidation hook", async () => {
  for (const [route, method, body, expectedCommit] of [
    [legacyRoute, "PATCH", { action: "archive" }, "commit:archive"],
    [ownerArchiveRoute, "PATCH", { action: "archive" }, "commit:archive"],
    [legacyRoute, "DELETE", { confirmation: "Bistro Test" }, "commit:deleted"],
    [ownerDeleteRoute, "DELETE", { confirmation: "Bistro Test" }, "commit:deleted"]
  ]) {
    const events = [];
    globalThis[hooksSymbol] = baseHooks(events);
    const response = await route[method](request(method, body), {
      params: Promise.resolve({ restaurantId: RESTAURANT_ID })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(events, [expectedCommit, "invalidate:bistro-test"]);
  }
});

test("create handler returns a controlled response for malformed post-commit data", async () => {
  globalThis[hooksSymbol] = baseHooks([]);
  const response = await createRoute.POST(request("POST", { name: "Bistro Test" }));

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Creation invalide apres commit."
  });
});

test("both delete handlers return a redacted committed response after cleanup failure", async () => {
  for (const route of [legacyRoute, ownerDeleteRoute]) {
    const events = [];
    globalThis[hooksSymbol] = baseHooks(events, { cleanupThrows: true });
    const response = await route.DELETE(
      request("DELETE", { confirmation: "Bistro Test", deleteStorage: true }),
      { params: Promise.resolve({ restaurantId: RESTAURANT_ID }) }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.restaurantDeleted, true);
    assert.equal(events.filter((event) => event === "invalidate:bistro-test").length, 2);
    assert.match(body.storage.warnings.join("\n"), /nettoyage.*differe/i);
    assert.equal(JSON.stringify(body).includes("storage-secret"), false);
  }
});
