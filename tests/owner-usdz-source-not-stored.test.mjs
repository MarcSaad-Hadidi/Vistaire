import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  FORBIDDEN_SOURCE_STORAGE_FIELDS,
  assertNoForbiddenSourceStorage,
  buildUsdzRuntimeMetadataPatch,
  buildViewerGlbMetadataPatch,
  buildViewerGlbStoragePlan,
  createUsdzRuntimeAssetVersion,
  evaluateRuntimeUsdzUploadGate,
  USDZ_OPTIMIZATION_PROFILES,
  validateUsdzStructure,
  sha256Hex
} from "../lib/owner/usdzRuntimeModel.ts";
import {
  createUsdzRuntimeJobToken,
  createUsdzRuntimeSignedAssetVersion,
  completeUsdzRuntimeSignedUpload,
  prepareUsdzRuntimeSignedUpload,
  rollbackUsdzRuntimeSignedUpload,
  verifyUsdzRuntimeJobToken
} from "../lib/owner/usdzRuntimeJsonFlow.ts";
import { buildSupabasePublicMenu } from "../lib/menu/publicMenuCore.ts";
import { runUsdzRuntimePipeline } from "../lib/owner/usdzRuntimePipelineCore.ts";
import { collectTargetedDishModelDeletion } from "../lib/owner/deleteDishModelAssets.ts";
import {
  USDZ_DISH_KIND_OPTIONS,
  inferUsdzDishKind,
  resolveUsdzDishKindPreset
} from "../lib/owner/usdzDishKind.ts";

const read = (path) => readFileSync(path, "utf8");

const usdzRoute = read(
  "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/usdz-runtime/route.ts"
);
const usdzStartRoute = read(
  "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/usdz-runtime/start/route.ts"
);
const usdzPrepareRoute = read(
  "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/usdz-runtime/prepare-upload/route.ts"
);
const usdzCompleteRoute = read(
  "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/usdz-runtime/complete/route.ts"
);
const usdzFailRoute = read(
  "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/usdz-runtime/fail/route.ts"
);
const viewerRoute = read(
  "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/viewer-glb/route.ts"
);
const pipeline = read("lib/owner/usdzRuntimePipelineCore.ts");
const viewerLib = read("lib/owner/viewerGlbUpload.ts");
const cli = read("scripts/owner/optimize-restaurant-usdz.mjs");
const worker = read("scripts/owner/optimize_restaurant_usdz.py");
const localWorker = read("scripts/owner/usdz-local-worker.mjs");
const blenderOptimizer = read("scripts/owner/blender_usdz_geometry_optimizer.py");

const RESTAURANT_ID = "11111111-2222-4333-8444-555555555555";
const DISH_ID = "22222222-3333-4444-8555-666666666666";

function validUsdzBytes(size = 64) {
  const head = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const eocd = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  return Buffer.concat([head, Buffer.alloc(Math.max(8, size - 8)), eocd]);
}

function mockAdminClient(handlers = {}) {
  const removed = [];
  const updates = [];
  return {
    removed,
    updates,
    client: {
      storage: {
        from: () => ({
          upload: handlers.upload ?? (async () => ({ data: {}, error: null })),
          createSignedUploadUrl:
            handlers.createSignedUploadUrl ??
            (async (path) => ({
              data: {
                signedUrl: `https://storage.vistaire.test/object/upload/sign/${path}`,
                token: "signed-token",
                path
              },
              error: null
            })),
          download:
            handlers.download ??
            (async () => ({ data: new Blob([validUsdzBytes(7000)]), error: null })),
          remove: async (paths) => {
            removed.push(...paths);
            if (handlers.remove) return handlers.remove(paths);
            return { data: paths.map((name) => ({ name })), error: null };
          }
        })
      },
      from: (table) => {
        if (table === "menu_dishes") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle:
                    handlers.dishSelect ??
                    (async () => ({ data: { metadata: handlers.freshMetadata ?? {} }, error: null }))
                })
              })
            }),
            update: (payload) => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    maybeSingle: async () => {
                      updates.push(payload);
                      if (handlers.dishUpdate) return handlers.dishUpdate(payload);
                      return { data: { id: DISH_ID }, error: null };
                    }
                  })
                })
              })
            })
          };
        }
        if (table === "owner_3d_pipeline_jobs") {
          return {
            insert: handlers.jobInsert ?? (async () => ({ data: {}, error: null }))
          };
        }
        throw new Error(`unexpected table ${table}`);
      }
    }
  };
}

function basePipelineArgs(adminClient, optimizer) {
  return {
    adminClient,
    owner: { userId: "user_test", email: "test@vistaire.test" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "homard-grille",
    existingMetadata: { webModel3dUrl: "/api/public/menu-dishes/x/model/glb" },
    sourceBytes: validUsdzBytes(8000),
    originalName: "master.usdz",
    profile: "balanced",
    maxRuntimeBytes: 16 * 1024 * 1024,
    optimizer
  };
}

function successOptimizer(runtimeBytes, { fails = [], optimizationApplied = true } = {}) {
  return async ({ outputPath, reportPath }) => {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(outputPath, runtimeBytes);
    writeFileSync(reportPath, JSON.stringify({ ok: true }));
    return {
      ok: true,
      runtimePath: outputPath,
      reportPath,
      runtimeBytes: runtimeBytes.byteLength,
      runtimeSha256: sha256Hex(runtimeBytes),
      optimizationApplied,
      geometryOptimization: "skipped",
      reductionPercent: 10,
      warnings: [],
      fails
    };
  };
}

function extractPhysicalScaleTargets(source, constantName) {
  const start = source.indexOf(`${constantName} = {`);
  assert.notEqual(start, -1, `${constantName} must exist`);
  const endMatch = /\r?\n}\r?\n/.exec(source.slice(start));
  assert.ok(endMatch, `${constantName} must have a simple dict body`);
  const block = source.slice(start, start + endMatch.index);
  const targets = {};
  for (const match of block.matchAll(
    /"([^"]+)": \{"dimension": "([^"]+)", "targetMeters": ([0-9.]+), "minMeters": ([0-9.]+), "maxMeters": ([0-9.]+)\}/g
  )) {
    targets[match[1]] = {
      dimension: match[2],
      targetMeters: Number(match[3]),
      minMeters: Number(match[4]),
      maxMeters: Number(match[5])
    };
  }
  return targets;
}

test("forbidden source-storage fields are never persisted by the runtime pipeline", () => {
  // The only file allowed to mention these strings is the guard list itself.
  for (const field of FORBIDDEN_SOURCE_STORAGE_FIELDS) {
    assert.doesNotMatch(pipeline, new RegExp(field), `pipeline must not persist ${field}`);
    assert.doesNotMatch(usdzRoute, new RegExp(field), `route must not persist ${field}`);
    assert.doesNotMatch(viewerLib, new RegExp(field), `viewer lib must not persist ${field}`);
  }
  assert.equal(FORBIDDEN_SOURCE_STORAGE_FIELDS.includes("usdzSourceStoragePath"), true);
  assert.equal(FORBIDDEN_SOURCE_STORAGE_FIELDS.includes("masterUsdzStoragePath"), true);
  assert.equal(FORBIDDEN_SOURCE_STORAGE_FIELDS.includes("sourceUsdzPublicUrl"), true);
});

test("assertNoForbiddenSourceStorage throws for each forbidden field", () => {
  for (const field of FORBIDDEN_SOURCE_STORAGE_FIELDS) {
    assert.throws(
      () => assertNoForbiddenSourceStorage({ [field]: "restaurants/x/models/source/heavy.usdz" }),
      new RegExp(field)
    );
  }
  assert.doesNotThrow(() =>
    assertNoForbiddenSourceStorage({ arUsdzUrl: "/api/public/x", usdzSourceStored: false })
  );
});

test("runtime metadata patch stores only runtime + non-binary source metadata", () => {
  const patch = buildUsdzRuntimeMetadataPatch(
    {
      restaurantId: "11111111-2222-4333-8444-555555555555",
      dishId: "11111111-2222-4333-8444-555555555555",
      dishSlug: "homard-grille",
      version: "20260704-abcdef12",
      runtimeBytes: 6_000_000,
      runtimeSha256: "a".repeat(64),
    reportStoragePath: "restaurants/x/models/manifests/homard.json",
    profile: "balanced",
    warnings: [],
    fails: [],
    reductionPercent: 72,
    geometryOptimization: "done",
    triangleCountBefore: 240000,
    triangleCountAfter: 132000,
    geometryReductionPercent: 45,
    physicalScale: {
      status: "normalized",
      dishKind: "burger",
      dimension: "height",
      targetMeters: 0.15,
      minMeters: 0.1,
      maxMeters: 0.22,
      heightBeforeMeters: 0.03,
      widthBeforeMeters: 0.08,
      depthBeforeMeters: 0.07,
      footprintBeforeMeters: 0.08,
      heightAfterMeters: 0.15,
      widthAfterMeters: 0.4,
      depthAfterMeters: 0.35,
      footprintAfterMeters: 0.4,
      centeredX: true,
      centeredY: true,
      grounded: true,
      centerOffsetBeforeMeters: 0.12,
      centerOffsetAfterMeters: 0,
      scaleFactor: 5,
      warnings: ["Scale factor above 4"]
    },
    textureCount: 4,
    changedTextures: 2,
    attemptCount: 2,
    candidateAttempts: [{ profile: "balanced", passedBudget: true }],
    source: {
        originalName: "master.usdz",
        bytes: 120_000_000,
        sha256: "b".repeat(64),
        processedAt: "2026-07-04T00:00:00.000Z"
      },
      uploadedAt: "2026-07-04T00:00:00.000Z"
    },
    "restaurants/x/models/ar-ios/homard-grille-20260704-abcdef12.usdz"
  );

  assert.equal(patch.usdzSourceStored, false);
  assert.equal(patch.usdzSourceRetention, "none");
  assert.equal(patch.usdzUrl, "");
  assert.equal(patch.quickLookQaStatus, "not-tested");
  assert.equal(patch.usdzGeometryOptimization, "done");
  assert.equal(patch.usdzPhysicalScaleStatus, "normalized");
  assert.equal(patch.usdzPhysicalScaleDishKind, "burger");
  assert.equal(patch.usdzPhysicalScaleDimension, "height");
  assert.equal(patch.usdzPhysicalScaleHeightAfterMeters, 0.15);
  assert.equal(patch.usdzPhysicalScaleFootprintBeforeMeters, 0.08);
  assert.equal(patch.usdzPhysicalScaleFootprintAfterMeters, 0.4);
  assert.equal(patch.usdzPhysicalScaleCenteredX, true);
  assert.equal(patch.usdzPhysicalScaleCenteredY, true);
  assert.equal(patch.usdzPhysicalScaleGrounded, true);
  assert.equal(patch.usdzPhysicalScaleScaleFactor, 5);
  assert.deepEqual(patch.usdzPhysicalScaleWarnings, ["Scale factor above 4"]);
  assert.equal(patch.usdzTriangleCountBefore, 240000);
  assert.equal(patch.usdzTriangleCountAfter, 132000);
  assert.equal(patch.usdzOptimizationAttemptCount, 2);
  assert.equal(patch.usdzSourceBytes, 120_000_000);
  assert.equal(patch.usdzSourceOriginalName, "master.usdz");
  assert.ok(String(patch.arUsdzUrl).startsWith("/api/public/menu-dishes/"));
  // No storage path field for the source may exist.
  for (const field of FORBIDDEN_SOURCE_STORAGE_FIELDS) {
    assert.equal(field in patch, false);
  }
  assert.doesNotThrow(() => assertNoForbiddenSourceStorage(patch));
});

test("runtime asset version and storage path change when the same source is processed with a different profile", async () => {
  const runtimeBytes = validUsdzBytes(7000);
  const runtimeSha256 = sha256Hex(runtimeBytes);

  async function runForProfile(profile) {
    const uploads = [];
    const { client } = mockAdminClient({
      upload: async (path) => {
        uploads.push(path);
        return { data: {}, error: null };
      }
    });
    const result = await runUsdzRuntimePipeline({
      ...basePipelineArgs(client, successOptimizer(runtimeBytes)),
      profile
    });
    return { result, uploads };
  }

  const premium = await runForProfile("premium");
  const light = await runForProfile("light");

  assert.equal(
    premium.result.version,
    createUsdzRuntimeAssetVersion({ profile: "premium", runtimeSha256 })
  );
  assert.equal(
    light.result.version,
    createUsdzRuntimeAssetVersion({ profile: "light", runtimeSha256 })
  );
  assert.notEqual(premium.result.version, light.result.version);
  assert.notEqual(premium.uploads[0], light.uploads[0]);
  assert.ok(premium.result.arUsdzUrl.endsWith(`?v=${premium.result.version}`));
  assert.ok(light.result.arUsdzUrl.endsWith(`?v=${light.result.version}`));
});

test("runtime upload gate blocks bad output and passes a valid runtime", () => {
  const runtime = validUsdzBytes(6000);
  const good = evaluateRuntimeUsdzUploadGate({
    runtimeBytes: runtime,
    sourceBytes: 120_000_000,
    sourceSha256: "b".repeat(64),
    maxRuntimeBytes: 16 * 1024 * 1024,
    reportGenerated: true,
    sourceCleaned: true,
    optimizationExpected: true
  });
  assert.equal(good.ok, true);
  assert.equal(good.runtimeSha256, sha256Hex(runtime));

  const noReport = evaluateRuntimeUsdzUploadGate({
    runtimeBytes: runtime,
    sourceBytes: 10,
    sourceSha256: "c".repeat(64),
    maxRuntimeBytes: 16 * 1024 * 1024,
    reportGenerated: false,
    sourceCleaned: true,
    optimizationExpected: false
  });
  assert.equal(noReport.ok, false);

  const tooBig = evaluateRuntimeUsdzUploadGate({
    runtimeBytes: runtime,
    sourceBytes: 10,
    sourceSha256: "c".repeat(64),
    maxRuntimeBytes: 100,
    reportGenerated: true,
    sourceCleaned: true,
    optimizationExpected: false
  });
  assert.equal(tooBig.ok, false);

  const identical = evaluateRuntimeUsdzUploadGate({
    runtimeBytes: runtime,
    sourceBytes: runtime.byteLength,
    sourceSha256: sha256Hex(runtime),
    maxRuntimeBytes: 16 * 1024 * 1024,
    reportGenerated: true,
    sourceCleaned: true,
    optimizationExpected: true
  });
  assert.equal(identical.ok, false);

  const badStructure = evaluateRuntimeUsdzUploadGate({
    runtimeBytes: Buffer.from("not a zip at all, definitely not usdz padding padding"),
    sourceBytes: 10,
    sourceSha256: "c".repeat(64),
    maxRuntimeBytes: 16 * 1024 * 1024,
    reportGenerated: true,
    sourceCleaned: true,
    optimizationExpected: false
  });
  assert.equal(badStructure.ok, false);

  const sourceNotCleaned = evaluateRuntimeUsdzUploadGate({
    runtimeBytes: runtime,
    sourceBytes: 120_000_000,
    sourceSha256: "b".repeat(64),
    maxRuntimeBytes: 16 * 1024 * 1024,
    reportGenerated: true,
    sourceCleaned: false,
    optimizationExpected: true
  });
  assert.equal(sourceNotCleaned.ok, false);
  if (!sourceNotCleaned.ok) {
    assert.match(sourceNotCleaned.error, /source/i);
  }
});

test("validateUsdzStructure rejects LFS pointers and bad magic", () => {
  assert.equal(validateUsdzStructure(validUsdzBytes()), null);
  assert.match(
    String(validateUsdzStructure(Buffer.from("version https://git-lfs.github.com/spec/v1\noid sha256:x"))),
    /LFS/
  );
  assert.match(String(validateUsdzStructure(Buffer.alloc(64))), /Signature/);
});

test("USDZ dish kind auto inference is generic and category-first", () => {
  assert.equal(inferUsdzDishKind({ dishName: "Chocolate cake", category: "Desserts" }), "dessert");
  assert.equal(inferUsdzDishKind({ dishName: "Signature burger", category: "Soupes" }), "bowl");
  assert.equal(inferUsdzDishKind({ dishName: "Margherita", category: "Pizzas" }), "pizza");
  assert.equal(inferUsdzDishKind({ dishName: "Chef selection", category: "Sharing plates" }), "platter");
  assert.equal(inferUsdzDishKind({ dishName: "Sea bass", category: "Mains" }), "plate");
  assert.equal(inferUsdzDishKind({ dishName: "Mystery item", category: "" }), "fallback");
  assert.equal(inferUsdzDishKind({ dishName: "The Grill", category: "" }), "plate");
  assert.equal(inferUsdzDishKind({ dishName: "The steak", category: "Mains" }), "plate");
  assert.equal(inferUsdzDishKind({ dishName: "Th\u00e9 glac\u00e9", category: "" }), "drink");
  assert.equal(inferUsdzDishKind({ dishName: "Iced tea", category: "" }), "drink");
});

test("manual USDZ dish kind preset overrides auto inference", () => {
  assert.equal(
    resolveUsdzDishKindPreset({
      selectedPreset: "platter",
      dishName: "Chocolate cake",
      category: "Desserts"
    }),
    "platter"
  );
  assert.equal(
    resolveUsdzDishKindPreset({
      selectedPreset: "auto",
      dishName: "Chocolate cake",
      category: "Desserts"
    }),
    "dessert"
  );
});

test("USDZ dish kind presets are generic and include platter", () => {
  assert.ok(USDZ_DISH_KIND_OPTIONS.some((option) => option.value === "platter"));
  const source = read("lib/owner/usdzDishKind.ts");
  assert.doesNotMatch(source, /trouvable|homard|ravioles|maison.?elyse|dejeuner-classique/i);
});

test("usdz-runtime route uploads only after optimization and reports source not stored", () => {
  assert.match(usdzRoute, /runtime = "nodejs"/);
  assert.match(usdzRoute, /Upload USDZ direct desactive/);
  assert.match(usdzRoute, /usdzSourceStored: false/);
  assert.doesNotMatch(usdzRoute, /request\.formData\(/);
  assert.doesNotMatch(usdzRoute, /File/);
  assert.doesNotMatch(usdzRoute, /runUsdzRuntimePipeline/);
  assert.doesNotMatch(usdzRoute, /storage[\s\S]{0,40}\.upload\(/);
});

test("usdz runtime JSON lifecycle routes never parse multipart files", () => {
  const lifecycleRoutes = [usdzStartRoute, usdzPrepareRoute, usdzCompleteRoute, usdzFailRoute].join("\n");
  assert.doesNotMatch(lifecycleRoutes, /request\.formData\(/);
  assert.doesNotMatch(lifecycleRoutes, /FormData/);
  assert.match(usdzStartRoute, /request\.json\(\)/);
  assert.match(usdzPrepareRoute, /request\.json\(\)/);
  assert.match(usdzCompleteRoute, /request\.json\(\)/);
  assert.match(usdzFailRoute, /request\.json\(\)/);
  assert.match(usdzStartRoute, /requireVistaireOwnerApi\(\)/);
  assert.match(usdzStartRoute, /requireSameOriginOwnerMutation\(request\)/);
  assert.match(usdzPrepareRoute, /assertUsdzRuntimeJobClaimsMatchRoute/);
  assert.match(usdzCompleteRoute, /assertUsdzRuntimeJobClaimsMatchRoute/);
  assert.match(usdzFailRoute, /assertUsdzRuntimeJobClaimsMatchRoute/);
  assert.match(lifecycleRoutes, /jobToken/);
  assert.match(lifecycleRoutes, /usdzSourceStored: false/);
});

test("prepare-upload signs only runtime USDZ and report JSON paths", async () => {
  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const token = createUsdzRuntimeJobToken({
    owner: { userId: "user_test", email: "owner@vistaire.test" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "homard-grille",
    sourceOriginalName: "master.usdz",
    sourceBytes: 8000,
    profile: "balanced",
    env
  });
  assert.equal(token.ok, true);
  const signedPaths = [];
  const { client } = mockAdminClient({
    createSignedUploadUrl: async (path) => {
      signedPaths.push(path);
      return {
        data: {
          signedUrl: `https://storage.vistaire.test/object/upload/sign/${path}`,
          token: "signed-token",
          path
        },
        error: null
      };
    }
  });

  const runtimeBytes = validUsdzBytes(7000);
  const prepared = await prepareUsdzRuntimeSignedUpload({
    adminClient: client,
    env,
    maxRuntimeBytes: 16 * 1024 * 1024,
    input: {
      jobId: token.jobId,
      jobToken: token.token,
      profile: "balanced",
      sourceBytes: 8000,
      sourceSha256: "b".repeat(64),
      runtimeBytes: runtimeBytes.byteLength,
      runtimeSha256: sha256Hex(runtimeBytes),
      reportBytes: 512,
      geometryOptimization: "done",
      warnings: [],
      fails: []
    }
  });

  assert.equal(prepared.ok, true);
  assert.equal(signedPaths.length, 2);
  assert.ok(signedPaths[0].includes("/models/ar-ios/"));
  assert.ok(signedPaths[0].endsWith(".usdz"));
  assert.ok(signedPaths[1].includes("/models/manifests/"));
  assert.ok(signedPaths[1].endsWith("-usdz-report.json"));
  assert.doesNotMatch(signedPaths.join("\n"), /source|master|raw|candidate/i);
});

test("prepare-upload enforces the selected profile byte budget", async () => {
  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const token = createUsdzRuntimeJobToken({
    owner: { userId: "user_test", email: "owner@vistaire.test" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "homard-grille",
    sourceOriginalName: "master.usdz",
    sourceBytes: 20 * 1024 * 1024,
    profile: "emergency",
    env
  });
  assert.equal(token.ok, true);
  const { client } = mockAdminClient();

  await assert.rejects(
    () =>
      prepareUsdzRuntimeSignedUpload({
        adminClient: client,
        env,
        maxRuntimeBytes: 16 * 1024 * 1024,
        input: {
          jobId: token.jobId,
          jobToken: token.token,
          profile: "emergency",
          sourceBytes: 20 * 1024 * 1024,
          sourceSha256: "b".repeat(64),
          runtimeBytes: 6 * 1024 * 1024,
          runtimeSha256: "a".repeat(64),
          reportBytes: 512,
          geometryOptimization: "done",
          warnings: [],
          fails: []
        }
      }),
    /limite runtime/
  );
});

test("light profile budget accepts a mobile-safe runtime without signing source storage", async () => {
  assert.equal(USDZ_OPTIMIZATION_PROFILES.light.targetMaxBytes, 10 * 1024 * 1024);
  assert.equal(
    USDZ_OPTIMIZATION_PROFILES.emergency.targetMaxBytes,
    5.5 * 1024 * 1024
  );

  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const token = createUsdzRuntimeJobToken({
    owner: { userId: "user_test", email: "owner@vistaire.test" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "homard-grille",
    sourceOriginalName: "master.usdz",
    sourceBytes: 26 * 1024 * 1024,
    profile: "light",
    env
  });
  assert.equal(token.ok, true);

  const signedPaths = [];
  const { client } = mockAdminClient({
    createSignedUploadUrl: async (path) => {
      signedPaths.push(path);
      return {
        data: {
          signedUrl: `https://storage.vistaire.test/object/upload/sign/${path}`,
          token: "signed-token",
          path
        },
        error: null
      };
    }
  });

  const prepared = await prepareUsdzRuntimeSignedUpload({
    adminClient: client,
    env,
    maxRuntimeBytes: 16 * 1024 * 1024,
    input: {
      jobId: token.jobId,
      jobToken: token.token,
      profile: "light",
      sourceBytes: 26 * 1024 * 1024,
      sourceSha256: "b".repeat(64),
      runtimeBytes: 9 * 1024 * 1024,
      runtimeSha256: "a".repeat(64),
      reportBytes: 512,
      geometryOptimization: "done",
      warnings: [],
      fails: []
    }
  });

  assert.equal(prepared.ok, true);
  assert.deepEqual(signedPaths, [prepared.runtimeStoragePath, prepared.reportStoragePath]);
  assert.doesNotMatch(signedPaths.join("\n"), /source|master|raw|candidate/i);
});

test("signed upload retry gets a job-scoped runtime path", async () => {
  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const runtimeSha256 = "a".repeat(64);
  async function prepareForJob() {
    const token = createUsdzRuntimeJobToken({
      owner: { userId: "user_test", email: "owner@vistaire.test" },
      restaurantId: RESTAURANT_ID,
      restaurantSlug: "demo",
      menuSlug: "principal",
      dishId: DISH_ID,
      dishSlug: "homard-grille",
      sourceOriginalName: "master.usdz",
      sourceBytes: 8000,
      profile: "balanced",
      env
    });
    assert.equal(token.ok, true);
    const { client } = mockAdminClient();
    return prepareUsdzRuntimeSignedUpload({
      adminClient: client,
      env,
      maxRuntimeBytes: 16 * 1024 * 1024,
      input: {
        jobId: token.jobId,
        jobToken: token.token,
        profile: "balanced",
        sourceBytes: 8000,
        sourceSha256: "b".repeat(64),
        runtimeBytes: 7000,
        runtimeSha256,
        reportBytes: 512,
        geometryOptimization: "done",
        warnings: [],
        fails: []
      }
    });
  }

  const first = await prepareForJob();
  const retry = await prepareForJob();
  assert.notEqual(first.version, retry.version);
  assert.notEqual(first.runtimeStoragePath, retry.runtimeStoragePath);
  assert.notEqual(first.reportStoragePath, retry.reportStoragePath);
});

test("complete rejects report JSON that does not prove sourceStored false", async () => {
  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const token = createUsdzRuntimeJobToken({
    owner: { userId: "user_test", email: "owner@vistaire.test" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "homard-grille",
    sourceOriginalName: "master.usdz",
    sourceBytes: 8000,
    profile: "balanced",
    env
  });
  assert.equal(token.ok, true);
  const runtimeBytes = validUsdzBytes(7000);
  const runtimeSha256 = sha256Hex(runtimeBytes);
  const version = createUsdzRuntimeSignedAssetVersion({
    profile: "balanced",
    runtimeSha256,
    jobId: token.jobId
  });
  const runtimeStoragePath = `restaurants/${RESTAURANT_ID}/models/ar-ios/homard-grille-${version}.usdz`;
  const reportStoragePath = `restaurants/${RESTAURANT_ID}/models/manifests/homard-grille-${version}-usdz-report.json`;
  const { client, removed } = mockAdminClient({
    download: async (path) => ({
      data: new Blob([
        path.endsWith(".usdz")
          ? runtimeBytes
          : Buffer.from(JSON.stringify({ sourceStored: true }))
      ]),
      error: null
    })
  });

  await assert.rejects(
    () =>
      completeUsdzRuntimeSignedUpload({
        adminClient: client,
        env,
        input: {
          jobId: token.jobId,
          jobToken: token.token,
          profile: "balanced",
          sourceBytes: 8000,
          sourceSha256: "b".repeat(64),
          runtimeBytes: runtimeBytes.byteLength,
          runtimeSha256,
          reportBytes: Buffer.byteLength(JSON.stringify({ sourceStored: true })),
          geometryOptimization: "done",
          warnings: [],
          fails: [],
          version,
          runtimeStoragePath,
          reportStoragePath
        }
      }),
    /sourceStored/
  );
  assert.deepEqual(removed, [runtimeStoragePath, reportStoragePath]);
});

test("complete rejects stale worker reports without physical scale metrics", async () => {
  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const token = createUsdzRuntimeJobToken({
    owner: { userId: "user_test", email: "owner@vistaire.test" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "homard-grille",
    sourceOriginalName: "master.usdz",
    sourceBytes: 8000,
    profile: "balanced",
    env
  });
  assert.equal(token.ok, true);
  const runtimeBytes = validUsdzBytes(7000);
  const runtimeSha256 = sha256Hex(runtimeBytes);
  const version = createUsdzRuntimeSignedAssetVersion({
    profile: "balanced",
    runtimeSha256,
    jobId: token.jobId
  });
  const runtimeStoragePath = `restaurants/${RESTAURANT_ID}/models/ar-ios/homard-grille-${version}.usdz`;
  const reportStoragePath = `restaurants/${RESTAURANT_ID}/models/manifests/homard-grille-${version}-usdz-report.json`;
  const report = {
    sourceStored: false,
    reductionPercent: 12,
    geometryOptimization: "done",
    warnings: [],
    fails: []
  };
  const { client, removed, updates } = mockAdminClient({
    download: async (path) => ({
      data: new Blob([path.endsWith(".usdz") ? runtimeBytes : Buffer.from(JSON.stringify(report))]),
      error: null
    })
  });

  await assert.rejects(
    () =>
      completeUsdzRuntimeSignedUpload({
        adminClient: client,
        env,
        input: {
          jobId: token.jobId,
          jobToken: token.token,
          profile: "balanced",
          sourceBytes: 8000,
          sourceSha256: "b".repeat(64),
          runtimeBytes: runtimeBytes.byteLength,
          runtimeSha256,
          reportBytes: Buffer.byteLength(JSON.stringify(report)),
          geometryOptimization: "done",
          warnings: [],
          fails: [],
          version,
          runtimeStoragePath,
          reportStoragePath
        }
      }),
    /physicalScale requis/
  );
  assert.deepEqual(removed, [runtimeStoragePath, reportStoragePath]);
  assert.equal(updates.length, 0);
});

test("fail rollback removes only the signed runtime after report upload fails", async () => {
  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const token = createUsdzRuntimeJobToken({
    owner: { userId: "user_test", email: "owner@vistaire.test" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "homard-grille",
    sourceOriginalName: "master.usdz",
    sourceBytes: 8000,
    profile: "balanced",
    env
  });
  assert.equal(token.ok, true);
  const runtimeSha256 = "a".repeat(64);
  const version = createUsdzRuntimeSignedAssetVersion({
    profile: "balanced",
    runtimeSha256,
    jobId: token.jobId
  });
  const runtimeStoragePath = `restaurants/${RESTAURANT_ID}/models/ar-ios/homard-grille-${version}.usdz`;
  const { client, removed } = mockAdminClient();

  const rollback = await rollbackUsdzRuntimeSignedUpload({
    adminClient: client,
    env,
    input: {
      jobId: token.jobId,
      jobToken: token.token,
      profile: "balanced",
      sourceBytes: 8000,
      sourceSha256: "b".repeat(64),
      runtimeBytes: 7000,
      runtimeSha256,
      reportBytes: 512,
      geometryOptimization: "done",
      warnings: [],
      fails: [],
      version,
      runtimeStoragePath
    }
  });

  assert.equal(rollback.ok, true);
  assert.deepEqual(removed, [runtimeStoragePath]);
});

test("fail rollback refuses source master raw and candidate paths", async () => {
  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const token = createUsdzRuntimeJobToken({
    owner: { userId: "user_test", email: "owner@vistaire.test" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "homard-grille",
    sourceOriginalName: "master.usdz",
    sourceBytes: 8000,
    profile: "balanced",
    env
  });
  assert.equal(token.ok, true);
  const runtimeSha256 = "a".repeat(64);
  const version = createUsdzRuntimeSignedAssetVersion({
    profile: "balanced",
    runtimeSha256,
    jobId: token.jobId
  });
  const { client, removed } = mockAdminClient();

  for (const path of [
    `restaurants/${RESTAURANT_ID}/models/source/master.usdz`,
    `restaurants/${RESTAURANT_ID}/models/raw/candidate.usdz`,
    `restaurants/${RESTAURANT_ID}/models/candidates/runtime.usdz`
  ]) {
    await assert.rejects(
      () =>
        rollbackUsdzRuntimeSignedUpload({
          adminClient: client,
          env,
          input: {
            jobId: token.jobId,
            jobToken: token.token,
            profile: "balanced",
            sourceBytes: 8000,
            sourceSha256: "b".repeat(64),
            runtimeBytes: 7000,
            runtimeSha256,
            reportBytes: 512,
            geometryOptimization: "done",
            warnings: [],
            fails: [],
            version,
            runtimeStoragePath: path
          }
        }),
      /Chemin rollback runtime USDZ invalide/
    );
  }
  assert.deepEqual(removed, []);
});

test("complete publishes metrics from the uploaded report, not client JSON", async () => {
  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const token = createUsdzRuntimeJobToken({
    owner: { userId: "user_test", email: "owner@vistaire.test" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "homard-grille",
    sourceOriginalName: "master.usdz",
    sourceBytes: 8000,
    profile: "balanced",
    env
  });
  assert.equal(token.ok, true);
  const runtimeBytes = validUsdzBytes(7000);
  const runtimeSha256 = sha256Hex(runtimeBytes);
  const version = createUsdzRuntimeSignedAssetVersion({
    profile: "balanced",
    runtimeSha256,
    jobId: token.jobId
  });
  const runtimeStoragePath = `restaurants/${RESTAURANT_ID}/models/ar-ios/homard-grille-${version}.usdz`;
  const reportStoragePath = `restaurants/${RESTAURANT_ID}/models/manifests/homard-grille-${version}-usdz-report.json`;
  const report = {
    sourceStored: false,
    reductionPercent: 12,
    geometryOptimization: "done",
    triangleCountBefore: 240000,
    triangleCountAfter: 120000,
    geometryReductionPercent: 50,
    textureCount: 4,
    changedTextures: 2,
    physicalScale: {
      status: "normalized",
      dishKind: "burger",
      dimension: "height",
      targetMeters: 0.15,
      minMeters: 0.1,
      maxMeters: 0.22,
      heightBeforeMeters: 0.03,
      widthBeforeMeters: 0.08,
      depthBeforeMeters: 0.07,
      footprintBeforeMeters: 0.08,
      heightAfterMeters: 0.15,
      widthAfterMeters: 0.4,
      depthAfterMeters: 0.35,
      footprintAfterMeters: 0.4,
      centeredX: true,
      centeredY: true,
      grounded: true,
      scaleFactor: 5,
      warnings: ["Scale factor above 4"]
    },
    attemptCount: 1,
    candidateAttempts: [
      { profile: "balanced", targetBytes: 8000, runtimeBytes: 7000, passedBudget: true }
    ],
    warnings: ["normal map missing"],
    fails: []
  };
  const { client, updates } = mockAdminClient({
    download: async (path) => ({
      data: new Blob([path.endsWith(".usdz") ? runtimeBytes : Buffer.from(JSON.stringify(report))]),
      error: null
    })
  });

  const result = await completeUsdzRuntimeSignedUpload({
    adminClient: client,
    env,
    input: {
      jobId: token.jobId,
      jobToken: token.token,
      profile: "balanced",
      sourceBytes: 8000,
      sourceSha256: "b".repeat(64),
      runtimeBytes: runtimeBytes.byteLength,
      runtimeSha256,
      reportBytes: Buffer.byteLength(JSON.stringify(report)),
      geometryOptimization: "skipped",
      warnings: ["client warning should not persist"],
      fails: [],
      reductionPercent: 99,
      triangleCountBefore: 1,
      triangleCountAfter: 1,
      version,
      runtimeStoragePath,
      reportStoragePath
    }
  });

  assert.equal(result.geometryOptimization, "done");
  assert.equal(result.reductionPercent, 12);
  assert.deepEqual(result.warnings, ["normal map missing"]);
  assert.equal(updates[0].metadata.usdzGeometryOptimization, "done");
  assert.equal(updates[0].metadata.usdzPhysicalScaleStatus, "normalized");
  assert.equal(updates[0].metadata.usdzPhysicalScaleDishKind, "burger");
  assert.equal(updates[0].metadata.usdzPhysicalScaleHeightAfterMeters, 0.15);
  assert.equal(updates[0].metadata.usdzPhysicalScaleFootprintAfterMeters, 0.4);
  assert.equal(updates[0].metadata.usdzPhysicalScaleCenteredX, true);
  assert.equal(updates[0].metadata.usdzPhysicalScaleCenteredY, true);
  assert.equal(updates[0].metadata.usdzPhysicalScaleGrounded, true);
  assert.deepEqual(updates[0].metadata.usdzPhysicalScaleWarnings, ["Scale factor above 4"]);
  assert.equal(updates[0].metadata.usdzTriangleCountBefore, 240000);
  assert.equal(updates[0].metadata.usdzTriangleCountAfter, 120000);
  assert.equal(updates[0].metadata.usdzOptimizationAttemptCount, 1);
});

test("jobToken verification rejects tampering and expiry", () => {
  const env = { VISTAIRE_USDZ_JOB_TOKEN_SECRET: "x".repeat(48) };
  const nowMs = Date.parse("2026-07-04T00:00:00.000Z");
  const token = createUsdzRuntimeJobToken({
    owner: { userId: "user_test" },
    restaurantId: RESTAURANT_ID,
    restaurantSlug: "demo",
    menuSlug: "principal",
    dishId: DISH_ID,
    dishSlug: "homard-grille",
    sourceOriginalName: "master.usdz",
    sourceBytes: 8000,
    profile: "balanced",
    nowMs,
    env
  });
  assert.equal(token.ok, true);
  assert.equal(verifyUsdzRuntimeJobToken(token.token, env, nowMs + 1000).ok, true);
  assert.equal(verifyUsdzRuntimeJobToken(`${token.token}x`, env, nowMs + 1000).ok, false);
  assert.equal(verifyUsdzRuntimeJobToken(token.token, env, nowMs + 31 * 60 * 1000).ok, false);
});

test("usdz runtime pipeline gates before upload, uploads runtime only, and cleans temp in finally", () => {
  const gateIndex = pipeline.indexOf("evaluateRuntimeUsdzUploadGate");
  const sourceDeleteIndex = pipeline.indexOf("rmSync(sourcePath");
  const uploadIndex = pipeline.indexOf(".upload(runtimeStoragePath");
  assert.ok(gateIndex > -1, "gate must be called");
  assert.ok(sourceDeleteIndex > -1, "source must be deleted before upload");
  assert.ok(uploadIndex > -1, "runtime upload must exist");
  assert.ok(sourceDeleteIndex < uploadIndex, "source must be deleted before runtime upload");
  assert.ok(gateIndex < uploadIndex, "gate must be evaluated before runtime upload");

  // The source buffer/path is never uploaded.
  assert.doesNotMatch(pipeline, /\.upload\(\s*sourcePath/);
  assert.doesNotMatch(pipeline, /\.upload\([^)]*source\.usdz/);
  assert.match(pipeline, /writeFileSync\(sourcePath/);
  assert.match(pipeline, /const sourceCleaned = !existsSync\(sourcePath\)/);
  assert.match(pipeline, /uploadedReport\.error/);
  assert.match(pipeline, /rollbackStorageObjects/);
  assert.match(pipeline, /summary\.fails\.length > 0/);
  assert.match(pipeline, /\.upload\(runtimeStoragePath/);
  assert.match(pipeline, /\.upload\(reportStoragePath/);
  assert.match(pipeline, /finally\s*{\s*[\s\S]*rmSync\(workspace/);
  assert.match(pipeline, /assertNoForbiddenSourceStorage/);
});

test("viewer GLB metadata patch does not set arModel3dUrl or AR-lite storage fields", () => {
  const plan = buildViewerGlbStoragePlan({
    restaurantId: RESTAURANT_ID,
    dishSlug: "homard-grille",
    version: "20260704-abcdef12"
  });
  const patch = buildViewerGlbMetadataPatch(
    {
      restaurantId: RESTAURANT_ID,
      dishId: DISH_ID,
      dishSlug: "homard-grille",
      version: "20260704-abcdef12",
      bytes: 2_500_000,
      sha256: "a".repeat(64),
      originalName: "viewer.glb",
      uploadedAt: "2026-07-04T00:00:00.000Z"
    },
    plan
  );

  assert.ok(String(patch.webModel3dUrl).startsWith("/api/public/menu-dishes/"));
  assert.equal("arModel3dUrl" in patch, false);
  assert.equal("arModel3dStoragePath" in patch, false);
  assert.equal("arModel3dStorageBucket" in patch, false);
  assert.equal("arModel3dBytes" in patch, false);
  assert.equal("arLiteStoragePath" in plan, false);
});

test("viewer GLB upload lib does not copy AR-lite to Storage", () => {
  assert.doesNotMatch(viewerLib, /arLiteStoragePath/);
  assert.doesNotMatch(viewerLib, /plan\.arLiteStoragePath/);
  assert.match(viewerLib, /VIEWER_GLB_CLEARED_AR_LITE_FIELDS/);
  assert.equal(viewerLib.includes("await uploadGlb(args.adminClient, plan.webStoragePath"), true);
  assert.equal(
    (viewerLib.match(/await uploadGlb\(/g) ?? []).length,
    1,
    "only one GLB upload (web viewer) is allowed"
  );
});

test("hasAndroidAr stays false when only GLB viewer metadata exists", () => {
  const menu = buildSupabasePublicMenu(
    "demo",
    { id: RESTAURANT_ID, slug: "demo", name: "Demo" },
    [
      {
        id: DISH_ID,
        restaurant_id: RESTAURANT_ID,
        name: "Homard grille",
        slug: "homard-grille",
        metadata: {
          webModel3dUrl: `/api/public/menu-dishes/${DISH_ID}/model/glb?v=20260704-abcdef12`,
          webModel3dStoragePath: `restaurants/${RESTAURANT_ID}/models/web/homard-grille-20260704-abcdef12.glb`,
          viewerGlbStatus: "ready"
        }
      }
    ]
  );

  const dish = menu.dishes[0];
  assert.equal(dish.has3d, true);
  assert.equal(dish.hasAndroidAr, false);
  assert.equal(dish.hasIosAr, false);
  assert.equal(dish.arModel3dUrl, "");
});

test("summary.fails blocks USDZ runtime upload", async () => {
  const uploads = [];
  const { client } = mockAdminClient({
    upload: async (path) => {
      uploads.push(path);
      return { data: {}, error: null };
    }
  });

  await assert.rejects(
    () =>
      runUsdzRuntimePipeline({
        ...basePipelineArgs(client, successOptimizer(validUsdzBytes(7000), { fails: ["glossy material"] }))
      }),
    /Optimisation USDZ bloquee/
  );
  assert.equal(uploads.length, 0);
});

test("report upload error rolls back runtime from Storage", async () => {
  const uploads = [];
  const { client, removed } = mockAdminClient({
    upload: async (path) => {
      uploads.push(path);
      if (path.endsWith("-usdz-report.json")) {
        return { data: null, error: { message: "report failed" } };
      }
      return { data: {}, error: null };
    }
  });

  await assert.rejects(
    () =>
      runUsdzRuntimePipeline({
        ...basePipelineArgs(client, successOptimizer(validUsdzBytes(7000)))
      }),
    /rapport d'optimisation USDZ/
  );
  assert.equal(uploads.length, 2);
  assert.deepEqual(removed, [uploads[0]]);
});

test("metadata update error rolls back runtime and report from Storage", async () => {
  const uploads = [];
  const { client, removed } = mockAdminClient({
    upload: async (path) => {
      uploads.push(path);
      return { data: {}, error: null };
    },
    dishUpdate: async () => ({ data: null, error: { message: "db failed" } })
  });

  await assert.rejects(
    () =>
      runUsdzRuntimePipeline({
        ...basePipelineArgs(client, successOptimizer(validUsdzBytes(7000)))
      }),
    /Plat impossible a mettre a jour/
  );
  assert.equal(uploads.length, 2);
  assert.deepEqual(removed, uploads);
});

test("runtime pipeline merges USDZ patch onto fresh dish metadata so concurrent GLB viewer metadata is preserved", async () => {
  const concurrentGlbMetadata = {
    webModel3dUrl: `/api/public/menu-dishes/${DISH_ID}/model/glb?v=old-glb-version`,
    model3dUrl: `/api/public/menu-dishes/${DISH_ID}/model/glb?v=old-glb-version`,
    webModel3dStoragePath: `restaurants/${RESTAURANT_ID}/models/web/homard-grille-old-glb-version.glb`,
    viewerGlbStatus: "ready",
    viewerGlbSha256: "c".repeat(64),
    concurrentMarker: "glb-added-during-usdz-optimization"
  };
  const { client, updates } = mockAdminClient({
    dishSelect: async () => ({ data: { metadata: concurrentGlbMetadata }, error: null })
  });

  const result = await runUsdzRuntimePipeline({
    ...basePipelineArgs(client, successOptimizer(validUsdzBytes(7000))),
    existingMetadata: { staleOnly: "must-not-be-merged" }
  });

  assert.equal(updates.length, 1);
  const metadata = updates[0].metadata;
  assert.equal(metadata.concurrentMarker, "glb-added-during-usdz-optimization");
  assert.equal(metadata.viewerGlbStatus, "ready");
  assert.equal(metadata.webModel3dStoragePath, concurrentGlbMetadata.webModel3dStoragePath);
  assert.equal(metadata.webModel3dUrl, `/api/public/menu-dishes/${DISH_ID}/model/glb?v=${result.version}`);
  assert.equal(metadata.model3dUrl, `/api/public/menu-dishes/${DISH_ID}/model/glb?v=${result.version}`);
  assert.equal(metadata.arUsdzUrl, result.arUsdzUrl);
  assert.equal("staleOnly" in metadata, false);
});

test("validated runtime pipeline uploads runtime and report after source cleanup", async () => {
  const uploads = [];
  const { client } = mockAdminClient({
    upload: async (path) => {
      uploads.push(path);
      return { data: {}, error: null };
    }
  });

  const result = await runUsdzRuntimePipeline({
    ...basePipelineArgs(client, successOptimizer(validUsdzBytes(7000)))
  });

  assert.equal(result.status, "ready");
  assert.equal(uploads.length, 2);
  assert.ok(uploads[0].includes("/models/ar-ios/"));
  assert.ok(uploads[1].endsWith("-usdz-report.json"));
});

test("no source USDZ signed upload URL is ever created", async () => {
  const sourceFiles = [
    usdzRoute,
    pipeline,
    read("lib/owner/usdzRuntimeModel.ts"),
    read("scripts/owner/optimize-restaurant-usdz.mjs")
  ].join("\n");

  assert.doesNotMatch(sourceFiles, /createSignedUploadUrl\([^)]*source/i);
  assert.doesNotMatch(sourceFiles, /createSignedUploadUrl\([^)]*master/i);
  assert.doesNotMatch(sourceFiles, /source.*signedUpload/i);
  assert.doesNotMatch(sourceFiles, /master.*signedUpload/i);
});

test("signed upload URL flow, when added, is constrained to runtime and report only", () => {
  const allSource = [
    usdzRoute,
    pipeline,
    read("lib/owner/usdzRuntimeModel.ts"),
    read("scripts/owner/optimize-restaurant-usdz.mjs")
  ].join("\n");

  assert.doesNotMatch(allSource, /createSignedUploadUrl\(/);
  assert.match(allSource, /runtimeStoragePath/);
  assert.match(allSource, /reportStoragePath/);
});

test("deleting usdz-runtime also targets the linked optimization report", () => {
  const metadata = {
    arUsdzStoragePath: `restaurants/${RESTAURANT_ID}/models/ar-ios/homard-grille-20260704-abcdef12.usdz`,
    usdzOptimizationReportStoragePath: `restaurants/${RESTAURANT_ID}/models/manifests/homard-grille-20260704-abcdef12-usdz-report.json`,
    usdzPhysicalScaleFootprintBeforeMeters: 0.08,
    usdzPhysicalScaleFootprintAfterMeters: 0.4,
    usdzPhysicalScaleCenteredX: true,
    usdzPhysicalScaleCenteredY: true,
    usdzPhysicalScaleGrounded: true,
    usdzPhysicalScaleWarnings: ["Scale factor above 4"]
  };
  const { targets, clearKeys } = collectTargetedDishModelDeletion(
    metadata,
    RESTAURANT_ID,
    "usdz-runtime"
  );

  assert.ok(targets.some((target) => target.kind === "ios_usdz_runtime" || target.kind === "ios_usdz"));
  assert.ok(targets.some((target) => target.kind === "usdz_report"));
  assert.ok(clearKeys.includes("usdzOptimizationReportStoragePath"));
  assert.ok(clearKeys.includes("usdzPhysicalScaleFootprintBeforeMeters"));
  assert.ok(clearKeys.includes("usdzPhysicalScaleFootprintAfterMeters"));
  assert.ok(clearKeys.includes("usdzPhysicalScaleCenteredX"));
  assert.ok(clearKeys.includes("usdzPhysicalScaleCenteredY"));
  assert.ok(clearKeys.includes("usdzPhysicalScaleGrounded"));
  assert.ok(clearKeys.includes("usdzPhysicalScaleWarnings"));
});

test("viewer-glb route never triggers a USDZ pipeline", () => {
  assert.doesNotMatch(viewerRoute, /runUsdzRuntimePipeline/);
  assert.doesNotMatch(viewerRoute, /runRestaurantMeshyDishPipeline/);
  assert.doesNotMatch(viewerLib, /runUsdzRuntimePipeline/);
  assert.doesNotMatch(viewerRoute, /arModel3dUrl/);
  assert.match(viewerRoute, /usdzTriggered: false/);
});

test("local worker deletes source before signed upload and skips upload when optimizer fails", () => {
  const optimizerIndex = localWorker.indexOf("const summary = await runOptimizer");
  const failGateIndex = localWorker.indexOf("Array.isArray(summary.fails)");
  const sourceDeleteIndex = localWorker.indexOf("rmSync(sourcePath, { force: true })");
  const catchSourceDeleteIndex = localWorker.indexOf("if (sourcePath) rmSync(sourcePath, { force: true })");
  const notifyFailIndex = localWorker.indexOf("if (form) await notifyFail");
  const prepareIndex = localWorker.indexOf("preparePayload = {");
  const uploadIndex = localWorker.indexOf("uploadSigned(prepared.runtimeUpload");
  const runtimeUploadedIndex = localWorker.indexOf("runtimeUploaded = true");
  const reportUploadedIndex = localWorker.indexOf("reportUploaded = true");
  const rollbackPayloadIndex = localWorker.indexOf("const rollbackPayload");
  assert.ok(optimizerIndex > -1, "local worker must run optimizer");
  assert.ok(failGateIndex > optimizerIndex, "optimizer fails must be checked");
  assert.ok(sourceDeleteIndex > failGateIndex, "source must be deleted before network upload");
  assert.ok(prepareIndex > sourceDeleteIndex, "prepare-upload JSON happens after source cleanup");
  assert.ok(uploadIndex > prepareIndex, "signed upload happens only after prepare-upload");
  assert.ok(runtimeUploadedIndex > uploadIndex, "worker tracks successful runtime upload");
  assert.ok(reportUploadedIndex > runtimeUploadedIndex, "worker tracks successful report upload");
  assert.ok(rollbackPayloadIndex > catchSourceDeleteIndex, "worker builds rollback after source cleanup");
  assert.ok(
    catchSourceDeleteIndex > -1 && catchSourceDeleteIndex < notifyFailIndex,
    "failure notification must happen after source cleanup"
  );
  assert.match(localWorker, /runtimeStoragePath: runtimeUploaded \? prepared\.runtimeStoragePath : undefined/);
  assert.match(localWorker, /reportStoragePath: reportUploaded \? prepared\.reportStoragePath : undefined/);
  assert.match(localWorker, /finally\s*{[\s\S]*rmSync\(workspace, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(localWorker, /sourceStoragePath|masterUsdzStoragePath|rawUsdzStoragePath/);
});

test("fail route performs token-scoped runtime rollback only", () => {
  assert.match(usdzFailRoute, /parseRollbackInput/);
  assert.match(usdzFailRoute, /rollbackUsdzRuntimeSignedUpload/);
  assert.match(usdzFailRoute, /assertUsdzRuntimeJobClaimsMatchRoute/);
  assert.doesNotMatch(usdzFailRoute, /sourceStoragePath|masterUsdzStoragePath|rawUsdzStoragePath|candidateStoragePath/);
});

test("worker refuses to store source and reports geometry honestly", () => {
  assert.match(worker, /geometry_optimization[^\n]*=[^\n]*"skipped"/);
  assert.match(worker, /Blender indisponible/);
  assert.match(worker, /Triangle budget depasse sans optimisation Blender reussie/);
  assert.match(worker, /physical_scale/);
  assert.match(worker, /physicalScale/);
  assert.match(worker, /Echelle physique invalide/);
  assert.match(worker, /"platter"/);
  const blender = read("scripts/owner/blender_usdz_geometry_optimizer.py");
  assert.match(blender, /"platter"/);
  assert.match(blender, /"footprint"/);
  assert.match(blender, /max_x - min_x/);
  assert.match(blender, /max_y - min_y/);
  assert.match(blender, /max\([^)]*width[^)]*depth[^)]*\)/s);
  assert.match(blender, /centerX/);
  assert.match(blender, /centerY/);
  assert.match(blender, /centeredX/);
  assert.match(blender, /centeredY/);
  assert.match(blender, /grounded/);
  assert.match(blender, /Matrix\.Translation\(\(-float\(scaled\["centerX"\]\), -float\(scaled\["centerY"\]\), 0\)\)/);
  assert.match(worker, /guard_output_path/);
  assert.match(worker, /optimized_root = root_layer\.parent/);
  assert.match(worker, /validate_packaging_root\(root_layer, extracted\)/);
  assert.match(worker, /UsdUtils\.ComputeAllDependencies/);
  assert.match(worker, /shutil\.rmtree\(workspace/);
  assert.match(cli, /light:\s*10 \* 1024 \* 1024/);
  assert.match(cli, /emergency:\s*Math\.floor\(5\.5 \* 1024 \* 1024\)/);
  assert.match(cli, /VALID_DISH_KINDS/);
  assert.match(cli, /--dish-kind/);
  assert.match(cli, /platter/);
  assert.match(cli, /VISTAIRE_USDZ_WORKER_ALLOWED_ORIGINS/);
  assert.match(cli, /VISTAIRE_USDZ_PYTHON/);
  assert.match(cli, /VISTAIRE_USDZ_BLENDER/);
  assert.match(cli, /origin .*non autorisee|Origin .*not allowed/i);
  assert.match(cli, /triangleCountAfter < triangleCountBefore/);
  // CLI never uploads anywhere.
  assert.doesNotMatch(cli, /supabase/i);
  assert.doesNotMatch(cli, /\.upload\(/);
});

test("Python optimizer discovers Blender installed in Windows Program Files", () => {
  assert.match(worker, /ProgramFiles/);
  assert.match(worker, /Blender Foundation/);
  assert.match(worker, /Blender \*\/blender\.exe/);
  assert.match(worker, /windows_blender_candidates/);
  assert.match(worker, /resolve_blender\(\)[\s\S]*windows_blender_candidates\(\)/);
});

test("physical scale targets use footprint for solid dishes and height for burger and drink", () => {
  const python = read("scripts/owner/optimize_restaurant_usdz.py");
  for (const source of [blenderOptimizer, python]) {
    assert.match(source, /"burger": \{"dimension": "height"/);
    assert.match(source, /"drink": \{"dimension": "height"/);
    for (const kind of ["pizza", "plate", "bowl", "dessert", "fallback"]) {
      assert.match(source, new RegExp(`"${kind}": \\{"dimension": "footprint"`));
    }
    assert.match(
      source,
      /"platter": \{"dimension": "footprint", "targetMeters": 0\.32, "minMeters": 0\.22, "maxMeters": 0\.45\}/
    );
  }
  assert.doesNotMatch(blenderOptimizer, /"pizza": \{"dimension": "width"/);
  assert.doesNotMatch(blenderOptimizer, /"plate": \{"dimension": "width"/);
  assert.doesNotMatch(blenderOptimizer, /"platter": \{"dimension": "width"/);
});

test("Blender and Python physical scale target maps stay in parity", () => {
  assert.deepEqual(
    extractPhysicalScaleTargets(blenderOptimizer, "DISH_SCALE_TARGETS"),
    extractPhysicalScaleTargets(worker, "DISH_PHYSICAL_SCALE_TARGETS")
  );
});

test("local worker forwards dish kind to the transient optimizer without changing upload paths", () => {
  assert.match(localWorker, /dishKind/);
  assert.match(localWorker, /form\.get\("dishKind"\)/);
  assert.match(localWorker, /"--dish-kind"/);
  assert.match(localWorker, /physicalScale: summary\.physicalScale/);
  assert.match(localWorker, /WORKER_VERSION = 3/);
  assert.match(localWorker, /WORKER_CAPABILITIES = \["physicalScaleNormalization"\]/);
  assert.match(localWorker, /capabilities: WORKER_CAPABILITIES/);
  assert.doesNotMatch(localWorker, /dishKind[\s\S]{0,120}StoragePath/);
  assert.doesNotMatch(localWorker, /dishKind[\s\S]{0,120}\.upload\(/);
});

test("local worker preserves optimizer failure diagnostics without storing source", () => {
  assert.match(localWorker, /class OptimizerRunError extends Error/);
  assert.match(localWorker, /diagnostics = parsed/);
  assert.match(localWorker, /failureKind: diagnostics\.failureKind/);
  assert.match(localWorker, /selectedCandidate: diagnostics\.selectedCandidate \?\? null/);
  assert.match(localWorker, /candidateAttempts: Array\.isArray\(diagnostics\.attempts\)/);
  assert.match(localWorker, /usdzSourceStored: false/);
  assert.match(localWorker, /if \(sourcePath\) rmSync\(sourcePath, \{ force: true \}\)/);
  assert.doesNotMatch(localWorker, /sourceStoragePath|masterUsdzStoragePath|rawUsdzStoragePath/);
});

test("worker CLI refuses an origin outside VISTAIRE_USDZ_WORKER_ALLOWED_ORIGINS", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/owner/optimize-restaurant-usdz.mjs",
      "--origin",
      "https://evil.example",
      "--source",
      "missing.usdz",
      "--output",
      "runtime.usdz",
      "--report",
      "report.json"
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VISTAIRE_USDZ_WORKER_ALLOWED_ORIGINS: "https://www.vistaire.ca"
      },
      encoding: "utf8"
    }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Origin worker USDZ non autorisee/);
  assert.doesNotMatch(result.stderr, /Source USDZ introuvable/);
});
