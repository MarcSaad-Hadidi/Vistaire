import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const hooksSymbol = Symbol.for("vistaire.test.public-model-route-hooks");
const hookedModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const hookCall = (method, args = "...args") =>
  `globalThis[Symbol.for("vistaire.test.public-model-route-hooks")].${method}(${args})`;

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
    hookedModule(`export function revalidatePath(...args) { return ${hookCall("revalidatePath")}; }`)
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
    hookedModule(`export function requireOwnerRestaurantCapability(...args) { return ${hookCall("capability")}; }`)
  ],
  [
    "@/utils/supabase/admin",
    hookedModule(`export function getSupabaseAdminClient(...args) { return ${hookCall("getAdmin")}; }`)
  ],
  [
    "@/lib/owner/menuMutationRevalidation",
    hookedModule(`
      export function resolvePublicMutationIdentity(...args) { return ${hookCall("resolveIdentity")}; }
      export function invalidateCommittedPublicMutation(...args) { return ${hookCall("invalidate")}; }
    `)
  ],
  [
    "@/lib/owner/menuUrlCore",
    hookedModule(`export function slugifyRestaurantSlug(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }`)
  ],
  [
    "@/lib/owner/threeDSourceUploadModel",
    hookedModule(`
      export function parseSourceUploadLimit() { return { ok: true, maxBytes: 1048576 }; }
      export function validateSourceGlbFile(input) { return { ok: true, bytes: input.bytes, originalName: input.name }; }
    `)
  ],
  [
    "@/lib/owner/restaurantMeshyPipeline",
    hookedModule(`export function runRestaurantMeshyDishPipeline(args) { return ${hookCall("pipeline", '"meshy", args')}; }`)
  ],
  [
    "@/lib/owner/viewerGlbUpload",
    hookedModule(`export function runViewerGlbUpload(args) { return ${hookCall("pipeline", '"viewer", args')}; }`)
  ],
  [
    "@/lib/owner/usdzRuntimeJsonFlow",
    hookedModule(`
      export function parseCompleteInput(value) { return value; }
      export function parsePrepareUploadInput(value) { return value; }
      export function parseRollbackInput() { return null; }
      export function verifyUsdzRuntimeJobToken(...args) { return ${hookCall("verifyToken")}; }
      export function assertUsdzRuntimeJobClaimsMatchRoute() {}
      export function completeUsdzRuntimeSignedUpload(args) { return ${hookCall("pipeline", '"usdz", args')}; }
      export function createUsdzRuntimeJobToken() { return { ok: true, jobId: "job", token: "token", expiresAt: "2099-01-01T00:00:00.000Z" }; }
      export function prepareUsdzRuntimeSignedUpload() { return Promise.resolve({ ok: true, jobId: "job", usdzSourceStored: false }); }
      export function rollbackUsdzRuntimeSignedUpload() { return Promise.resolve({ ok: true, removedPaths: [], usdzSourceStored: false }); }
    `)
  ],
  [
    "@/lib/owner/usdzRuntimeModel",
    hookedModule(`
      export const DEFAULT_USDZ_OPTIMIZATION_PROFILE = "balanced";
      export function isUsdzOptimizationProfile(value) { return value === "balanced"; }
      export function parseUsdzSourceUploadLimit() { return { ok: true, maxBytes: 1048576 }; }
      export function parseUsdzRuntimeMaxBytes() { return { ok: true, maxBytes: 1048576 }; }
      export function sanitizeUsdzOriginalName(value) { return value; }
    `)
  ],
  [
    "@/lib/owner/deleteDishModelAssets",
    hookedModule(`
      export const DISH_MODEL_MISSING_STATUS = "missing";
      export function cleanDishModelMetadata() { return {}; }
      export function cleanTargetedDishModelMetadata() { return {}; }
      export function collectDishModelStorageTargets() { return { targets: [], skipped: [] }; }
      export function collectTargetedDishModelDeletion() { return { targets: [], clearKeys: [] }; }
      export function groupTargetsByBucket() { return []; }
      export function hasDishModelMetadata() { return true; }
    `)
  ],
  [
    "@/lib/owner/storageSafeIdentifier",
    hookedModule(`
      export function isCanonicalUuid() { return true; }
      export function normalizeStorageSafeIdentifier(value) { return value; }
    `)
  ]
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (moduleStubs.has(specifier)) return { url: moduleStubs.get(specifier), shortCircuit: true };
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
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
        }).outputText,
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});

const routeRoot = "../app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model";
const [glbRoute, publishRoute, viewerRoute, completeRoute, startRoute, prepareRoute, failRoute, disabledRoute, deleteRoute] = await Promise.all([
  import(`${routeRoot}/glb/route.ts`),
  import(`${routeRoot}/publish/route.ts`),
  import(`${routeRoot}/viewer-glb/route.ts`),
  import(`${routeRoot}/usdz-runtime/complete/route.ts`),
  import(`${routeRoot}/usdz-runtime/start/route.ts`),
  import(`${routeRoot}/usdz-runtime/prepare-upload/route.ts`),
  import(`${routeRoot}/usdz-runtime/fail/route.ts`),
  import(`${routeRoot}/usdz-runtime/route.ts`),
  import(`${routeRoot}/route.ts`)
]);

const RESTAURANT_ID = "11111111-2222-4333-8444-555555555555";
const DISH_ID = "22222222-3333-4444-8555-666666666666";

function identity() {
  return {
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    restaurantKey: "demo",
    featuredExperienceId: "demo",
    dishSlug: "sole"
  };
}

function fakeAdmin(events) {
  return {
    storage: {
      from() {
        return {
          async download() { return { data: new Blob([Buffer.from("glb")]), error: null }; },
          async remove(paths) { return { data: paths.map((name) => ({ name })), error: null }; }
        };
      }
    },
    from(table) {
      let operation = "select";
      const builder = {
        select() { return builder; },
        update() { operation = "update"; return builder; },
        eq() { return builder; },
        async maybeSingle() {
          if (operation === "update") {
            events.push("db:commit");
            return { data: { id: DISH_ID }, error: null };
          }
          if (table === "restaurants") return { data: { slug: "demo" }, error: null };
          if (table === "menus") return { data: { slug: "principal" }, error: null };
          return {
            data: {
              id: DISH_ID,
              restaurant_id: RESTAURANT_ID,
              menu_id: "menu-id",
              slug: "sole",
              name: "Sole",
              metadata: {},
              has_immersive_view: true
            },
            error: null
          };
        }
      };
      return builder;
    }
  };
}

function baseHooks(events) {
  const admin = fakeAdmin(events);
  return {
    ownerAuth: async () => ({ ok: true, userId: "owner", emailAddresses: ["owner@vistaire.test"] }),
    sameOrigin: () => null,
    capability: async () => ({ ok: true }),
    getAdmin: () => ({ ok: true, client: admin }),
    resolveIdentity: async () => { events.push("identity"); return identity(); },
    invalidate: async () => {
      events.push("invalidate");
      return { attempted: 10, queuedCallReturned: 10, enqueueErrors: [] };
    },
    revalidatePath: (path) => { events.push(`legacy-path:${path}`); },
    verifyToken: () => ({
      ok: true,
      claims: {
        restaurantId: RESTAURANT_ID,
        restaurantSlug: "demo",
        menuSlug: "principal",
        dishId: DISH_ID,
        dishSlug: "sole",
        jobId: "job"
      }
    }),
    pipeline: async (kind, args) => {
      events.push(`pipeline:${kind}`);
      await args.onPublicCommit?.();
      events.push("postcommit:throw");
      throw new Error(`${kind}-cleanup-secret`);
    }
  };
}

function glbRequest() {
  const form = new FormData();
  form.set("file", new File([Buffer.from("glb")], "sole.glb", { type: "model/gltf-binary" }));
  return new Request("https://vistaire.test/api/model", {
    method: "POST",
    headers: { "content-length": "256", origin: "https://vistaire.test" },
    body: form
  });
}

function jsonRequest(body = {}) {
  return new Request("https://vistaire.test/api/model", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://vistaire.test" },
    body: JSON.stringify(body)
  });
}

test("reachable GLB, publish, viewer, and USDZ handlers reschedule a committed failure and return a redacted Response", async () => {
  const cases = [
    ["meshy", glbRoute, glbRequest],
    ["meshy", publishRoute, () => jsonRequest({ sourceStoragePath: `restaurants/${RESTAURANT_ID}/models/staging/source.glb` })],
    ["viewer", viewerRoute, glbRequest],
    ["usdz", completeRoute, () => jsonRequest({ jobToken: "token" })]
  ];

  for (const [kind, route, requestFactory] of cases) {
    const events = [];
    globalThis[hooksSymbol] = baseHooks(events);
    const response = await route.POST(requestFactory(), {
      params: Promise.resolve({ restaurantId: RESTAURANT_ID, dishId: DISH_ID })
    });
    const body = await response.json();

    assert.equal(response instanceof Response, true);
    assert.equal(body.committed, true);
    assert.equal(body.dishUpdated, true);
    assert.equal(JSON.stringify(body).includes(`${kind}-cleanup-secret`), false);
    assert.ok(events.indexOf("identity") < events.indexOf(`pipeline:${kind}`));
    assert.equal(events.filter((event) => event === "invalidate").length, 2);
  }
});

test("model delete keeps menu and dish invalidation after the metadata commit through B3", async () => {
  const events = [];
  globalThis[hooksSymbol] = baseHooks(events);
  const request = new Request("https://vistaire.test/api/model?target=all", {
    method: "DELETE",
    headers: { origin: "https://vistaire.test" }
  });
  Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });

  const response = await deleteRoute.DELETE(request, {
    params: Promise.resolve({ restaurantId: RESTAURANT_ID, dishId: DISH_ID })
  });
  assert.equal(response.status, 200);
  assert.ok(events.indexOf("identity") < events.indexOf("db:commit"));
  assert.ok(events.indexOf("db:commit") < events.indexOf("invalidate"));
  assert.equal(events.filter((event) => event.startsWith("legacy-path:")).length, 0);
});

test("USDZ start, prepare, fail, and the retired 410 route never claim a public commit", async () => {
  const cases = [
    [startRoute, () => jsonRequest({ sourceBytes: 100, originalName: "sole.usdz", profile: "balanced" })],
    [prepareRoute, () => jsonRequest({ jobToken: "token" })],
    [failRoute, () => jsonRequest({ jobToken: "token" })],
    [disabledRoute, () => jsonRequest()]
  ];
  for (const [route, requestFactory] of cases) {
    const events = [];
    globalThis[hooksSymbol] = baseHooks(events);
    await route.POST(requestFactory(), {
      params: Promise.resolve({ restaurantId: RESTAURANT_ID, dishId: DISH_ID })
    });
    assert.equal(events.includes("identity"), false);
    assert.equal(events.includes("invalidate"), false);
  }
});

test.after(() => {
  delete globalThis[hooksSymbol];
});
