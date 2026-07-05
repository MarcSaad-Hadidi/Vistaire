import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";

import { validateUsdzBasic } from "../scripts/3d/shared/validators/usdz-basic.mjs";

const PYTHON = process.env.VISTAIRE_USDZ_PYTHON || (process.platform === "win32" ? "python" : "python3");
const CLI = "scripts/owner/optimize-restaurant-usdz.mjs";

function pythonHasToolchain() {
  try {
    const probe = spawnSync(PYTHON, ["-c", "import pxr, PIL"], { stdio: "ignore" });
    return probe.status === 0;
  } catch {
    return false;
  }
}

function blenderAvailable() {
  const blender = process.env.VISTAIRE_USDZ_BLENDER || "blender";
  try {
    const probe = spawnSync(blender, ["--version"], { stdio: "ignore" });
    return probe.status === 0;
  } catch {
    return false;
  }
}

const TOOLCHAIN_AVAILABLE = pythonHasToolchain() && blenderAvailable();
const TOOLCHAIN_SKIP_REASON = "OpenUSD/Pillow/Blender not available";

const GENERATOR = `
import sys, tempfile
from pathlib import Path
from pxr import Usd, UsdGeom, UsdShade, Sdf, UsdUtils
from PIL import Image
import random

out = Path(sys.argv[1])
work = Path(tempfile.mkdtemp(prefix="gen-usdz-"))
tex_dir = work / "0"
tex_dir.mkdir(parents=True, exist_ok=True)

# A deliberately large-ish base color texture so the optimizer resizes it.
img = Image.new("RGB", (2048, 2048))
px = img.load()
for y in range(2048):
    for x in range(0, 2048, 64):
        c = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
        for dx in range(64):
            px[x + dx, y] = c
img.save(tex_dir / "baseColor.png", format="PNG")

layer = work / "model.usdc"
stage = Usd.Stage.CreateNew(str(layer))
xform = UsdGeom.Xform.Define(stage, "/Dish")
stage.SetDefaultPrim(xform.GetPrim())
mesh = UsdGeom.Cube.Define(stage, "/Dish/Cube")
material = UsdShade.Material.Define(stage, "/Dish/Mat")
shader = UsdShade.Shader.Define(stage, "/Dish/Mat/Surface")
shader.CreateIdAttr("UsdPreviewSurface")
shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(0.6)
shader.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.0)
tex = UsdShade.Shader.Define(stage, "/Dish/Mat/Tex")
tex.CreateIdAttr("UsdUVTexture")
tex.CreateInput("file", Sdf.ValueTypeNames.Asset).Set("0/baseColor.png")
tex_out = tex.CreateOutput("rgb", Sdf.ValueTypeNames.Float3)
shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).ConnectToSource(tex_out)
material.CreateSurfaceOutput().ConnectToSource(shader.CreateOutput("surface", Sdf.ValueTypeNames.Token))
UsdShade.MaterialBindingAPI(mesh).Bind(material)
stage.GetRootLayer().Save()

if out.exists():
    out.unlink()
UsdUtils.CreateNewUsdzPackage(str(layer), str(out))
print(str(out))
`;

const MULTI_LAYER_GENERATOR = `
import shutil, sys
from pathlib import Path
from pxr import Usd, UsdGeom, UsdUtils

out = Path(sys.argv[1])
work = out.parent / "multi-root-work"
if work.exists():
    shutil.rmtree(work)
work.mkdir(parents=True, exist_ok=True)

decoy = work / "a_decoy.usda"
decoy_stage = Usd.Stage.CreateNew(str(decoy))
decoy_root = UsdGeom.Xform.Define(decoy_stage, "/AlphaDecoy")
decoy_stage.SetDefaultPrim(decoy_root.GetPrim())
UsdGeom.Cube.Define(decoy_stage, "/AlphaDecoy/Cube")
decoy_stage.GetRootLayer().Save()

root = work / "z_root.usda"
root_stage = Usd.Stage.CreateNew(str(root))
selected_root = UsdGeom.Xform.Define(root_stage, "/SelectedRoot")
root_stage.SetDefaultPrim(selected_root.GetPrim())
UsdGeom.Cube.Define(root_stage, "/SelectedRoot/Cube")
root_stage.GetRootLayer().subLayerPaths.append("a_decoy.usda")
root_stage.GetRootLayer().Save()

if out.exists():
    out.unlink()
UsdUtils.CreateNewUsdzPackage(str(root), str(out))
print(str(out))
`;

const OFFSET_RECT_GENERATOR = `
import sys
from pathlib import Path
from pxr import Usd, UsdGeom, UsdUtils

out = Path(sys.argv[1])
width = float(sys.argv[2])
depth = float(sys.argv[3])
height = float(sys.argv[4])
offset_x = float(sys.argv[5])
offset_y = float(sys.argv[6])
bottom_z = float(sys.argv[7])
work = out.parent / "offset-rect-work"
work.mkdir(parents=True, exist_ok=True)
layer = work / "model.usda"
stage = Usd.Stage.CreateNew(str(layer))
root = UsdGeom.Xform.Define(stage, "/Dish")
stage.SetDefaultPrim(root.GetPrim())
mesh = UsdGeom.Mesh.Define(stage, "/Dish/Rect")
x0 = offset_x - width / 2
x1 = offset_x + width / 2
y0 = offset_y - depth / 2
y1 = offset_y + depth / 2
z0 = bottom_z
z1 = bottom_z + height
mesh.CreatePointsAttr([
    (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
    (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),
])
mesh.CreateFaceVertexCountsAttr([4, 4, 4, 4, 4, 4])
mesh.CreateFaceVertexIndicesAttr([
    0, 1, 2, 3,
    4, 7, 6, 5,
    0, 4, 5, 1,
    1, 5, 6, 2,
    2, 6, 7, 3,
    3, 7, 4, 0,
])
stage.GetRootLayer().Save()
if out.exists():
    out.unlink()
UsdUtils.CreateNewUsdzPackage(str(layer), str(out))
print(str(out))
`;

function usdTextBundle(filePath) {
  const entries = unzipSync(readFileSync(filePath));
  return Object.entries(entries)
    .filter(([name]) => /\.usd[ac]?$/i.test(name))
    .map(([, bytes]) => Buffer.from(bytes).toString("utf8"))
    .join("\n");
}

function zipCentralDirectoryEntryNames(filePath) {
  const buffer = readFileSync(filePath);
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === eocdSignature) {
      eocdOffset = index;
      break;
    }
  }
  assert.notEqual(eocdOffset, -1, "ZIP end-of-central-directory must exist");

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const names = [];
  for (let index = 0; index < totalEntries; index += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, "central directory header expected");
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    names.push(buffer.subarray(nameStart, nameEnd).toString("utf8"));
    offset = nameEnd + extraLength + commentLength;
  }
  return names;
}

test("USDZ runtime optimizer produces a valid, smaller runtime with an honest report", { skip: !TOOLCHAIN_AVAILABLE ? TOOLCHAIN_SKIP_REASON : false }, () => {
  const dir = mkdtempSync(join(tmpdir(), "vistaire-usdz-test-"));
  const genPy = join(dir, "gen.py");
  const source = join(dir, "source.usdz");
  const runtime = join(dir, "runtime.usdz");
  const report = join(dir, "report.json");
  try {
    writeFileSync(genPy, GENERATOR, "utf8");
    execFileSync(PYTHON, [genPy, source], { stdio: "pipe" });
    assert.ok(existsSync(source), "source USDZ generated");

    const stdout = execFileSync(
      process.execPath,
      [CLI, "--source", source, "--output", runtime, "--report", report, "--profile", "balanced", "--dish-kind", "burger"],
      { encoding: "utf8" }
    );
    const summary = JSON.parse(stdout.trim().split("\n").pop());

    assert.equal(summary.ok, true);
    assert.ok(existsSync(runtime), "runtime USDZ produced");
    assert.ok(existsSync(source), "source is not consumed by the CLI (API cleans it)");
    assert.notEqual(summary.runtimeSha256, summary.sourceSha256, "runtime differs from source");
    assert.equal(summary.geometryOptimization, "skipped");
    assert.equal(summary.optimizationApplied, true, "a 2048 base color texture must be resized");
    assert.equal(summary.physicalScale?.dishKind, "burger");
    assert.equal(summary.physicalScale?.dimension, "height");
    assert.equal(summary.physicalScale?.status, "normalized");

    const runtimeValidation = validateUsdzBasic({ filePath: runtime, productionUrl: false });
    assert.equal(runtimeValidation.ok, true, JSON.stringify(runtimeValidation.fails));

    const parsedReport = JSON.parse(readFileSync(report, "utf8"));
    assert.equal(parsedReport.geometryOptimization, "skipped");
    assert.equal(parsedReport.physicalScale.status, "normalized");
    assert.equal(parsedReport.physicalScale.heightAfterMeters, 0.15);
    assert.ok(typeof parsedReport.reductionPercent === "number");
    assert.ok(parsedReport.textureCount >= 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("USDZ runtime optimizer uses the first archive USD layer instead of alphabetical order", { skip: !TOOLCHAIN_AVAILABLE ? TOOLCHAIN_SKIP_REASON : false }, () => {
  const dir = mkdtempSync(join(tmpdir(), "vistaire-usdz-root-test-"));
  const genPy = join(dir, "gen-multi-layer.py");
  const source = join(dir, "source.usdz");
  const runtime = join(dir, "runtime.usdz");
  const report = join(dir, "report.json");
  try {
    writeFileSync(genPy, MULTI_LAYER_GENERATOR, "utf8");
    execFileSync(PYTHON, [genPy, source], { stdio: "pipe" });
    assert.ok(existsSync(source), "multi-layer source USDZ generated");

    const sourceUsdEntries = zipCentralDirectoryEntryNames(source).filter((name) => /\.usd[ac]?$/i.test(name));
    assert.equal(sourceUsdEntries[0], "z_root.usda");
    assert.equal([...sourceUsdEntries].sort()[0], "0/a_decoy.usda");

    const sourceText = usdTextBundle(source);
    assert.match(sourceText, /SelectedRoot/);
    assert.match(sourceText, /AlphaDecoy/);

    const stdout = execFileSync(
      process.execPath,
      [CLI, "--source", source, "--output", runtime, "--report", report, "--profile", "light"],
      { encoding: "utf8" }
    );
    const summary = JSON.parse(stdout.trim().split("\n").pop());

    assert.equal(summary.ok, true);
    assert.ok(existsSync(runtime), "runtime USDZ produced");

    const runtimeValidation = validateUsdzBasic({ filePath: runtime, productionUrl: false });
    assert.equal(runtimeValidation.ok, true, JSON.stringify(runtimeValidation.fails));

    const runtimeText = usdTextBundle(runtime);
    assert.match(runtimeText, /SelectedRoot/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("USDZ physical scale uses footprint when depth is larger than width", { skip: !TOOLCHAIN_AVAILABLE ? TOOLCHAIN_SKIP_REASON : false }, () => {
  const dir = mkdtempSync(join(tmpdir(), "vistaire-usdz-footprint-test-"));
  const genPy = join(dir, "gen-offset-rect.py");
  const source = join(dir, "source.usdz");
  const runtime = join(dir, "runtime.usdz");
  const report = join(dir, "report.json");
  try {
    writeFileSync(genPy, OFFSET_RECT_GENERATOR, "utf8");
    execFileSync(PYTHON, [genPy, source, "0.03", "0.32", "0.02", "0", "0", "0"], { stdio: "pipe" });
    const stdout = execFileSync(
      process.execPath,
      [CLI, "--source", source, "--output", runtime, "--report", report, "--profile", "light", "--dish-kind", "pizza"],
      { encoding: "utf8" }
    );
    const summary = JSON.parse(stdout.trim().split("\n").pop());
    assert.equal(summary.ok, true);
    assert.equal(summary.physicalScale?.dimension, "footprint");
    assert.equal(summary.physicalScale?.status, "unchanged");
    assert.ok(summary.physicalScale.footprintAfterMeters >= 0.319);
    assert.ok(summary.physicalScale.footprintAfterMeters <= 0.321);
    assert.ok(summary.physicalScale.widthAfterMeters < summary.physicalScale.depthAfterMeters);
    assert.ok(summary.physicalScale.scaleFactor <= 1.001);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("USDZ physical scale recenters horizontally and grounds the model", { skip: !TOOLCHAIN_AVAILABLE ? TOOLCHAIN_SKIP_REASON : false }, () => {
  const dir = mkdtempSync(join(tmpdir(), "vistaire-usdz-center-test-"));
  const genPy = join(dir, "gen-offset-rect.py");
  const source = join(dir, "source.usdz");
  const runtime = join(dir, "runtime.usdz");
  const report = join(dir, "report.json");
  try {
    writeFileSync(genPy, OFFSET_RECT_GENERATOR, "utf8");
    execFileSync(PYTHON, [genPy, source, "0.26", "0.18", "0.04", "0.6", "-0.4", "-0.03"], { stdio: "pipe" });
    const stdout = execFileSync(
      process.execPath,
      [CLI, "--source", source, "--output", runtime, "--report", report, "--profile", "light", "--dish-kind", "plate"],
      { encoding: "utf8" }
    );
    const summary = JSON.parse(stdout.trim().split("\n").pop());
    assert.equal(summary.ok, true);
    assert.equal(summary.physicalScale?.dimension, "footprint");
    assert.equal(summary.physicalScale?.status, "normalized");
    assert.equal(summary.physicalScale?.centeredX, true);
    assert.equal(summary.physicalScale?.centeredY, true);
    assert.equal(summary.physicalScale?.grounded, true);
    assert.ok(summary.physicalScale.centerOffsetBeforeMeters > 0.7);
    assert.ok(summary.physicalScale.centerOffsetAfterMeters <= 0.001);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("USDZ runtime optimizer CLI accepts platter dish kind", () => {
  const result = spawnSync(
    process.execPath,
    [
      CLI,
      "--source",
      "missing.usdz",
      "--output",
      "runtime.usdz",
      "--report",
      "report.json",
      "--profile",
      "light",
      "--dish-kind",
      "platter"
    ],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source USDZ introuvable/);
  assert.doesNotMatch(result.stderr, /Type de plat invalide/);
});
