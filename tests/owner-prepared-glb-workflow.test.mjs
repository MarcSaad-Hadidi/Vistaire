import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildPreparedModelMetadata,
  buildPreparedModelPublicArLiteGlbPath,
  buildPreparedModelStoragePath,
  buildPreparedModelUsdzStoragePath,
  buildPreparedModelWebStoragePath,
  isPreparedGlbPipelineStep
} from "../lib/owner/preparedModelWorkflow.ts";

const restaurantId = "11111111-2222-4333-8444-555555555555";

test("prepared GLB workflow uses explicit storage paths and metadata without optimization", () => {
  const storagePath = buildPreparedModelStoragePath({
    restaurantId,
    jobId: "job_prepared_12345678",
    sha256: "a".repeat(64)
  });

  assert.equal(
    storagePath,
    `restaurants/${restaurantId}/models/staging/job_prepared_12345678/source.glb`
  );
  assert.doesNotMatch(storagePath, /\.\.|\\|public\/models|assets\/3d\/source/);
  assert.equal(
    buildPreparedModelWebStoragePath({ restaurantId, dishSlug: "dejeuner-classique-maison" }),
    `restaurants/${restaurantId}/models/web/dejeuner-classique-maison.glb`
  );
  assert.equal(
    buildPreparedModelUsdzStoragePath({ restaurantId, dishSlug: "dejeuner-classique-maison" }),
    `restaurants/${restaurantId}/models/ar-ios/dejeuner-classique-maison.usdz`
  );
  assert.equal(
    buildPreparedModelPublicArLiteGlbPath(restaurantId),
    `/api/public/menu-dishes/${restaurantId}/model/glb?variant=ar-lite`
  );

  assert.deepEqual(
    buildPreparedModelMetadata({
      webModel3dUrl: "https://cdn.example.test/dish.glb",
      arUsdzUrl: "",
      sourceJobId: "job_prepared_12345678"
    }),
    {
      webModel3dUrl: "https://cdn.example.test/dish.glb",
      model3dUrl: "https://cdn.example.test/dish.glb",
      arUsdzUrl: "",
      modelStatus: "web_ready_usdz_pending",
      preparedGlbJobId: "job_prepared_12345678"
    }
  );
  assert.equal(isPreparedGlbPipelineStep("prepared_usdz"), true);
  assert.equal(isPreparedGlbPipelineStep("optimize"), false);
});

test("prepared GLB owner routes are guarded and run the Meshy owner pipeline", async () => {
  const uploadRoute = await readFile(
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/glb/route.ts",
    "utf8"
  );
  const publishRoute = await readFile(
    "app/api/owner/restaurants/[restaurantId]/dishes/[dishId]/model/publish/route.ts",
    "utf8"
  );
  const migration = await readFile(
    "supabase/migrations/0014_owner_prepared_glb_pipeline.sql",
    "utf8"
  );
  const creationMigration = await readFile(
    "supabase/migrations/0013_create_owner_restaurant_with_menu.sql",
    "utf8"
  );
  const meshyPipeline = await readFile("lib/owner/restaurantMeshyPipeline.ts", "utf8");
  const arLiteBuilder = await readFile("scripts/build-demo-ar-lite-assets.mjs", "utf8");
  const iosBuilder = await readFile("scripts/build-ios-quicklook-ultra-assets.mjs", "utf8");
  const publicGlbRoute = await readFile(
    "app/api/public/menu-dishes/[dishId]/model/glb/route.ts",
    "utf8"
  );
  const dish3dManifest = await readFile("lib/dish3dManifest.ts", "utf8");
  const packageJson = await readFile("package.json", "utf8");
  const nextConfig = await readFile("next.config.ts", "utf8");

  for (const source of [uploadRoute, publishRoute]) {
    assert.match(source, /runtime = "nodejs"/);
    assert.match(source, /requireVistaireOwnerApi\(\)/);
    assert.match(source, /requireSameOriginOwnerMutation\(request\)/);
    assert.match(source, /\.eq\("id", dishId\)/);
    assert.match(source, /\.eq\("restaurant_id", restaurantId\)/);
    assert.match(source, /runRestaurantMeshyDishPipeline/);
    assert.doesNotMatch(source, /glb-shrink/i);
  }

  assert.match(meshyPipeline, /scripts\/owner\/build-restaurant-meshy-dish\.mjs/);
  assert.match(meshyPipeline, /tmp_owner_3d_uploads/);
  assert.match(meshyPipeline, /\/models\/restaurants\//);
  assert.match(meshyPipeline, /owner-meshy-pipeline/);
  assert.match(meshyPipeline, /publishMeshyAssetsToStorage/);
  assert.match(meshyPipeline, /storage\s*\.from\(MODEL_BUCKET\)\s*\.upload/);
  assert.match(meshyPipeline, /webModel3dStoragePath/);
  assert.match(meshyPipeline, /arModel3dStoragePath/);
  assert.match(meshyPipeline, /arUsdzStoragePath/);
  assert.match(meshyPipeline, /webModel3dBytes/);
  assert.match(meshyPipeline, /arModel3dBytes/);
  assert.match(meshyPipeline, /arUsdzBytes/);
  assert.match(meshyPipeline, /buildPreparedModelPublicGlbPath/);
  assert.match(meshyPipeline, /buildPreparedModelPublicArLiteGlbPath/);
  assert.match(meshyPipeline, /buildPreparedModelPublicUsdzPath/);
  assert.match(meshyPipeline, /manual_runner_command/);
  assert.match(meshyPipeline, /worker_kind: "external_worker"/);
  assert.match(meshyPipeline, /insertedJob\.error/);
  assert.doesNotMatch(meshyPipeline, /glb-shrink/i);
  assert.doesNotMatch(meshyPipeline, /3d:optimize|optimize-heavy|optimize-dish/);
  assert.match(migration, /prepared_usdz/);
  assert.match(migration, /pending_manual_usdz/);
  assert.match(creationMigration, /create table if not exists public\.menus/);
  assert.match(creationMigration, /create table if not exists public\.menu_categories/);
  assert.match(creationMigration, /create table if not exists public\.menu_dishes/);
  assert.match(creationMigration, /v_menu_row public\.menus%rowtype/);
  assert.match(arLiteBuilder, /createOwnerProfile/);
  assert.doesNotMatch(arLiteBuilder, /Unknown Meshy profile slug/);
  assert.match(iosBuilder, /createOwnerDish/);
  assert.doesNotMatch(iosBuilder, /Unknown dish slug/);
  assert.match(publicGlbRoute, /variant === "ar-lite"/);
  assert.match(publicGlbRoute, /arModel3dStoragePath/);
  assert.match(dish3dManifest, /PUBLIC_MODEL_ROUTE_PATTERN/);
  assert.match(dish3dManifest, /\?variant=ar-lite/);
  assert.match(nextConfig, /OWNER_MODEL_PIPELINE_TRACE_EXCLUDES/);
  assert.match(nextConfig, /\/api\/owner\/restaurants\/\*\/dishes\/\*\/model\/glb/);
  assert.match(nextConfig, /\/api\/owner\/restaurants\/\*\/dishes\/\*\/model\/publish/);
  assert.match(nextConfig, /public\/\*\*\//);
  assert.doesNotMatch(migration, /glb-shrink/i);
  assert.doesNotMatch(packageJson, /glb-shrink/i);
});
