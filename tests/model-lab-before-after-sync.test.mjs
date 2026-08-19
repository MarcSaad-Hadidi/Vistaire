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
  const configRoute = read("app/api/owner/model-lab/config/route.ts");
  const headers = read("lib/owner/modelLab/modelLabHeaders.ts");
  const multipart = read("lib/owner/modelLab/modelLabMultipart.ts");

  assert.match(route, /export const runtime = "nodejs"/);
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(configRoute, /export const runtime = "nodejs"/);
  assert.match(configRoute, /export const dynamic = "force-dynamic"/);
  assert.match(configRoute, /requireVistaireOwnerApi/);
  assert.match(configRoute, /modelLabConfigResponse/);
  assert.match(route, /requireVistaireOwnerApi/);
  assert.match(route, /requireSameOriginOwnerMutation/);
  assert.match(route, /readModelLabMultipartRequest/);
  assert.match(multipart, /request\.arrayBuffer\(\)/);
  assert.match(multipart, /MODEL_LAB multipart|multipart/i);
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

test("same-origin owner mutation guard accepts forwarded public origins only", () => {
  const ownerApi = read("lib/auth/ownerApi.ts");

  assert.match(ownerApi, /allowedOwnerMutationOrigins/);
  assert.match(ownerApi, /x-forwarded-proto/);
  assert.match(ownerApi, /x-forwarded-host/);
  assert.match(ownerApi, /request\.headers\.get\("host"\)/);
  assert.match(ownerApi, /VISTAIRE_OWNER_ALLOWED_ORIGINS/);
  assert.match(ownerApi, /allowedOwnerMutationOrigins\(request\)\.has\(origin\)/);
  assert.match(ownerApi, /fetchSite !== "same-origin" && fetchSite !== "none"/);
  assert.match(ownerApi, /Owner mutation must come from the Vistaire owner app/);
});

test("model lab code does not write or store GLB assets", () => {
  const files = [
    "app/api/owner/model-lab/config/route.ts",
    "app/api/owner/model-lab/inspect/route.ts",
    "app/api/owner/model-lab/optimize/route.ts",
    "lib/owner/modelLab/inspectGlb.ts",
    "lib/owner/modelLab/modelLabMultipart.ts",
    "lib/owner/modelLab/optimizeGlb.ts",
    "lib/owner/modelLab/optimizeWorker.mjs",
    "lib/owner/modelLab/modelLabRiskScore.ts",
    "lib/modelViewerAssetDecoders.ts",
    "components/owner/model-lab/ModelLabClient.tsx",
    "components/owner/model-lab/ModelLabBeforeAfter.tsx",
    "components/owner/model-lab/ModelLabViewer.tsx"
  ];
  const combined = files.map(read).join("\n");
  const nonOptimizerCombined = files
    .filter((file) => file !== "lib/owner/modelLab/optimizeGlb.ts")
    .map(read)
    .join("\n");
  const optimizer = read("lib/owner/modelLab/optimizeGlb.ts");

  assert.doesNotMatch(nonOptimizerCombined, /writeFile|writeFileSync|createWriteStream|mkdir|rmSync/);
  assert.match(optimizer, /mkdtemp\(join\(tmpdir\(\), "vistaire-model-lab-"\)/);
  assert.match(optimizer, /await rm\(tempRoot, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(optimizer, /public\/models|public\\models|assets\/3d\/work|assets\\3d\\work/);
  assert.doesNotMatch(combined, /getSupabase|@supabase|storage\.from|\.insert\(/);
  assert.doesNotMatch(combined, /public\/videos|public\\videos|public\/frames|public\\frames/);
  assert.doesNotMatch(
    combined,
    /(writeFile|writeFileSync|createWriteStream|mkdir|rmSync)[\s\S]{0,160}(public\/models|public\\models|assets\/3d\/work|assets\\3d\\work)/
  );
});

test("model lab limits are exposed by config and the client does not hardcode 25 MB", () => {
  const client = read("components/owner/model-lab/ModelLabClient.tsx");
  const limits = read("lib/owner/modelLab/modelLabLimits.ts");
  const inspectRoute = read("app/api/owner/model-lab/inspect/route.ts");
  const optimizeRoute = read("app/api/owner/model-lab/optimize/route.ts");
  const nextConfig = read("next.config.ts");

  assert.match(client, /\/api\/owner\/model-lab\/config/);
  assert.match(client, /inspectionMaxBytes/);
  assert.match(client, /optimizationMaxBytes/);
  assert.match(client, /optimizationLimitError/);
  assert.match(client, /config\.optimizationMaxBytes/);
  assert.match(client, /config\.inspectionMaxBytes/);
  assert.match(client, /Cible \$\{preset\.targetLabel\}/);
  assert.doesNotMatch(client, /DEFAULT_MODEL_LAB_MAX_BYTES|25 MB|25 \* 1024/);
  assert.match(limits, /DEFAULT_MODEL_LAB_INSPECTION_MAX_BYTES = 100 \* 1024 \* 1024/);
  assert.match(limits, /DEFAULT_MODEL_LAB_OPTIMIZATION_MAX_BYTES = 75 \* 1024 \* 1024/);
  assert.match(limits, /HARD_MODEL_LAB_MAX_BYTES = 250 \* 1024 \* 1024/);
  assert.match(limits, /VISTAIRE_MODEL_LAB_OPTIMIZE_MAX_BYTES \?\? env\.VISTAIRE_MODEL_LAB_MAX_BYTES/);
  assert.match(inspectRoute, /parseModelLabInspectionMaxBytes/);
  assert.match(optimizeRoute, /parseModelLabOptimizationMaxBytes/);
  assert.match(nextConfig, /proxyClientMaxBodySize: MODEL_LAB_PROXY_CLIENT_MAX_BODY_SIZE/);
  assert.match(nextConfig, /parseModelLabInspectionMaxBytes\(process\.env\)/);
  assert.match(nextConfig, /parseModelLabOptimizationMaxBytes\(process\.env\)/);
  assert.match(nextConfig, /Math\.max\(/);
  assert.match(nextConfig, /modelLabLimits\.ts/);
});

test("model lab is visible in the rendered owner portfolio navigation and dashboard", () => {
  const nav = read("lib/owner/nav.ts");
  const shell = read("components/owner/OwnerShell.tsx");
  const ownerPage = read("app/(fr)/owner/page.tsx");

  assert.match(nav, /OWNER_PORTFOLIO_NAV_ITEMS[\s\S]*\/owner\/model-lab/);
  assert.match(shell, /items=\{OWNER_PORTFOLIO_NAV_ITEMS\}/);
  assert.match(ownerPage, /href="\/owner\/model-lab"/);
});

test("model lab optimizer runs in a killable worker with output caps", () => {
  const optimizer = read("lib/owner/modelLab/optimizeGlb.ts");
  const worker = read("lib/owner/modelLab/optimizeWorker.mjs");
  const nextConfig = read("next.config.ts");

  assert.match(optimizer, /spawn\(process\.execPath/);
  assert.match(optimizer, /child\.kill\("SIGKILL"\)/);
  assert.match(optimizer, /child\.stdin\.on\("error"/);
  assert.match(optimizer, /stdinError/);
  assert.match(optimizer, /child\.stdin\.end\(args\.bytes\)/);
  assert.match(optimizer, /gltfpack/);
  assert.match(optimizer, /"-cc"/);
  assert.match(optimizer, /tryGltfpackCc/);
  assert.match(optimizer, /compressionPath/);
  assert.match(optimizer, /3_000/);
  assert.match(optimizer, /MODEL_LAB_OPTIMIZE_TIMEOUT_MS/);
  assert.match(optimizer, /MODEL_LAB_OPTIMIZED_MAX_BYTES/);
  assert.match(worker, /await document\.transform/);
  assert.match(worker, /targetFormat: preset\.textureFormat/);
  assert.match(worker, /textureEffort/);
  assert.match(worker, /meshopt\(\{/);
  assert.match(worker, /geometryCompression === "meshopt"/);
  assert.match(worker, /geometryCompression === "reorder"/);
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
  assert.match(viewer, /addEventListener\("error"/);
  assert.match(viewer, /removeEventListener\("error"/);
  assert.match(viewer, /Affichage 3D impossible pour ce GLB/);
  assert.match(viewer, /configureModelViewerAssetDecoders/);
  assert.match(read("lib/modelViewerAssetDecoders.ts"), /meshoptDecoderLocation/);
  assert.match(viewer, /cameraOrbit/);
  assert.match(viewer, /cameraTarget/);
  assert.match(viewer, /fieldOfView/);
  assert.doesNotMatch(viewer, /"ios-src"|ar-modes|quick-look|scene-viewer|activateAR/);
  assert.doesNotMatch(beforeAfter, /Promise\.all/);
});

test("model lab compact stats do not split short GLB values mid-token", () => {
  const styles = read("components/owner/OwnerCockpit.module.css");

  assert.match(styles, /\.sourceUploadRecord \{\s*display: grid;[\s\S]*minmax\(58px, 1fr\)/);
  assert.match(styles, /\.modelLabViewerStats \{\s*display: grid;[\s\S]*minmax\(62px, 1fr\)/);
  assert.match(styles, /\.sourceUploadRecord dd \{[\s\S]*white-space: nowrap/);
  assert.match(styles, /\.modelLabViewerStats dd \{[\s\S]*white-space: nowrap/);
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
  assert.match(client, /rapport candidat relit temporairement le Blob optimise via \/inspect/);
  assert.match(beforeAfter, /blockedReason/);
  assert.doesNotMatch(client, /Promise\.all/);
});

test("model lab presets do not promise finished USDZ or real-device AR validation", () => {
  const presets = read("lib/owner/modelLab/modelLabPresets.ts");

  assert.match(presets, /id: "safe"/);
  assert.match(presets, /id: "balanced"/);
  assert.match(presets, /id: "target-5mb"/);
  assert.match(presets, /id: "ultra"/);
  assert.match(presets, /id: "ar-bridge"/);
  assert.match(presets, /textureFormat: "webp"/);
  assert.match(presets, /geometryCompression: "meshopt"/);
  assert.match(presets, /requiresNoRequiredExtensions: true/);
  assert.match(presets, /USDZ \/ Quick Look, utilisez le pipeline 3D \/ AR/);
  assert.doesNotMatch(presets, /Preserve scale\/origin/);
  assert.doesNotMatch(presets, /0\.004|0\.008|0\.035|textureMax: 256|textureMax: 384/);
});

test("model lab risk scoring is transparent and target based", () => {
  const risk = read("lib/owner/modelLab/modelLabRiskScore.ts");
  const stats = read("components/owner/model-lab/ModelLabStatsPanel.tsx");

  assert.match(risk, /targetPass/);
  assert.match(risk, /reductionPercent/);
  assert.match(risk, /triangleReductionPercent/);
  assert.match(risk, /maxTextureSize/);
  assert.match(risk, /extensionsRequired/);
  assert.match(risk, /source\.externalUris/);
  assert.match(risk, /source\.triangles > 1_000_000/);
  assert.match(stats, /assessModelLabCandidate/);
  assert.match(stats, /risque/);
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
