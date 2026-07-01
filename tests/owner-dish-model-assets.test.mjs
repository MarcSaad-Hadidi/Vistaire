import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  cleanDishModelMetadata,
  collectDishModelStorageTargets,
  groupTargetsByBucket,
  hasDishModelMetadata,
  isSafeDishModelStoragePath
} from "../lib/owner/deleteDishModelAssets.ts";

const restaurantId = "11111111-2222-4333-8444-555555555555";
const otherRestaurantId = "22222222-3333-4444-8555-666666666666";

test("dish model storage collection keeps only safe paths for the restaurant", () => {
  const metadata = {
    sourceModel3dStorageBucket: "vistaire-3d",
    sourceModel3dStoragePath: `restaurants/${restaurantId}/models/source/dejeuner.glb`,
    webModel3dStorageBucket: "vistaire-3d",
    webModel3dStoragePath: `restaurants/${restaurantId}/models/web/dejeuner.glb`,
    arModel3dStorageBucket: "vistaire-3d",
    arModel3dStoragePath: `restaurants/${restaurantId}/models/ar-lite/dejeuner.glb`,
    arUsdzStorageBucket: "vistaire-3d",
    arUsdzStoragePath: `restaurants/${restaurantId}/models/ar-ios/dejeuner.usdz`,
    meshyManifestStorageBucket: "vistaire-3d",
    meshyManifestStoragePath: `restaurants/${restaurantId}/models/manifests/dejeuner-20260624.json`,
    preparedGlbStoragePath: `restaurants/${restaurantId}/models/staging/job_prepared_12345678/source.glb`
  };

  const collection = collectDishModelStorageTargets(metadata, restaurantId);

  assert.deepEqual(
    collection.targets.map((target) => target.path),
    [
      `restaurants/${restaurantId}/models/source/dejeuner.glb`,
      `restaurants/${restaurantId}/models/web/dejeuner.glb`,
      `restaurants/${restaurantId}/models/ar-lite/dejeuner.glb`,
      `restaurants/${restaurantId}/models/ar-ios/dejeuner.usdz`,
      `restaurants/${restaurantId}/models/manifests/dejeuner-20260624.json`,
      `restaurants/${restaurantId}/models/staging/job_prepared_12345678/source.glb`
    ]
  );
  assert.deepEqual(collection.skipped, []);
  assert.deepEqual(
    groupTargetsByBucket(collection.targets).get("vistaire-3d"),
    collection.targets.map((target) => target.path)
  );
});

test("dish model storage collection rejects unsafe paths and buckets", () => {
  const metadata = {
    sourceModel3dStorageBucket: "vistaire-3d",
    sourceModel3dStoragePath: `restaurants/${restaurantId}/models/source/../secret.glb`,
    webModel3dStorageBucket: "evil-bucket",
    webModel3dStoragePath: `restaurants/${restaurantId}/models/web/dejeuner.glb`,
    arModel3dStorageBucket: "vistaire-3d",
    arModel3dStoragePath: `restaurants/${restaurantId}/models/ar-lite/bad\\file.glb`,
    arUsdzStorageBucket: "vistaire-3d",
    arUsdzStoragePath: `restaurants/${restaurantId}/models/ar-ios/dejeuner.glb`,
    meshyManifestStorageBucket: "vistaire-3d",
    meshyManifestStoragePath: `restaurants/${otherRestaurantId}/models/manifests/dejeuner.json`,
    preparedGlbStoragePath: `restaurants/${restaurantId}/models/staging/job_prepared_12345678/not-source.glb`
  };

  const collection = collectDishModelStorageTargets(metadata, restaurantId);

  assert.deepEqual(collection.targets, []);
  assert.equal(collection.skipped.length, 6);
  assert.equal(collection.skipped.some((target) => target.reason === "unsafe_bucket"), true);
  assert.equal(collection.skipped.every((target) => target.path), true);
});

test("dish model path validation rejects traversal, encoded paths, wrong folders, and wrong extensions", () => {
  const safeWeb = `restaurants/${restaurantId}/models/web/dejeuner.glb`;
  assert.equal(isSafeDishModelStoragePath(safeWeb, restaurantId, ".glb", ["web"]), true);

  for (const path of [
    `restaurants/${restaurantId}/models/web/../secret.glb`,
    `restaurants/${restaurantId}/models/web/dejeuner%2egl%62`,
    `restaurants/${restaurantId}/models/web//dejeuner.glb`,
    `https://storage.example.test/restaurants/${restaurantId}/models/web/dejeuner.glb`,
    `/restaurants/${restaurantId}/models/web/dejeuner.glb`,
    `restaurants/${restaurantId}/photos/originals/dejeuner.glb`,
    `restaurants/${restaurantId}/models/web/nested/dejeuner.glb`,
    `restaurants/${restaurantId}/models/staging/job_prepared_12345678/dejeuner.glb`,
    `restaurants/${restaurantId}/models/ar-ios/dejeuner.glb`
  ]) {
    assert.equal(isSafeDishModelStoragePath(path, restaurantId, ".glb", ["web"]), false, path);
  }
});

test("cleanDishModelMetadata removes model fields and preserves dish/photo metadata", () => {
  const cleaned = cleanDishModelMetadata({
    description: "Assiette maison",
    priceHint: "22",
    allergens: ["lait"],
    customNote: { service: "midi" },
    photoStatus: "ready",
    photoStorageBucket: "vistaire-media",
    photoStoragePath: `restaurants/${restaurantId}/photos/originals/dejeuner.png`,
    webModel3dUrl: "/api/public/menu-dishes/dish/model/glb",
    arUsdzUrl: "/api/public/menu-dishes/dish/model/usdz",
    webModel3dStoragePath: `restaurants/${restaurantId}/models/web/dejeuner.glb`,
    arUsdzStoragePath: `restaurants/${restaurantId}/models/ar-ios/dejeuner.usdz`,
    preparedGlbJobId: "job_prepared_12345678",
    modelAssetVersion: "meshy-20260701-abc123def456",
    model_asset_version: "legacy-asset-version",
    modelAssetSha256: "a".repeat(64),
    modelUpdatedAt: "2026-07-01T17:31:43.000Z",
    ownerMeshyPipeline: true,
    modelStatus: "ready"
  });

  assert.deepEqual(cleaned, {
    description: "Assiette maison",
    priceHint: "22",
    allergens: ["lait"],
    customNote: { service: "midi" },
    photoStatus: "ready",
    photoStorageBucket: "vistaire-media",
    photoStoragePath: `restaurants/${restaurantId}/photos/originals/dejeuner.png`,
    modelStatus: "missing"
  });
});

test("hasDishModelMetadata distinguishes missing state from active model metadata", () => {
  assert.equal(hasDishModelMetadata({ modelStatus: "missing" }), false);
  assert.equal(hasDishModelMetadata({ photoStatus: "ready" }), false);
  assert.equal(hasDishModelMetadata({ modelStatus: "ready" }), true);
  assert.equal(hasDishModelMetadata({ modelAssetVersion: "meshy-20260701-abc123def456" }), true);
  assert.equal(hasDishModelMetadata({ webModel3dUrl: "/api/public/menu-dishes/dish/model/glb" }), true);
  assert.equal(
    hasDishModelMetadata({
      preparedGlbStoragePath: `restaurants/${restaurantId}/models/staging/job_prepared_12345678/source.glb`
    }),
    true
  );
});

test("dish model DELETE route is guarded, scoped, and cleans only server-side model targets", async () => {
  const route = await readFile(
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/route.ts",
    "utf8"
  );
  const uploadRoute = await readFile(
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/glb/route.ts",
    "utf8"
  );
  const publishRoute = await readFile(
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/publish/route.ts",
    "utf8"
  );

  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /requireVistaireOwnerApi\(\)/);
  assert.match(route, /requireSameOriginOwnerMutation\(request\)/);
  assert.doesNotMatch(route, /requireOwner3dRestaurantAccess/);
  assert.doesNotMatch(uploadRoute, /requireOwner3dRestaurantAccess/);
  assert.doesNotMatch(publishRoute, /requireOwner3dRestaurantAccess/);
  assert.match(route, /\.eq\("id", dishId\)/);
  assert.match(route, /\.eq\("restaurant_id", restaurantId\)/);
  assert.match(route, /collectDishModelStorageTargets\(dish\.metadata, restaurantId\)/);
  assert.match(route, /storage\.from\(bucket\)\.remove\(paths\)/);
  assert.match(route, /cleanDishModelMetadata\(dish\.metadata\)/);
  assert.match(route, /has_immersive_view: false/);
  assert.doesNotMatch(route, /request\.json\(\).*StoragePath/s);
});

test("owner model uploader exposes a confirmed delete flow and clears local model state on success", async () => {
  const uploader = await readFile("components/owner/OwnerDishModelUploader.tsx", "utf8");
  const mediaManager = await readFile("components/owner/OwnerRestaurantMediaManager.tsx", "utf8");
  const modelsManager = await readFile("components/owner/OwnerRestaurant3dManager.tsx", "utf8");

  assert.match(uploader, /method: "DELETE"/);
  assert.match(uploader, /Supprimer mod/);
  assert.match(uploader, /GLB web/);
  assert.match(uploader, /USDZ iPhone/);
  assert.match(uploader, /Telecharger USDZ/);
  assert.match(uploader, /download=\{usdzDownloadFileName\}/);
  assert.match(uploader, /buildUsdzDownloadFileName/);
  assert.match(uploader, /\.usdz`/);
  assert.match(uploader, /setWebModel3dUrl\(""\)/);
  assert.match(uploader, /setArUsdzUrl\(""\)/);
  assert.match(uploader, /setStoragePath\(""\)/);
  assert.match(uploader, /setJobId\(""\)/);
  assert.match(uploader, /router\.refresh\(\)/);
  assert.match(mediaManager, /dishName=\{dish\.name\}/);
  assert.match(modelsManager, /dishName=\{dish\.name\}/);
});
