import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  cleanupReplacedDishAssets,
  extractDishAssetRefsFromMetadata
} from "../lib/owner/dishAssetReplacementCleanup.ts";

const restaurantId = "11111111-2222-4333-8444-555555555555";
const dishId = "22222222-3333-4444-8555-666666666666";

function createCleanupClient({
  currentMetadata = {},
  otherRows = [],
  removeError = null,
  removeThrows = false
} = {}) {
  const removed = [];
  const client = {
    removed,
    storage: {
      from(bucket) {
        return {
          async remove(paths) {
            removed.push({ bucket, paths });
            if (removeThrows) throw new Error("storage unavailable");
            return removeError
              ? { data: null, error: { message: removeError } }
              : { data: paths.map((name) => ({ name })), error: null };
          }
        };
      }
    },
    from(table) {
      assert.equal(table, "menu_dishes");
      return {
        select() {
          const state = { otherRows: false };
          const query = {
            eq() {
              return query;
            },
            neq() {
              state.otherRows = true;
              return query;
            },
            async maybeSingle() {
              return { data: { metadata: currentMetadata }, error: null };
            },
            then(resolve, reject) {
              Promise.resolve(
                state.otherRows
                  ? { data: otherRows, error: null }
                  : { data: [{ metadata: currentMetadata }], error: null }
              ).then(resolve, reject);
            }
          };
          return query;
        }
      };
    }
  };
  return client;
}

test("extractDishAssetRefsFromMetadata returns typed photo, GLB, USDZ, source, manifest, and report refs", () => {
  const refs = extractDishAssetRefsFromMetadata(
    {
      photoStorageBucket: "vistaire-media",
      photoStoragePath: `restaurants/${restaurantId}/photos/originals/sole.webp`,
      webModel3dStorageBucket: "vistaire-3d",
      webModel3dStoragePath: `restaurants/${restaurantId}/models/web/sole.glb`,
      arModel3dStorageBucket: "vistaire-3d",
      arModel3dStoragePath: `restaurants/${restaurantId}/models/ar-lite/sole.glb`,
      arUsdzStorageBucket: "vistaire-3d",
      arUsdzStoragePath: `restaurants/${restaurantId}/models/ar-ios/sole.usdz`,
      usdzRuntimeStorageBucket: "vistaire-3d",
      usdzRuntimeStoragePath: `restaurants/${restaurantId}/models/ar-ios/sole-runtime.usdz`,
      sourceModel3dStorageBucket: "vistaire-3d",
      sourceModel3dStoragePath: `restaurants/${restaurantId}/models/source/sole.glb`,
      meshyManifestStorageBucket: "vistaire-3d",
      meshyManifestStoragePath: `restaurants/${restaurantId}/models/manifests/sole.json`,
      usdzOptimizationReportStoragePath: `restaurants/${restaurantId}/models/manifests/sole-report.json`,
      ignoredEmpty: "",
      ignoredNull: null,
      ignoredNumber: 123
    },
    restaurantId
  );

  assert.deepEqual(
    refs.map((ref) => ref.kind),
    ["photo", "web-glb", "ar-lite-glb", "ios-usdz", "ios-usdz", "source-glb", "manifest", "report"]
  );
  assert.equal(refs.every((ref) => ref.bucket && ref.path && ref.requiredPrefix), true);
});

test("cleanupReplacedDishAssets does not delete when previous and next exact paths match", async () => {
  const metadata = {
    photoStorageBucket: "vistaire-media",
    photoStoragePath: `restaurants/${restaurantId}/photos/originals/sole.webp`
  };
  const client = createCleanupClient({ currentMetadata: metadata });

  const report = await cleanupReplacedDishAssets({
    client,
    dishId,
    restaurantId,
    previousMetadata: metadata,
    nextMetadata: metadata,
    reason: "test"
  });

  assert.equal(report.candidates.length, 0);
  assert.deepEqual(client.removed, []);
});

test("cleanupReplacedDishAssets deletes only old exact paths when replacement differs", async () => {
  const previousMetadata = {
    photoStorageBucket: "vistaire-media",
    photoStoragePath: `restaurants/${restaurantId}/photos/originals/sole-old.webp`
  };
  const nextMetadata = {
    photoStorageBucket: "vistaire-media",
    photoStoragePath: `restaurants/${restaurantId}/photos/originals/sole-new.webp`
  };
  const client = createCleanupClient({ currentMetadata: nextMetadata });

  const report = await cleanupReplacedDishAssets({
    client,
    dishId,
    restaurantId,
    previousMetadata,
    nextMetadata,
    reason: "test"
  });

  assert.deepEqual(
    report.deleted.map((ref) => `${ref.bucket}:${ref.path}`),
    [`vistaire-media:restaurants/${restaurantId}/photos/originals/sole-old.webp`]
  );
  assert.deepEqual(client.removed, [
    {
      bucket: "vistaire-media",
      paths: [`restaurants/${restaurantId}/photos/originals/sole-old.webp`]
    }
  ]);
});

test("cleanupReplacedDishAssets protects unsafe buckets, prefixes, and dangerous path shapes", async () => {
  const previousMetadata = {
    photoStorageBucket: "evil",
    photoStoragePath: `restaurants/${restaurantId}/photos/originals/sole.webp`,
    webModel3dStorageBucket: "vistaire-3d",
    webModel3dStoragePath: `restaurants/${restaurantId}/models/source/sole.glb`,
    arModel3dStorageBucket: "vistaire-3d",
    arModel3dStoragePath: `restaurants/${restaurantId}/models/ar-lite/..\\secret.glb`
  };
  const client = createCleanupClient({ currentMetadata: {} });

  const report = await cleanupReplacedDishAssets({
    client,
    dishId,
    restaurantId,
    previousMetadata,
    nextMetadata: {},
    reason: "test"
  });

  assert.equal(report.skippedUnsafeBucket.length, 1);
  assert.equal(report.skippedUnsafePrefix.length, 2);
  assert.deepEqual(report.deleted, []);
  assert.deepEqual(client.removed, []);
});

test("cleanupReplacedDishAssets skips old assets still referenced by another dish", async () => {
  const oldPath = `restaurants/${restaurantId}/models/web/shared.glb`;
  const previousMetadata = {
    webModel3dStorageBucket: "vistaire-3d",
    webModel3dStoragePath: oldPath
  };
  const nextMetadata = {
    webModel3dStorageBucket: "vistaire-3d",
    webModel3dStoragePath: `restaurants/${restaurantId}/models/web/new.glb`
  };
  const client = createCleanupClient({
    currentMetadata: nextMetadata,
    otherRows: [{ id: "33333333-4444-4555-8666-777777777777", is_available: true, metadata: previousMetadata }]
  });

  const report = await cleanupReplacedDishAssets({
    client,
    dishId,
    restaurantId,
    previousMetadata,
    nextMetadata,
    reason: "test"
  });

  assert.equal(report.skippedStillReferenced.length, 1);
  assert.deepEqual(client.removed, []);
});

test("cleanupReplacedDishAssets reports cleanup errors without throwing after DB success", async () => {
  const previousMetadata = {
    arUsdzStorageBucket: "vistaire-3d",
    arUsdzStoragePath: `restaurants/${restaurantId}/models/ar-ios/sole-old.usdz`
  };
  const nextMetadata = {
    arUsdzStorageBucket: "vistaire-3d",
    arUsdzStoragePath: `restaurants/${restaurantId}/models/ar-ios/sole-new.usdz`
  };
  const client = createCleanupClient({ currentMetadata: nextMetadata, removeError: "network down" });

  const report = await cleanupReplacedDishAssets({
    client,
    dishId,
    restaurantId,
    previousMetadata,
    nextMetadata,
    reason: "test"
  });

  assert.equal(report.deleted.length, 0);
  assert.deepEqual(report.errors, [
    {
      bucket: "vistaire-3d",
      paths: [`restaurants/${restaurantId}/models/ar-ios/sole-old.usdz`],
      message: "network down"
    }
  ]);
});

test("cleanupReplacedDishAssets converts thrown remove failures into warnings without deleting active replacements", async () => {
  const previousMetadata = {
    usdzRuntimeStorageBucket: "vistaire-3d",
    usdzRuntimeStoragePath: `restaurants/${restaurantId}/models/ar-ios/sole-old.usdz`
  };
  const nextMetadata = {
    usdzRuntimeStorageBucket: "vistaire-3d",
    usdzRuntimeStoragePath: `restaurants/${restaurantId}/models/ar-ios/sole-new.usdz`
  };
  const client = createCleanupClient({ currentMetadata: nextMetadata, removeThrows: true });

  const report = await cleanupReplacedDishAssets({
    client,
    dishId,
    restaurantId,
    previousMetadata,
    nextMetadata,
    reason: "test"
  });

  assert.equal(report.deleted.length, 0);
  assert.deepEqual(report.errors, [
    {
      bucket: "vistaire-3d",
      paths: [`restaurants/${restaurantId}/models/ar-ios/sole-old.usdz`],
      message: "storage unavailable"
    }
  ]);
  assert.deepEqual(client.removed, [
    {
      bucket: "vistaire-3d",
      paths: [`restaurants/${restaurantId}/models/ar-ios/sole-old.usdz`]
    }
  ]);
});

test("viewer GLB upload rolls back the newly uploaded file when DB update fails", async () => {
  const source = await readFile("lib/owner/viewerGlbUpload.ts", "utf8");

  assert.match(source, /await uploadGlb\(args\.adminClient, plan\.webStoragePath, args\.sourceBytes\)/);
  assert.match(source, /activeViewerPaths/);
  assert.match(source, /if \(updated\.error \|\| !updated\.data\) \{/);
  assert.match(source, /await rollbackUploadedGlb\(args\.adminClient, plan\.webStoragePath, activeViewerPaths\)/);
  assert.match(source, /protectedPaths\.some\(\(protectedPath\) => protectedPath\.trim\(\) === path\)/);
  assert.match(source, /storage\.from\(MODEL_BUCKET\)\.remove\(\[path\]\)/);
});

test("public photo, GLB, and USDZ routes redirect active metadata objects through the shared guard", async () => {
  const photoRoute = await readFile(
    "app/api/public/menu-dishes/[dishId]/photo/route.ts",
    "utf8"
  );
  const glbRoute = await readFile(
    "app/api/public/menu-dishes/[dishId]/model/glb/route.ts",
    "utf8"
  );
  const usdzRoute = await readFile(
    "app/api/public/menu-dishes/[dishId]/model/usdz/route.ts",
    "utf8"
  );
  const redirectHelper = await readFile("lib/publicDishAssetRedirect.ts", "utf8");

  assert.match(photoRoute, /redirectPublicDishAsset/);
  assert.match(photoRoute, /kind: "photo"/);
  assert.match(glbRoute, /redirectPublicDishAsset/);
  assert.match(glbRoute, /variant === "ar-lite"/);
  assert.match(usdzRoute, /redirectPublicDishAsset/);
  assert.match(usdzRoute, /kind: "usdz"/);
  assert.match(redirectHelper, /photoStorageBucket/);
  assert.match(redirectHelper, /photoStoragePath/);
  assert.match(redirectHelper, /webModel3dStoragePath/);
  assert.match(redirectHelper, /arModel3dStoragePath/);
  assert.match(redirectHelper, /arUsdzStoragePath/);
  assert.match(redirectHelper, /modelAssetVersion/);
  assert.match(redirectHelper, /storage\.info\(storagePath\)/);
  assert.match(redirectHelper, /storage\.createSignedUrl\(storagePath, SIGNED_URL_TTL_SECONDS\)/);
  assert.doesNotMatch(redirectHelper, /\.download\s*\(|\.arrayBuffer\s*\(/);
});
