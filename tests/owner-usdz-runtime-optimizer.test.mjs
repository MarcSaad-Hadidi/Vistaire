import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, zipSync, strToU8 } from "fflate";

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

const MINIMAL_USDA = `#usda 1.0
(
    defaultPrim = "Dish"
)

def Xform "Dish"
{
    def Mesh "Cube"
    {
        point3f[] points = [(-0.1, -0.1, 0), (0.1, -0.1, 0), (0.1, 0.1, 0), (-0.1, 0.1, 0), (-0.1, -0.1, 0.1), (0.1, -0.1, 0.1), (0.1, 0.1, 0.1), (-0.1, 0.1, 0.1)]
        int[] faceVertexCounts = [4, 4, 4, 4, 4, 4]
        int[] faceVertexIndices = [0, 1, 2, 3, 4, 7, 6, 5, 0, 4, 5, 1, 1, 5, 6, 2, 2, 6, 7, 3, 3, 7, 4, 0]
    }
}
`;

const FAKE_WORKER = `
import { copyFileSync, writeFileSync } from "node:fs";

const mode = process.env.VISTAIRE_FAKE_USDZ_MODE || "physical-scale-stderr";
let args = process.argv.slice(2);
if (args[0] && !args[0].startsWith("--")) args = args.slice(1);
function arg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}
const source = arg("--source");
const output = arg("--output");
const report = arg("--report");
const profile = arg("--profile") || "balanced";
const recipe = arg("--recipe") || profile + "-max";

function writeRuntimeReport(extra = {}) {
  copyFileSync(source, output);
  writeFileSync(report, JSON.stringify({
    profile,
    recipe,
    selectedRecipe: recipe,
    profileRecipe: profile + ":" + recipe,
    sourceBytes: 2048,
    runtimeBytes: 2048,
    reductionPercent: 0,
    geometryOptimization: "skipped",
    geometryOptimizationReason: "fake worker",
    triangleCountBefore: 12,
    triangleCountAfter: 12,
    targetTriangles: 100,
    physicalScale: { status: "normalized", dishKind: "plate", dimension: "footprint" },
    warnings: [],
    fails: [],
    textureCount: 0,
    changedTextures: 0,
    materialCount: 0,
    optimizationApplied: true,
    sourceStored: false,
    cleanup: { extractedWorkspaceRemoved: true },
    ...extra
  }), "utf8");
}

if (mode === "physical-scale-stderr") {
  console.error(JSON.stringify({ ok: false, error: "Echelle physique invalide apres normalisation Blender.", stage: "physical-scale" }));
  process.exit(2);
}
if (mode === "blender-stderr") {
  console.error(JSON.stringify({ ok: false, error: "Blender executable introuvable.", stage: "blender" }));
  process.exit(2);
}
if (mode === "blender-unavailable-report") {
  console.error(JSON.stringify({
    ok: false,
    error: "Echelle physique invalide apres normalisation Blender.",
    stage: "physical-scale",
    report: {
      geometryOptimization: "skipped",
      geometryOptimizationReason: "Blender indisponible; geometryOptimization ne peut pas etre done.",
      physicalScale: {
        status: "failed",
        dishKind: "plate",
        warnings: ["Blender unavailable; physical scale could not be measured."]
      },
      fails: ["Echelle physique invalide: Blender indisponible pour normaliser le modele AR."]
    }
  }));
  process.exit(2);
}
if (mode === "blender-launch-report") {
  console.error(JSON.stringify({
    ok: false,
    error: "Echelle physique invalide: Blender impossible ([Errno 13] Permission denied).",
    stage: "physical-scale",
    report: {
      geometryOptimization: "skipped",
      geometryOptimizationReason: "Blender geometry pass impossible: [Errno 13] Permission denied",
      physicalScale: {
        status: "failed",
        dishKind: "plate",
        warnings: []
      },
      fails: ["Echelle physique invalide: Blender impossible ([Errno 13] Permission denied)."]
    }
  }));
  process.exit(2);
}
if (mode === "physical-scale-report") {
  writeRuntimeReport({
    physicalScale: { status: "failed", dishKind: "plate", dimension: "footprint", grounded: false },
    fails: ["Echelle physique invalide: modele non grounded."]
  });
  process.exit(0);
}
if (mode === "over-budget") {
  writeRuntimeReport();
  process.exit(0);
}
if (mode === "strict-success") {
  writeRuntimeReport({ optimizationApplied: false });
  process.exit(0);
}
if (mode === "premium-safe-success") {
  if (profile !== "premium") {
    console.error(JSON.stringify({ ok: false, error: "unexpected profile", stage: "profile" }));
    process.exit(2);
  }
  if (recipe !== "premium-safe") {
    writeRuntimeReport({ runtimeBytes: 30 * 1024 * 1024 });
    process.exit(0);
  }
  writeRuntimeReport({
    optimizationApplied: false,
    runtimeBytes: 20 * 1024 * 1024,
    triangleCountBefore: 1555864,
    triangleCountAfter: 220000,
    targetTriangles: 220000
  });
  process.exit(0);
}
if (mode === "emergency-safe-success") {
  if (profile !== "emergency") {
    console.error(JSON.stringify({ ok: false, error: "unexpected profile", stage: "profile" }));
    process.exit(2);
  }
  if (recipe !== "emergency-safe") {
    writeRuntimeReport({
      optimizationApplied: false,
      runtimeBytes: 5_980_000,
      triangleCountBefore: 1555864,
      triangleCountAfter: 77793,
      targetTriangles: 70000,
      minDecimateRatio: 0.03,
      maxDecimatePasses: 2,
      decimatePassesApplied: 1,
      fails: ["Triangle budget depasse apres optimisation (77793 > 70000)."]
    });
    process.exit(0);
  }
  writeRuntimeReport({
    optimizationApplied: false,
    runtimeBytes: 5_620_000,
    triangleCountBefore: 1555864,
    triangleCountAfter: 55000,
    targetTriangles: 55000,
    minDecimateRatio: 0.02,
    maxDecimatePasses: 2,
    decimatePassesApplied: 2
  });
  process.exit(0);
}
if (mode === "bad-report") {
  copyFileSync(source, output);
  writeFileSync(report, "{", "utf8");
  process.exit(0);
}
if (mode === "invalid-runtime") {
  writeRuntimeReport();
  writeFileSync(output, "not-a-usdz", "utf8");
  process.exit(0);
}
if (mode === "light-only-success") {
  if (profile !== "light") {
    writeRuntimeReport({
      runtimeBytes: 30 * 1024 * 1024,
      fails: ["premium fake failure"]
    });
    process.exit(0);
  }
  writeRuntimeReport({
    triangleCountBefore: 1555864,
    triangleCountAfter: 100000,
    targetTriangles: 100000
  });
  process.exit(0);
}
console.error(JSON.stringify({ ok: false, error: "fake worker mode unknown", stage: "fake" }));
process.exit(2);
`;

function writeMinimalUsdz(filePath) {
  writeFileSync(filePath, Buffer.from(zipSync({ "model.usda": strToU8(MINIMAL_USDA) })));
}

function writeFakePython(dir) {
  const fakeWorker = join(dir, "fake-worker.mjs");
  writeFileSync(fakeWorker, FAKE_WORKER, "utf8");
  if (process.platform === "win32") {
    const commandPath = join(dir, "fake-python.cmd");
    writeFileSync(
      commandPath,
      `@echo off\r\n"${process.execPath}" "${fakeWorker}" %*\r\nexit /b %ERRORLEVEL%\r\n`,
      "utf8"
    );
    return commandPath;
  }
  const commandPath = join(dir, "fake-python.sh");
  writeFileSync(commandPath, `#!/bin/sh\n"${process.execPath}" "${fakeWorker}" "$@"\n`, {
    encoding: "utf8",
    mode: 0o755
  });
  return commandPath;
}

function runCliWithFakeWorker(mode, extraEnv = {}, profile = "premium", extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), "vistaire-usdz-fake-worker-"));
  const source = join(dir, "source.usdz");
  const runtime = join(dir, "runtime.usdz");
  const report = join(dir, "report.json");
  try {
    writeMinimalUsdz(source);
    const fakePython = writeFakePython(dir);
    const result = spawnSync(
      process.execPath,
      [
        CLI,
        "--source",
        source,
        "--output",
        runtime,
        "--report",
        report,
        "--profile",
        profile,
        "--dish-kind",
        "plate",
        ...extraArgs
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...extraEnv,
          VISTAIRE_USDZ_PYTHON: fakePython,
          VISTAIRE_FAKE_USDZ_MODE: mode
        },
        encoding: "utf8"
      }
    );
    const stderrLine =
      result.stderr
        .trim()
        .split("\n")
        .filter((line) => line.trim().startsWith("{"))
        .pop() || "{}";
    const stdoutLine = result.stdout.trim().split("\n").filter(Boolean).pop() || "{}";
    return {
      result,
      stderrJson: JSON.parse(stderrLine),
      stdoutJson: JSON.parse(stdoutLine),
      reportJson: existsSync(report) ? JSON.parse(readFileSync(report, "utf8")) : null
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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

test("USDZ runtime optimizer reports physical scale failure instead of budget when every candidate fails scale", () => {
  const { result, stderrJson } = runCliWithFakeWorker("physical-scale-stderr");

  assert.notEqual(result.status, 0);
  assert.equal(stderrJson.stage, "physical-scale");
  assert.equal(stderrJson.failureKind, "physical-scale");
  assert.match(stderrJson.error, /Echelle physique invalide/);
  assert.doesNotMatch(stderrJson.error, /sous budget/i);
  assert.equal(stderrJson.selectedCandidate, null);
  assert.ok(stderrJson.attempts.length >= 1);
  assert.equal(stderrJson.attempts[0].stage, "physical-scale");
});

test("USDZ runtime optimizer reports Blender failure instead of budget when every candidate fails in Blender", () => {
  const { result, stderrJson } = runCliWithFakeWorker("blender-stderr");

  assert.notEqual(result.status, 0);
  assert.equal(stderrJson.stage, "blender");
  assert.equal(stderrJson.failureKind, "blender");
  assert.match(stderrJson.error, /Blender/);
  assert.doesNotMatch(stderrJson.error, /sous budget/i);
  assert.equal(stderrJson.selectedCandidate, null);
  assert.equal(stderrJson.attempts[0].stage, "blender");
});

test("USDZ runtime optimizer preserves failed worker report details for missing Blender", () => {
  const { result, stderrJson } = runCliWithFakeWorker("blender-unavailable-report");

  assert.notEqual(result.status, 0);
  assert.equal(stderrJson.stage, "blender");
  assert.equal(stderrJson.failureKind, "blender");
  assert.match(stderrJson.error, /Blender indisponible/);
  assert.doesNotMatch(stderrJson.error, /sous budget/i);
  assert.equal(stderrJson.attempts[0].stage, "physical-scale");
  assert.equal(stderrJson.attempts[0].physicalScale.status, "failed");
  assert.deepEqual(stderrJson.attempts[0].fails, [
    "Echelle physique invalide: Blender indisponible pour normaliser le modele AR."
  ]);
});

test("USDZ runtime optimizer classifies Blender launch failures as Blender setup failures", () => {
  const { result, stderrJson } = runCliWithFakeWorker("blender-launch-report");

  assert.notEqual(result.status, 0);
  assert.equal(stderrJson.stage, "blender");
  assert.equal(stderrJson.failureKind, "blender");
  assert.match(stderrJson.error, /Blender impossible|Blender geometry pass impossible/);
  assert.equal(stderrJson.attempts[0].stage, "physical-scale");
});

test("USDZ runtime optimizer reports failed physical scale from candidate report", () => {
  const { result, stderrJson } = runCliWithFakeWorker("physical-scale-report");

  assert.notEqual(result.status, 0);
  assert.equal(stderrJson.stage, "physical-scale");
  assert.equal(stderrJson.failureKind, "physical-scale");
  assert.match(stderrJson.error, /modele non grounded|Echelle physique/i);
  assert.doesNotMatch(stderrJson.error, /sous budget/i);
  assert.equal(stderrJson.attempts[0].physicalScale.status, "failed");
  assert.deepEqual(stderrJson.attempts[0].fails, ["Echelle physique invalide: modele non grounded."]);
});

test("USDZ runtime optimizer reports byte budgets only when candidates exceed byte budget", () => {
  const { result, stderrJson } = runCliWithFakeWorker("over-budget", {
    VISTAIRE_USDZ_PREMIUM_TARGET_BYTES: "1",
    VISTAIRE_USDZ_BALANCED_TARGET_BYTES: "1",
    VISTAIRE_USDZ_LIGHT_TARGET_BYTES: "1",
    VISTAIRE_USDZ_EMERGENCY_TARGET_BYTES: "1"
  });

  assert.notEqual(result.status, 0);
  assert.equal(stderrJson.stage, "budget");
  assert.equal(stderrJson.failureKind, "byte-budget");
  assert.match(stderrJson.error, /Premium au-dessus du budget|depassent le budget/i);
  assert.match(stderrJson.error, /premium.*2048 B\/1 B|2048 B \/ 1 B/);
  assert.equal(stderrJson.selectedCandidate, null);
  assert.equal(stderrJson.attempts[0].runtimeBytes, 2048);
  assert.equal(stderrJson.attempts[0].targetBytes, 1);
  assert.equal(stderrJson.attempts[0].passedBudget, false);
});

test("USDZ runtime optimizer uses strict requested profile candidates by default", () => {
  for (const requestedProfile of ["premium", "balanced", "light", "emergency"]) {
    const { result, stdoutJson } = runCliWithFakeWorker("strict-success", {}, requestedProfile);

    assert.equal(result.status, 0);
    assert.equal(stdoutJson.profile, requestedProfile);
    assert.equal(stdoutJson.requestedProfile, requestedProfile);
    assert.equal(stdoutJson.selectedProfile, requestedProfile);
    assert.match(stdoutJson.selectedRecipe, new RegExp(`^${requestedProfile}-`));
    assert.equal(stdoutJson.profileFallbackApplied, false);
    assert.equal(stdoutJson.recipeFallbackApplied, false);
    assert.ok(stdoutJson.candidateAttempts.every((attempt) => attempt.profile === requestedProfile));
  }
});

test("USDZ runtime optimizer does not select light when premium is requested by default", () => {
  const { result, stderrJson } = runCliWithFakeWorker("light-only-success", {}, "premium");

  assert.notEqual(result.status, 0);
  assert.equal(stderrJson.selectedCandidate, null);
  assert.equal(stderrJson.profileFallbackApplied, false);
  assert.ok(stderrJson.attempts.every((attempt) => attempt.profile === "premium"));
  assert.deepEqual(
    stderrJson.attempts.map((attempt) => attempt.recipe),
    ["premium-max", "premium-fit", "premium-safe"]
  );
  assert.match(stderrJson.error, /premium fake failure/i);
});

test("USDZ runtime optimizer falls back only across recipes inside the requested profile", () => {
  const { result, stdoutJson, reportJson } = runCliWithFakeWorker(
    "premium-safe-success",
    {},
    "premium"
  );

  assert.equal(result.status, 0);
  assert.equal(stdoutJson.profile, "premium");
  assert.equal(stdoutJson.requestedProfile, "premium");
  assert.equal(stdoutJson.selectedProfile, "premium");
  assert.equal(stdoutJson.selectedRecipe, "premium-safe");
  assert.equal(stdoutJson.profileFallbackApplied, false);
  assert.equal(stdoutJson.recipeFallbackApplied, true);
  assert.deepEqual(
    stdoutJson.candidateAttempts.map((attempt) => `${attempt.profile}:${attempt.recipe}`),
    ["premium:premium-max", "premium:premium-fit", "premium:premium-safe"]
  );
  assert.equal(reportJson.selectedProfile, "premium");
  assert.equal(reportJson.selectedRecipe, "premium-safe");
  assert.equal(reportJson.recipeFallbackApplied, true);
});

test("USDZ runtime optimizer can choose emergency-safe without profile fallback", () => {
  const { result, stdoutJson, reportJson } = runCliWithFakeWorker(
    "emergency-safe-success",
    {},
    "emergency"
  );

  assert.equal(result.status, 0);
  assert.equal(stdoutJson.profile, "emergency");
  assert.equal(stdoutJson.requestedProfile, "emergency");
  assert.equal(stdoutJson.selectedProfile, "emergency");
  assert.equal(stdoutJson.selectedRecipe, "emergency-safe");
  assert.equal(stdoutJson.profileFallbackApplied, false);
  assert.equal(stdoutJson.recipeFallbackApplied, true);
  assert.deepEqual(
    stdoutJson.candidateAttempts.map((attempt) => `${attempt.profile}:${attempt.recipe}`),
    ["emergency:emergency-max", "emergency:emergency-safe"]
  );
  assert.equal(stdoutJson.candidateAttempts[0].targetTriangles, 70000);
  assert.equal(stdoutJson.candidateAttempts[0].minDecimateRatio, 0.03);
  assert.equal(stdoutJson.candidateAttempts[1].targetTriangles, 55000);
  assert.equal(stdoutJson.candidateAttempts[1].minDecimateRatio, 0.02);
  assert.equal(stdoutJson.candidateAttempts[1].decimatePassesApplied, 2);
  assert.equal(reportJson.selectedProfile, "emergency");
  assert.equal(reportJson.selectedRecipe, "emergency-safe");
  assert.equal(reportJson.profileFallbackApplied, false);
  assert.equal(reportJson.recipeFallbackApplied, true);
});

test("USDZ runtime optimizer preserves attempts when selected runtime fails final validation", () => {
  const { result, stderrJson } = runCliWithFakeWorker("invalid-runtime");

  assert.notEqual(result.status, 0);
  assert.equal(stderrJson.stage, "validate-runtime");
  assert.equal(stderrJson.failureKind, "runtime-invalid");
  assert.equal(stderrJson.selectedCandidate.profile, "premium");
  assert.ok(stderrJson.attempts.length >= 1);
  assert.equal(stderrJson.attempts[0].profile, "premium");
  assert.match(stderrJson.error, /Runtime USDZ invalide/);
  assert.ok(Array.isArray(stderrJson.fails));
});

test("Blender optimizer refreshes scene geometry after baked mesh transforms", () => {
  const blender = readFileSync("scripts/owner/blender_usdz_geometry_optimizer.py", "utf8");

  assert.match(blender, /def refresh_scene_geometry\(\) -> None:/);
  assert.match(blender, /obj\.data\.update\(\)/);
  assert.match(blender, /bpy\.context\.view_layer\.update\(\)/);
  assert.match(blender, /bake_meshes_to_world\(\)[\s\S]*refresh_scene_geometry\(\)/);
  assert.match(blender, /transform_mesh_geometry\(matrix: Matrix\)[\s\S]*refresh_scene_geometry\(\)/);
});

test("Blender optimizer uses recipe-driven decimation limits instead of a hardcoded 0.05 floor", () => {
  const blender = readFileSync("scripts/owner/blender_usdz_geometry_optimizer.py", "utf8");
  const worker = readFileSync("scripts/owner/optimize_restaurant_usdz.py", "utf8");
  const config = JSON.parse(readFileSync("scripts/owner/usdz-optimization-recipes.json", "utf8"));

  assert.doesNotMatch(blender, /max\(0\.05,\s*min/);
  assert.match(blender, /--min-decimate-ratio/);
  assert.match(blender, /--max-decimate-passes/);
  assert.match(blender, /decimatePassesApplied/);
  assert.match(worker, /"--min-decimate-ratio"/);
  assert.match(worker, /"--max-decimate-passes"/);
  assert.equal(config.profiles.emergency.recipes[0].minDecimateRatio, 0.03);
  assert.equal(config.profiles.emergency.recipes[1].minDecimateRatio, 0.02);
  assert.equal(config.profiles.emergency.recipes[1].maxDecimatePasses, 2);
  for (const profile of ["premium", "balanced", "light"]) {
    for (const recipe of config.profiles[profile].recipes) {
      assert.equal(recipe.minDecimateRatio, 0.05);
      assert.equal(recipe.maxDecimatePasses, 1);
    }
  }
});
