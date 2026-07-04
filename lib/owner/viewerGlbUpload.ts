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
  sha256Hex
} from "@/lib/owner/usdzRuntimeModel";

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
  arModel3dUrl: string;
  viewerGlbBytes: number;
  modelStatus: string;
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

async function removeIfDifferent(
  adminClient: SupabaseClient,
  previousPath: string,
  nextPath: string
): Promise<void> {
  const previous = previousPath.trim();
  if (!previous || previous === nextPath) return;
  try {
    await adminClient.storage.from(MODEL_BUCKET).remove([previous]);
  } catch {
    // best-effort cleanup of a superseded viewer GLB
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

  await uploadGlb(args.adminClient, plan.webStoragePath, args.sourceBytes);
  await uploadGlb(args.adminClient, plan.arLiteStoragePath, args.sourceBytes);

  const existing = getMetadataObject(args.existingMetadata);
  const previousWebPath =
    typeof existing.webModel3dStoragePath === "string" ? existing.webModel3dStoragePath : "";
  const previousArLitePath =
    typeof existing.arModel3dStoragePath === "string" ? existing.arModel3dStoragePath : "";

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
    throw new Error("Plat impossible a mettre a jour avec le GLB viewer.");
  }

  await removeIfDifferent(args.adminClient, previousWebPath, plan.webStoragePath);
  await removeIfDifferent(args.adminClient, previousArLitePath, plan.arLiteStoragePath);

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
      "menu_dishes metadata updated with viewer GLB URLs only."
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
      },
      {
        id: `${jobId}_ar_lite_glb`,
        type: "ar_lite_glb",
        label: "Android AR-lite GLB (viewer copy)",
        path: plan.arLiteStoragePath,
        publicUrl: patch.arModel3dUrl,
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
    arModel3dUrl: String(patch.arModel3dUrl),
    viewerGlbBytes: args.sourceBytes.byteLength,
    modelStatus: String(merged.modelStatus)
  };
}
