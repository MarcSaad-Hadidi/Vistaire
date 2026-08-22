import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRootUrl = pathToFileURL(`${process.cwd()}${sep}`).href;
const hooksSymbol = Symbol.for("vistaire.test.public-model-library-hooks");
const hookedModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const hookCall = (method, args = "...args") =>
  `globalThis[Symbol.for("vistaire.test.public-model-library-hooks")].${method}(${args})`;

const cleanupStub = hookedModule(`
  export function cleanupReplacedDishAssets(...args) { return ${hookCall("cleanup")}; }
`);

const moduleStubs = new Map([
  ["server-only", hookedModule("export default undefined;")],
  [
    "node:fs",
    hookedModule(`
      export function existsSync(...args) { return ${hookCall("existsSync")}; }
      export function readFileSync(...args) { return ${hookCall("readFileSync")}; }
      export function writeFileSync(...args) { return ${hookCall("writeFileSync")}; }
    `)
  ],
  [
    "node:child_process",
    hookedModule(`export function spawn(...args) { return ${hookCall("spawn")}; }`)
  ],
  [
    "@/lib/owner/meshyRuntimeWorkspace",
    hookedModule(`
      export function createOwnerMeshyRuntimeWorkspace(...args) { return ${hookCall("workspace")}; }
      export function resolveOwnerMeshyAssetPath(...args) { return ${hookCall("resolveAssetPath")}; }
    `)
  ],
  [
    "@/lib/owner/preparedModelWorkflow",
    hookedModule(`
      export const buildPreparedModelArLiteStoragePath = (args) => \`restaurants/\${args.restaurantId}/models/ar-lite/\${args.dishSlug}.glb\`;
      export const buildPreparedModelUsdzStoragePath = (args) => \`restaurants/\${args.restaurantId}/models/ar-ios/\${args.dishSlug}.usdz\`;
      export const buildPreparedModelWebStoragePath = (args) => \`restaurants/\${args.restaurantId}/models/web/\${args.dishSlug}.glb\`;
      export const buildPreparedModelPublicArLiteGlbPath = (dishId) => \`/api/public/menu-dishes/\${dishId}/model/glb?variant=ar-lite\`;
      export const buildPreparedModelPublicGlbPath = (dishId) => \`/api/public/menu-dishes/\${dishId}/model/glb\`;
      export const buildPreparedModelPublicUsdzPath = (dishId) => \`/api/public/menu-dishes/\${dishId}/model/usdz\`;
    `)
  ],
  [
    "@/lib/owner/deleteDishModelAssets",
    hookedModule("export const cleanDishModelMetadata = (value) => value && typeof value === 'object' ? { ...value } : {};")
  ],
  [
    "@/lib/owner/threeDSourceUploadModel",
    hookedModule("export const sha256Hex = () => 'a'.repeat(64);")
  ],
  ["@/lib/owner/dishAssetReplacementCleanup", cleanupStub],
  ["./dishAssetReplacementCleanup.ts", cleanupStub]
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

const [meshy, viewer, usdz, usdzModel] = await Promise.all([
  import("../lib/owner/restaurantMeshyPipeline.ts"),
  import("../lib/owner/viewerGlbUpload.ts"),
  import("../lib/owner/usdzRuntimeJsonFlow.ts"),
  import("../lib/owner/usdzRuntimeModel.ts")
]);

const RESTAURANT_ID = "11111111-2222-4333-8444-555555555555";
const DISH_ID = "22222222-3333-4444-8555-666666666666";

function emptyCleanupReport(message = "") {
  return {
    candidates: [],
    deleted: [],
    skippedStillReferenced: [],
    skippedUnsafeBucket: [],
    skippedUnsafePrefix: [],
    skippedMissingPath: [],
    errors: message ? [{ bucket: "", paths: [], message }] : []
  };
}

function fakeSpawn() {
  const listeners = new Map();
  const stream = { on() { return stream; } };
  return {
    stdout: stream,
    stderr: stream,
    kill() {},
    on(event, callback) {
      listeners.set(event, callback);
      if (event === "close") queueMicrotask(() => callback(0));
      return this;
    }
  };
}

function createAdmin(events, options = {}) {
  return {
    storage: {
      from() {
        return {
          async upload() { return { data: {}, error: null }; },
          async remove(paths) {
            events.push("storage:remove");
            return { data: paths.map((name) => ({ name })), error: null };
          },
          async download(path) { return options.download(path); }
        };
      }
    },
    from(table) {
      if (table === "menu_dishes") {
        let operation = "select";
        const builder = {
          select() { return builder; },
          update() { operation = "update"; return builder; },
          eq() { return builder; },
          async maybeSingle() {
            if (operation === "update") {
              events.push("db:commit");
              return options.updateFails
                ? { data: null, error: { code: "PGRST000" } }
                : { data: { id: DISH_ID }, error: null };
            }
            return { data: { metadata: {} }, error: null };
          }
        };
        return builder;
      }
      if (table === "owner_3d_pipeline_jobs") {
        return {
          async insert() {
            events.push("job:insert");
            return { data: {}, error: null };
          }
        };
      }
      throw new Error(`unexpected table ${table}`);
    }
  };
}

function baseHooks(events) {
  return {
    existsSync: () => true,
    writeFileSync: () => {},
    readFileSync: (path) => {
      if (String(path).endsWith("manifest.json")) {
        return JSON.stringify({
          version: "meshy-v1",
          assets: {
            model3dUrl: "/models/restaurants/demo/principal/sole/model.glb",
            webModel3dUrl: "/models/restaurants/demo/principal/sole/web.glb",
            arModel3dUrl: "/models/restaurants/demo/principal/sole/ar.glb",
            arUsdzUrl: "/models/restaurants/demo/principal/sole/ar.usdz"
          },
          localPaths: {
            model3d: "model.glb",
            webModel3d: "web.glb",
            arModel3d: "ar.glb",
            arUsdz: "ar.usdz"
          },
          sha256: { meshopt: "b".repeat(64), arLite: "c".repeat(64), arUsdz: "d".repeat(64) }
        });
      }
      return Buffer.from("asset");
    },
    spawn: fakeSpawn,
    workspace: () => ({
      tempSourcePath: "C:/tmp/source.glb",
      outputRoot: "C:/tmp/output",
      cleanup() { events.push("workspace:cleanup"); }
    }),
    resolveAssetPath: ({ localPath }) => `C:/tmp/output/${localPath}`,
    cleanup: async () => emptyCleanupReport()
  };
}

test("Meshy schedules immediately after its public metadata commit and controls cleanup throws", async () => {
  const events = [];
  const hooks = baseHooks(events);
  hooks.cleanup = async () => {
    events.push("cleanup");
    throw new Error("meshy-cleanup-secret");
  };
  globalThis[hooksSymbol] = hooks;
  const adminClient = createAdmin(events, { download: async () => ({ data: null, error: null }) });

  const result = await meshy.runRestaurantMeshyDishPipeline({
    adminClient,
    owner: { userId: "owner" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "sole",
    existingMetadata: {},
    sourceBytes: Buffer.from("glb"),
    originalName: "sole.glb",
    onPublicCommit: async () => { events.push("invalidate"); }
  });

  assert.equal(result.status, "ready");
  assert.ok(events.indexOf("db:commit") < events.indexOf("invalidate"));
  assert.ok(events.indexOf("invalidate") < events.indexOf("cleanup"));
  assert.equal(events.filter((event) => event === "invalidate").length, 2);
  assert.equal(JSON.stringify(result).includes("meshy-cleanup-secret"), false);
});

test("viewer GLB schedules immediately after its public metadata commit and controls cleanup throws", async () => {
  const events = [];
  const hooks = baseHooks(events);
  hooks.cleanup = async () => {
    events.push("cleanup");
    throw new Error("viewer-cleanup-secret");
  };
  globalThis[hooksSymbol] = hooks;
  const adminClient = createAdmin(events, { download: async () => ({ data: null, error: null }) });

  const result = await viewer.runViewerGlbUpload({
    adminClient,
    owner: { userId: "owner" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "sole",
    existingMetadata: {},
    sourceBytes: Buffer.from("glb"),
    originalName: "sole.glb",
    onPublicCommit: async () => { events.push("invalidate"); }
  });

  assert.equal(result.status, "ready");
  assert.ok(events.indexOf("db:commit") < events.indexOf("invalidate"));
  assert.ok(events.indexOf("invalidate") < events.indexOf("cleanup"));
  assert.equal(events.filter((event) => event === "invalidate").length, 2);
  assert.equal(JSON.stringify(result).includes("viewer-cleanup-secret"), false);
});

function validUsdzBytes(size = 7000) {
  return Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.alloc(Math.max(8, size - 8)),
    Buffer.from([0x50, 0x4b, 0x05, 0x06])
  ]);
}

test("USDZ completion schedules after metadata commit, before cleanup, without rolling back committed assets", async () => {
  const events = [];
  const hooks = baseHooks(events);
  hooks.cleanup = async () => {
    events.push("cleanup");
    throw new Error("usdz-cleanup-secret");
  };
  globalThis[hooksSymbol] = hooks;

  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const token = usdz.createUsdzRuntimeJobToken({
    owner: { userId: "owner" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "sole",
    sourceOriginalName: "sole.usdz",
    sourceBytes: 8000,
    profile: "balanced",
    env
  });
  assert.equal(token.ok, true);
  const runtimeBytes = validUsdzBytes();
  const runtimeSha256 = usdzModel.sha256Hex(runtimeBytes);
  const version = usdz.createUsdzRuntimeSignedAssetVersion({
    profile: "balanced",
    runtimeSha256,
    jobId: token.jobId
  });
  const runtimeStoragePath = `restaurants/${RESTAURANT_ID}/models/ar-ios/sole-${version}.usdz`;
  const reportStoragePath = `restaurants/${RESTAURANT_ID}/models/manifests/sole-${version}-usdz-report.json`;
  const report = {
    reportSchemaVersion: 1,
    workerVersion: 3,
    assetKey: "usdzRuntime",
    restaurantId: RESTAURANT_ID,
    dishSlug: "sole",
    sourceStored: false,
    sourceBytes: 8000,
    sourceSha256: "b".repeat(64),
    runtimeBytes: runtimeBytes.byteLength,
    runtimeSha256,
    requestedProfile: "balanced",
    selectedProfile: "balanced",
    selectedRecipe: "balanced-max",
    profileFallbackApplied: false,
    recipeFallbackApplied: false,
    reductionPercent: 12,
    geometryOptimization: "done",
    physicalScale: {
      status: "normalized",
      dishKind: "plate",
      dimension: "height",
      minMeters: 0.1,
      maxMeters: 0.3,
      heightAfterMeters: 0.2,
      centeredX: true,
      centeredY: true,
      grounded: true
    },
    warnings: [],
    fails: []
  };
  const reportBytes = Buffer.from(JSON.stringify(report));
  const adminClient = createAdmin(events, {
    download: async (path) => ({
      data: new Blob([path.endsWith(".usdz") ? runtimeBytes : reportBytes]),
      error: null
    })
  });

  const result = await usdz.completeUsdzRuntimeSignedUpload({
    adminClient,
    env,
    input: {
      jobId: token.jobId,
      jobToken: token.token,
      profile: "balanced",
      selectedProfile: "balanced",
      selectedRecipe: "balanced-max",
      profileFallbackApplied: false,
      recipeFallbackApplied: false,
      sourceBytes: 8000,
      sourceSha256: "b".repeat(64),
      runtimeBytes: runtimeBytes.byteLength,
      runtimeSha256,
      reportBytes: reportBytes.byteLength,
      geometryOptimization: "done",
      warnings: [],
      fails: [],
      version,
      runtimeStoragePath,
      reportStoragePath
    },
    onPublicCommit: async () => { events.push("invalidate"); }
  });

  assert.equal(result.status, "ready");
  assert.ok(events.indexOf("db:commit") < events.indexOf("invalidate"));
  assert.ok(events.indexOf("invalidate") < events.indexOf("cleanup"));
  assert.equal(events.filter((event) => event === "invalidate").length, 2);
  assert.equal(events.includes("storage:remove"), false);
  assert.equal(JSON.stringify(result).includes("usdz-cleanup-secret"), false);
});

test.after(() => {
  delete globalThis[hooksSymbol];
});
