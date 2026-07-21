import assert from "node:assert/strict";
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
  validateManifest
} from "../scripts/owner/backfill-maison-elyse-media.mjs";

const ROOT = join(import.meta.dirname, "..");
const manifest = loadManifest(join(ROOT, "scripts", "owner", "maison-elyse-media.manifest.json"));

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
});

test("plan uses cleanup-compatible builder paths and reuses exact existing objects", () => {
  const inventory = buildLocalAssetInventory({ rootDir: ROOT, manifest });
  const row = { id: "84226092-1b25-4174-a635-50e2b8319580", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "tartare-saumon", image_url: null, has_immersive_view: false, metadata: {} };
  const plan = createBackfillPlan({ manifest, inventory, rows: [row], existingObjectPaths: new Set() });
  const metadata = plan.dishUpdates[0].patch.metadata;
  const photoObject = plan.storageObjects.find((object) => object.bucket === "vistaire-media");
  const modelObjects = plan.storageObjects.filter((object) => object.bucket === "vistaire-3d");

  assert.ok(photoObject);
  assert.equal(isSafeDishPhotoStoragePath(photoObject.path, MAISON_ELYSE_RESTAURANT_ID), true);
  assert.deepEqual(
    collectDishPhotoStorageTarget(metadata, MAISON_ELYSE_RESTAURANT_ID).targets.map((target) => target.path),
    [photoObject.path]
  );
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
  const reused = createBackfillPlan({ manifest, inventory, rows: [row], existingObjectPaths: new Set(plan.storageObjects.map((object) => object.path)) });
  assert.equal(reused.storageObjects.every((object) => object.action === "reuse"), true);
});

test("plan fails closed when the slug-to-UUID mapping is not exact", () => {
  const inventory = buildLocalAssetInventory({ rootDir: ROOT, manifest });
  assert.throws(
    () => createBackfillPlan({
      manifest,
      inventory,
      rows: [{ id: "00000000-0000-4000-8000-000000000000", restaurant_id: MAISON_ELYSE_RESTAURANT_ID, slug: "tartare-saumon", metadata: {} }],
      existingObjectPaths: new Set()
    }),
    /UUID.*allowlist|slug/i
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
    async updateDish(update) { events.push(["update", update.row.id]); if (update.row.id === "dish-2") throw new Error("db failure"); },
    async restoreDish(row) { events.push(["restore", row.id]); },
    async removeObject(object) { events.push(["remove", object.path]); }
  };
  await assert.rejects(() => applyPlan({ adapter, plan }), /db failure/);
  assert.deepEqual(events, [["upload", "restaurants/r/dishes/d/photo-hash.png", false], ["update", "dish-1"], ["update", "dish-2"], ["restore", "dish-1"], ["remove", "restaurants/r/dishes/d/photo-hash.png"]]);
});
