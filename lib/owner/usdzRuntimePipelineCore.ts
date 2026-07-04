import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertNoForbiddenSourceStorage,
  buildUsdzRuntimeMetadataPatch,
  buildUsdzRuntimeStoragePath,
  computeSplitModelStatus,
  createUsdzRuntimeAssetVersion,
  evaluateRuntimeUsdzUploadGate,
  getMetadataObject,
  MODEL_BUCKET,
  restampPublicModelUrls,
  sha256Hex,
  type UsdzOptimizationProfile
} from "./usdzRuntimeModel.ts";

const PROJECT_ROOT = process.cwd();
const CLI_RELATIVE_PATH = "scripts/owner/optimize-restaurant-usdz.mjs";
const CLI_PATH = join(PROJECT_ROOT, CLI_RELATIVE_PATH);
const CLI_TIMEOUT_MS = 8 * 60 * 1000;

type OwnerIdentity = {
  userId: string;
  email?: string | null;
};

export type UsdzOptimizerRunOptions = {
  sourcePath: string;
  outputPath: string;
  reportPath: string;
  profile: UsdzOptimizationProfile;
};

/**
 * Runs the transient USDZ optimizer and returns its summary. Injectable so the
 * upload/rollback/gate logic can be unit-tested without spawning the real
 * worker. The default implementation shells out to the Node CLI.
 */
export type UsdzOptimizerRunner = (options: UsdzOptimizerRunOptions) => Promise<CliSummary>;

export type UsdzRuntimePipelineArgs = {
  adminClient: SupabaseClient;
  owner: OwnerIdentity;
  restaurantId: string;
  restaurantSlug: string;
  menuSlug: string;
  dishId: string;
  dishSlug: string;
  existingMetadata: unknown;
  sourceBytes: Buffer;
  originalName: string;
  profile: UsdzOptimizationProfile;
  maxRuntimeBytes: number;
  /** Test seam. Defaults to the real CLI-backed optimizer. */
  optimizer?: UsdzOptimizerRunner;
};

export type UsdzRuntimePipelineResult = {
  status: "ready";
  jobId: string;
  version: string;
  arUsdzUrl: string;
  usdzRuntimeBytes: number;
  usdzSourceBytes: number;
  reductionPercent: number;
  profile: UsdzOptimizationProfile;
  geometryOptimization: string;
  triangleCountBefore: number;
  triangleCountAfter: number;
  geometryReductionPercent: number;
  attemptCount: number;
  textureCount: number;
  changedTextures: number;
  warnings: string[];
  fails: string[];
};

type CliSummary = {
  ok: boolean;
  runtimePath: string;
  reportPath: string;
  runtimeBytes: number;
  runtimeSha256: string;
  optimizationApplied: boolean;
  geometryOptimization: string;
  physicalScale?: {
    status?: string;
    dishKind?: string;
    dimension?: string;
    targetMeters?: number;
    minMeters?: number;
    maxMeters?: number;
    heightBeforeMeters?: number;
    widthBeforeMeters?: number;
    depthBeforeMeters?: number;
    footprintBeforeMeters?: number;
    heightAfterMeters?: number;
    widthAfterMeters?: number;
    depthAfterMeters?: number;
    footprintAfterMeters?: number;
    scaleFactor?: number;
    centeredX?: boolean;
    centeredY?: boolean;
    grounded?: boolean;
    centerOffsetBeforeMeters?: number;
    centerOffsetAfterMeters?: number;
    warnings?: string[];
  };
  triangleCountBefore?: number;
  triangleCountAfter?: number;
  geometryReductionPercent?: number;
  candidateAttempts?: unknown[];
  attemptCount?: number;
  textureCount?: number;
  changedTextures?: number;
  reductionPercent: number;
  warnings: string[];
  fails: string[];
};

function runOptimizerCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: PROJECT_ROOT,
      env: process.env,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Optimisation USDZ trop longue."));
    }, CLI_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        let message = stderr.trim() || stdout.trim() || "Worker USDZ indisponible.";
        try {
          const parsed = JSON.parse(stderr.trim().split("\n").pop() as string);
          if (parsed && parsed.error) message = parsed.error;
        } catch {
          // keep raw message
        }
        reject(new Error(message));
      }
    });
  });
}

function parseCliSummary(stdout: string): CliSummary {
  const line = stdout.trim().split("\n").filter(Boolean).pop() ?? "";
  const parsed = JSON.parse(line) as CliSummary;
  if (!parsed.ok || !parsed.runtimePath || !parsed.reportPath) {
    throw new Error("Sortie worker USDZ invalide.");
  }
  return parsed;
}

const runDefaultOptimizer: UsdzOptimizerRunner = async (options) => {
  const { stdout } = await runOptimizerCli([
    "--source",
    options.sourcePath,
    "--output",
    options.outputPath,
    "--report",
    options.reportPath,
    "--profile",
    options.profile
  ]);
  return parseCliSummary(stdout);
};

/**
 * Best-effort removal of already-uploaded runtime artifacts. Used to roll back
 * a partial upload so no orphaned/inconsistent asset remains. It NEVER touches
 * a source path (the source is never stored).
 */
async function rollbackStorageObjects(
  adminClient: SupabaseClient,
  paths: Array<string | undefined>
): Promise<void> {
  const cleanPaths = paths.filter((path): path is string => Boolean(path && path.trim()));
  if (cleanPaths.length === 0) return;
  try {
    await adminClient.storage.from(MODEL_BUCKET).remove(cleanPaths);
  } catch {
    // best-effort rollback; the transient temp workspace is still cleaned in finally
  }
}

async function fetchFreshDishMetadata(args: {
  adminClient: SupabaseClient;
  dishId: string;
  restaurantId: string;
}): Promise<Record<string, unknown>> {
  const result = await args.adminClient
    .from("menu_dishes")
    .select("metadata")
    .eq("id", args.dishId)
    .eq("restaurant_id", args.restaurantId)
    .maybeSingle();
  if (result.error || !result.data) {
    throw new Error("Metadata du plat impossible a relire avant publication USDZ.");
  }
  return getMetadataObject((result.data as { metadata?: unknown }).metadata);
}

/**
 * Optimizes a heavy source USDZ transiently and uploads ONLY the validated
 * runtime USDZ + a lightweight report to Supabase. The source never leaves the
 * controlled temp directory, which is deleted in `finally`. If any step fails
 * before the gate passes, nothing is uploaded.
 */
export async function runUsdzRuntimePipeline(
  args: UsdzRuntimePipelineArgs
): Promise<UsdzRuntimePipelineResult> {
  const processedAt = new Date().toISOString();
  const sourceSha256 = sha256Hex(args.sourceBytes);

  const workspace = mkdtempSync(join(resolve(tmpdir()), "vistaire-usdz-runtime-"));
  const sourcePath = join(workspace, "source.usdz");
  const runtimePath = join(workspace, "runtime.usdz");
  const reportPath = join(workspace, "report.json");

  try {
    writeFileSync(sourcePath, args.sourceBytes);

    const optimizer = args.optimizer ?? runDefaultOptimizer;
    const summary = await optimizer({
      sourcePath,
      outputPath: runtimePath,
      reportPath,
      profile: args.profile
    });

    // Fail closed if the worker reported any blocking fail: upload nothing.
    if (Array.isArray(summary.fails) && summary.fails.length > 0) {
      throw new Error(`Optimisation USDZ bloquee: ${summary.fails.join("; ")}`);
    }

    if (!existsSync(runtimePath)) {
      throw new Error("Aucun runtime USDZ produit par le worker.");
    }
    const runtimeBytes = readFileSync(runtimePath);
    const reportGenerated = existsSync(reportPath);
    const reportBytes = reportGenerated ? readFileSync(reportPath) : Buffer.from("{}");

    // Prove the transient source is deleted BEFORE any Supabase upload. The
    // whole workspace is still removed in `finally`, but the gate must not pass
    // on an assumption: it verifies the source file no longer exists.
    rmSync(sourcePath, { force: true });
    const sourceCleaned = !existsSync(sourcePath);

    const gate = evaluateRuntimeUsdzUploadGate({
      runtimeBytes,
      sourceBytes: args.sourceBytes.byteLength,
      sourceSha256,
      maxRuntimeBytes: args.maxRuntimeBytes,
      reportGenerated,
      sourceCleaned,
      optimizationExpected: summary.optimizationApplied
    });
    if (!gate.ok) {
      throw new Error(gate.error);
    }

    const version = createUsdzRuntimeAssetVersion({
      profile: args.profile,
      runtimeSha256: gate.runtimeSha256
    });

    const runtimeStoragePath = buildUsdzRuntimeStoragePath({
      restaurantId: args.restaurantId,
      dishSlug: args.dishSlug,
      version
    });
    const reportStoragePath = `restaurants/${args.restaurantId}/models/manifests/${args.dishSlug}-${version}-usdz-report.json`;

    const patch = buildUsdzRuntimeMetadataPatch(
      {
        restaurantId: args.restaurantId,
        dishId: args.dishId,
        dishSlug: args.dishSlug,
        version,
        runtimeBytes: runtimeBytes.byteLength,
        runtimeSha256: gate.runtimeSha256,
        reportStoragePath,
        profile: args.profile,
        warnings: summary.warnings,
        fails: summary.fails,
        reductionPercent: summary.reductionPercent,
        geometryOptimization: summary.geometryOptimization,
        physicalScale: summary.physicalScale,
        triangleCountBefore: summary.triangleCountBefore ?? 0,
        triangleCountAfter: summary.triangleCountAfter ?? 0,
        geometryReductionPercent: summary.geometryReductionPercent ?? 0,
        textureCount: summary.textureCount ?? 0,
        changedTextures: summary.changedTextures ?? 0,
        candidateAttempts: summary.candidateAttempts ?? [],
        attemptCount: summary.attemptCount ?? 0,
        source: {
          originalName: args.originalName,
          bytes: args.sourceBytes.byteLength,
          sha256: sourceSha256,
          processedAt
        },
        uploadedAt: new Date().toISOString()
      },
      runtimeStoragePath
    );

    const uploadedRuntime = await args.adminClient.storage
      .from(MODEL_BUCKET)
      .upload(runtimeStoragePath, runtimeBytes, {
        contentType: "model/vnd.usdz+zip",
        cacheControl: "31536000",
        upsert: true
      });
    if (uploadedRuntime.error) {
      throw new Error("Upload Storage impossible pour le runtime USDZ.");
    }

    const uploadedReport = await args.adminClient.storage
      .from(MODEL_BUCKET)
      .upload(reportStoragePath, reportBytes, {
        contentType: "application/json",
        cacheControl: "3600",
        upsert: true
      });
    if (uploadedReport.error) {
      // Roll back the runtime we just uploaded so no half-published asset remains.
      await rollbackStorageObjects(args.adminClient, [runtimeStoragePath]);
      throw new Error("Upload Storage impossible pour le rapport d'optimisation USDZ.");
    }

    let merged: Record<string, unknown>;
    try {
      const freshMetadata = await fetchFreshDishMetadata({
        adminClient: args.adminClient,
        dishId: args.dishId,
        restaurantId: args.restaurantId
      });
      merged = { ...freshMetadata, ...patch };
      merged = restampPublicModelUrls(merged, args.dishId, version);
      merged.modelStatus = computeSplitModelStatus(merged);
      assertNoForbiddenSourceStorage(merged);
    } catch (error) {
      await rollbackStorageObjects(args.adminClient, [runtimeStoragePath, reportStoragePath]);
      throw error;
    }

    const updated = await args.adminClient
      .from("menu_dishes")
      .update({ has_immersive_view: true, metadata: merged })
      .eq("id", args.dishId)
      .eq("restaurant_id", args.restaurantId)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      // The dish still points at the previous state, so remove both freshly
      // uploaded objects to avoid orphaned runtime/report in Storage.
      await rollbackStorageObjects(args.adminClient, [runtimeStoragePath, reportStoragePath]);
      throw new Error("Plat impossible a mettre a jour avec le runtime USDZ.");
    }

    const jobId = `job_usdz_runtime_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
    // Job insert is an audit/log record. If it fails, the served asset and dish
    // metadata are already coherent, so we do NOT roll back the runtime; the
    // failure is swallowed to keep a consistent, servable state.
    try {
      await args.adminClient.from("owner_3d_pipeline_jobs").insert({
        id: jobId,
        restaurant_slug: args.restaurantSlug,
        menu_slug: args.menuSlug,
        dish_slug: args.dishSlug,
        asset_version: version,
        step: "usdz_runtime_optimize",
        status: "published",
        logs: [
          "Owner USDZ master processed transiently (never stored in Supabase).",
          `USDZ-only optimizer produced a runtime USDZ (profile ${args.profile}).`,
          "Only the validated runtime USDZ and a lightweight report were uploaded.",
          "Source/candidate/temp files were removed in a finally block.",
          "usdzSourceStored=false; Quick Look QA remains not-tested until a real iPhone validates."
        ],
        step_logs: [],
        artifacts: [
          {
            id: `${jobId}_ios_usdz`,
            type: "ios_usdz",
            label: "iOS Quick Look runtime USDZ",
            path: runtimeStoragePath,
            publicUrl: patch.arUsdzUrl,
            sha256: gate.runtimeSha256,
            bytes: runtimeBytes.byteLength
          },
          {
            id: `${jobId}_report`,
            type: "usdz_report",
            label: "USDZ optimization report",
            path: reportStoragePath
          }
        ],
        metrics: {
          usdzSourceBytes: args.sourceBytes.byteLength,
          usdzSourceSha256: sourceSha256,
          usdzRuntimeBytes: runtimeBytes.byteLength,
          usdzRuntimeSha256: gate.runtimeSha256,
          reductionPercent: summary.reductionPercent,
          geometryOptimization: summary.geometryOptimization,
          triangleCountBefore: summary.triangleCountBefore ?? 0,
          triangleCountAfter: summary.triangleCountAfter ?? 0,
          geometryReductionPercent: summary.geometryReductionPercent ?? 0,
          attemptCount: summary.attemptCount ?? 0,
          optimizationProfile: args.profile,
          storageBucket: MODEL_BUCKET,
          conversionMethod: "owner-usdz-only-optimizer",
          usdzSourceStored: false
        },
        quality_status: "published",
        started_at: processedAt,
        finished_at: new Date().toISOString(),
        duration_ms: 0,
        initiated_by_clerk_user_id: args.owner.userId,
        initiated_by_email: args.owner.email ?? null,
        next_action: "Run real-device iPhone Quick Look QA before promoting.",
        manual_runner_command: `node ${CLI_RELATIVE_PATH} --source <runtime-temp.usdz> --output <runtime.usdz> --report <report.json> --profile ${args.profile}`,
        worker_kind: "external_worker",
        dedupe_key: `${args.restaurantSlug}:${args.menuSlug}:${args.dishSlug}:${version}:usdz_runtime`,
        metadata: {
          restaurantId: args.restaurantId,
          dishId: args.dishId,
          reportStoragePath,
          usdzSourceStored: false
        }
      });
    } catch {
      // Audit job insert failed; served asset + dish metadata remain coherent.
    }

    return {
      status: "ready",
      jobId,
      version,
      arUsdzUrl: String(patch.arUsdzUrl),
      usdzRuntimeBytes: runtimeBytes.byteLength,
      usdzSourceBytes: args.sourceBytes.byteLength,
      reductionPercent: summary.reductionPercent,
      profile: args.profile,
      geometryOptimization: summary.geometryOptimization,
      triangleCountBefore: summary.triangleCountBefore ?? 0,
      triangleCountAfter: summary.triangleCountAfter ?? 0,
      geometryReductionPercent: summary.geometryReductionPercent ?? 0,
      attemptCount: summary.attemptCount ?? 0,
      textureCount: summary.textureCount ?? 0,
      changedTextures: summary.changedTextures ?? 0,
      warnings: summary.warnings,
      fails: summary.fails
    };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
