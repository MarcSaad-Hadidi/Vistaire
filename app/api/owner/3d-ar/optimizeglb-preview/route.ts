import { NextResponse, type NextRequest } from "next/server";
import {
  requireOwner3dRestaurantAccess,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { validateSourceUploadIdentity } from "@/lib/owner/threeDSourceUploadModel";
import {
  downloadPrivateObject,
  getOptimizeGlbCandidateObject,
  resolveSourceUpload
} from "@/lib/owner/threeDOptimizeGlbCandidateStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function inlineGlbResponse(bytes: Buffer): NextResponse {
  const body = new Blob([Uint8Array.from(bytes)], { type: "model/gltf-binary" });
  return new NextResponse(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": String(bytes.byteLength),
      "Content-Type": "model/gltf-binary",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

// Owner-gated, no-store inline preview for the explicit-load 3D viewer.
// This is an in-dashboard preview, not an export; exports use the audited
// /source-download route.
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

  const kind = params.get("kind");
  if (kind === "source") {
    const sourceUploadId = params.get("sourceUploadId") ?? "";
    if (!ID_PATTERN.test(sourceUploadId)) {
      return NextResponse.json({ ok: false, error: "sourceUploadId is invalid." }, { status: 400 });
    }
    const resolved = await resolveSourceUpload({ sourceUploadId, identity: identityResult.identity });
    if (!resolved.ok) {
      return NextResponse.json({ ok: false, error: resolved.message }, { status: resolved.status });
    }
    const download = await downloadPrivateObject({
      ctx: resolved.ctx,
      storagePath: resolved.source.storagePath
    });
    if (!download.ok) {
      return NextResponse.json({ ok: false, error: download.message }, { status: download.status });
    }
    return inlineGlbResponse(download.bytes);
  }

  if (kind === "candidate") {
    const candidateId = params.get("candidateId") ?? "";
    if (!ID_PATTERN.test(candidateId)) {
      return NextResponse.json({ ok: false, error: "candidateId is invalid." }, { status: 400 });
    }
    const candidate = await getOptimizeGlbCandidateObject({
      identity: identityResult.identity,
      candidateId
    });
    if (!candidate.ok) {
      return NextResponse.json({ ok: false, error: candidate.message }, { status: candidate.status });
    }
    return inlineGlbResponse(candidate.bytes);
  }

  return NextResponse.json({ ok: false, error: "kind must be source or candidate." }, { status: 400 });
}
