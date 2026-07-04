import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FORBIDDEN_SOURCE_STORAGE_FIELDS,
  assertNoForbiddenSourceStorage,
  buildUsdzRuntimeMetadataPatch,
  evaluateRuntimeUsdzUploadGate,
  validateUsdzStructure,
  sha256Hex
} from "../lib/owner/usdzRuntimeModel.ts";

const read = (path) => readFileSync(path, "utf8");

const usdzRoute = read(
  "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/usdz-runtime/route.ts"
);
const viewerRoute = read(
  "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/viewer-glb/route.ts"
);
const pipeline = read("lib/owner/usdzRuntimePipeline.ts");
const viewerLib = read("lib/owner/viewerGlbUpload.ts");
const cli = read("scripts/owner/optimize-restaurant-usdz.mjs");
const worker = read("scripts/owner/optimize_restaurant_usdz.py");

function validUsdzBytes(size = 64) {
  const head = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const eocd = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  return Buffer.concat([head, Buffer.alloc(Math.max(8, size - 8)), eocd]);
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
  const uploadIndex = pipeline.indexOf(".upload(");
  assert.ok(gateIndex > -1, "gate must be called");
  assert.ok(uploadIndex > -1, "an upload must exist");
  assert.ok(gateIndex < uploadIndex, "gate must be evaluated before any upload");

  // The source buffer/path is never uploaded.
  assert.doesNotMatch(pipeline, /\.upload\(\s*sourcePath/);
  assert.doesNotMatch(pipeline, /\.upload\([^)]*source\.usdz/);
  assert.match(pipeline, /writeFileSync\(sourcePath/);
  assert.match(pipeline, /\.upload\(runtimeStoragePath/);
  assert.match(pipeline, /\.upload\(reportStoragePath/);
  assert.match(pipeline, /finally\s*{\s*[\s\S]*rmSync\(workspace/);
  assert.match(pipeline, /assertNoForbiddenSourceStorage/);
});

test("viewer-glb route never triggers a USDZ pipeline", () => {
  assert.doesNotMatch(viewerRoute, /runUsdzRuntimePipeline/);
  assert.doesNotMatch(viewerRoute, /runRestaurantMeshyDishPipeline/);
  assert.doesNotMatch(viewerLib, /runUsdzRuntimePipeline/);
  assert.doesNotMatch(viewerLib, /\.usdz/);
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
