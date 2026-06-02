import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceUploadIdentity } from "@/lib/owner/threeDSourceUploadModel";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

const SOURCE_DOWNLOAD_EVENTS_TABLE = "owner_3d_source_download_events";

type OwnerIdentity = {
  userId: string;
  emailAddresses: string[];
};

type AuditFailure = {
  ok: false;
  code: "audit_not_configured" | "audit_unavailable";
  message: string;
};

export type SourceDownloadEvent = {
  id: string;
  sourceUploadId: string | null;
  sourceSha256: string;
  downloadedByEmail: string | null;
  downloadedAt: string;
};

function getAdminClient(): { ok: true; client: SupabaseClient } | AuditFailure {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return { ok: false, code: "audit_not_configured", message: "Audit store is not configured." };
  }
  return { ok: true, client: admin.client };
}

/**
 * Record a protected source download. Sanitized: no raw IP, no tokens.
 * Returns ok:false on store issues so the caller can decide policy, but the
 * download route treats a missing audit as a hard failure (no silent download).
 */
export async function recordSourceDownloadEvent(args: {
  identity: SourceUploadIdentity;
  sourceUploadId: string;
  sourceSha256: string;
  owner: OwnerIdentity;
  requestMetadata?: Record<string, string | number | boolean>;
}): Promise<{ ok: true; id: string } | AuditFailure> {
  const admin = getAdminClient();
  if (!admin.ok) return admin;

  const requestMetadata = sanitizeRequestMetadata(args.requestMetadata);

  const { data, error } = await admin.client
    .from(SOURCE_DOWNLOAD_EVENTS_TABLE)
    .insert({
      source_upload_id: args.sourceUploadId,
      restaurant_slug: args.identity.restaurantSlug,
      menu_slug: args.identity.menuSlug,
      dish_slug: args.identity.dishSlug,
      version: args.identity.version,
      source_sha256: args.sourceSha256,
      downloaded_by_clerk_user_id: args.owner.userId,
      downloaded_by_email: args.owner.emailAddresses[0] ?? null,
      request_metadata: requestMetadata
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, code: "audit_unavailable", message: "Audit event could not be recorded." };
  }
  return { ok: true, id: (data as { id: string }).id };
}

export async function listSourceDownloadEvents(
  identity: SourceUploadIdentity
): Promise<{ ok: true; configured: boolean; events: SourceDownloadEvent[] } | AuditFailure> {
  const admin = getAdminClient();
  if (!admin.ok) return { ok: true, configured: false, events: [] };

  const { data, error } = await admin.client
    .from(SOURCE_DOWNLOAD_EVENTS_TABLE)
    .select("id,source_upload_id,source_sha256,downloaded_by_email,downloaded_at")
    .eq("restaurant_slug", identity.restaurantSlug)
    .eq("menu_slug", identity.menuSlug)
    .eq("dish_slug", identity.dishSlug)
    .eq("version", identity.version)
    .order("downloaded_at", { ascending: false })
    .limit(20);

  if (error) {
    return { ok: false, code: "audit_unavailable", message: "Audit events are unavailable." };
  }

  const events = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    sourceUploadId: (row.source_upload_id as string | null) ?? null,
    sourceSha256: String(row.source_sha256),
    downloadedByEmail: (row.downloaded_by_email as string | null) ?? null,
    downloadedAt: String(row.downloaded_at)
  }));
  return { ok: true, configured: true, events };
}

function sanitizeRequestMetadata(
  metadata?: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  if (!metadata) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(key)) continue;
    if (/token|secret|key|authorization|cookie|ip|password/i.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, 120);
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
  }
  return out;
}
