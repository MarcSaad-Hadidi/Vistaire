import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("model lab optimize route is owner-only, no-store, and returns binary GLB", () => {
  const route = read("app/api/owner/model-lab/optimize/route.ts");
  const headers = read("lib/owner/modelLab/modelLabHeaders.ts");

  assert.match(route, /export const runtime = "nodejs"/);
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /requireVistaireOwnerApi/);
  assert.match(route, /requireSameOriginOwnerMutation/);
  assert.match(route, /validateModelLabContentLength/);
  assert.match(route, /validateModelLabOptimizationBudget/);
  assert.match(route, /request\.headers\.get\("content-length"\)/);
  assert.match(headers, /Cache-Control": "no-store, no-cache, must-revalidate"/);
  assert.match(headers, /Content-Type": "model\/gltf-binary"/);
  assert.match(headers, /Content-Disposition": `attachment; filename="/);
  assert.match(headers, /X-Content-Type-Options": "nosniff"/);
  assert.doesNotMatch(route, /base64/i);
  assert.doesNotMatch(route, /Promise\.race/);
});

test("model lab code does not write or store GLB assets", () => {
  const files = [
    "app/api/owner/model-lab/inspect/route.ts",
    "app/api/owner/model-lab/optimize/route.ts",
    "lib/owner/modelLab/inspectGlb.ts",
    "lib/owner/modelLab/optimizeGlb.ts",
    "lib/owner/modelLab/optimizeWorker.mjs",
    "components/owner/model-lab/ModelLabClient.tsx",
    "components/owner/model-lab/ModelLabBeforeAfter.tsx",
    "components/owner/model-lab/ModelLabViewer.tsx"
  ];
  const combined = files.map(read).join("\n");

  assert.doesNotMatch(combined, /writeFile|writeFileSync|createWriteStream|mkdir|rmSync/);
  assert.doesNotMatch(combined, /getSupabase|@supabase|storage\.from|\.insert\(/);
  assert.doesNotMatch(combined, /public\/models|public\\models|assets\/3d\/work|assets\\3d\\work/);
  assert.doesNotMatch(combined, /public\/videos|public\\videos|public\/frames|public\\frames/);
});

test("model lab optimizer runs in a killable worker with output caps", () => {
  const optimizer = read("lib/owner/modelLab/optimizeGlb.ts");
  const worker = read("lib/owner/modelLab/optimizeWorker.mjs");
  const nextConfig = read("next.config.ts");

  assert.match(optimizer, /spawn\(process\.execPath/);
  assert.match(optimizer, /child\.kill\("SIGKILL"\)/);
  assert.match(optimizer, /MODEL_LAB_OPTIMIZE_TIMEOUT_MS/);
  assert.match(optimizer, /MODEL_LAB_OPTIMIZED_MAX_BYTES/);
  assert.match(worker, /await document\.transform/);
  assert.match(worker, /stdout\.write/);
  assert.match(nextConfig, /\/api\/owner\/model-lab\/optimize/);
  assert.match(nextConfig, /lib\/owner\/modelLab\/optimizeWorker\.mjs/);
});

test("model lab before-after viewer synchronizes camera safely without AR", () => {
  const beforeAfter = read("components/owner/model-lab/ModelLabBeforeAfter.tsx");
  const viewer = read("components/owner/model-lab/ModelLabViewer.tsx");

  assert.match(beforeAfter, /requestAnimationFrame/);
  assert.match(beforeAfter, /ignoredCameraSignatures/);
  assert.match(beforeAfter, /cameraStateSignature/);
  assert.match(beforeAfter, /readModelLabCameraState/);
  assert.match(beforeAfter, /applyModelLabCameraState/);
  assert.match(beforeAfter, /role="tablist"/);
  assert.match(beforeAfter, /aria-selected/);
  assert.match(beforeAfter, /Reset camera/);
  assert.match(beforeAfter, /Aligner/);
  assert.match(viewer, /camera-change/);
  assert.match(viewer, /removeEventListener\("camera-change"/);
  assert.match(viewer, /cameraOrbit/);
  assert.match(viewer, /cameraTarget/);
  assert.match(viewer, /fieldOfView/);
  assert.doesNotMatch(viewer, /"ios-src"|ar-modes|quick-look|scene-viewer|activateAR/);
  assert.doesNotMatch(beforeAfter, /Promise\.all/);
});

test("model lab frontend uses sequential binary generation and cleans Blob URLs", () => {
  const client = read("components/owner/model-lab/ModelLabClient.tsx");
  const beforeAfter = read("components/owner/model-lab/ModelLabBeforeAfter.tsx");

  assert.match(client, /response\.blob\(\)/);
  assert.match(client, /URL\.createObjectURL/);
  assert.match(client, /URL\.revokeObjectURL/);
  assert.match(client, /for \(const preset of MODEL_LAB_PRESETS\)/);
  assert.match(client, /fileToken/);
  assert.match(client, /externalUris\.length > 0/);
  assert.match(beforeAfter, /blockedReason/);
  assert.doesNotMatch(client, /Promise\.all/);
});

test("model lab inspect reports external URIs and bounds without storage", () => {
  const inspect = read("lib/owner/modelLab/inspectGlb.ts");
  const validation = read("lib/owner/modelLab/modelLabValidation.ts");

  assert.match(validation, /GLB magic header must be glTF/);
  assert.match(validation, /Only GLB version 2 is accepted/);
  assert.match(validation, /GLB declared length does not match/);
  assert.match(validation, /GLB JSON chunk must be first/);
  assert.match(inspect, /externalUris/);
  assert.match(inspect, /collectBounds/);
  assert.match(inspect, /collectTextureMetrics/);
  assert.match(inspect, /warnings\.push/);
});
