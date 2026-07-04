import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FORBIDDEN_SOURCE_STORAGE_FIELDS,
  assertNoForbiddenSourceStorage,
  buildUsdzRuntimeMetadataPatch,
  buildViewerGlbMetadataPatch,
  buildViewerGlbStoragePlan,
  createUsdzRuntimeAssetVersion,
  evaluateRuntimeUsdzUploadGate,
  validateUsdzStructure,
  sha256Hex
} from "../lib/owner/usdzRuntimeModel.ts";
import { buildSupabasePublicMenu } from "../lib/menu/publicMenuCore.ts";
import { runUsdzRuntimePipeline } from "../lib/owner/usdzRuntimePipelineCore.ts";
import { collectTargetedDishModelDeletion } from "../lib/owner/deleteDishModelAssets.ts";

const read = (path) => readFileSync(path, "utf8");

const usdzRoute = read(
  "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/usdz-runtime/route.ts"
);
const viewerRoute = read(
  "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/viewer-glb/route.ts"
);
const pipeline = read("lib/owner/usdzRuntimePipelineCore.ts");
const viewerLib = read("lib/owner/viewerGlbUpload.ts");
const cli = read("scripts/owner/optimize-restaurant-usdz.mjs");
const worker = read("scripts/owner/optimize_restaurant_usdz.py");

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
          remove: async (paths) => {
            removed.push(...paths);
            if (handlers.remove) return handlers.remove(paths);
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

test("usdz-runtime route uploads only after optimization and reports source not stored", () => {
  assert.match(usdzRoute, /runtime = "nodejs"/);
  assert.match(usdzRoute, /requireVistaireOwnerApi\(\)/);
  assert.match(usdzRoute, /requireSameOriginOwnerMutation\(request\)/);
  assert.match(usdzRoute, /validateUsdzFile/);
  assert.match(usdzRoute, /runUsdzRuntimePipeline/);
  assert.match(usdzRoute, /usdzSourceStored: false/);
  // The route itself never uploads to storage; that happens post-gate in the pipeline.
  assert.doesNotMatch(usdzRoute, /storage[\s\S]{0,40}\.upload\(/);
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

test("deleting usdz-runtime also targets the linked optimization report", () => {
  const metadata = {
    arUsdzStoragePath: `restaurants/${RESTAURANT_ID}/models/ar-ios/homard-grille-20260704-abcdef12.usdz`,
    usdzOptimizationReportStoragePath: `restaurants/${RESTAURANT_ID}/models/manifests/homard-grille-20260704-abcdef12-usdz-report.json`
  };
  const { targets, clearKeys } = collectTargetedDishModelDeletion(
    metadata,
    RESTAURANT_ID,
    "usdz-runtime"
  );

  assert.ok(targets.some((target) => target.kind === "ios_usdz_runtime" || target.kind === "ios_usdz"));
  assert.ok(targets.some((target) => target.kind === "usdz_report"));
  assert.ok(clearKeys.includes("usdzOptimizationReportStoragePath"));
});

test("viewer-glb route never triggers a USDZ pipeline", () => {
  assert.doesNotMatch(viewerRoute, /runUsdzRuntimePipeline/);
  assert.doesNotMatch(viewerRoute, /runRestaurantMeshyDishPipeline/);
  assert.doesNotMatch(viewerLib, /runUsdzRuntimePipeline/);
  assert.doesNotMatch(viewerRoute, /arModel3dUrl/);
  assert.match(viewerRoute, /usdzTriggered: false/);
});

test("worker refuses to store source and reports geometry honestly", () => {
  assert.match(worker, /geometry_optimization[^\n]*=[^\n]*"skipped"/);
  assert.match(worker, /guard_output_path/);
  assert.match(worker, /shutil\.rmtree\(workspace/);
  // CLI never uploads anywhere.
  assert.doesNotMatch(cli, /supabase/i);
  assert.doesNotMatch(cli, /\.upload\(/);
});
