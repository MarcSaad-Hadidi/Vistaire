import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertNoForbiddenSourceStorage,
  buildViewerGlbMetadataPatch,
  buildViewerGlbStoragePlan,
  computeSplitModelStatus,
  createModelAssetVersion,
  getMetadataObject,
  MODEL_BUCKET,
  restampPublicModelUrls,
  sha256Hex,
  VIEWER_GLB_CLEARED_AR_LITE_FIELDS
} from "@/lib/owner/usdzRuntimeModel";
import {
  cleanupReplacedDishAssets,
  type CleanupReplacedDishAssetsReport
} from "@/lib/owner/dishAssetReplacementCleanup";

type OwnerIdentity = {
  userId: string;
  email?: string | null;
};

export type ViewerGlbUploadArgs = {
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
};

export type ViewerGlbUploadResult = {
  status: "ready";
  jobId: string;
  version: string;
  webModel3dUrl: string;
  viewerGlbBytes: number;
  modelStatus: string;
  cleanup: CleanupReplacedDishAssetsReport;
};

async function uploadGlb(
  adminClient: SupabaseClient,
  storagePath: string,
  bytes: Buffer
): Promise<void> {
  const uploaded = await adminClient.storage.from(MODEL_BUCKET).upload(storagePath, bytes, {
    contentType: "model/gltf-binary",
    cacheControl: "31536000",
    upsert: true
  });
  if (uploaded.error) {
    throw new Error(`Upload Storage impossible pour ${storagePath}.`);
  }
}

async function rollbackUploadedGlb(
  adminClient: SupabaseClient,
  storagePath: string,
  protectedPaths: readonly string[] = []
): Promise<void> {
  const path = storagePath.trim();
  if (!path) return;
  if (protectedPaths.some((protectedPath) => protectedPath.trim() === path)) return;
  try {
    await adminClient.storage.from(MODEL_BUCKET).remove([path]);
  } catch {
    // Best-effort rollback after a failed DB update.
  }
}

/**
 * Uploads an already-optimized viewer GLB (from optimizeglb.com) to Supabase.
 * It NEVER derives or references a USDZ, and NEVER runs the Meshy pipeline.
 */
export async function runViewerGlbUpload(
  args: ViewerGlbUploadArgs
): Promise<ViewerGlbUploadResult> {
  const uploadedAt = new Date().toISOString();
  const sha256 = sha256Hex(args.sourceBytes);
  const version = createModelAssetVersion(sha256);
  const plan = buildViewerGlbStoragePlan({
    restaurantId: args.restaurantId,
    dishSlug: args.dishSlug,
    version
  });
  const existing = getMetadataObject(args.existingMetadata);
  const activeViewerPaths = [
    typeof existing.webModel3dStoragePath === "string" ? existing.webModel3dStoragePath : "",
    typeof existing.viewerGlbStoragePath === "string" ? existing.viewerGlbStoragePath : ""
  ].filter(Boolean);

  await uploadGlb(args.adminClient, plan.webStoragePath, args.sourceBytes);

  const patch = buildViewerGlbMetadataPatch(
    {
      restaurantId: args.restaurantId,
      dishId: args.dishId,
      dishSlug: args.dishSlug,
      version,
      bytes: args.sourceBytes.byteLength,
      sha256,
      originalName: args.originalName,
      uploadedAt
    },
    plan
  );

  let merged = { ...existing, ...patch };
  // A viewer GLB is never an AR-lite asset: clear any stale AR-lite fields so a
  // viewer-only dish is not reported as Android AR ready by the public menu.
  for (const field of VIEWER_GLB_CLEARED_AR_LITE_FIELDS) {
    delete merged[field];
  }
  merged = restampPublicModelUrls(merged, args.dishId, version);
  merged.modelStatus = computeSplitModelStatus(merged);
  assertNoForbiddenSourceStorage(merged);

  const updated = await args.adminClient
    .from("menu_dishes")
    .update({ has_immersive_view: true, metadata: merged })
    .eq("id", args.dishId)
    .eq("restaurant_id", args.restaurantId)
    .select("id")
    .maybeSingle();
  if (updated.error || !updated.data) {
    await rollbackUploadedGlb(args.adminClient, plan.webStoragePath, activeViewerPaths);
    throw new Error("Plat impossible a mettre a jour avec le GLB viewer.");
  }

  const cleanup = await cleanupReplacedDishAssets({
    client: args.adminClient,
    dishId: args.dishId,
    restaurantId: args.restaurantId,
    previousMetadata: existing,
    nextMetadata: merged,
    reason: "viewer-glb-replacement"
  });

  const jobId = `job_viewer_glb_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await args.adminClient.from("owner_3d_pipeline_jobs").insert({
    id: jobId,
    restaurant_slug: args.restaurantSlug,
    menu_slug: args.menuSlug,
    dish_slug: args.dishSlug,
    asset_version: version,
    step: "viewer_glb_upload",
    status: "published",
    logs: [
      "Owner viewer GLB uploaded (pre-optimized via optimizeglb.com).",
      "No USDZ pipeline was triggered; no USDZ was derived from this GLB.",
      "No Android AR-lite copy was produced; viewer GLB is web-view only.",
      "menu_dishes metadata updated with viewer GLB URLs only.",
      cleanup.errors.length > 0
        ? `Storage cleanup partiel: ${cleanup.errors.map((entry) => entry.message).join("; ")}`
        : "Superseded Storage assets cleanup completed or skipped safely."
    ],
    step_logs: [],
    artifacts: [
      {
        id: `${jobId}_web_glb`,
        type: "web_glb",
        label: "Viewer web GLB",
        path: plan.webStoragePath,
        publicUrl: patch.webModel3dUrl,
        sha256,
        bytes: args.sourceBytes.byteLength
      }
    ],
    metrics: {
      viewerGlbBytes: args.sourceBytes.byteLength,
      viewerGlbSha256: sha256,
      storageBucket: MODEL_BUCKET,
      conversionMethod: "owner-viewer-glb-upload",
      usdzSourceStored: false
    },
    quality_status: "published",
    started_at: uploadedAt,
    finished_at: new Date().toISOString(),
    duration_ms: 0,
    initiated_by_clerk_user_id: args.owner.userId,
    initiated_by_email: args.owner.email ?? null,
    next_action: "Upload a USDZ master to enable iOS Quick Look, then run real-device QA.",
    manual_runner_command: "",
    worker_kind: "inline",
    dedupe_key: `${args.restaurantSlug}:${args.menuSlug}:${args.dishSlug}:${version}:viewer_glb`,
    metadata: {
      restaurantId: args.restaurantId,
      dishId: args.dishId,
      originalName: args.originalName,
      usdzSourceStored: false
    }
  });

  return {
    status: "ready",
    jobId,
    version,
    webModel3dUrl: String(patch.webModel3dUrl),
    viewerGlbBytes: args.sourceBytes.byteLength,
    modelStatus: String(merged.modelStatus),
    cleanup
  };
}
