import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  collectDishModelStorageTargets,
  isSafeDishModelStoragePath
} from "../lib/owner/deleteDishModelAssets.ts";
import {
  collectDishPhotoStorageTarget,
  isSafeDishPhotoStoragePath
} from "../lib/owner/dishMediaGarbageCollector.ts";

import {
  ALLOWED_SLUGS,
  MAISON_ELYSE_RESTAURANT_ID,
  applyPlan,
  buildLocalAssetInventory,
  createBackfillPlan,
  loadManifest,
  parseCliArgs,
  validateManifest,
  validateUsdzPhysicalScaleReport,
  verifyStorageObjectCollisions
} from "../scripts/owner/backfill-maison-elyse-media.mjs";

const ROOT = join(import.meta.dirname, "..");
const manifest = loadManifest(join(ROOT, "scripts", "owner", "maison-elyse-media.manifest.json"));

const validPhysicalScaleReport = {
  sourceStored: false,
  fails: [],
  physicalScale: {
    status: "normalized",
    dishKind: "plate",
    dimension: "height",
    minMeters: 0.1,
    maxMeters: 0.2,
    heightAfterMeters: 0.15,
    centeredX: true,
    centeredY: true,
    grounded: true
  }
};

function reportAsset() {
  const bytes = Buffer.from(JSON.stringify(validPhysicalScaleReport));
  return {
    path: "tests/fixtures/maison-elyse-usdz-report.json",
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    contentType: "application/json"
  };
}

test("manifest contains exactly the twelve allowlisted slugs and no fuzzy identity", () => {
  assert.deepEqual(manifest.dishes.map((dish) => dish.slug), ALLOWED_SLUGS);
  assert.equal(validateManifest(manifest).ok, true);
  assert.throws(
    () => validateManifest({ ...manifest, dishes: manifest.dishes.map((dish) => dish.slug === "tartare-saumon" ? { ...dish, slug: "Tartare de saumon" } : dish) }),
    /allowlist|slug/i
  );
});

test("CLI is dry-run by default and apply requires production guards", () => {
  assert.equal(parseCliArgs([]).mode, "dry-run");
  assert.throws(() => parseCliArgs(["--apply"]), /production|restaurant-id|confirmation/i);
  const args = parseCliArgs(["--apply", "--restaurant-id", MAISON_ELYSE_RESTAURANT_ID, "--restaurant-slug", "maison-elyse", "--expected-project-ref", "projectref", "--confirm-production", "MAISON-ELYSE"]);
  assert.equal(args.mode, "apply");
});

test("local inventory reports twelve photos, missing models, and source-only USDZ", () => {
  const inventory = buildLocalAssetInventory({ rootDir: ROOT, manifest });
  assert.equal(inventory.summary.photo.ready, 12);
  assert.equal(inventory.bySlug["risotto-cepe"].webGlb.status, "absent");
  assert.equal(inventory.bySlug["negroni-fut"].webGlb.status, "absent");
  assert.equal(inventory.bySlug["mocktail-bergamote"].webGlb.status, "absent");
  assert.equal(inventory.bySlug["homard-bisque"].historicalPrimaryUsdz.disposition, "source-only");
  assert.equal(inventory.summary.usdzRuntime.ready, 9);
  assert.equal(inventory.summary.usdzPhysicalScaleReport.absent, 9);
  assert.equal(inventory.summary.usdzPublishable.ready, 0);
  assert.equal(inventory.summary.usdzPublishable.pending, 9);
});

test("plan uses cleanup-compatible builder paths and reuses exact existing objects", () => {
  const inventory = buildLocalAssetInventory({ rootDir: ROOT, manifest });
  const row = { id: "84226092-1b25-4174-a635-50e2b8319580", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "tartare-saumon", image_url: null, has_immersive_view: false, metadata: {} };
  const plan = createBackfillPlan({ manifest, inventory, rows: [row], existingObjects: new Map() });
  const metadata = plan.dishUpdates[0].patch.metadata;
  const photoObject = plan.storageObjects.find((object) => object.bucket === "vistaire-media");
  const modelObjects = plan.storageObjects.filter((object) => object.bucket === "vistaire-3d");

  assert.ok(photoObject);
  assert.equal(isSafeDishPhotoStoragePath(photoObject.path, MAISON_ELYSE_RESTAURANT_ID), true);
  assert.deepEqual(
    collectDishPhotoStorageTarget(metadata, MAISON_ELYSE_RESTAURANT_ID).targets.map((target) => target.path),
    [photoObject.path]
  );
  assert.equal(modelObjects.length, 2);
  assert.equal(metadata.arUsdzUrl, undefined);
  assert.equal(metadata.arUsdzStoragePath, undefined);
  assert.equal(metadata.usdzRuntimeStatus, "pending_manual_usdz");
  assert.equal(metadata.usdzRuntimePendingReason, "requires-worker-v3");
  assert.equal(metadata.modelStatus, "web_ready_usdz_pending");
  assert.match(metadata.modelAssetSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(metadata.modelAssetSha256, /,/);
  assert.ok(photoObject.path.startsWith(`restaurants/${MAISON_ELYSE_RESTAURANT_ID}/photos/originals/`));

  for (const object of modelObjects) {
    const extension = object.path.endsWith(".usdz") ? ".usdz" : ".glb";
    const folder = object.path.split("/")[3];
    assert.equal(isSafeDishModelStoragePath(object.path, MAISON_ELYSE_RESTAURANT_ID, extension, [folder]), true);
  }
  const collectedModels = collectDishModelStorageTargets(metadata, MAISON_ELYSE_RESTAURANT_ID);
  assert.deepEqual(collectedModels.skipped, []);
  assert.deepEqual(
    collectedModels.targets.map((target) => target.path).sort(),
    modelObjects.map((object) => object.path).sort()
  );
  assert.equal(plan.dishUpdates[0].patch.metadata.quickLookQaStatus, "not-tested");
  assert.equal(plan.dishUpdates[0].patch.metadata.usdzSourceStored, false);
  assert.equal(plan.storageObjects.some((object) => object.path.endsWith("homard-bisque.usdz")), false);
  const existingObjects = new Map(plan.storageObjects.map((object) => [
    `${object.bucket}/${object.path}`,
    { bucket: object.bucket, path: object.path, size: object.bytes, contentType: object.contentType, sha256: object.sha256 }
  ]));
  const reused = createBackfillPlan({ manifest, inventory, rows: [row], existingObjects });
  assert.equal(reused.storageObjects.every((object) => object.action === "reuse"), true);
});

test("plan fails closed when the slug-to-UUID mapping is not exact", () => {
  const inventory = buildLocalAssetInventory({ rootDir: ROOT, manifest });
  assert.throws(
    () => createBackfillPlan({
      manifest,
      inventory,
      rows: [{ id: "00000000-0000-4000-8000-000000000000", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "tartare-saumon", metadata: {} }],
      existingObjects: new Map()
    }),
    /UUID.*allowlist|slug/i
  );
});

test("photo-only dishes do not receive model metadata and reject stale model state", () => {
  const inventory = buildLocalAssetInventory({ rootDir: ROOT, manifest });
  const cleanRow = {
    id: "30453578-103d-4dca-bb05-27baf46eda3e",
    restaurant_id: MAISON_ELYSE_RESTAURANT_ID,
    slug: "risotto-cepe",
    image_url: null,
    has_immersive_view: false,
    metadata: {}
  };
  const plan = createBackfillPlan({ manifest, inventory, rows: [cleanRow], existingObjects: new Map() });
  assert.equal(plan.dishUpdates[0].patch.metadata.modelAssetVersion, undefined);
  assert.equal(plan.dishUpdates[0].patch.metadata.modelStatus, "missing");
  assert.throws(
    () => createBackfillPlan({
      manifest,
      inventory,
      rows: [{ ...cleanRow, metadata: { model3dUrl: "/api/public/menu-dishes/30453578-103d-4dca-bb05-27baf46eda3e/model/glb" } }],
      existingObjects: new Map()
    }),
    /photo-only|model metadata/i
  );
});

test("apply rollback removes only newly created objects and restores updated rows", async () => {
  const events = [];
  const plan = {
    storageObjects: [{ bucket: "vistaire-media", path: "restaurants/r/dishes/d/photo-hash.png", action: "create", bytes: 5, contentType: "image/png", data: Buffer.from("photo"), upsert: false }],
    dishUpdates: [
      { row: { id: "dish-1", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "ravioles-romarin", image_url: null, has_immersive_view: false, metadata: {} }, patch: { image_url: "/api/public/menu-dishes/dish-1/photo", has_immersive_view: false, metadata: {} } },
      { row: { id: "dish-2", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "tartare-saumon", image_url: null, has_immersive_view: false, metadata: {} }, patch: { image_url: "/api/public/menu-dishes/dish-2/photo", has_immersive_view: false, metadata: {} } }
    ]
  };
  const adapter = {
    async uploadObject(object) { events.push(["upload", object.path, object.upsert]); return { created: true }; },
    async updateDish(update) {
      events.push(["update", update.row.id]);
      if (update.row.id === "dish-2") {
        const error = new Error("db failure");
        error.backfillMutationApplied = false;
        throw error;
      }
    },
    async restoreDish(row) { events.push(["restore", row.id]); return { data: { id: row.id, restaurant_id: row.restaurant_id }, error: null }; },
    async removeObject(object) { events.push(["remove", object.path]); return { data: [object.path], error: null }; }
  };
  await assert.rejects(() => applyPlan({ adapter, plan }), /db failure/);
  assert.deepEqual(events, [["upload", "restaurants/r/dishes/d/photo-hash.png", false], ["update", "dish-1"], ["update", "dish-2"], ["restore", "dish-1"], ["remove", "restaurants/r/dishes/d/photo-hash.png"]]);
});

test("rollback aggregates DB and Storage failures without touching reuse objects", async () => {
  const reusedPath = "restaurants/11111111-1111-1111-1111-111111111111/models/web/reused.glb";
  const createdPath = "restaurants/11111111-1111-1111-1111-111111111111/photos/originals/created.png";
  const plan = {
    storageObjects: [
      { bucket: "vistaire-media", path: createdPath, action: "create", bytes: 5, contentType: "image/png", data: Buffer.from("photo"), upsert: false },
      { bucket: "vistaire-3d", path: reusedPath, action: "reuse", bytes: 5, contentType: "model/gltf-binary", data: Buffer.from("glTF"), upsert: false }
    ],
    dishUpdates: [
      { row: { id: "dish-1", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "ravioles-romarin", image_url: null, has_immersive_view: false, metadata: {} }, patch: {} },
      { row: { id: "dish-2", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "tartare-saumon", image_url: null, has_immersive_view: false, metadata: {} }, patch: {} }
    ]
  };
  const events = [];
  const adapter = {
    async uploadObject(object) { events.push(["upload", object.path]); return { created: true }; },
    async updateDish(update) {
      events.push(["update", update.row.id]);
      if (update.row.id === "dish-2") throw new Error("db failure after request");
    },
    async restoreDish(row) { events.push(["restore", row.id]); return { data: null, error: { message: "restore unavailable" } }; },
    async removeObject(object) { events.push(["remove", object.path]); return { data: null, error: { message: "remove unavailable" } }; }
  };

  await assert.rejects(
    () => applyPlan({ adapter, plan }),
    (error) => {
      assert.equal(error.code, "BACKFILL_ROLLBACK_INCOMPLETE");
      assert.equal(error.rollbackComplete, false);
      assert.match(error.initialError.message, /db failure/);
      assert.deepEqual(error.rollbackErrors.map((item) => item.phase), ["database-restore", "database-restore", "storage-remove"]);
      return true;
    }
  );
  assert.deepEqual(events, [
    ["upload", createdPath],
    ["update", "dish-1"],
    ["update", "dish-2"],
    ["restore", "dish-2"],
    ["restore", "dish-1"],
    ["remove", createdPath]
  ]);
  assert.equal(events.some(([, path]) => path === reusedPath), false);
});

test("Storage reuse requires content metadata and refuses mismatches", () => {
  const inventory = buildLocalAssetInventory({ rootDir: ROOT, manifest });
  const row = { id: "84226092-1b25-4174-a635-50e2b8319580", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "tartare-saumon", image_url: null, has_immersive_view: false, metadata: {} };
  const firstPlan = createBackfillPlan({ manifest, inventory, rows: [row], existingObjects: new Map() });
  const photo = firstPlan.storageObjects.find((object) => object.bucket === "vistaire-media");
  assert.throws(
    () => createBackfillPlan({ manifest, inventory, rows: [row], existingObjectPaths: new Set([photo.path]) }),
    /collision lacks|metadata/i
  );
  assert.throws(
    () => createBackfillPlan({ manifest, inventory, rows: [row], existingObjects: new Map([[`${photo.bucket}/${photo.path}`, { bucket: photo.bucket, path: photo.path, size: photo.bytes + 1, contentType: photo.contentType, sha256: photo.sha256 }]]) }),
    /different size/i
  );
  assert.throws(
    () => createBackfillPlan({ manifest, inventory, rows: [row], existingObjects: new Map([[`${photo.bucket}/${photo.path}`, { bucket: photo.bucket, path: photo.path, size: photo.bytes, contentType: "image/jpeg", sha256: photo.sha256 }]]) }),
    /Content-Type/i
  );
  assert.throws(
    () => createBackfillPlan({ manifest, inventory, rows: [row], existingObjects: new Map([[`${photo.bucket}/${photo.path}`, { bucket: photo.bucket, path: photo.path, size: photo.bytes, contentType: photo.contentType, sha256: "0".repeat(64) }]]) }),
    /SHA-256/i
  );
});

test("Storage collisions without a listed SHA are downloaded and verified before reuse", async () => {
  const inventory = buildLocalAssetInventory({ rootDir: ROOT, manifest });
  const row = { id: "84226092-1b25-4174-a635-50e2b8319580", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "tartare-saumon", image_url: null, has_immersive_view: false, metadata: {} };
  const firstPlan = createBackfillPlan({ manifest, inventory, rows: [row], existingObjects: new Map() });
  const photo = firstPlan.storageObjects.find((object) => object.bucket === "vistaire-media");
  const existingObjects = new Map([[`${photo.bucket}/${photo.path}`, {
    bucket: photo.bucket,
    path: photo.path,
    size: photo.bytes,
    contentType: photo.contentType,
    sha256: ""
  }]]);
  const plan = createBackfillPlan({ manifest, inventory, rows: [row], existingObjects });
  assert.equal(plan.storageObjects.find((object) => object.path === photo.path).action, "verify");
  await verifyStorageObjectCollisions({
    plan,
    adapter: {
      async downloadObject() {
        return { bytes: Buffer.from(readFileSync(join(ROOT, photo.localPath))), contentType: photo.contentType };
      }
    }
  });
  assert.equal(plan.storageObjects.find((object) => object.path === photo.path).action, "reuse");
});

test("USDZ reports fail closed and only a valid worker-v3 report can publish", () => {
  assert.throws(() => validateUsdzPhysicalScaleReport({ sourceStored: false }, "missing"), /physicalScale/i);
  assert.throws(() => validateUsdzPhysicalScaleReport({ sourceStored: false, physicalScale: { ...validPhysicalScaleReport.physicalScale, heightAfterMeters: 0.3 } }, "out-of-bounds"), /bornes|bounds/i);
  assert.throws(() => validateUsdzPhysicalScaleReport({ sourceStored: false, physicalScale: { ...validPhysicalScaleReport.physicalScale, centeredX: false } }, "not-centered"), /centre|center/i);
  assert.throws(() => validateUsdzPhysicalScaleReport({ sourceStored: false, physicalScale: { ...validPhysicalScaleReport.physicalScale, grounded: false } }, "not-grounded"), /grounded/i);
  assert.deepEqual(validateUsdzPhysicalScaleReport(validPhysicalScaleReport).physicalScale, {
    ...validPhysicalScaleReport.physicalScale,
    targetMeters: 0,
    heightBeforeMeters: 0,
    widthBeforeMeters: 0,
    depthBeforeMeters: 0,
    footprintBeforeMeters: 0,
    widthAfterMeters: 0,
    depthAfterMeters: 0,
    footprintAfterMeters: 0,
    scaleFactor: 1,
    centerOffsetBeforeMeters: 0,
    centerOffsetAfterMeters: 0,
    warnings: []
  });
});

test("valid USDZ report enables publication while the master stays excluded", () => {
  const report = reportAsset();
  const validManifest = structuredClone(manifest);
  const dish = validManifest.dishes.find((item) => item.slug === "tartare-saumon");
  dish.usdzPhysicalScaleReport = report;
  const inventory = buildLocalAssetInventory({ rootDir: ROOT, manifest });
  inventory.bySlug["tartare-saumon"].usdzPhysicalScaleReport = {
    status: "ready",
    bytes: report.bytes,
    sha256: report.sha256,
    contentType: report.contentType,
    report: validPhysicalScaleReport,
    physicalScale: validateUsdzPhysicalScaleReport(validPhysicalScaleReport).physicalScale
  };
  const row = { id: "84226092-1b25-4174-a635-50e2b8319580", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "tartare-saumon", image_url: null, has_immersive_view: false, metadata: {} };
  const plan = createBackfillPlan({ manifest: validManifest, inventory, rows: [row], existingObjects: new Map() });
  const metadata = plan.dishUpdates[0].patch.metadata;
  assert.equal(plan.storageObjects.some((object) => object.path.endsWith(".usdz")), true);
  assert.equal(metadata.modelStatus, "ready");
  assert.match(metadata.arUsdzUrl, /\/model\/usdz/);
  assert.equal(metadata.usdzPhysicalScaleStatus, "normalized");
  assert.equal(metadata.usdzPhysicalScaleCenteredX, true);
  assert.equal(metadata.usdzPhysicalScaleGrounded, true);
  assert.match(metadata.modelAssetSha256, /^[a-f0-9]{64}$/);
  assert.equal(plan.storageObjects.some((object) => object.path.endsWith("homard-bisque.usdz")), false);
});
