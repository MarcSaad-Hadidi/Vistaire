import { storageBucket } from "@/lib/storage/backend";
import { NextResponse, type NextRequest } from "next/server";
import {
  requireOwner3dRestaurantAccess,
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { validateSourceUploadIdentity } from "@/lib/owner/threeDSourceUploadModel";
import {
  mergeDeviceQaRecords,
  validateDeviceQaSubmission,
  type DeviceQaRecord,
  type DeviceQaEvidenceInput
} from "@/lib/owner/threeDDeviceQaModel";
import { getOwner3dVisualReview } from "@/lib/owner/threeDVisualReviewServer";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEVICE_QA_TABLE = "owner_3d_device_qa";
const ARTIFACTS_TABLE = "owner_3d_pipeline_artifacts";
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 512 * 1024;

function cleanText(value: FormDataEntryValue | null, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength)
    : "";
}

function deviceTargetForRow(target: string): "iphone_quick_look" | "android_scene_viewer" {
  return target === "iphoneQuickLook" ? "iphone_quick_look" : "android_scene_viewer";
}

function deviceTargetFromRow(target: unknown): DeviceQaRecord["target"] | null {
  if (target === "iphone_quick_look") return "iphoneQuickLook";
  if (target === "android_scene_viewer") return "androidSceneViewer";
  return null;
}

function statusFromRow(status: unknown): DeviceQaRecord["status"] {
  if (status === "passed" || status === "failed" || status === "blocked") return status;
  return "not-tested";
}

function recordFromRow(row: Record<string, unknown>): DeviceQaRecord | null {
  const target = deviceTargetFromRow(row.device_target);
  if (!target) return null;
  const evidenceBytes =
    typeof row.evidence_bytes === "number"
      ? row.evidence_bytes
      : Number(row.evidence_bytes);
  const evidence =
    typeof row.evidence_sha256 === "string" &&
    Number.isFinite(evidenceBytes) &&
    evidenceBytes > 0
      ? {
          originalName: cleanRowText(row.evidence_original_name, "Recorded evidence"),
          mimeType: cleanRowText(row.evidence_mime_type, "text/plain"),
          bytes: evidenceBytes,
          sha256: row.evidence_sha256
        }
      : null;

  return {
    target,
    status: statusFromRow(row.status),
    deviceName: cleanRowText(row.device_name),
    osVersion: cleanRowText(row.os_version),
    browserName: cleanRowText(row.browser_name, target === "iphoneQuickLook" ? "Safari" : "Chrome"),
    browserVersion: cleanRowText(row.browser_version),
    arcoreStatus: cleanRowText(row.arcore_status),
    network: cleanRowText(row.network),
    notes: cleanRowText(row.notes),
    testedBy: cleanRowText(row.tested_by),
    testedAt: cleanRowText(row.tested_at) || null,
    evidence
  };
}

function evidenceBucket(): string {
  return (
    process.env.VISTAIRE_3D_QA_EVIDENCE_BUCKET?.trim() ||
    process.env.VISTAIRE_3D_SOURCE_BUCKET?.trim() ||
    ""
  );
}

function cleanRowText(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 2000);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function extensionForEvidence(fileName: string, mimeType: string): string {
  const fromName = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  if ([".md", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(fromName)) {
    return fromName;
  }
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "text/markdown") return ".md";
  return ".txt";
}

function contentTypeForEvidence(fileName: string, mimeType: string): string {
  const lowerName = fileName.toLowerCase();
  if (mimeType) return mimeType;
  if (lowerName.endsWith(".md")) return "text/markdown";
  if (lowerName.endsWith(".txt")) return "text/plain";
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".webp")) return "image/webp";
  return "text/plain";
}

function privateEvidencePath(args: {
  restaurantSlug: string;
  menuSlug: string;
  dishSlug: string;
  version: string;
  target: string;
  sha256: string;
  extension: string;
}) {
  return [
    "device-qa",
    args.restaurantSlug,
    args.menuSlug,
    args.dishSlug,
    args.version,
    args.target,
    `${args.sha256}${args.extension}`
  ].join("/");
}

export async function GET(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const identity = validateSourceUploadIdentity({
    restaurantSlug: request.nextUrl.searchParams.get("restaurantSlug"),
    menuSlug: request.nextUrl.searchParams.get("menuSlug"),
    dishSlug: request.nextUrl.searchParams.get("dishSlug"),
    version: request.nextUrl.searchParams.get("version")
  });
  if (!identity.ok) {
    return NextResponse.json({ ok: false, error: identity.error }, { status: 400 });
  }
  const accessError = requireOwner3dRestaurantAccess(owner, identity.identity.restaurantSlug);
  if (accessError) return accessError;

  const review = getOwner3dVisualReview(identity.identity);
  if (!review) {
    return NextResponse.json({ ok: false, error: "Device QA asset not found." }, { status: 404 });
  }

  let deviceQa = review.deviceQa;
  const admin = getSupabaseAdminClient();
  if (admin.ok) {
    const rows = await admin.client
      .from(DEVICE_QA_TABLE)
      .select(
        [
          "device_target",
          "status",
          "device_name",
          "os_version",
          "browser_name",
          "browser_version",
          "arcore_status",
          "network",
          "tested_by",
          "tested_at",
          "evidence_original_name",
          "evidence_mime_type",
          "evidence_bytes",
          "evidence_sha256",
          "notes"
        ].join(",")
      )
      .eq("restaurant_slug", identity.identity.restaurantSlug)
      .eq("menu_slug", identity.identity.menuSlug)
      .eq("dish_slug", identity.identity.dishSlug)
      .eq("asset_version", identity.identity.version)
      .is("superseded_at", null)
      .order("tested_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (!rows.error && Array.isArray(rows.data)) {
      deviceQa = mergeDeviceQaRecords(
        review.deviceQa,
        rows.data
          .map((row) => recordFromRow(row as unknown as Record<string, unknown>))
          .filter((record): record is DeviceQaRecord => Boolean(record))
      );
    }
  }

  return NextResponse.json({
    ok: true,
    storageConfigured: Boolean(evidenceBucket()),
    deviceQa
  });
}

export async function POST(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength ? Number(rawContentLength) : 0;
  if (!rawContentLength || !Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json({ ok: false, error: "Content length is required." }, { status: 411 });
  }
  if (contentLength > MAX_EVIDENCE_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ ok: false, error: "Evidence upload is too large." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Formulaire invalide." }, { status: 400 });
  }

  const identity = validateSourceUploadIdentity({
    restaurantSlug: formData.get("restaurantSlug"),
    menuSlug: formData.get("menuSlug"),
    dishSlug: formData.get("dishSlug"),
    version: formData.get("version")
  });
  if (!identity.ok) {
    return NextResponse.json({ ok: false, error: identity.error }, { status: 400 });
  }
  const accessError = requireOwner3dRestaurantAccess(owner, identity.identity.restaurantSlug);
  if (accessError) return accessError;

  const review = getOwner3dVisualReview(identity.identity);
  if (!review) {
    return NextResponse.json({ ok: false, error: "Device QA asset not found." }, { status: 404 });
  }

  const file = formData.get("evidence");
  let evidence: DeviceQaEvidenceInput | null = null;
  let evidenceBytes: Buffer | null = null;
  if (file instanceof File) {
    if (file.size > MAX_EVIDENCE_BYTES) {
      return NextResponse.json({ ok: false, error: "Evidence upload is too large." }, { status: 413 });
    }
    evidenceBytes = Buffer.from(await file.arrayBuffer());
    evidence = {
      originalName: file.name,
      mimeType: contentTypeForEvidence(file.name, file.type),
      bytes: evidenceBytes
    };
  }

  const validation = validateDeviceQaSubmission(
    {
      target: cleanText(formData.get("target"), 80),
      status: cleanText(formData.get("status"), 80),
      deviceName: cleanText(formData.get("deviceName"), 160),
      osVersion: cleanText(formData.get("osVersion"), 160),
      browserVersion: cleanText(formData.get("browserVersion"), 160),
      arcoreStatus: cleanText(formData.get("arcoreStatus"), 160),
      network: cleanText(formData.get("network"), 160),
      testedBy: cleanText(formData.get("testedBy"), 160) || owner.emailAddresses[0] || owner.userId,
      testedAt: cleanText(formData.get("testedAt"), 80),
      notes: cleanText(formData.get("notes"), 2000),
      evidence
    },
    review.deviceQa
  );

  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const bucket = evidenceBucket();
  if (!admin.ok) {
    return NextResponse.json(
      { ok: false, error: "Device QA metadata storage is not configured." },
      { status: 503 }
    );
  }
  if (validation.record.evidence && !bucket) {
    return NextResponse.json(
      { ok: false, error: "Device QA evidence storage is not configured." },
      { status: 503 }
    );
  }

  let artifactId: string | null = null;
  let evidencePath: string | null = null;
  if (validation.record.evidence && evidenceBytes) {
    const extension = extensionForEvidence(
      validation.record.evidence.originalName,
      validation.record.evidence.mimeType
    );
    evidencePath = privateEvidencePath({
      ...identity.identity,
      target: validation.record.target,
      sha256: validation.record.evidence.sha256,
      extension
    });

    const upload = await storageBucket(admin.client.storage, bucket).upload(evidencePath, evidenceBytes, {
      cacheControl: "0",
      contentType: validation.record.evidence.mimeType,
      upsert: false
    });
    if (upload.error) {
      return NextResponse.json({ ok: false, error: "Device QA evidence could not be stored." }, { status: 503 });
    }

    const artifact = await admin.client
      .from(ARTIFACTS_TABLE)
      .insert({
        artifact_type: "qa_evidence",
        variant: "evidence",
        status: validation.record.status === "passed" ? "approved" : "staged",
        label: validation.record.evidence.originalName,
        storage_provider: "supabase-storage",
        storage_bucket: bucket,
        storage_path: evidencePath,
        public_url: null,
        bytes: validation.record.evidence.bytes,
        sha256: validation.record.evidence.sha256,
        mime_type: validation.record.evidence.mimeType,
        metadata: {
          restaurantSlug: identity.identity.restaurantSlug,
          menuSlug: identity.identity.menuSlug,
          dishSlug: identity.identity.dishSlug,
          version: identity.identity.version,
          deviceTarget: validation.record.target
        }
      })
      .select("id")
      .single();
    if (artifact.error || !artifact.data) {
      await storageBucket(admin.client.storage, bucket).remove([evidencePath]);
      return NextResponse.json({ ok: false, error: "Device QA evidence metadata could not be recorded." }, { status: 503 });
    }
    artifactId = String(artifact.data.id);
  }

  const deviceTarget = deviceTargetForRow(validation.record.target);
  const supersededAt = new Date().toISOString();
  const superseded = await admin.client
    .from(DEVICE_QA_TABLE)
    .update({ superseded_at: supersededAt })
    .eq("restaurant_slug", identity.identity.restaurantSlug)
    .eq("menu_slug", identity.identity.menuSlug)
    .eq("dish_slug", identity.identity.dishSlug)
    .eq("asset_version", identity.identity.version)
    .eq("device_target", deviceTarget)
    .is("superseded_at", null)
    .select("id");

  if (superseded.error) {
    if (evidencePath) await storageBucket(admin.client.storage, bucket).remove([evidencePath]);
    return NextResponse.json(
      { ok: false, error: "Existing Device QA result could not be superseded." },
      { status: 503 }
    );
  }

  const deviceQa = await admin.client
    .from(DEVICE_QA_TABLE)
    .insert({
      restaurant_slug: identity.identity.restaurantSlug,
      menu_slug: identity.identity.menuSlug,
      dish_slug: identity.identity.dishSlug,
      asset_version: identity.identity.version,
      device_target: deviceTarget,
      status: validation.record.status === "not-tested" ? "not_tested" : validation.record.status,
      device_name: validation.record.deviceName || null,
      os_version: validation.record.osVersion || null,
      browser_name: validation.record.browserName || null,
      browser_version: validation.record.browserVersion || null,
      arcore_status: validation.record.arcoreStatus || null,
      network: validation.record.network || null,
      tested_by: validation.record.testedBy || owner.emailAddresses[0] || owner.userId,
      tested_by_clerk_user_id: owner.userId,
      tested_by_email: owner.emailAddresses[0] ?? null,
      tested_at: validation.record.testedAt,
      evidence_artifact_id: artifactId,
      evidence_storage_bucket: validation.record.evidence ? bucket : null,
      evidence_storage_path: evidencePath,
      evidence_original_name: validation.record.evidence?.originalName ?? null,
      evidence_mime_type: validation.record.evidence?.mimeType ?? null,
      evidence_bytes: validation.record.evidence?.bytes ?? null,
      evidence_sha256: validation.record.evidence?.sha256 ?? null,
      asset_url: review.deviceQa.targets.find((target) => target.target === validation.record.target)?.assetUrl ?? null,
      notes: validation.record.notes || null,
      metadata: {
        source: "owner-device-qa-ui",
        noAutomatedDeviceClaim: true
      }
    })
    .select("id,status,device_target,tested_at")
    .single();

  if (deviceQa.error || !deviceQa.data) {
    if (evidencePath) await storageBucket(admin.client.storage, bucket).remove([evidencePath]);
    const supersededIds = Array.isArray(superseded.data)
      ? superseded.data
          .map((row) => (row && typeof row === "object" && "id" in row ? String(row.id) : ""))
          .filter(Boolean)
      : [];
    if (supersededIds.length > 0) {
      await admin.client
        .from(DEVICE_QA_TABLE)
        .update({ superseded_at: null })
        .in("id", supersededIds)
        .eq("superseded_at", supersededAt);
    }
    return NextResponse.json({ ok: false, error: "Device QA could not be recorded." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    deviceQa: deviceQa.data,
    currentStatus: mergeDeviceQaRecords(review.deviceQa, [validation.record]),
    message:
      validation.record.status === "passed"
        ? "Device QA pass recorded with evidence."
        : "Device QA failure recorded with note."
  });
}
