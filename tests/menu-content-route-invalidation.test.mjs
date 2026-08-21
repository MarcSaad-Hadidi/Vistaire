import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const hooksSymbol = Symbol.for("vistaire.test.menu-content-route-hooks");
const hookedModule = (source) =>
  `data:text/javascript,${encodeURIComponent(source)}`;
const hookCall = (method, args = "...args") =>
  `globalThis[Symbol.for("vistaire.test.menu-content-route-hooks")].${method}(${args})`;

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
    "next/cache",
    hookedModule(`
      export function revalidatePath(...args) { return ${hookCall("revalidatePath")}; }
      export function revalidateTag(...args) { return ${hookCall("revalidateTag")}; }
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
    "@/lib/owner/demoCapabilities",
    hookedModule(`
      export function requireOwnerRestaurantCapability(...args) { return ${hookCall("capability")}; }
    `)
  ],
  [
    "@/lib/admin/access",
    hookedModule(`
      export function requireAdminRestaurantAccess(...args) { return ${hookCall("adminAccess")}; }
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
      export function resolvePublicMutationIdentity(...args) { return ${hookCall("resolveIdentity")}; }
      export function invalidateCommittedPublicMutation(...args) { return ${hookCall("invalidate")}; }
      export function revalidateOwnerMenuMutationPaths(...args) { return ${hookCall("legacyInvalidate")}; }
    `)
  ],
  [
    "@/lib/owner/menuMutations",
    hookedModule(`
      export function createOwnerMenuCategory(args) { return ${hookCall("menuMutation", '"category:create", args')}; }
      export function updateOwnerMenuCategory(args) { return ${hookCall("menuMutation", '"category:update", args')}; }
      export function deleteOwnerMenuCategory(args) { return ${hookCall("menuMutation", '"category:delete", args')}; }
      export function createOwnerMenuDish(args) { return ${hookCall("menuMutation", '"dish:create", args')}; }
      export function updateOwnerMenuDish(args) { return ${hookCall("menuMutation", '"dish:update", args')}; }
      export function deleteOwnerMenuDish(args) { return ${hookCall("menuMutation", '"dish:delete", args')}; }
    `)
  ],
  [
    "@/lib/owner/dishAssetReplacementCleanup",
    hookedModule(`
      export function cleanupReplacedDishAssets(...args) { return ${hookCall("cleanup")}; }
    `)
  ],
  [
    "@/lib/owner/dishPhotoDerivatives",
    hookedModule(`
      export function generateDishPhotoDerivatives() { return Promise.resolve({}); }
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

const [categoryRoute, dishRoute, photoRoute, availabilityRoute] = await Promise.all([
  import("../app/api/owner/restaurants/[restaurantId]/menu/categories/route.ts"),
  import("../app/api/owner/restaurants/[restaurantId]/menu/dishes/route.ts"),
  import("../app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/photo/route.ts"),
  import("../app/(fr)/admin/api/dishes/[dishId]/availability/route.ts")
]);

const RESTAURANT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const DISH_ID = "11111111-2222-4333-8444-555555555555";

function identity(dishSlug = "") {
  return {
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "maison-elyse",
    restaurantKey: "maison-elyse",
    featuredExperienceId: "maison-elyse",
    dishSlug
  };
}

function baseHooks(events, admin) {
  return {
    ownerAuth: async () => ({ ok: true }),
    sameOrigin: () => null,
    capability: async () => ({ ok: true }),
    adminAccess: async () => ({
      ok: true,
      qrId: "22222222-3333-4444-8555-666666666666",
      restaurantId: RESTAURANT_ID
    }),
    getAdmin: () => ({ ok: true, client: admin }),
    resolveIdentity: async () => {
      events.push("identity");
      return identity();
    },
    invalidate: async (retainedIdentity) => {
      events.push(`invalidate:${retainedIdentity?.dishSlug ?? ""}`);
      return { attempted: 1, queuedCallReturned: 1, enqueueErrors: [] };
    },
    legacyInvalidate: async () => {
      events.push("legacy-invalidate");
    },
    revalidatePath: (path) => {
      events.push(`path:${path}`);
    },
    revalidateTag: () => {},
    cleanup: async () => ({
      candidates: [],
      deleted: [],
      skippedStillReferenced: [],
      skippedUnsafeBucket: [],
      skippedUnsafePrefix: [],
      skippedMissingPath: [],
      errors: []
    }),
    menuMutation: async (kind, args) => {
      events.push(`commit:${kind}`);
      await args.onPublicCommit?.({
        ...(kind.startsWith("dish:") ? { dishSlug: "turbot" } : {})
      });
      return {
        ok: true,
        record: kind.startsWith("dish:")
          ? { id: DISH_ID, slug: "turbot" }
          : { id: "category-id", slug: "entrees" }
      };
    }
  };
}

function jsonRequest(method) {
  return new Request("https://vistaire.test/api/mutation", {
    method,
    headers: { "content-type": "application/json", origin: "https://vistaire.test" },
    body: JSON.stringify({ id: "record-id", name: "Entrées" })
  });
}

test("category and dish handlers retain identity before commit and use the B3 callback", async () => {
  for (const [route, kind] of [
    [categoryRoute, "category"],
    [dishRoute, "dish"]
  ]) {
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const events = [];
      globalThis[hooksSymbol] = baseHooks(events, {});
      const response = await route[method](jsonRequest(method), {
        params: Promise.resolve({ restaurantId: RESTAURANT_ID })
      });
      assert.equal(response.status, 200);
      assert.ok(events.indexOf("identity") < events.indexOf(`commit:${kind}:${method.toLowerCase() === "post" ? "create" : method.toLowerCase() === "patch" ? "update" : "delete"}`));
      assert.equal(events.includes("legacy-invalidate"), false);
      assert.equal(events.filter((event) => event.startsWith("invalidate:")).length, 1);
    }
  }
});

function photoAdmin(events) {
  return {
    from(table) {
      assert.equal(table, "menu_dishes");
      let operation = "read";
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        update() { operation = "update"; return builder; },
        async maybeSingle() {
          if (operation === "update") {
            events.push("db:update");
            return { data: { id: DISH_ID }, error: null };
          }
          return {
            data: {
              id: DISH_ID,
              restaurant_id: RESTAURANT_ID,
              slug: "turbot",
              name: "Turbot",
              metadata: {}
            },
            error: null
          };
        }
      };
      return builder;
    },
    storage: {
      from() {
        return {
          async upload() { return { data: {}, error: null }; },
          async remove() { return { data: [], error: null }; }
        };
      }
    }
  };
}

function photoRequest(method) {
  if (method === "DELETE") {
    return new Request("https://vistaire.test/api/photo", { method });
  }
  const form = new FormData();
  form.set(
    "file",
    new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "photo.png",
      { type: "image/png" }
    )
  );
  return new Request("https://vistaire.test/api/photo", {
    method,
    headers: { "content-length": "512" },
    body: form
  });
}

test("photo upload and delete invalidate after metadata commit, before cleanup, and catch cleanup throws", async () => {
  for (const method of ["POST", "DELETE"]) {
    const events = [];
    const hooks = baseHooks(events, photoAdmin(events));
    hooks.cleanup = async () => {
      events.push("cleanup");
      throw new Error("never-print-this-photo-cleanup");
    };
    globalThis[hooksSymbol] = hooks;

    const response = await photoRoute[method](photoRequest(method), {
      params: Promise.resolve({ restaurantId: RESTAURANT_ID, dishId: DISH_ID })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(JSON.stringify(body).includes("never-print-this"), false);
    assert.ok(events.indexOf("identity") < events.indexOf("db:update"));
    assert.ok(events.indexOf("db:update") < events.findIndex((event) => event.startsWith("invalidate:")));
    assert.ok(events.findIndex((event) => event.startsWith("invalidate:")) < events.indexOf("cleanup"));
    assert.equal(events.filter((event) => event.startsWith("invalidate:")).length, 2);
  }
});

function availabilityAdmin(events, succeeds) {
  return {
    rpc() {
      return {
        async maybeSingle() {
          events.push(succeeds ? "rpc:commit" : "rpc:failed");
          return succeeds
            ? {
                data: { dish_id: DISH_ID, dish_slug: "turbot", is_available: false },
                error: null
              }
            : { data: null, error: { code: "PGRST000" } };
        }
      };
    }
  };
}

test("admin availability invalidates only after a successful RPC commit", async () => {
  for (const succeeds of [false, true]) {
    const events = [];
    const hooks = baseHooks(
      events,
      availabilityAdmin(events, succeeds)
    );
    if (succeeds) {
      hooks.revalidatePath = (path) => {
        events.push(`path:${path}`);
        throw new Error("admin-path-revalidation-failed");
      };
    }
    globalThis[hooksSymbol] = hooks;
    const logged = [];
    const originalConsoleError = console.error;
    if (succeeds) console.error = (message) => logged.push(message);
    let response;
    try {
      response = await availabilityRoute.PATCH(
        new Request(`https://vistaire.test/admin/api/dishes/${DISH_ID}/availability`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            origin: "https://vistaire.test"
          },
          body: JSON.stringify({ available: false })
        }),
        { params: Promise.resolve({ dishId: DISH_ID }) }
      );
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(response.status, succeeds ? 200 : 503);
    assert.equal(events.some((event) => event.startsWith("invalidate:")), succeeds);
    if (succeeds) {
      assert.ok(events.indexOf("identity") < events.indexOf("rpc:commit"));
      assert.ok(events.indexOf("rpc:commit") < events.indexOf("invalidate:turbot"));
      assert.deepEqual(logged, [
        "Admin availability revalidation failed after commit."
      ]);
    }
  }
});

test.after(() => {
  delete globalThis[hooksSymbol];
});
