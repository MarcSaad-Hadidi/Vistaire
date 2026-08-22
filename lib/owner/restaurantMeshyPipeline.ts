import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createOwnerMeshyRuntimeWorkspace,
  resolveOwnerMeshyAssetPath
} from "@/lib/owner/meshyRuntimeWorkspace";
import {
  buildPreparedModelArLiteStoragePath,
  buildPreparedModelPublicArLiteGlbPath,
  buildPreparedModelPublicGlbPath,
  buildPreparedModelPublicUsdzPath,
  buildPreparedModelUsdzStoragePath,
  buildPreparedModelWebStoragePath
} from "@/lib/owner/preparedModelWorkflow";
import { cleanDishModelMetadata } from "@/lib/owner/deleteDishModelAssets";
import { sha256Hex } from "@/lib/owner/threeDSourceUploadModel";
import {
  cleanupReplacedDishAssets,
  type CleanupReplacedDishAssetsReport
} from "@/lib/owner/dishAssetReplacementCleanup";

const PROJECT_ROOT = /* turbopackIgnore: true */ process.cwd();
const PIPELINE_SCRIPT_RELATIVE_PATH = "scripts/owner/build-restaurant-meshy-dish.mjs";
const PIPELINE_SCRIPT_PATH = join(PROJECT_ROOT, PIPELINE_SCRIPT_RELATIVE_PATH);
const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000;
const MODEL_BUCKET = "vistaire-3d";

type OwnerIdentity = {
  userId: string;
  email?: string | null;
};

type RestaurantMeshyPipelineArgs = {
  adminClient: SupabaseClient;
  owner: OwnerIdentity;
  restaurantId: string;
  restaurantSlug: string;
  menuSlug: string;
  dishId: string;
  dishSlug: string;
  existingMetadata: unknown;
  sourceBytes: Buffer;
  originalName?: string;
  onPublicCommit?: () => void | Promise<void>;
};

type MeshyManifest = {
  kind?: string;
  restaurantSlug?: string;
  menuSlug?: string;
  dishSlug?: string;
  version?: string;
  sourceFile?: string;
  assets?: {
    model3dUrl?: string;
    webModel3dUrl?: string;
    arModel3dUrl?: string;
    arUsdzUrl?: string;
  };
  localPaths?: {
    model3d?: string;
    webModel3d?: string;
    arModel3d?: string;
    arUsdz?: string;
  };
  sha256?: {
    meshy?: string;
    meshopt?: string;
    arLite?: string;
    arUsdz?: string;
  };
};

type PipelineRunResult = {
  ok: true;
  status: "ready";
  jobId: string;
  manifest: MeshyManifest;
  manifestPath: string;
  manifestUrl: string;
  model3dUrl: string;
  webModel3dUrl: string;
  arModel3dUrl: string;
  arUsdzUrl: string;
  webModel3dBytes: number;
  arModel3dBytes: number;
  arUsdzBytes: number;
  cleanup: CleanupReplacedDishAssetsReport;
};

type LocalMeshyAssets = {
  model3dUrl: string;
  webModel3dUrl: string;
  arModel3dUrl: string;
  arUsdzUrl: string;
  model3dPath: string;
  webModel3dPath: string;
  arModel3dPath: string;
  arUsdzPath: string;
};

type DurableMeshyAssets = {
  bucket: string;
  sourceStoragePath: string;
  webStoragePath: string;
  arLiteStoragePath: string;
  usdzStoragePath: string;
  manifestStoragePath: string;
  model3dUrl: string;
  webModel3dUrl: string;
  arModel3dUrl: string;
  arUsdzUrl: string;
  webModel3dBytes: number;
  arModel3dBytes: number;
  arUsdzBytes: number;
};

function deferredCleanupReport(): CleanupReplacedDishAssetsReport {
  return {
    candidates: [],
    deleted: [],
    skippedStillReferenced: [],
    skippedUnsafeBucket: [],
    skippedUnsafePrefix: [],
    skippedMissingPath: [],
    skippedConcurrentReuseRisk: [],
    errors: [
      {
        bucket: "",
        paths: [],
        message: "Nettoyage differe apres publication du modele."
      }
    ]
  };
}

function assertSafeSlug(value: string, label: string): string {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${label} invalide pour le pipeline Meshy.`);
  }
  return slug;
}

function dateTag(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function normalizeMeshyPipelineError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /\b(?:ENOENT|EACCES|EPERM|EROFS)\b/i.test(message) &&
    /(?:mkdir|output-root|\/var\/task|\\var\\task|\/tmp|\\Temp)/i.test(message)
  ) {
    return new Error("Workspace temporaire 3D indisponible.");
  }
  return error instanceof Error ? error : new Error(message);
}

async function runNodeScript(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [PIPELINE_SCRIPT_PATH, ...args], {
      cwd: PROJECT_ROOT,
      env: process.env,
      windowsHide: true
    });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Pipeline Meshy trop long: ${PIPELINE_SCRIPT_RELATIVE_PATH}.`));
    }, PIPELINE_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(output.trim() || `Pipeline Meshy echoue: ${PIPELINE_SCRIPT_RELATIVE_PATH}.`));
      }
    });
  });
}

function manifestPathFor(args: {
  outputRoot: string;
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
  versionTag: string;
}): string {
  return join(
    manifestAssetRootFor(args),
    "manifest.json"
  );
}

function manifestAssetRootFor(args: {
  outputRoot: string;
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
  versionTag: string;
}): string {
  return join(
    args.outputRoot,
    "models",
    "restaurants",
    args.restaurantSlug,
    args.menuSlug,
    args.dishSlug,
    `meshy-${args.versionTag}`
  );
}

function readManifest(manifestPath: string): MeshyManifest {
  if (!existsSync(manifestPath)) {
    throw new Error("Manifest Meshy introuvable apres generation.");
  }
  return JSON.parse(readFileSync(manifestPath, "utf8")) as MeshyManifest;
}

function cleanManifestAssets(args: {
  manifest: MeshyManifest;
  outputRoot: string;
  assetRoot: string;
}): LocalMeshyAssets {
  const { manifest } = args;
  const model3dUrl = manifest.assets?.model3dUrl?.trim() ?? "";
  const webModel3dUrl = manifest.assets?.webModel3dUrl?.trim() ?? "";
  const arModel3dUrl = manifest.assets?.arModel3dUrl?.trim() ?? "";
  const arUsdzUrl = manifest.assets?.arUsdzUrl?.trim() ?? "";
  for (const url of [model3dUrl, webModel3dUrl, arModel3dUrl, arUsdzUrl]) {
    if (!url.startsWith("/models/restaurants/") || url.includes("..") || url.includes("\\")) {
      throw new Error("Manifest Meshy contient une URL modele invalide.");
    }
  }
  if (!webModel3dUrl || !arUsdzUrl) {
    throw new Error("Manifest Meshy incomplet: GLB web ou USDZ manquant.");
  }
  return {
    model3dUrl,
    webModel3dUrl,
    arModel3dUrl,
    arUsdzUrl,
    model3dPath: resolveOwnerMeshyAssetPath({
      outputRoot: args.outputRoot,
      assetRoot: args.assetRoot,
      assetUrl: model3dUrl || webModel3dUrl,
      localPath: manifest.localPaths?.model3d || manifest.localPaths?.webModel3d
    }),
    webModel3dPath: resolveOwnerMeshyAssetPath({
      outputRoot: args.outputRoot,
      assetRoot: args.assetRoot,
      assetUrl: webModel3dUrl,
      localPath: manifest.localPaths?.webModel3d
    }),
    arModel3dPath: resolveOwnerMeshyAssetPath({
      outputRoot: args.outputRoot,
      assetRoot: args.assetRoot,
      assetUrl: arModel3dUrl,
      localPath: manifest.localPaths?.arModel3d
    }),
    arUsdzPath: resolveOwnerMeshyAssetPath({
      outputRoot: args.outputRoot,
      assetRoot: args.assetRoot,
      assetUrl: arUsdzUrl,
      localPath: manifest.localPaths?.arUsdz
    })
  };
}

async function uploadDurableMeshyAsset(args: {
  adminClient: SupabaseClient;
  storagePath: string;
  localPath: string;
  contentType: string;
  cacheControl?: string;
}): Promise<number> {
  if (!existsSync(args.localPath)) {
    throw new Error("Asset Meshy introuvable avant upload Storage.");
  }
  const bytes = readFileSync(args.localPath);
  const uploaded = await args.adminClient.storage
    .from(MODEL_BUCKET)
    .upload(args.storagePath, bytes, {
      contentType: args.contentType,
      cacheControl: args.cacheControl ?? "31536000",
      upsert: false
    });
  if (uploaded.error) {
    throw new Error(`Upload Storage impossible pour ${args.storagePath}.`);
  }
  return bytes.byteLength;
}

async function rollbackDurableMeshyAssets(
  adminClient: SupabaseClient,
  paths: string[]
): Promise<void> {
  const cleanPaths = paths.map((path) => path.trim()).filter(Boolean);
  if (cleanPaths.length === 0) return;
  try {
    await adminClient.storage.from(MODEL_BUCKET).remove(cleanPaths);
  } catch {
    // Best-effort rollback after a failed multi-asset publish.
  }
}

async function publishMeshyAssetsToStorage(args: {
  adminClient: SupabaseClient;
  restaurantId: string;
  dishId: string;
  dishSlug: string;
  versionTag: string;
  assetVersion: string;
  manifestPath: string;
  assets: LocalMeshyAssets;
}): Promise<DurableMeshyAssets> {
  const basePath = `restaurants/${args.restaurantId}/models`;
  const sourceStoragePath = `${basePath}/source/${args.dishSlug}-${args.assetVersion}.glb`;
  const webStoragePath = buildPreparedModelWebStoragePath({
    restaurantId: args.restaurantId,
    dishSlug: args.dishSlug,
    assetVersion: args.assetVersion
  });
  const arLiteStoragePath = buildPreparedModelArLiteStoragePath({
    restaurantId: args.restaurantId,
    dishSlug: args.dishSlug,
    assetVersion: args.assetVersion
  });
  const usdzStoragePath = buildPreparedModelUsdzStoragePath({
    restaurantId: args.restaurantId,
    dishSlug: args.dishSlug,
    assetVersion: args.assetVersion
  });
  const manifestStoragePath = `${basePath}/manifests/${args.dishSlug}-${args.versionTag}.json`;
  const uploadedPaths: string[] = [];

  try {
    await uploadDurableMeshyAsset({
      adminClient: args.adminClient,
      storagePath: sourceStoragePath,
      localPath: args.assets.model3dPath || args.assets.webModel3dPath,
      contentType: "model/gltf-binary"
    });
    uploadedPaths.push(sourceStoragePath);
    const webModel3dBytes = await uploadDurableMeshyAsset({
      adminClient: args.adminClient,
      storagePath: webStoragePath,
      localPath: args.assets.webModel3dPath,
      contentType: "model/gltf-binary"
    });
    uploadedPaths.push(webStoragePath);
    const arModel3dBytes = await uploadDurableMeshyAsset({
      adminClient: args.adminClient,
      storagePath: arLiteStoragePath,
      localPath: args.assets.arModel3dPath,
      contentType: "model/gltf-binary"
    });
    uploadedPaths.push(arLiteStoragePath);
    const arUsdzBytes = await uploadDurableMeshyAsset({
      adminClient: args.adminClient,
      storagePath: usdzStoragePath,
      localPath: args.assets.arUsdzPath,
      contentType: "model/vnd.usdz+zip"
    });
    uploadedPaths.push(usdzStoragePath);
    await uploadDurableMeshyAsset({
      adminClient: args.adminClient,
      storagePath: manifestStoragePath,
      localPath: args.manifestPath,
      contentType: "application/json",
      cacheControl: "3600"
    });
    uploadedPaths.push(manifestStoragePath);

    const webModel3dUrl = buildPreparedModelPublicGlbPath(args.dishId, {
      assetVersion: args.assetVersion
    });
    const arModel3dUrl = buildPreparedModelPublicArLiteGlbPath(args.dishId, {
      assetVersion: args.assetVersion
    });
    const arUsdzUrl = buildPreparedModelPublicUsdzPath(args.dishId, {
      assetVersion: args.assetVersion
    });

    return {
      bucket: MODEL_BUCKET,
      sourceStoragePath,
      webStoragePath,
      arLiteStoragePath,
      usdzStoragePath,
      manifestStoragePath,
      model3dUrl: webModel3dUrl,
      webModel3dUrl,
      arModel3dUrl,
      arUsdzUrl,
      webModel3dBytes,
      arModel3dBytes,
      arUsdzBytes
    };
  } catch (error) {
    await rollbackDurableMeshyAssets(args.adminClient, uploadedPaths);
    throw error;
  }
}

export async function runRestaurantMeshyDishPipeline(
  args: RestaurantMeshyPipelineArgs
): Promise<PipelineRunResult> {
  const restaurantSlug = assertSafeSlug(args.restaurantSlug, "Slug restaurant");
  const menuSlug = assertSafeSlug(args.menuSlug || "principal", "Slug menu");
  const dishSlug = assertSafeSlug(args.dishSlug, "Slug plat");
  const jobId = `job_meshy_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const sourceSha256 = sha256Hex(args.sourceBytes);
  const versionTag = `${dateTag()}-${sourceSha256.slice(0, 12)}-${jobId
    .replace(/^job_meshy_/, "")
    .slice(0, 12)}`;
  let workspace: ReturnType<typeof createOwnerMeshyRuntimeWorkspace>;
  try {
    workspace = createOwnerMeshyRuntimeWorkspace({ restaurantSlug, dishSlug, jobId });
  } catch {
    throw new Error("Workspace temporaire 3D indisponible.");
  }
  const startedAt = new Date();

  try {
    writeFileSync(workspace.tempSourcePath, args.sourceBytes);
  } catch {
    workspace.cleanup();
    throw new Error("Workspace temporaire 3D indisponible.");
  }

  try {
    try {
      await runNodeScript([
        "--restaurant",
        restaurantSlug,
        "--menu",
        menuSlug,
        "--dish",
        dishSlug,
        "--source",
        workspace.tempSourcePath,
        "--output-root",
        workspace.outputRoot,
        "--date",
        versionTag
      ]);
    } catch (pipelineError) {
      throw normalizeMeshyPipelineError(pipelineError);
    }

    const manifestPath = manifestPathFor({
      outputRoot: workspace.outputRoot,
      restaurantSlug,
      menuSlug,
      dishSlug,
      versionTag
    });
    const assetRoot = manifestAssetRootFor({
      outputRoot: workspace.outputRoot,
      restaurantSlug,
      menuSlug,
      dishSlug,
      versionTag
    });
    const manifest = readManifest(manifestPath);
    const assets = cleanManifestAssets({
      manifest,
      outputRoot: workspace.outputRoot,
      assetRoot
    });
    const durableAssets = await publishMeshyAssetsToStorage({
      adminClient: args.adminClient,
      restaurantId: args.restaurantId,
      dishId: args.dishId,
      dishSlug,
      versionTag,
      assetVersion: versionTag,
      manifestPath,
      assets
    });
    const manifestVirtualPath = [
      "models",
      "restaurants",
      restaurantSlug,
      menuSlug,
      dishSlug,
      `meshy-${versionTag}`,
      "manifest.json"
    ].join("/");
    const modelUpdatedAt = new Date().toISOString();
    const nextMetadata = {
      ...cleanDishModelMetadata(args.existingMetadata),
      model3dUrl: durableAssets.model3dUrl,
      webModel3dUrl: durableAssets.webModel3dUrl,
      arModel3dUrl: durableAssets.arModel3dUrl,
      arUsdzUrl: durableAssets.arUsdzUrl,
      usdzUrl: "",
      modelStatus: "ready",
      modelAssetVersion: versionTag,
      modelAssetSha256: manifest.sha256?.meshopt ?? sourceSha256,
      modelUpdatedAt,
      meshyManifestVersion: manifest.version ?? `meshy-${versionTag}`,
      meshyManifestPath: durableAssets.manifestStoragePath,
      meshyLocalManifestPath: manifestVirtualPath,
      meshyManifestStorageBucket: durableAssets.bucket,
      meshyManifestStoragePath: durableAssets.manifestStoragePath,
      sourceModel3dStorageBucket: durableAssets.bucket,
      sourceModel3dStoragePath: durableAssets.sourceStoragePath,
      webModel3dStorageBucket: durableAssets.bucket,
      webModel3dStoragePath: durableAssets.webStoragePath,
      arModel3dStorageBucket: durableAssets.bucket,
      arModel3dStoragePath: durableAssets.arLiteStoragePath,
      arUsdzStorageBucket: durableAssets.bucket,
      arUsdzStoragePath: durableAssets.usdzStoragePath,
      preparedGlbBytes: args.sourceBytes.byteLength,
      webModel3dBytes: durableAssets.webModel3dBytes,
      arModel3dBytes: durableAssets.arModel3dBytes,
      arUsdzBytes: durableAssets.arUsdzBytes,
      preparedGlbSha256: sourceSha256,
      preparedGlbOriginalName: args.originalName ?? "",
      ownerMeshyPipeline: true
    };

    const updated = await args.adminClient
      .from("menu_dishes")
      .update({
        has_immersive_view: true,
        metadata: nextMetadata
      })
      .eq("id", args.dishId)
      .eq("restaurant_id", args.restaurantId)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      await rollbackDurableMeshyAssets(args.adminClient, [
        durableAssets.sourceStoragePath,
        durableAssets.webStoragePath,
        durableAssets.arLiteStoragePath,
        durableAssets.usdzStoragePath,
        durableAssets.manifestStoragePath
      ]);
      throw new Error("Plat impossible a mettre a jour avec les URLs Meshy.");
    }

    await args.onPublicCommit?.();

    let cleanup: CleanupReplacedDishAssetsReport;
    try {
      cleanup = await cleanupReplacedDishAssets({
        client: args.adminClient,
        dishId: args.dishId,
        restaurantId: args.restaurantId,
        previousMetadata: args.existingMetadata,
        nextMetadata,
        reason: "meshy-model-replacement"
      });
    } catch {
      await args.onPublicCommit?.();
      cleanup = deferredCleanupReport();
    }

    const finishedAt = new Date();
    const manualRunnerCommand = [
      "node",
      PIPELINE_SCRIPT_RELATIVE_PATH,
      "--restaurant",
      restaurantSlug,
      "--menu",
      menuSlug,
      "--dish",
      dishSlug,
      "--source",
      "<runtime-upload.glb>",
      "--output-root",
      "<runtime-temp>",
      "--date",
      versionTag
    ].join(" ");
    const insertedJob = await args.adminClient.from("owner_3d_pipeline_jobs").insert({
      id: jobId,
      restaurant_slug: restaurantSlug,
      menu_slug: menuSlug,
      dish_slug: dishSlug,
      asset_version: manifest.version ?? `meshy-${versionTag}`,
      step: "prepared_usdz",
      status: "published",
      logs: [
        "Owner GLB uploaded.",
        "Meshy restaurant pipeline generated web GLB, AR-lite GLB, and iOS USDZ.",
        "Generated assets were uploaded to Supabase Storage.",
        "menu_dishes metadata was updated with durable public proxy URLs.",
        cleanup.errors.length > 0
          ? `Storage cleanup partiel: ${cleanup.errors.map((entry) => entry.message).join("; ")}`
          : "Superseded Storage assets cleanup completed or skipped safely."
      ],
      step_logs: [],
      artifacts: [
        {
          id: `${jobId}_source_glb`,
          type: "source_glb",
          label: "Owner source GLB",
          path: durableAssets.sourceStoragePath,
          publicUrl: assets.model3dUrl || assets.webModel3dUrl,
          sha256: sourceSha256
        },
        {
          id: `${jobId}_web_glb`,
          type: "web_glb",
          label: "Meshopt web GLB",
          path: durableAssets.webStoragePath,
          publicUrl: durableAssets.webModel3dUrl,
          sha256: manifest.sha256?.meshopt ?? "",
          bytes: durableAssets.webModel3dBytes
        },
        {
          id: `${jobId}_ar_lite_glb`,
          type: "ar_lite_glb",
          label: "Android AR-lite GLB",
          path: durableAssets.arLiteStoragePath,
          publicUrl: durableAssets.arModel3dUrl,
          sha256: manifest.sha256?.arLite ?? "",
          bytes: durableAssets.arModel3dBytes
        },
        {
          id: `${jobId}_ios_usdz`,
          type: "ios_usdz",
          label: "iOS Quick Look USDZ",
          path: durableAssets.usdzStoragePath,
          publicUrl: durableAssets.arUsdzUrl,
          sha256: manifest.sha256?.arUsdz ?? "",
          bytes: durableAssets.arUsdzBytes
        }
      ],
      metrics: {
        sourceSizeBytes: args.sourceBytes.byteLength,
        sourceSha256,
        storageBucket: durableAssets.bucket,
        conversionMethod: "owner-meshy-pipeline"
      },
      quality_status: "published",
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      initiated_by_clerk_user_id: args.owner.userId,
      initiated_by_email: args.owner.email ?? null,
      next_action: "Review in browser and run real-device iPhone Quick Look QA.",
      manual_runner_command: manualRunnerCommand,
      worker_kind: "external_worker",
      dedupe_key: `${restaurantSlug}:${menuSlug}:${dishSlug}:${manifest.version ?? versionTag}:owner_meshy`,
      metadata: {
        restaurantId: args.restaurantId,
        dishId: args.dishId,
        manifestPath: durableAssets.manifestStoragePath,
        localManifestPath: manifestVirtualPath,
        manifestStoragePath: durableAssets.manifestStoragePath,
        originalName: args.originalName ?? ""
      }
    });
    if (insertedJob.error) {
      throw new Error("Job Meshy impossible a enregistrer dans Supabase.");
    }

    return {
      ok: true,
      status: "ready",
      jobId,
      manifest,
      manifestPath: durableAssets.manifestStoragePath,
      manifestUrl: "",
      model3dUrl: durableAssets.model3dUrl,
      webModel3dUrl: durableAssets.webModel3dUrl,
      arModel3dUrl: durableAssets.arModel3dUrl,
      arUsdzUrl: durableAssets.arUsdzUrl,
      webModel3dBytes: durableAssets.webModel3dBytes,
      arModel3dBytes: durableAssets.arModel3dBytes,
      arUsdzBytes: durableAssets.arUsdzBytes,
      cleanup
    };
  } finally {
    workspace.cleanup();
  }
}
