/**
 * Build Meshy restaurant dish assets (Draco GLB, Meshopt web, AR-lite, iOS USDZ)
 * under public/models/restaurants/{restaurant}/{menu}/{dish}/meshy-{date}/,
 * or under a temporary output root when --output-root / VISTAIRE_MESHY_OUTPUT_ROOT is provided.
 *
 * Usage:
 *   node scripts/owner/build-restaurant-meshy-dish.mjs \
 *     --restaurant trouvable \
 *     --menu principal \
 *     --dish dejeuner-classique-maison \
 *     --source "3D Plat/DejeunerMeshyCompresser.glb"
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveGltfTransformCliPath } from "../shared/gltf-transform-cli.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

function parseArgs(argv) {
  const options = {
    restaurant: "",
    menu: "principal",
    dish: "",
    source: "",
    outputRoot: process.env.VISTAIRE_MESHY_OUTPUT_ROOT?.trim() || "",
    dateTag: new Date().toISOString().slice(0, 10).replace(/-/g, "")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--restaurant") options.restaurant = argv[++index] ?? "";
    else if (arg.startsWith("--restaurant=")) options.restaurant = arg.split("=")[1] ?? "";
    else if (arg === "--menu") options.menu = argv[++index] ?? "principal";
    else if (arg.startsWith("--menu=")) options.menu = arg.split("=")[1] ?? "principal";
    else if (arg === "--dish") options.dish = argv[++index] ?? "";
    else if (arg.startsWith("--dish=")) options.dish = arg.split("=")[1] ?? "";
    else if (arg === "--source") options.source = argv[++index] ?? "";
    else if (arg.startsWith("--source=")) options.source = arg.split("=")[1] ?? "";
    else if (arg === "--output-root") options.outputRoot = argv[++index] ?? "";
    else if (arg.startsWith("--output-root=")) options.outputRoot = arg.split("=")[1] ?? "";
    else if (arg === "--date") options.dateTag = argv[++index] ?? options.dateTag;
    else if (arg.startsWith("--date=")) options.dateTag = arg.split("=")[1] ?? options.dateTag;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage:",
          "  node scripts/owner/build-restaurant-meshy-dish.mjs \\",
          '    --restaurant trouvable --menu principal \\',
          "    --dish dejeuner-classique-maison \\",
          '    --source "3D Plat/DejeunerMeshyCompresser.glb"',
          "",
          "Owner runtime:",
          "  --output-root /tmp/vistaire-owner-meshy-output",
          "  or VISTAIRE_MESHY_OUTPUT_ROOT=/tmp/vistaire-owner-meshy-output"
        ].join("\n")
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.restaurant || !options.dish || !options.source) {
    throw new Error("Required: --restaurant, --dish, --source");
  }

  return options;
}

function runNode(scriptRelativePath, extraEnv = {}, extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [join(ROOT, scriptRelativePath), ...extraArgs],
    {
      cwd: ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: "inherit"
    }
  );
  if (result.status !== 0) {
    throw new Error(`Command failed: node ${scriptRelativePath} ${extraArgs.join(" ")}`);
  }
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function resolveInputPath(path) {
  return isAbsolute(path) ? path : join(ROOT, path);
}

function resolveOutputRoot(path) {
  const root = path?.trim();
  if (!root) return "";
  return isAbsolute(root) ? root : join(ROOT, root);
}

function slashPath(path) {
  return path.replace(/\\/g, "/");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourcePath = resolveInputPath(options.source);
  if (!existsSync(sourcePath)) {
    throw new Error(`Source introuvable: ${sourcePath}`);
  }
  const gltfTransformCli = resolveGltfTransformCliPath();

  const publicAssetRootRelative = join(
    "models",
    "restaurants",
    options.restaurant,
    options.menu,
    options.dish,
    `meshy-${options.dateTag}`
  );
  const outputRoot = resolveOutputRoot(options.outputRoot);
  const assetRoot = outputRoot
    ? join(outputRoot, publicAssetRootRelative)
    : join(ROOT, "public", publicAssetRootRelative);
  const childAssetRoot = outputRoot
    ? assetRoot
    : join("public", publicAssetRootRelative);
  const arLiteDir = join(assetRoot, "ar-lite");
  const meshyFile = `${options.dish}-meshy.glb`;
  const meshyPath = join(assetRoot, meshyFile);

  mkdirSync(arLiteDir, { recursive: true });
  copyFileSync(sourcePath, meshyPath);
  console.log(`Source -> ${meshyPath}`);

  const meshoptTmp = join(assetRoot, `${options.dish}-meshopt-tmp.glb`);
  const meshoptResult = spawnSync(
    process.execPath,
    [
      gltfTransformCli,
      "optimize",
      meshyPath,
      meshoptTmp,
      "--compress",
      "meshopt",
      "--texture-compress",
      "webp",
      "--texture-size",
      "2048"
    ],
    { cwd: ROOT, stdio: "inherit" }
  );
  if (meshoptResult.status !== 0) {
    throw new Error("Meshopt optimize failed.");
  }

  const meshoptHash = sha256File(meshoptTmp).slice(0, 8);
  const meshoptPath = join(assetRoot, `${options.dish}-meshopt-${meshoptHash}.glb`);
  renameSync(meshoptTmp, meshoptPath);
  console.log(`Meshopt web -> ${meshoptPath}`);

  runNode("scripts/build-demo-ar-lite-assets.mjs", {
    VISTAIRE_MESHY_ASSET_ROOT: slashPath(childAssetRoot),
    VISTAIRE_MESHY_ONLY: options.dish
  });

  const iosEnv = {
    VISTAIRE_MESHY_ASSET_ROOT: slashPath(childAssetRoot)
  };
  if (outputRoot) {
    iosEnv.VISTAIRE_MESHY_CANDIDATE_ROOT = slashPath(join(assetRoot, ".ios-candidates"));
    iosEnv.VISTAIRE_MESHY_WORK_ROOT = slashPath(join(assetRoot, ".ios-work"));
    iosEnv.VISTAIRE_MESHY_SKIP_OPENUSD_OPTIMIZER = "1";
  }
  runNode(
    "scripts/build-ios-quicklook-ultra-assets.mjs",
    iosEnv,
    [
      options.dish,
      "--promote",
      "auto",
      "--production-output",
      `${options.dish}-ios-quicklook-meshy.usdz`,
      "--quality-approved"
    ]
  );

  const arLiteGlb = join(arLiteDir, `${options.dish}-ar-lite-meshy.glb`);
  const arUsdz = join(arLiteDir, `${options.dish}-ios-quicklook-meshy.usdz`);
  const iosPromotionManifest = join(arLiteDir, `${options.dish}-ios-quicklook-promotion.json`);
  const iosQuickLookPromotion = existsSync(iosPromotionManifest)
    ? JSON.parse(readFileSync(iosPromotionManifest, "utf8"))
    : null;
  const urlPrefix = `/${slashPath(publicAssetRootRelative)}`;

  const manifest = {
    kind: "vistaire.restaurant-meshy-dish",
    restaurantSlug: options.restaurant,
    menuSlug: options.menu,
    dishSlug: options.dish,
    version: `meshy-${options.dateTag}`,
    sourceFile: outputRoot ? basename(sourcePath) : options.source,
    assets: {
      model3dUrl: `${urlPrefix}/${meshyFile}`,
      webModel3dUrl: `${urlPrefix}/${options.dish}-meshopt-${meshoptHash}.glb`,
      arModel3dUrl: `${urlPrefix}/ar-lite/${options.dish}-ar-lite-meshy.glb`,
      arUsdzUrl: `${urlPrefix}/ar-lite/${options.dish}-ios-quicklook-meshy.usdz`
    },
    localPaths: {
      model3d: meshyFile,
      webModel3d: `${options.dish}-meshopt-${meshoptHash}.glb`,
      arModel3d: `ar-lite/${options.dish}-ar-lite-meshy.glb`,
      arUsdz: `ar-lite/${options.dish}-ios-quicklook-meshy.usdz`
    },
    sha256: {
      meshy: sha256File(meshyPath),
      meshopt: sha256File(meshoptPath),
      arLite: existsSync(arLiteGlb) ? sha256File(arLiteGlb) : "",
      arUsdz: existsSync(arUsdz) ? sha256File(arUsdz) : ""
    },
    iosQuickLookPromotion
  };

  const manifestPath = join(assetRoot, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log("\nOK Restaurant Meshy pipeline complete.");
  console.log(`Asset root: ${assetRoot}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(JSON.stringify(manifest.assets, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
