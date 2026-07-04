#!/usr/bin/env node
/**
 * Vistaire USDZ-only transient runtime optimizer (Node orchestrator).
 *
 * Contract:
 *   node scripts/owner/optimize-restaurant-usdz.mjs \
 *     --source <tmp source.usdz> --output <tmp runtime.usdz> \
 *     --report <tmp report.json> --profile balanced|premium|light
 *
 * - Validates the source USDZ structurally (usdz-basic).
 * - Runs the Python worker (OpenUSD + Pillow) that extracts, inspects,
 *   resizes textures per profile, and repackages a valid runtime USDZ.
 * - Validates the runtime output structurally (usdz-basic) and computes sha256.
 * - Emits a single JSON summary on stdout. On any failure it prints an error
 *   JSON on stderr, removes any partial output, and exits non-zero. It NEVER
 *   uploads anything and NEVER stores the source anywhere durable.
 *
 * Fail-closed: if OpenUSD/Pillow/Python is unavailable, this exits non-zero and
 * no runtime is produced, so the API uploads nothing.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateUsdzBasic } from "../3d/shared/validators/usdz-basic.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PYTHON_WORKER = join(SCRIPT_DIR, "optimize_restaurant_usdz.py");
const VALID_PROFILES = new Set(["premium", "balanced", "light"]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[i + 1];
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function emitError(message, stage, extra = {}) {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: message, stage, ...extra })}\n`
  );
  process.exit(2);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function resolvePythonExecutable() {
  if (process.env.VISTAIRE_USDZ_PYTHON) return process.env.VISTAIRE_USDZ_PYTHON;
  return process.platform === "win32" ? "python" : "python3";
}

function runPython(python, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(python, [PYTHON_WORKER, ...args], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolvePromise({ code: -1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => {
      resolvePromise({ code: code ?? -1, stdout, stderr });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source ? resolve(args.source) : "";
  const output = args.output ? resolve(args.output) : "";
  const reportPath = args.report ? resolve(args.report) : "";
  const profile = (args.profile || "balanced").toLowerCase();

  if (!source || !output || !reportPath) {
    emitError("Arguments requis: --source --output --report.", "args");
  }
  if (!VALID_PROFILES.has(profile)) {
    emitError(`Profil invalide: ${profile}.`, "args");
  }
  if (source === output) {
    emitError("Source et output identiques.", "args");
  }
  if (!existsSync(source)) {
    emitError("Source USDZ introuvable.", "source");
  }

  const sourceValidation = validateUsdzBasic({
    filePath: source,
    label: "usdz-source",
    productionUrl: false
  });
  if (!sourceValidation.ok) {
    emitError("Source USDZ invalide.", "validate-source", { fails: sourceValidation.fails });
  }
  const sourceBytes = statSync(source).size;
  const sourceSha256 = sha256File(source);

  const python = resolvePythonExecutable();
  const result = await runPython(python, [
    "--source",
    source,
    "--output",
    output,
    "--report",
    reportPath,
    "--profile",
    profile
  ]);

  if (result.code !== 0) {
    if (existsSync(output)) rmSync(output, { force: true });
    let detail = result.stderr.trim() || result.stdout.trim();
    let stage = "worker";
    try {
      const parsed = JSON.parse(result.stderr.trim().split("\n").pop());
      if (parsed && parsed.error) detail = parsed.error;
      if (parsed && parsed.stage) stage = parsed.stage;
    } catch {
      // keep raw detail
    }
    emitError(`Worker USDZ echoue: ${detail}`, stage);
  }

  if (!existsSync(output)) {
    emitError("Le worker n'a produit aucun runtime USDZ.", "output-missing");
  }
  if (!existsSync(reportPath)) {
    emitError("Le worker n'a produit aucun rapport.", "report-missing");
  }

  const runtimeValidation = validateUsdzBasic({
    filePath: output,
    label: "usdz-runtime",
    productionUrl: false
  });
  if (!runtimeValidation.ok) {
    rmSync(output, { force: true });
    emitError("Runtime USDZ invalide apres optimisation.", "validate-runtime", {
      fails: runtimeValidation.fails
    });
  }

  const runtimeBytes = statSync(output).size;
  const runtimeSha256 = sha256File(output);

  let report = {};
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    emitError(`Rapport illisible: ${error.message}`, "report-parse");
  }

  const optimizationApplied = Boolean(report.optimizationApplied);
  if (optimizationApplied && runtimeSha256 === sourceSha256 && runtimeBytes === sourceBytes) {
    rmSync(output, { force: true });
    emitError("Runtime identique au source malgre l'optimisation.", "identical");
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      profile,
      sourcePath: source,
      runtimePath: output,
      reportPath,
      sourceBytes,
      sourceSha256,
      runtimeBytes,
      runtimeSha256,
      optimizationApplied,
      geometryOptimization: report.geometryOptimization ?? "skipped",
      reductionPercent: report.reductionPercent ?? 0,
      warnings: Array.isArray(report.warnings) ? report.warnings : [],
      fails: Array.isArray(report.fails) ? report.fails : [],
      textureCount: report.textureCount ?? 0,
      materialCount: report.materialCount ?? 0,
      runtimeValidation: {
        entryCount: runtimeValidation.metrics.entryCount,
        usdLayerCount: runtimeValidation.metrics.usdLayerCount,
        textureCount: runtimeValidation.metrics.textureCount,
        materialCount: runtimeValidation.metrics.materialCount
      }
    })}\n`
  );
}

main().catch((error) => {
  emitError(error instanceof Error ? error.message : String(error), "uncaught");
});
