#!/usr/bin/env node
/**
 * Vistaire USDZ-only transient runtime optimizer (Node orchestrator).
 *
 * Contract:
 *   node scripts/owner/optimize-restaurant-usdz.mjs \
 *     --source <tmp source.usdz> --output <tmp runtime.usdz> \
 *     --report <tmp report.json> --profile balanced|premium|light|emergency
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
 *
 * Local worker hardening:
 * - VISTAIRE_USDZ_WORKER_ALLOWED_ORIGINS must include the production owner origin
 *   when this CLI is exposed behind a local worker bridge.
 * - VISTAIRE_USDZ_PYTHON points at the Python runtime with OpenUSD/Pillow.
 * - VISTAIRE_USDZ_BLENDER points at Blender for future geometry decimation; geometry
 *   cannot be reported as done unless triangleCountAfter < triangleCountBefore.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateUsdzBasic } from "../3d/shared/validators/usdz-basic.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PYTHON_WORKER = join(SCRIPT_DIR, "optimize_restaurant_usdz.py");
const PROFILE_ORDER = ["premium", "balanced", "light", "emergency"];
const VALID_PROFILES = new Set(PROFILE_ORDER);
const VALID_DISH_KINDS = new Set(["burger", "pizza", "plate", "bowl", "dessert", "drink", "platter", "fallback"]);
const DEFAULT_PROFILE_BUDGETS = {
  premium: 16 * 1024 * 1024,
  balanced: 12 * 1024 * 1024,
  light: 10 * 1024 * 1024,
  emergency: Math.floor(5.5 * 1024 * 1024)
};

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

function parsePositiveInt(value, fallback) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function targetBudgetBytes(profile) {
  const envKey = `VISTAIRE_USDZ_${profile.toUpperCase()}_TARGET_BYTES`;
  return parsePositiveInt(process.env[envKey], DEFAULT_PROFILE_BUDGETS[profile]);
}

function candidateProfiles(requestedProfile) {
  const startIndex = PROFILE_ORDER.indexOf(requestedProfile);
  return PROFILE_ORDER.slice(startIndex < 0 ? 1 : startIndex);
}

function resolvePythonExecutable() {
  if (process.env.VISTAIRE_USDZ_PYTHON) return process.env.VISTAIRE_USDZ_PYTHON;
  return process.platform === "win32" ? "python" : "python3";
}

function resolveBlenderExecutable() {
  return process.env.VISTAIRE_USDZ_BLENDER || "blender";
}

function allowedWorkerOrigins() {
  return (process.env.VISTAIRE_USDZ_WORKER_ALLOWED_ORIGINS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function assertAllowedWorkerOrigin(origin) {
  if (!origin) return;
  const allowed = allowedWorkerOrigins();
  if (allowed.length === 0 || !allowed.includes(origin)) {
    emitError("Origin worker USDZ non autorisee.", "origin", { origin });
  }
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

class OptimizerStageError extends Error {
  constructor(message, stage, extra = {}) {
    super(message);
    this.name = "OptimizerStageError";
    this.stage = stage;
    this.extra = extra;
  }
}

function parseWorkerReport(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function runCandidate({ python, source, workspace, profile, dishKind }) {
  const runtimePath = join(workspace, `runtime-${profile}.usdz`);
  const reportPath = join(workspace, `report-${profile}.json`);
  const startedAt = Date.now();
  const result = await runPython(python, [
    "--source",
    source,
    "--output",
    runtimePath,
    "--report",
    reportPath,
    "--profile",
    profile,
    "--dish-kind",
    dishKind
  ]);
  const attempt = {
    profile,
    targetBytes: targetBudgetBytes(profile),
    ok: result.code === 0,
    runtimeBytes: existsSync(runtimePath) ? statSync(runtimePath).size : 0,
    durationMs: Date.now() - startedAt
  };
  if (result.code !== 0) {
    let detail = result.stderr.trim() || result.stdout.trim();
    let stage = "worker";
    try {
      const parsed = JSON.parse(result.stderr.trim().split("\n").pop());
      if (parsed && parsed.error) detail = parsed.error;
      if (parsed && parsed.stage) stage = parsed.stage;
    } catch {
      // keep raw detail
    }
    return {
      ok: false,
      runtimePath,
      reportPath,
      attempt: { ...attempt, error: detail, stage },
      stderr: result.stderr,
      stdout: result.stdout
    };
  }

  let report = {};
  try {
    report = parseWorkerReport(reportPath);
  } catch (error) {
    return {
      ok: false,
      runtimePath,
      reportPath,
      attempt: {
        ...attempt,
        ok: false,
        error: `Rapport illisible: ${error.message}`,
        stage: "report-parse"
      },
      stderr: result.stderr,
      stdout: result.stdout
    };
  }

  const passedBudget = attempt.runtimeBytes > 0 && attempt.runtimeBytes <= attempt.targetBytes;
  return {
    ok: true,
    runtimePath,
    reportPath,
    report,
    attempt: {
      ...attempt,
      runtimeBytes: report.runtimeBytes ?? attempt.runtimeBytes,
      reductionPercent: report.reductionPercent ?? 0,
      geometryOptimization: report.geometryOptimization ?? "skipped",
      triangleCountBefore: report.triangleCountBefore ?? 0,
      triangleCountAfter: report.triangleCountAfter ?? 0,
      targetTriangles: report.targetTriangles ?? 0,
      physicalScale: report.physicalScale ?? null,
      warnings: Array.isArray(report.warnings) ? report.warnings : [],
      fails: Array.isArray(report.fails) ? report.fails : [],
      passedBudget
    },
    stderr: result.stderr,
    stdout: result.stdout
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source ? resolve(args.source) : "";
  const output = args.output ? resolve(args.output) : "";
  const reportPath = args.report ? resolve(args.report) : "";
  const profile = (args.profile || "balanced").toLowerCase();
  const dishKind = (args["dish-kind"] || "fallback").toLowerCase();
  const origin = typeof args.origin === "string" ? args.origin.trim() : "";

  assertAllowedWorkerOrigin(origin);
  resolveBlenderExecutable();
  if (!source || !output || !reportPath) {
    emitError("Arguments requis: --source --output --report.", "args");
  }
  if (!VALID_PROFILES.has(profile)) {
    emitError(`Profil invalide: ${profile}.`, "args");
  }
  if (!VALID_DISH_KINDS.has(dishKind)) {
    emitError(`Type de plat invalide: ${dishKind}.`, "args");
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
  const candidateWorkspace = mkdtempSync(join(resolve(tmpdir()), "vistaire-usdz-candidates-"));
  const attempts = [];
  let chosen = null;

  try {
    for (const candidateProfile of candidateProfiles(profile)) {
      const candidate = await runCandidate({
        python,
        source,
        workspace: candidateWorkspace,
        profile: candidateProfile,
        dishKind
      });
      attempts.push(candidate.attempt);
      if (!candidate.ok) {
        rmSync(candidate.runtimePath, { force: true });
        rmSync(candidate.reportPath, { force: true });
        continue;
      }

      const fails = Array.isArray(candidate.report.fails) ? candidate.report.fails : [];
      const passedBudget =
        candidate.attempt.runtimeBytes > 0 &&
        candidate.attempt.runtimeBytes <= candidate.attempt.targetBytes;
      if (fails.length === 0 && passedBudget) {
        chosen = candidate;
        break;
      }

      rmSync(candidate.runtimePath, { force: true });
      rmSync(candidate.reportPath, { force: true });
    }

    if (!chosen) {
      throw new OptimizerStageError("Aucune candidate USDZ runtime sous budget.", "budget", {
        attempts
      });
    }

    copyFileSync(chosen.runtimePath, output);
    copyFileSync(chosen.reportPath, reportPath);
    const finalReport = parseWorkerReport(reportPath);
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          ...finalReport,
          profile: chosen.attempt.profile,
          candidateAttempts: attempts,
          attemptCount: attempts.length,
          sourceStored: false
        },
        null,
        2
      ),
      "utf8"
    );
  } finally {
    rmSync(candidateWorkspace, { recursive: true, force: true });
  }

  if (!existsSync(output)) {
    emitError("Le worker n'a produit aucun runtime USDZ.", "output-missing", { attempts });
  }
  if (!existsSync(reportPath)) {
    emitError("Le worker n'a produit aucun rapport.", "report-missing", { attempts });
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
  if (report.geometryOptimization === "done") {
    const triangleCountBefore = Number(report.triangleCountBefore);
    const triangleCountAfter = Number(report.triangleCountAfter);
    if (!(triangleCountAfter < triangleCountBefore)) {
      rmSync(output, { force: true });
      emitError(
        "geometryOptimization=done exige triangleCountAfter < triangleCountBefore.",
        "geometry"
      );
    }
  }
  if (optimizationApplied && runtimeSha256 === sourceSha256 && runtimeBytes === sourceBytes) {
    rmSync(output, { force: true });
    emitError("Runtime identique au source malgre l'optimisation.", "identical");
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      profile: report.profile ?? chosen?.attempt?.profile ?? profile,
      sourcePath: source,
      runtimePath: output,
      reportPath,
      sourceBytes,
      sourceSha256,
      runtimeBytes,
      runtimeSha256,
      optimizationApplied,
      geometryOptimization: report.geometryOptimization ?? "skipped",
      geometryOptimizationReason: report.geometryOptimizationReason ?? "",
      triangleCountBefore: report.triangleCountBefore ?? 0,
      triangleCountAfter: report.triangleCountAfter ?? 0,
      geometryReductionPercent: report.geometryReductionPercent ?? 0,
      physicalScale: report.physicalScale ?? null,
      reductionPercent: report.reductionPercent ?? 0,
      candidateAttempts: Array.isArray(report.candidateAttempts)
        ? report.candidateAttempts
        : attempts,
      attemptCount: attempts.length,
      warnings: Array.isArray(report.warnings) ? report.warnings : [],
      fails: Array.isArray(report.fails) ? report.fails : [],
      textureCount: report.textureCount ?? 0,
      changedTextures: report.changedTextures ?? 0,
      materialCount: report.materialCount ?? 0,
      sourceStored: false,
      cleanup: report.cleanup ?? { extractedWorkspaceRemoved: true },
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
  if (error instanceof OptimizerStageError) {
    emitError(error.message, error.stage, error.extra);
  }
  emitError(error instanceof Error ? error.message : String(error), "uncaught");
});
