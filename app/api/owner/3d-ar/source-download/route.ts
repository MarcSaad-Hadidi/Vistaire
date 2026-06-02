import { NextResponse, type NextRequest } from "next/server";
import {
  requireOwner3dRestaurantAccess,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { validateSourceUploadIdentity } from "@/lib/owner/threeDSourceUploadModel";
import {
  downloadPrivateObject,
  resolveSourceUpload
} from "@/lib/owner/threeDOptimizeGlbCandidateStore";
import { recordSourceDownloadEvent } from "@/lib/owner/threeDSourceDownloadAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeDownloadName(originalName: string): string {
  const cleaned = originalName.replace(/[^a-zA-Z0-9._ -]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 160);
  const base = cleaned || "source.glb";
  return base.toLowerCase().endsWith(".glb") ? base : `${base}.glb`;
}

export async function GET(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const params = request.nextUrl.searchParams;
  const identityResult = validateSourceUploadIdentity({
    restaurantSlug: params.get("restaurantSlug"),
    menuSlug: params.get("menuSlug"),
    dishSlug: params.get("dishSlug"),
    version: params.get("version")
  });
  if (!identityResult.ok) {
    return NextResponse.json({ ok: false, error: identityResult.error }, { status: 400 });
  }

  const accessError = requireOwner3dRestaurantAccess(owner, identityResult.identity.restaurantSlug);
  if (accessError) return accessError;

  const sourceUploadId = params.get("sourceUploadId") ?? "";
  if (!SOURCE_ID_PATTERN.test(sourceUploadId)) {
    return NextResponse.json({ ok: false, error: "sourceUploadId is invalid." }, { status: 400 });
  }

  const resolved = await resolveSourceUpload({
    sourceUploadId,
    identity: identityResult.identity
  });
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.message }, { status: resolved.status });
  }

  // Mandatory audit before any bytes leave. No silent downloads.
  const audit = await recordSourceDownloadEvent({
    identity: identityResult.identity,
    sourceUploadId: resolved.source.id,
    sourceSha256: resolved.source.sha256,
    owner,
    requestMetadata: { route: "source-download" }
  });
  if (!audit.ok) {
    return NextResponse.json(
      { ok: false, error: "Source download could not be audited and was blocked." },
      { status: 503 }
    );
  }

  const download = await downloadPrivateObject({
    ctx: resolved.ctx,
    storagePath: resolved.source.storagePath
  });
  if (!download.ok) {
    return NextResponse.json({ ok: false, error: download.message }, { status: download.status });
  }

  const filename = safeDownloadName(resolved.source.originalName);
  const body = new Blob([Uint8Array.from(download.bytes)], { type: "model/gltf-binary" });
  return new NextResponse(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": String(download.bytes.byteLength),
      "Content-Type": "model/gltf-binary",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}
