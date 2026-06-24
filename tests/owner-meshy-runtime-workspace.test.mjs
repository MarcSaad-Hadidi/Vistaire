import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createOwnerMeshyRuntimeWorkspace,
  resolveOwnerMeshyAssetPath
} from "../lib/owner/meshyRuntimeWorkspace.ts";

test("owner Meshy runtime workspace is unique, temporary, and cleaned up", async () => {
  const tempParent = await mkdtemp(join(tmpdir(), "vistaire-workspace-test-"));
  const workspace = createOwnerMeshyRuntimeWorkspace({
    tempRoot: tempParent,
    restaurantSlug: "trouvable",
    dishSlug: "dejeuner-classique-maison",
    jobId: "job_meshy_test"
  });

  try {
    assert.equal(existsSync(workspace.rootDir), true);
    assert.equal(existsSync(workspace.outputRoot), true);
    assert.equal(workspace.rootDir.startsWith(tempParent), true);
    assert.equal(workspace.outputRoot.startsWith(workspace.rootDir), true);
    assert.doesNotMatch(workspace.rootDir, /tmp_owner_3d_uploads|public[\\/]models|[\\/]var[\\/]task/);
  } finally {
    workspace.cleanup();
    rmSync(tempParent, { recursive: true, force: true });
  }

  assert.equal(existsSync(workspace.rootDir), false);
});

test("owner Meshy asset paths resolve from output root instead of public URLs", async () => {
  const tempParent = await mkdtemp(join(tmpdir(), "vistaire-asset-test-"));
  const outputRoot = join(tempParent, "output");
  const assetPath = join(
    outputRoot,
    "models",
    "restaurants",
    "trouvable",
    "principal",
    "dejeuner-classique-maison",
    "meshy-20260624",
    "web",
    "dish.glb"
  );
  mkdirSync(join(assetPath, ".."), { recursive: true });
  writeFileSync(assetPath, "glb");

  try {
    assert.equal(
      resolveOwnerMeshyAssetPath({
        outputRoot,
        assetRoot: join(
          outputRoot,
          "models",
          "restaurants",
          "trouvable",
          "principal",
          "dejeuner-classique-maison",
          "meshy-20260624"
        ),
        assetUrl: "/models/restaurants/trouvable/principal/dejeuner-classique-maison/meshy-20260624/web/dish.glb"
      }),
      assetPath
    );
    assert.throws(() =>
      resolveOwnerMeshyAssetPath({
        outputRoot,
        assetRoot: join(
          outputRoot,
          "models",
          "restaurants",
          "trouvable",
          "principal",
          "dejeuner-classique-maison",
          "meshy-20260624"
        ),
        assetUrl: "/models/restaurants/trouvable/principal/dejeuner-classique-maison/meshy-20260624/../secret.glb"
      })
    );
    assert.throws(() =>
      resolveOwnerMeshyAssetPath({
        outputRoot,
        assetRoot: join(
          outputRoot,
          "models",
          "restaurants",
          "trouvable",
          "principal",
          "dejeuner-classique-maison",
          "meshy-20260624"
        ),
        assetUrl: "https://cdn.example.test/dish.glb"
      })
    );
  } finally {
    rmSync(tempParent, { recursive: true, force: true });
  }
});

test("owner Meshy pipeline and scripts use runtime output roots in owner mode", async () => {
  const pipeline = await readFile("lib/owner/restaurantMeshyPipeline.ts", "utf8");
  const ownerScript = await readFile("scripts/owner/build-restaurant-meshy-dish.mjs", "utf8");
  const arLiteScript = await readFile("scripts/build-demo-ar-lite-assets.mjs", "utf8");
  const iosScript = await readFile("scripts/build-ios-quicklook-ultra-assets.mjs", "utf8");

  assert.match(pipeline, /createOwnerMeshyRuntimeWorkspace/);
  assert.match(pipeline, /--output-root/);
  assert.match(pipeline, /outputRoot/);
  assert.doesNotMatch(pipeline, /tmp_owner_3d_uploads/);
  assert.doesNotMatch(pipeline, /publicUrlToLocalPath/);

  assert.match(ownerScript, /--output-root/);
  assert.match(ownerScript, /VISTAIRE_MESHY_OUTPUT_ROOT/);
  assert.match(ownerScript, /VISTAIRE_MESHY_ASSET_ROOT/);
  assert.match(ownerScript, /localPaths/);
  assert.match(ownerScript, /sourceFile: outputRoot \? basename\(sourcePath\) : options\.source/);

  assert.match(arLiteScript, /isAbsolute/);
  assert.match(iosScript, /isAbsolute/);
  assert.match(iosScript, /VISTAIRE_MESHY_CANDIDATE_ROOT/);
  assert.match(iosScript, /VISTAIRE_MESHY_WORK_ROOT/);
});
