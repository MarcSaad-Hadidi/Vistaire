import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildDishPhotoPublicPath,
  buildDishPhotoStoragePath,
  buildDishPhotoV2StoragePath,
  buildDishPhotoDerivativeV2StoragePath,
  inspectDishPhotoFile,
  mergeDishPhotoMetadata,
  validateDishPhotoFile
} from "../lib/owner/dishPhotoUpload.ts";
import { DISH_PHOTO_RECIPE } from "../lib/owner/dishPhotoRecipe.ts";

const restaurantId = "11111111-2222-4333-8444-555555555555";
const dishId = "22222222-3333-4444-8555-666666666666";
const maisonElyseRestaurantId = "11111111-1111-1111-1111-111111111111";

const tinyPng = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489",
  "hex"
);
const validTinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test("dish photo upload accepts image bytes and rejects non-images", () => {
  const valid = validateDishPhotoFile(
    {
      name: "betteraves.png",
      type: "image/png",
      size: tinyPng.byteLength,
      bytes: tinyPng
    },
    5 * 1024 * 1024
  );

  assert.equal(valid.ok, true);
  assert.equal(valid.extension, "png");
  assert.equal(valid.contentType, "image/png");

  assert.deepEqual(
    validateDishPhotoFile(
      {
        name: "model.glb",
        type: "model/gltf-binary",
        size: 4,
        bytes: Buffer.from("glTF")
      },
      5 * 1024 * 1024
    ),
    {
      ok: false,
      status: 400,
      error: "Seules les images JPEG, PNG ou WebP sont acceptees."
    }
  );
});

test("dish photo v2 recipe and paths are immutable/content-addressed", async () => {
  assert.equal(DISH_PHOTO_RECIPE.id, "dish-photo-v2");
  assert.deepEqual(Object.keys(DISH_PHOTO_RECIPE.variants), ["thumbnail", "card", "display"]);
  const sourceSha = "a".repeat(64);
  const outputSha = "b".repeat(64);
  assert.equal(
    buildDishPhotoV2StoragePath({ restaurantId, sha256: sourceSha, extension: "png" }),
    `restaurants/${restaurantId}/photos/originals/${sourceSha}.png`
  );
  assert.equal(
    buildDishPhotoDerivativeV2StoragePath({ restaurantId, sourceSha256: sourceSha, recipeId: DISH_PHOTO_RECIPE.id, variant: "card", outputSha256: outputSha }),
    `restaurants/${restaurantId}/photos/derivatives/${sourceSha}/${DISH_PHOTO_RECIPE.id}/card-${outputSha}.webp`
  );
  const inspected = await inspectDishPhotoFile({ name: "photo.png", type: "image/png", size: validTinyPng.byteLength, bytes: validTinyPng }, 5 * 1024 * 1024);
  assert.equal(inspected.ok, true);
  assert.equal(inspected.inspection?.pages, 1);
});

test("dish photo upload rejects oversized files and path filenames", () => {
  assert.equal(
    validateDishPhotoFile(
      {
        name: "../photo.png",
        type: "image/png",
        size: tinyPng.byteLength,
        bytes: tinyPng
      },
      5 * 1024 * 1024
    ).ok,
    false
  );
  assert.deepEqual(
    validateDishPhotoFile(
      {
        name: "photo.png",
        type: "image/png",
        size: 6 * 1024 * 1024,
        bytes: Buffer.alloc(6 * 1024 * 1024)
      },
      5 * 1024 * 1024
    ),
    {
      ok: false,
      status: 413,
      error: "Photo trop volumineuse."
    }
  );
});

test("dish photo storage path and public path are generated from trusted ids", () => {
  const storagePath = buildDishPhotoStoragePath({
    restaurantId,
    dishId,
    dishSlug: "Betteraves roties",
    extension: "png",
    sha256: "a".repeat(64)
  });

  assert.match(
    storagePath,
    /^restaurants\/11111111-2222-4333-8444-555555555555\/photos\/originals\/betteraves-roties-[a-f0-9]{12}\.png$/
  );
  assert.doesNotMatch(storagePath, /\.\.|\\|public\/|3D Plat|3D photo/);
  assert.equal(
    buildDishPhotoPublicPath(dishId),
    `/api/public/menu-dishes/${dishId}/photo`
  );
  assert.equal(
    buildDishPhotoPublicPath(dishId, { assetVersion: "A".repeat(64) }),
    `/api/public/menu-dishes/${dishId}/photo?v=${"a".repeat(64)}`
  );
  assert.throws(
    () => buildDishPhotoPublicPath(dishId, { assetVersion: "short-sha" }),
    /version/i
  );
});

test("dish photo storage accepts the Maison Elyse legacy restaurant id only as a safe storage segment", () => {
  assert.equal(
    buildDishPhotoStoragePath({
      restaurantId: maisonElyseRestaurantId,
      dishId,
      dishSlug: "tartare-saumon",
      extension: "jpg",
      sha256: "a".repeat(64)
    }),
    `restaurants/${maisonElyseRestaurantId}/photos/originals/tartare-saumon-${"a".repeat(12)}.jpg`
  );

  for (const unsafeRestaurantId of [
    "",
    "../",
    "restaurant/1",
    "restaurant\\1",
    "https://example.test/restaurant",
    " 11111111-1111-1111-1111-111111111111",
    "11111111-1111-1111-1111-111111111111 ",
    "11111111-1111-1111-1111-111111111111%20",
    "dish-2"
  ]) {
    assert.throws(
      () =>
        buildDishPhotoStoragePath({
          restaurantId: unsafeRestaurantId,
          dishId,
          dishSlug: "tartare-saumon",
          extension: "jpg",
          sha256: "a".repeat(64)
        }),
      /Identifiants photo invalides/,
      unsafeRestaurantId
    );
  }
});

test("dish photo metadata merge keeps existing fields and marks photo ready", () => {
  assert.deepEqual(
    mergeDishPhotoMetadata(
      { ingredients: ["betterave"], modelStatus: "missing" },
      {
        storageBucket: "vistaire-media",
        storagePath: "restaurants/x/photos/originals/dish.png",
        sha256: "b".repeat(64),
        contentType: "image/png",
        bytes: 123
      }
    ),
    {
      ingredients: ["betterave"],
      modelStatus: "missing",
      photoStatus: "ready",
      photoStorageBucket: "vistaire-media",
      photoStoragePath: "restaurants/x/photos/originals/dish.png",
      photoSha256: "b".repeat(64),
      photoContentType: "image/png",
      photoBytes: 123,
      photoDerivatives: {}
    }
  );
});

test("dish photo upload API and public redirect use guarded server-side storage", async () => {
  const uploadRoute = await readFile(
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/photo/route.ts",
    "utf8"
  );
  const publicRoute = await readFile(
    "app/api/public/menu-dishes/[dishId]/photo/route.ts",
    "utf8"
  );
  const redirectHelper = await readFile("lib/publicDishAssetRedirect.ts", "utf8");

  assert.match(uploadRoute, /runtime = "nodejs"/);
  assert.match(uploadRoute, /requireVistaireOwnerApi\(\)/);
  assert.match(uploadRoute, /requireSameOriginOwnerMutation\(request\)/);
  assert.match(uploadRoute, /\.eq\("id", dishId\)/);
  assert.match(uploadRoute, /\.eq\("restaurant_id", restaurantId\)/);
  assert.match(uploadRoute, /validateDishPhotoFile/);
  assert.match(uploadRoute, /storage\.from\(MEDIA_BUCKET\)\.upload/);
  assert.match(uploadRoute, /storage\.from\(MEDIA_BUCKET\)\.remove/);
  assert.match(uploadRoute, /export async function DELETE/);
  assert.match(uploadRoute, /clearDishPhotoMetadata/);
  assert.match(uploadRoute, /cleanupReplacedDishAssets/);
  assert.match(uploadRoute, /previousMetadata: oldMetadata/);
  assert.match(uploadRoute, /nextMetadata: metadata/);
  assert.match(uploadRoute, /warning/);
  assert.doesNotMatch(uploadRoute, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(publicRoute, /redirectPublicDishAsset/);
  assert.match(publicRoute, /kind: "photo"/);
  assert.match(publicRoute, /export async function HEAD/);
  assert.match(redirectHelper, /photoStorageBucket/);
  assert.match(redirectHelper, /photoStoragePath/);
  assert.match(redirectHelper, /storage\.info\(storagePath\)/);
  assert.match(redirectHelper, /storage\.createSignedUrl\((?:storagePath|targetPath), SIGNED_URL_TTL_SECONDS\)/);
  assert.doesNotMatch(redirectHelper, /\.download\s*\(|\.arrayBuffer\s*\(/);
});

test("photo replacement, delete, and dish delete use the shared media cleanup", async () => {
  const uploadRoute = await readFile(
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/photo/route.ts",
    "utf8"
  );
  const dishRoute = await readFile(
    "app/api/owner/restaurants/[restaurantId]/menu/dishes/route.ts",
    "utf8"
  );
  const photoHelper = await readFile("lib/owner/dishPhotoUpload.ts", "utf8");
  const mutations = await readFile("lib/owner/menuMutations.ts", "utf8");

  assert.match(uploadRoute, /DELETE\(\s*request: NextRequest/);
  assert.match(uploadRoute, /image_url: null/);
  assert.match(photoHelper, /delete metadata\.photoStatus/);
  assert.match(photoHelper, /delete metadata\.photoStorageBucket/);
  assert.match(photoHelper, /delete metadata\.photoStoragePath/);
  assert.match(photoHelper, /delete metadata\.photoSha256/);
  assert.match(photoHelper, /delete metadata\.photoContentType/);
  assert.match(photoHelper, /delete metadata\.photoBytes/);
  assert.match(uploadRoute, /reason: "dish-photo-replacement"/);
  assert.match(uploadRoute, /cleanup: replacementCleanup/);
  assert.match(uploadRoute, /skippedCount/);
  assert.match(uploadRoute, /revalidateOwnerMenuMutationPaths/);
  assert.match(dishRoute, /mediaCleanup/);
  assert.match(mutations, /cleanupReplacedDishAssets/);
  assert.match(mutations, /select\("id,name,slug,menu_id,category_id,metadata"\)/);
});

test("photo DELETE clears DB metadata before cross-dish-safe Storage cleanup", async () => {
  const uploadRoute = await readFile(
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/photo/route.ts",
    "utf8"
  );
  const deleteStart = uploadRoute.indexOf("export async function DELETE");
  assert.ok(deleteStart >= 0);
  const deleteRoute = uploadRoute.slice(deleteStart).replace(/\r\n/g, "\n");
  const updateIndex = deleteRoute.indexOf('.update({\n      image_url: null');
  const cleanupIndex = deleteRoute.indexOf("cleanupReplacedDishAssets({");
  assert.ok(updateIndex >= 0, "DELETE must clear the dish metadata");
  assert.ok(cleanupIndex > updateIndex, "Storage cleanup must run after the DB update");
  assert.doesNotMatch(deleteRoute, /deleteDishMediaStorageTargets|collectDishPhotoStorageTarget/);
  assert.match(deleteRoute, /previousMetadata: oldMetadata/);
  assert.match(deleteRoute, /nextMetadata: clearedMetadata/);
});

test("whole-dish deletion also updates DB before cross-dish-safe media cleanup", async () => {
  const mutations = await readFile("lib/owner/menuMutations.ts", "utf8");
  const deleteStart = mutations.indexOf("export async function deleteOwnerMenuDish");
  assert.ok(deleteStart >= 0);
  const deleteMutation = mutations.slice(deleteStart);
  const dbDeleteIndex = deleteMutation.indexOf(".delete()");
  const cleanupIndex = deleteMutation.indexOf("cleanupReplacedDishAssets({");
  assert.ok(dbDeleteIndex >= 0, "dish deletion must be the DB authority");
  assert.ok(cleanupIndex > dbDeleteIndex, "dish media cleanup must run after DB deletion");
  assert.doesNotMatch(deleteMutation, /deleteDishMediaStorageTargets|collectDishMediaStorageTargets/);
  assert.match(deleteMutation, /currentMetadata: \{\}/);
});
