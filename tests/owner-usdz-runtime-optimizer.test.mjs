import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

const TOOLCHAIN_AVAILABLE = pythonHasToolchain();

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

test("USDZ runtime optimizer produces a valid, smaller runtime with an honest report", { skip: !TOOLCHAIN_AVAILABLE ? "OpenUSD/Pillow not available" : false }, () => {
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
      [CLI, "--source", source, "--output", runtime, "--report", report, "--profile", "balanced"],
      { encoding: "utf8" }
    );
    const summary = JSON.parse(stdout.trim().split("\n").pop());

    assert.equal(summary.ok, true);
    assert.ok(existsSync(runtime), "runtime USDZ produced");
    assert.ok(existsSync(source), "source is not consumed by the CLI (API cleans it)");
    assert.notEqual(summary.runtimeSha256, summary.sourceSha256, "runtime differs from source");
    assert.equal(summary.geometryOptimization, "skipped");
    assert.equal(summary.optimizationApplied, true, "a 2048 base color texture must be resized");

    const runtimeValidation = validateUsdzBasic({ filePath: runtime, productionUrl: false });
    assert.equal(runtimeValidation.ok, true, JSON.stringify(runtimeValidation.fails));

    const parsedReport = JSON.parse(readFileSync(report, "utf8"));
    assert.equal(parsedReport.geometryOptimization, "skipped");
    assert.ok(typeof parsedReport.reductionPercent === "number");
    assert.ok(parsedReport.textureCount >= 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
