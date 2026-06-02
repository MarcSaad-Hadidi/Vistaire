import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isExpectedPrivateSourceKey,
  resolveSourceUploadStorageStatus,
  type SourceUploadIdentity
} from "@/lib/owner/threeDSourceUploadModel";
import {
  buildCandidateStorageKey,
  type BudgetStatus,
  type CandidateStatus,
  type OptimizeGlbCandidateRecord,
  type PresetLabel,
  type VariantRole
} from "@/lib/owner/threeDOptimizeGlbModel";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

const CANDIDATES_TABLE = "owner_3d_optimizeglb_candidates";
const CANDIDATE_SETS_TABLE = "owner_3d_optimizeglb_candidate_sets";
const SOURCE_UPLOADS_TABLE = "owner_3d_ar_source_uploads";

type OwnerIdentity = {
  userId: string;
  emailAddresses: string[];
};

export type CandidateStoreFailure = {
  ok: false;
  code:
    | "storage_not_configured"
    | "storage_unavailable"
    | "source_not_found"
    | "source_path_mismatch"
    | "duplicate_candidate"
    | "metadata_unavailable";
  message: string;
  status: 400 | 404 | 409 | 503;
};

type StorageContext = { client: SupabaseClient; bucket: string };

function logStoreError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.NODE_ENV === "production") {
    console.error(`[Vistaire OptimizeGLB candidate] ${scope}`);
    return;
  }
  console.warn(`[Vistaire OptimizeGLB candidate] ${scope}`, message);
}

function getStorage(): { ok: true; ctx: StorageContext } | CandidateStoreFailure {
  const status = resolveSourceUploadStorageStatus(process.env);
  if (!status.configured || !status.bucket) {
    return { ok: false, code: "storage_not_configured", message: "Private storage is not configured.", status: 503 };
  }
  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return { ok: false, code: "storage_not_configured", message: "Private storage is not configured.", status: 503 };
  }
  return { ok: true, ctx: { client: admin.client, bucket: status.bucket } };
}

export type ResolvedSourceUpload = {
  id: string;
  identity: SourceUploadIdentity;
  sha256: string;
  bytes: number;
  originalName: string;
  storageBucket: string;
  storagePath: string;
};

/**
 * Resolve a source upload row by id within an identity, validating its private
 * storage key. Used by the protected download route and candidate binding.
 */
export async function resolveSourceUpload(args: {
  sourceUploadId: string;
  identity: SourceUploadIdentity;
}): Promise<{ ok: true; ctx: StorageContext; source: ResolvedSourceUpload } | CandidateStoreFailure> {
  const storage = getStorage();
  if (!storage.ok) return storage;

  const { data, error } = await storage.ctx.client
    .from(SOURCE_UPLOADS_TABLE)
    .select("id,restaurant_slug,menu_slug,dish_slug,version,sha256,bytes,original_name,storage_bucket,storage_path,storage_provider")
    .eq("id", args.sourceUploadId)
    .eq("restaurant_slug", args.identity.restaurantSlug)
    .eq("menu_slug", args.identity.menuSlug)
    .eq("dish_slug", args.identity.dishSlug)
    .eq("version", args.identity.version)
    .maybeSingle();

  if (error) {
    logStoreError("source lookup failed", error.message);
    return { ok: false, code: "metadata_unavailable", message: "Source metadata could not be read.", status: 503 };
  }
  if (!data) {
    return { ok: false, code: "source_not_found", message: "Source upload was not found.", status: 404 };
  }

  const row = data as Record<string, unknown>;
  const identity: SourceUploadIdentity = {
    restaurantSlug: String(row.restaurant_slug),
    menuSlug: String(row.menu_slug),
    dishSlug: String(row.dish_slug),
    version: String(row.version)
  };
  const sha256 = String(row.sha256);
  const storagePath = String(row.storage_path);
  if (
    row.storage_provider !== "supabase-storage" ||
    row.storage_bucket !== storage.ctx.bucket ||
    !isExpectedPrivateSourceKey({ identity, sha256, storagePath })
  ) {
    return { ok: false, code: "source_path_mismatch", message: "Source storage path does not match its metadata.", status: 409 };
  }

  return {
    ok: true,
    ctx: storage.ctx,
    source: {
      id: String(row.id),
      identity,
      sha256,
      bytes: Number(row.bytes),
      originalName: String(row.original_name),
      storageBucket: String(row.storage_bucket),
      storagePath
    }
  };
}

export async function downloadPrivateObject(args: {
  ctx: StorageContext;
  storagePath: string;
}): Promise<{ ok: true; bytes: Buffer } | CandidateStoreFailure> {
  const { data, error } = await args.ctx.client.storage.from(args.ctx.bucket).download(args.storagePath);
  if (error || !data) {
    logStoreError("private object download failed", error?.message ?? "missing object");
    return { ok: false, code: "storage_unavailable", message: "Private object is unavailable.", status: 503 };
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  return { ok: true, bytes };
}

function rowToCandidate(row: Record<string, unknown>): OptimizeGlbCandidateRecord {
  const validation = (row.validation && typeof row.validation === "object"
    ? (row.validation as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const status = String(row.status) as CandidateStatus;
  const visualFromStatus =
    status === "candidate_visual_passed"
      ? "passed"
      : status === "candidate_visual_failed"
        ? "failed"
        : "none";
  return {
    id: String(row.id),
    sourceUploadId: String(row.source_upload_id),
    sourceSha256: String(row.source_sha256),
    restaurantSlug: String(row.restaurant_slug),
    menuSlug: String(row.menu_slug),
    dishSlug: String(row.dish_slug),
    version: String(row.version),
    variantRole: String(row.variant_role) as VariantRole,
    presetLabel: String(row.preset_label) as PresetLabel,
    originalName: String(row.original_name),
    bytes: Number(row.bytes),
    sha256: String(row.sha256),
    triangleCount: row.triangle_count == null ? null : Number(row.triangle_count),
    vertexCount: row.vertex_count == null ? null : Number(row.vertex_count),
    materialCount: row.material_count == null ? null : Number(row.material_count),
    textureCount: row.texture_count == null ? null : Number(row.texture_count),
    maxTextureSize: row.max_texture_size == null ? null : Number(row.max_texture_size),
    status,
    budgetStatus: (validation.budgetStatus as BudgetStatus) ?? "unknown",
    visualStatus:
      (validation.visualStatus as OptimizeGlbCandidateRecord["visualStatus"]) ?? visualFromStatus,
    fails: Array.isArray(validation.fails) ? (validation.fails as string[]) : [],
    warnings: Array.isArray(validation.warnings) ? (validation.warnings as string[]) : [],
    notes: (row.notes as string | null) ?? null,
    uploadedByClerkUserId: String(row.uploaded_by_clerk_user_id),
    uploadedByEmail: (row.uploaded_by_email as string | null) ?? null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

export async function createOptimizeGlbCandidate(args: {
  identity: SourceUploadIdentity;
  sourceUploadId: string;
  sourceSha256: string;
  variantRole: VariantRole;
  presetLabel: PresetLabel;
  originalName: string;
  notes: string | null;
  bytes: Buffer;
  sha256: string;
  status: CandidateStatus;
  budgetStatus: BudgetStatus;
  fails: string[];
  warnings: string[];
  triangleCount: number | null;
  vertexCount: number | null;
  materialCount: number | null;
  textureCount: number | null;
  maxTextureSize: number | null;
  owner: OwnerIdentity;
}): Promise<{ ok: true; record: OptimizeGlbCandidateRecord } | CandidateStoreFailure> {
  const storage = getStorage();
  if (!storage.ok) return storage;

  const storagePath = buildCandidateStorageKey({
    identity: args.identity,
    variantRole: args.variantRole,
    sha256: args.sha256
  });

  const validation = {
    budgetStatus: args.budgetStatus,
    fails: args.fails,
    warnings: args.warnings,
    visualStatus: "pending"
  };

  const uploadResult = await storage.ctx.client.storage
    .from(storage.ctx.bucket)
    .upload(storagePath, args.bytes, {
      cacheControl: "0",
      contentType: "model/gltf-binary",
      upsert: false
    });

  if (uploadResult.error && !/exists/i.test(uploadResult.error.message)) {
    logStoreError("candidate upload failed", uploadResult.error.message);
    return { ok: false, code: "storage_unavailable", message: "Candidate storage is unavailable.", status: 503 };
  }

  const { data, error } = await storage.ctx.client
    .from(CANDIDATES_TABLE)
    .insert({
      source_upload_id: args.sourceUploadId,
      source_sha256: args.sourceSha256,
      restaurant_slug: args.identity.restaurantSlug,
      menu_slug: args.identity.menuSlug,
      dish_slug: args.identity.dishSlug,
      version: args.identity.version,
      variant_role: args.variantRole,
      preset_label: args.presetLabel,
      original_name: args.originalName,
      bytes: args.bytes.byteLength,
      sha256: args.sha256,
      triangle_count: args.triangleCount,
      vertex_count: args.vertexCount,
      material_count: args.materialCount,
      texture_count: args.textureCount,
      max_texture_size: args.maxTextureSize,
      status: args.status,
      validation,
      notes: args.notes,
      storage_provider: "supabase-storage",
      storage_bucket: storage.ctx.bucket,
      storage_path: storagePath,
      uploaded_by_clerk_user_id: args.owner.userId,
      uploaded_by_email: args.owner.emailAddresses[0] ?? null
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error && /duplicate key/i.test(error.message)) {
      return { ok: false, code: "duplicate_candidate", message: "This exact candidate was already uploaded for this role.", status: 409 };
    }
    logStoreError("candidate metadata insert failed", error?.message ?? "missing row");
    return { ok: false, code: "metadata_unavailable", message: "Candidate metadata could not be recorded.", status: 503 };
  }

  return { ok: true, record: rowToCandidate(data as Record<string, unknown>) };
}

export async function listOptimizeGlbCandidates(
  identity: SourceUploadIdentity,
  options: { sourceUploadId?: string } = {}
): Promise<{ ok: true; configured: boolean; candidates: OptimizeGlbCandidateRecord[] } | CandidateStoreFailure> {
  const storage = getStorage();
  if (!storage.ok) {
    if (storage.code === "storage_not_configured") return { ok: true, configured: false, candidates: [] };
    return storage;
  }

  let query = storage.ctx.client
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("restaurant_slug", identity.restaurantSlug)
    .eq("menu_slug", identity.menuSlug)
    .eq("dish_slug", identity.dishSlug)
    .eq("version", identity.version);

  // Scope candidates to the active source upload so historical sources under
  // the same identity never leak into recommendations or set approval.
  if (options.sourceUploadId) {
    query = query.eq("source_upload_id", options.sourceUploadId);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);

  if (error) {
    logStoreError("candidate list failed", error.message);
    return { ok: false, code: "metadata_unavailable", message: "Candidate metadata could not be read.", status: 503 };
  }

  return {
    ok: true,
    configured: true,
    candidates: ((data ?? []) as Array<Record<string, unknown>>).map(rowToCandidate)
  };
}

export async function getOptimizeGlbCandidateObject(args: {
  identity: SourceUploadIdentity;
  candidateId: string;
}): Promise<{ ok: true; bytes: Buffer; originalName: string } | CandidateStoreFailure> {
  const storage = getStorage();
  if (!storage.ok) return storage;

  const { data, error } = await storage.ctx.client
    .from(CANDIDATES_TABLE)
    .select("id,storage_bucket,storage_path,original_name,storage_provider")
    .eq("id", args.candidateId)
    .eq("restaurant_slug", args.identity.restaurantSlug)
    .eq("menu_slug", args.identity.menuSlug)
    .eq("dish_slug", args.identity.dishSlug)
    .eq("version", args.identity.version)
    .maybeSingle();

  if (error) {
    logStoreError("candidate object lookup failed", error.message);
    return { ok: false, code: "metadata_unavailable", message: "Candidate metadata could not be read.", status: 503 };
  }
  if (!data) {
    return { ok: false, code: "source_not_found", message: "Candidate was not found.", status: 404 };
  }
  const row = data as Record<string, unknown>;
  if (row.storage_provider !== "supabase-storage" || row.storage_bucket !== storage.ctx.bucket) {
    return { ok: false, code: "source_path_mismatch", message: "Candidate storage does not match its metadata.", status: 409 };
  }
  const storagePath = String(row.storage_path);
  if (storagePath.includes("..") || storagePath.includes("\\") || !storagePath.startsWith("candidates/")) {
    return { ok: false, code: "source_path_mismatch", message: "Candidate storage path is invalid.", status: 409 };
  }

  const download = await downloadPrivateObject({ ctx: storage.ctx, storagePath });
  if (!download.ok) return download;
  return { ok: true, bytes: download.bytes, originalName: String(row.original_name) };
}

export async function recordApprovedCandidateSet(args: {
  identity: SourceUploadIdentity;
  sourceUploadId: string;
  sourceSha256: string;
  webCandidateId: string;
  mobileCandidateId: string;
  arLiteCandidateId: string;
  iosSourceCandidateId: string | null;
  totalBytes: number;
  visualQuality: Record<string, unknown>;
  owner: OwnerIdentity;
}): Promise<{ ok: true; id: string } | CandidateStoreFailure> {
  const storage = getStorage();
  if (!storage.ok) return storage;

  const { data, error } = await storage.ctx.client
    .from(CANDIDATE_SETS_TABLE)
    .insert({
      source_upload_id: args.sourceUploadId,
      source_sha256: args.sourceSha256,
      restaurant_slug: args.identity.restaurantSlug,
      menu_slug: args.identity.menuSlug,
      dish_slug: args.identity.dishSlug,
      version: args.identity.version,
      web_candidate_id: args.webCandidateId,
      mobile_candidate_id: args.mobileCandidateId,
      ar_lite_candidate_id: args.arLiteCandidateId,
      ios_source_candidate_id: args.iosSourceCandidateId,
      status: "approved_by_human",
      total_bytes: args.totalBytes,
      visual_quality: args.visualQuality,
      selected_by_clerk_user_id: args.owner.userId,
      selected_by_email: args.owner.emailAddresses[0] ?? null,
      selected_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error || !data) {
    logStoreError("candidate set insert failed", error?.message ?? "missing row");
    return { ok: false, code: "metadata_unavailable", message: "Candidate set could not be recorded.", status: 503 };
  }
  return { ok: true, id: (data as { id: string }).id };
}
