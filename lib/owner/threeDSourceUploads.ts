import "server-only";

import { storageBucket } from "@/lib/storage/backend";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildPrivateSourceKey,
  buildSourceUploadMetadata,
  isExpectedPrivateSourceKey,
  resolveSourceUploadStorageStatus,
  sha256Hex,
  toPublicSourceUploadRecord,
  validateSourceUploadIdentity,
  type SourceUploadIdentity,
  type SourceUploadMetadata,
  type SourceUploadPublicRecord,
  type SourceUploadStatus
} from "@/lib/owner/threeDSourceUploadModel";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

const SOURCE_UPLOADS_TABLE = "owner_3d_ar_source_uploads";
const DELETE_CONFIRMATION_TEXT = "DELETE STAGING SOURCE";
const DELETABLE_STATUSES = new Set<SourceUploadStatus>([
  "source_uploaded",
  "analysis_failed",
  "needs_review",
  "rejected",
  "delete_pending"
]);

type OwnerIdentity = {
  userId: string;
  emailAddresses: string[];
};

type SourceUploadRow = {
  id?: string;
  restaurant_slug: string;
  menu_slug: string;
  dish_slug: string;
  version: string;
  original_name: string;
  bytes: number;
  sha256: string;
  mime_type: string;
  extension: string;
  status: SourceUploadStatus;
  storage_provider: string;
  storage_bucket: string;
  storage_path: string;
  uploaded_by_clerk_user_id: string;
  uploaded_by_email: string | null;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
  confirmed_at?: string | null;
  promoted_at?: string | null;
};

type SourceUploadFailureCode =
  | "storage_not_configured"
  | "storage_unavailable"
  | "metadata_unavailable"
  | "source_not_found"
  | "source_not_deletable"
  | "source_path_mismatch"
  | "invalid_request";

type SourceUploadFailure = {
  ok: false;
  code: SourceUploadFailureCode;
  message: string;
  status: 400 | 404 | 409 | 503;
};

type SourceUploadSuccess = {
  ok: true;
  record: SourceUploadPublicRecord;
  persisted: true;
};

function sourceUploadsTableName(): string {
  const raw = process.env.VISTAIRE_3D_SOURCE_UPLOADS_TABLE?.trim();
  return raw && /^[a-z][a-z0-9_]{0,62}$/.test(raw) ? raw : SOURCE_UPLOADS_TABLE;
}

function genericStorageMissing(): SourceUploadFailure {
  return {
    ok: false,
    code: "storage_not_configured",
    message: "storage not configured",
    status: 503
  };
}

function logSourceUploadError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.NODE_ENV === "production") {
    console.error(`[Vistaire 3D source upload] ${scope}`);
    return;
  }
  console.warn(`[Vistaire 3D source upload] ${scope}`, message);
}

function rowFromMetadata(metadata: SourceUploadMetadata): SourceUploadRow {
  return {
    restaurant_slug: metadata.restaurantSlug,
    menu_slug: metadata.menuSlug,
    dish_slug: metadata.dishSlug,
    version: metadata.version,
    original_name: metadata.originalName,
    bytes: metadata.bytes,
    sha256: metadata.sha256,
    mime_type: metadata.mimeType,
    extension: metadata.extension,
    status: metadata.status,
    storage_provider: metadata.storageProvider,
    storage_bucket: metadata.storageBucket,
    storage_path: metadata.storagePath,
    uploaded_by_clerk_user_id: metadata.uploadedByClerkUserId,
    uploaded_by_email: metadata.uploadedByEmail
  };
}

function metadataFromRow(row: SourceUploadRow): SourceUploadMetadata {
  return {
    id: row.id,
    restaurantSlug: row.restaurant_slug,
    menuSlug: row.menu_slug,
    dishSlug: row.dish_slug,
    version: row.version,
    originalName: row.original_name,
    bytes: Number(row.bytes),
    sha256: row.sha256,
    mimeType: "model/gltf-binary",
    extension: ".glb",
    status: row.status,
    storageProvider: "supabase-storage",
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    uploadedByClerkUserId: row.uploaded_by_clerk_user_id,
    uploadedByEmail: row.uploaded_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getConfiguredSupabaseStorage():
  | { ok: true; client: SupabaseClient; bucket: string }
  | SourceUploadFailure {
  const storageStatus = resolveSourceUploadStorageStatus(process.env);
  if (!storageStatus.configured || !storageStatus.bucket) return genericStorageMissing();

  const admin = getSupabaseAdminClient();
  if (!admin.ok) return genericStorageMissing();

  return { ok: true, client: admin.client, bucket: storageStatus.bucket };
}

export function getOwner3dSourceUploadStorageStatus() {
  return resolveSourceUploadStorageStatus(process.env);
}

export async function createOwner3dSourceUpload(args: {
  identity: SourceUploadIdentity;
  originalName: string;
  mimeType: "model/gltf-binary";
  bytes: Buffer;
  owner: OwnerIdentity;
}): Promise<SourceUploadSuccess | SourceUploadFailure> {
  const storage = getConfiguredSupabaseStorage();
  if (!storage.ok) return storage;

  const sha256 = sha256Hex(args.bytes);
  const storagePath = buildPrivateSourceKey(args.identity, sha256);
  const metadata = buildSourceUploadMetadata({
    identity: args.identity,
    originalName: args.originalName,
    bytes: args.bytes.byteLength,
    sha256,
    mimeType: args.mimeType,
    storageProvider: "supabase-storage",
    storageBucket: storage.bucket,
    storagePath,
    ownerUserId: args.owner.userId,
    ownerEmail: args.owner.emailAddresses[0] ?? null
  });

  const uploadResult = await storageBucket(storage.client.storage, storage.bucket)
    .upload(storagePath, args.bytes, {
      cacheControl: "0",
      contentType: "model/gltf-binary",
      upsert: false
    });

  if (uploadResult.error) {
    logSourceUploadError("storage upload failed", uploadResult.error.message);
    return {
      ok: false,
      code: "storage_unavailable",
      message: "Source storage is unavailable.",
      status: 503
    };
  }

  const row = rowFromMetadata(metadata);
  const { data, error } = await storage.client
    .from(sourceUploadsTableName())
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    logSourceUploadError("metadata insert failed", error?.message ?? "missing row");
    const rollback = await storageBucket(storage.client.storage, storage.bucket).remove([storagePath]);
    if (rollback.error) {
      logSourceUploadError("storage rollback failed", rollback.error.message);
    }
    return {
      ok: false,
      code: "metadata_unavailable",
      message: "Source metadata could not be recorded.",
      status: 503
    };
  }

  return {
    ok: true,
    persisted: true,
    record: toPublicSourceUploadRecord(metadataFromRow(data as SourceUploadRow))
  };
}

export async function getOwner3dSourceUploadStatus(
  identity: SourceUploadIdentity | null
): Promise<
  | { ok: true; configured: boolean; record: SourceUploadPublicRecord | null }
  | SourceUploadFailure
> {
  const storageStatus = getOwner3dSourceUploadStorageStatus();
  if (!storageStatus.configured) {
    return { ok: true, configured: false, record: null };
  }
  if (!identity) {
    return { ok: true, configured: true, record: null };
  }

  const validated = validateSourceUploadIdentity(identity);
  if (!validated.ok) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Invalid source identity.",
      status: 400
    };
  }

  const storage = getConfiguredSupabaseStorage();
  if (!storage.ok) return storage;

  const { data, error } = await storage.client
    .from(sourceUploadsTableName())
    .select("*")
    .eq("restaurant_slug", validated.identity.restaurantSlug)
    .eq("menu_slug", validated.identity.menuSlug)
    .eq("dish_slug", validated.identity.dishSlug)
    .eq("version", validated.identity.version)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logSourceUploadError("metadata status lookup failed", error.message);
    return {
      ok: false,
      code: "metadata_unavailable",
      message: "Source metadata could not be read.",
      status: 503
    };
  }

  return {
    ok: true,
    configured: true,
    record: data ? toPublicSourceUploadRecord(metadataFromRow(data as SourceUploadRow)) : null
  };
}

function isPublishedOrPromoted(row: SourceUploadRow): boolean {
  return Boolean(
    row.status === "published" ||
      row.status === "ready_to_publish" ||
      row.published_at ||
      row.confirmed_at ||
      row.promoted_at
  );
}

export async function deleteOwner3dStagingSource(args: {
  sourceId: string;
  identity: SourceUploadIdentity;
  confirmed: boolean;
  confirmationText: string;
  owner: OwnerIdentity;
}): Promise<{ ok: true; deleted: true } | SourceUploadFailure> {
  if (
    !args.confirmed ||
    args.confirmationText !== DELETE_CONFIRMATION_TEXT ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      args.sourceId
    )
  ) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Explicit staging delete confirmation is required.",
      status: 400
    };
  }

  const identityResult = validateSourceUploadIdentity(args.identity);
  if (!identityResult.ok) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Invalid source identity.",
      status: 400
    };
  }

  const storage = getConfiguredSupabaseStorage();
  if (!storage.ok) return storage;

  const { data, error } = await storage.client
    .from(sourceUploadsTableName())
    .select("*")
    .eq("id", args.sourceId)
    .eq("restaurant_slug", identityResult.identity.restaurantSlug)
    .eq("menu_slug", identityResult.identity.menuSlug)
    .eq("dish_slug", identityResult.identity.dishSlug)
    .eq("version", identityResult.identity.version)
    .maybeSingle();

  if (error) {
    logSourceUploadError("metadata delete lookup failed", error.message);
    return {
      ok: false,
      code: "metadata_unavailable",
      message: "Source metadata could not be read.",
      status: 503
    };
  }
  if (!data) {
    return {
      ok: false,
      code: "source_not_found",
      message: "Source upload was not found.",
      status: 404
    };
  }

  const row = data as SourceUploadRow;
  if (
    row.storage_provider !== "supabase-storage" ||
    row.storage_bucket !== storage.bucket ||
    !row.storage_path ||
    isPublishedOrPromoted(row) ||
    !DELETABLE_STATUSES.has(row.status)
  ) {
    return {
      ok: false,
      code: "source_not_deletable",
      message: "Only unpublished staging sources can be deleted.",
      status: 409
    };
  }

  const rowIdentity: SourceUploadIdentity = {
    restaurantSlug: row.restaurant_slug,
    menuSlug: row.menu_slug,
    dishSlug: row.dish_slug,
    version: row.version
  };
  if (
    !isExpectedPrivateSourceKey({
      identity: rowIdentity,
      sha256: row.sha256,
      storagePath: row.storage_path
    })
  ) {
    return {
      ok: false,
      code: "source_path_mismatch",
      message: "Source storage path does not match its metadata.",
      status: 409
    };
  }

  if (row.status !== "delete_pending") {
    const { data: pendingRow, error: pendingError } = await storage.client
      .from(sourceUploadsTableName())
      .update({
        status: "delete_pending",
        deleted_by_clerk_user_id: args.owner.userId,
        delete_reason: "owner confirmed staging source deletion"
      })
      .eq("id", args.sourceId)
      .eq("status", row.status)
      .select("id")
      .maybeSingle();

    if (pendingError || !pendingRow) {
      logSourceUploadError(
        "metadata delete pending failed",
        pendingError?.message ?? "no matching staging row"
      );
      return {
        ok: false,
        code: pendingError ? "metadata_unavailable" : "source_not_deletable",
        message: pendingError
          ? "Source metadata could not be updated."
          : "Only unpublished staging sources can be deleted.",
        status: pendingError ? 503 : 409
      };
    }
  }

  const removal = await storageBucket(storage.client.storage, storage.bucket).remove([row.storage_path]);
  if (removal.error) {
    logSourceUploadError("storage delete failed", removal.error.message);
    return {
      ok: false,
      code: "storage_unavailable",
      message: "Source storage is unavailable.",
      status: 503
    };
  }

  const { data: deletedRow, error: updateError } = await storage.client
    .from(sourceUploadsTableName())
    .update({
      status: "deleted",
      deleted_at: new Date().toISOString(),
      deleted_by_clerk_user_id: args.owner.userId,
      delete_reason: "owner confirmed staging source deletion"
    })
    .eq("id", args.sourceId)
    .eq("status", "delete_pending")
    .select("id")
    .maybeSingle();

  if (updateError || !deletedRow) {
    logSourceUploadError(
      "metadata delete marker failed",
      updateError?.message ?? "no matching delete_pending row"
    );
    return {
      ok: false,
      code: updateError ? "metadata_unavailable" : "source_not_deletable",
      message: updateError
        ? "Source metadata could not be updated."
        : "Source metadata could not be finalized after storage deletion.",
      status: updateError ? 503 : 409
    };
  }

  return { ok: true, deleted: true };
}
