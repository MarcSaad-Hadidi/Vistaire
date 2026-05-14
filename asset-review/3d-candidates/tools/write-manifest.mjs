import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const rel = (path) => path.replaceAll("\\", "/");
const readJson = async (path) => JSON.parse(await readFile(resolve(ROOT, path), "utf8"));
const hashFile = async (path) => createHash("sha256").update(await readFile(resolve(ROOT, path))).digest("hex");
const mib = (bytes) => Number((bytes / 1024 / 1024).toFixed(4));
const pct = (before, after) => Number(((1 - after / before) * 100).toFixed(2));

const glbBaseline = (await readJson("asset-review/3d-candidates/baseline/glb-baseline.json")).reports;
const candidateAudit = (await readJson("asset-review/3d-candidates/baseline/glb-candidates-audit.json")).reports;
const usdzBaseline = (await readJson("asset-review/3d-candidates/baseline/usdz-baseline.json")).reports;
const visualQa = await readJson("asset-review/3d-candidates/visual-qa/visual-qa-results.json");

const originalBySlug = new Map(
  glbBaseline.map((report) => [report.file.split("/").pop().replace(".glb", ""), report]),
);
const usdzBySlug = new Map(
  usdzBaseline.map((report) => [report.file.split("/").pop().replace(".usdz", ""), report]),
);
const candidateAuditByFile = new Map(candidateAudit.map((report) => [report.file, report]));

const commands = {
  safe:
    "npx.cmd gltf-transform prune <source.glb> <safe-prune.glb> --keep-attributes true --keep-indices true --keep-leaves true --keep-solid-textures true; npx.cmd gltf-transform dedup <safe-prune.glb> <safe-dedup.glb>; npx.cmd gltf-transform reorder <safe-dedup.glb> <safe.glb> --target performance",
  meshopt:
    "npx.cmd gltf-transform meshopt <safe.glb> <meshopt-web-only.glb> --level high",
  medium:
    "E:\\blender.exe --background --python asset-review\\3d-candidates\\tools\\blender-decimate-candidate.py -- --input <source.glb> --output <medium.glb> --summary <medium.summary.json> --ratio 0.9 --min-triangles 100000",
  aggressive:
    "E:\\blender.exe --background --python asset-review\\3d-candidates\\tools\\blender-decimate-candidate.py -- --input <source.glb> --output <aggressive.glb> --summary <aggressive.summary.json> --ratio 0.65 --min-triangles 100000",
  usdzRepack:
    "E:\\5.1\\python\\bin\\python.exe scripts\\optimize-usdz-binary-layers.py <source.usdz> <repack.usdz>",
};

const retained = [
  ["ravioles-chevre-miel", "meshopt-web-only", "asset-review/3d-candidates/ravioles-chevre-miel/ravioles-chevre-miel.meshopt-web-only.glb", "meshopt"],
  ["ravioles-chevre-miel", "medium-targeted-review-only", "asset-review/3d-candidates/ravioles-chevre-miel/ravioles-chevre-miel.medium-targeted-review-only.glb", "medium"],
  ["ravioles-chevre-miel", "aggressive-targeted-review-only", "asset-review/3d-candidates/ravioles-chevre-miel/ravioles-chevre-miel.aggressive-targeted-review-only.glb", "aggressive"],
  ["homard-bisque", "meshopt-web-only", "asset-review/3d-candidates/homard-bisque/homard-bisque.meshopt-web-only.glb", "meshopt"],
  ["homard-bisque", "medium-targeted-review-only", "asset-review/3d-candidates/homard-bisque/homard-bisque.medium-targeted-review-only.glb", "medium"],
  ["homard-bisque", "aggressive-targeted-review-only", "asset-review/3d-candidates/homard-bisque/homard-bisque.aggressive-targeted-review-only.glb", "aggressive"],
  ["souffle-chocolat", "meshopt-web-only", "asset-review/3d-candidates/souffle-chocolat/souffle-chocolat.meshopt-web-only.glb", "meshopt"],
  ["souffle-chocolat", "medium-targeted-review-only", "asset-review/3d-candidates/souffle-chocolat/souffle-chocolat.medium-targeted-review-only.glb", "medium"],
  ["souffle-chocolat", "aggressive-targeted-review-only", "asset-review/3d-candidates/souffle-chocolat/souffle-chocolat.aggressive-targeted-review-only.glb", "aggressive"],
];

const deleted = [
  ["ravioles-chevre-miel", "safe", "asset-review/3d-candidates/ravioles-chevre-miel/ravioles-chevre-miel.safe.glb", "safe", "Deleted after audit: 0.01% reduction only; no useful optimization value."],
  ["homard-bisque", "safe", "asset-review/3d-candidates/homard-bisque/homard-bisque.safe.glb", "safe", "Deleted after audit: 0.02% reduction only; no useful optimization value."],
  ["souffle-chocolat", "safe", "asset-review/3d-candidates/souffle-chocolat/souffle-chocolat.safe.glb", "safe", "Deleted after audit: 0.00% reduction only; no useful optimization value."],
  ["ravioles-chevre-miel", "usdz-repack", "asset-review/3d-candidates/ravioles-chevre-miel/ravioles-chevre-miel.repack.usdz", "usdzRepack", "Deleted after OpenUSD compare: same=true but 0.00% reduction; active USDZ already USDC/store-only."],
  ["homard-bisque", "usdz-repack", "asset-review/3d-candidates/homard-bisque/homard-bisque.repack.usdz", "usdzRepack", "Deleted after OpenUSD compare: same=true but 0.00% reduction; active USDZ already USDC/store-only."],
  ["souffle-chocolat", "usdz-repack", "asset-review/3d-candidates/souffle-chocolat/souffle-chocolat.repack.usdz", "usdzRepack", "Deleted after OpenUSD compare: same=true but 0.00% reduction; active USDZ already USDC/store-only."],
];

function visualFor(slug, candidateName) {
  const rows = visualQa.results.filter((result) => result.slug === slug && result.candidateName === candidateName);
  return {
    capturedAngles: rows.map((row) => row.angleName),
    loadedCount: rows.filter((row) => row.loaded).length,
    totalCount: rows.length,
    screenshots: rows.map((row) => row.screenshot),
    consoleMessages: rows.flatMap((row) => row.consoleMessages),
  };
}

async function retainedEntry([slug, name, path, commandKey]) {
  const original = originalBySlug.get(slug);
  const audit = candidateAuditByFile.get(path);
  const fileStat = await stat(resolve(ROOT, path));
  const visual = visualFor(slug, name);
  const isMeshopt = name === "meshopt-web-only";
  const isLossy = name.includes("targeted");
  return {
    slug,
    candidateName: name,
    retained: true,
    path: rel(path),
    source: original.file,
    toolchain: commandKey === "meshopt" ? "glTF Transform 4.3.0" : "Blender 5.1.1",
    command: commands[commandKey],
    parameters: commandKey === "meshopt" ? { level: "high" } : commandKey === "medium" ? { ratio: 0.9, minTriangles: 100000, lockedSupportMeshes: true } : { ratio: 0.65, minTriangles: 100000, lockedSupportMeshes: true },
    beforeBytes: original.bytes,
    beforeMiB: original.mib,
    afterBytes: fileStat.size,
    afterMiB: mib(fileStat.size),
    reductionPercent: pct(original.bytes, fileStat.size),
    sha256: await hashFile(path),
    structuralValidation: {
      status: "structurally-valid",
      gltfTransformValidate: isMeshopt ? "0 errors; validator reports unsupported EXT_meshopt_compression info only" : "0 errors",
      extensionsRequired: audit.extensionsRequired,
      meshCount: audit.meshCount,
      vertexCount: audit.vertexCount,
      faceCount: audit.faceCount,
      bounds: audit.sceneBounds,
    },
    visualValidation: {
      status: visual.totalCount && visual.loadedCount === visual.totalCount && !isMeshopt ? "visually-reviewed" : "review-only",
      note: isMeshopt
        ? "Meshopt candidate was not included in normalized screenshot pass because prior run stalled on model-viewer load; requires dedicated model-viewer QA."
        : "Normalized Playwright side-by-side screenshots generated at 4 angles. Representative frames were inspected; no production claim is made.",
      ...visual,
    },
    deviceValidation: {
      quickLookIPhoneSafariHttps: "not-tested",
      androidChromeArCoreSceneViewer: "not-tested",
      status: "needs-real-device-test",
    },
    risk: isMeshopt
      ? "web-only transfer optimization; requires EXT_meshopt_compression and KHR_mesh_quantization, not suitable as USDZ source without separate conversion validation"
      : isLossy
        ? "lossy geometry reduction on heavy food meshes only; plate/support/contact meshes locked; requires human visual approval"
        : "review-only",
    recommendation: isMeshopt
      ? "Promising for web GLB delivery only after model-viewer/mobile QA; do not use for USDZ/Quick Look source."
      : name.includes("medium")
        ? "Potential review candidate, especially ravioles; requires human visual review and real-device tests before any promotion."
        : "Use only to understand upper-bound reduction potential; not recommended for production without much stricter visual review.",
    status: isMeshopt ? "review-only" : "review-only",
  };
}

function deletedEntry([slug, name, path, commandKey, reason]) {
  const original = commandKey === "usdzRepack" ? usdzBySlug.get(slug) : originalBySlug.get(slug);
  const audit = candidateAuditByFile.get(path);
  return {
    slug,
    candidateName: name,
    retained: false,
    path: rel(path),
    source: original.file,
    toolchain: commandKey === "usdzRepack" ? "OpenUSD via E:\\5.1\\python\\bin\\python.exe" : "glTF Transform 4.3.0",
    command: commands[commandKey],
    beforeBytes: original.bytes,
    beforeMiB: original.mib,
    afterBytes: commandKey === "usdzRepack" ? original.bytes : audit?.bytes,
    afterMiB: commandKey === "usdzRepack" ? original.mib : audit?.mib,
    reductionPercent: commandKey === "usdzRepack" ? 0 : audit ? pct(original.bytes, audit.bytes) : 0,
    structuralValidation: commandKey === "usdzRepack" ? { status: "structurally-valid", compareUsdzScenes: "same=true" } : { status: "structurally-valid" },
    visualValidation: { status: "review-only", note: "Deleted no-gain candidate; screenshots/structural audit retained where relevant." },
    deviceValidation: { status: "not-tested" },
    risk: "No useful optimization gain.",
    recommendation: "Do not retain or promote.",
    status: "rejected",
    rejectionReason: reason,
  };
}

const candidates = [
  ...(await Promise.all(retained.map(retainedEntry))),
  ...deleted.map(deletedEntry),
];

const manifest = {
  generatedAt: new Date().toISOString(),
  branch: "codex/deep-lossless-3d-asset-optimization",
  productionPolicy: {
    productionAssetsReplaced: false,
    demoMenuDataModified: false,
    candidatesInPublic: false,
    candidateRoot: "asset-review/3d-candidates",
  },
  baselineFiles: [
    "asset-review/3d-candidates/baseline/glb-baseline.json",
    "asset-review/3d-candidates/baseline/usdz-baseline.json",
    "asset-review/3d-candidates/baseline/blender-mesh-audit.json",
    "asset-review/3d-candidates/baseline/glb-candidates-audit.json",
  ],
  visualQa: {
    status: "partial",
    note: "Playwright normalized screenshots completed for retained Blender geometry candidates and no-gain safe candidates; Meshopt visual QA not completed.",
    results: "asset-review/3d-candidates/visual-qa/visual-qa-results.json",
  },
  candidates,
};

await writeFile(resolve(ROOT, "asset-review/3d-candidates/candidate-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Wrote asset-review/3d-candidates/candidate-manifest.json");
