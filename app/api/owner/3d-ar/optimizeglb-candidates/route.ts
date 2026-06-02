import { NextResponse, type NextRequest } from "next/server";
import {
  requireOwner3dRestaurantAccess,
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  parseSourceUploadLimit,
  validateSourceGlbFile,
  validateSourceUploadIdentity
} from "@/lib/owner/threeDSourceUploadModel";
import {
  analyzeCandidateBuffer,
  buildCandidateSetView,
  sanitizeCandidateFileName,
  validateCandidateUploadFields
} from "@/lib/owner/threeDOptimizeGlbModel";
import {
  createOptimizeGlbCandidate,
  listOptimizeGlbCandidates,
  resolveSourceUpload
} from "@/lib/owner/threeDOptimizeGlbCandidateStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const CANDIDATE_SOURCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const uploadLimit = parseSourceUploadLimit(process.env);
  if (!uploadLimit.ok) {
    return NextResponse.json(
      { ok: false, error: "Upload size cap is not configured correctly." },
      { status: 503 }
    );
  }

  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength ? Number(rawContentLength) : 0;
  if (!rawContentLength || !Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json({ ok: false, error: "Upload content length is required." }, { status: 411 });
  }
  if (contentLength > uploadLimit.maxBytes + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ ok: false, error: "Candidate file is larger than the upload cap." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Formulaire invalide." }, { status: 400 });
  }

  const fields = validateCandidateUploadFields({
    restaurantSlug: formData.get("restaurantSlug"),
    menuSlug: formData.get("menuSlug"),
    dishSlug: formData.get("dishSlug"),
    version: formData.get("version"),
    sourceUploadId: formData.get("sourceUploadId"),
    variantRole: formData.get("variantRole"),
    presetLabel: formData.get("presetLabel"),
    notes: formData.get("notes")
  });
  if (!fields.ok) {
    return NextResponse.json({ ok: false, error: fields.error }, { status: 400 });
  }

  const accessError = requireOwner3dRestaurantAccess(owner, fields.value.identity.restaurantSlug);
  if (accessError) return accessError;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Candidate GLB requis." }, { status: 400 });
  }
  if (file.size > uploadLimit.maxBytes) {
    return NextResponse.json({ ok: false, error: "Candidate file is larger than the upload cap." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileResult = validateSourceGlbFile(
    { name: file.name, type: file.type, size: file.size, bytes },
    uploadLimit.maxBytes
  );
  if (!fileResult.ok) {
    return NextResponse.json({ ok: false, error: fileResult.error }, { status: fileResult.status });
  }

  const source = await resolveSourceUpload({
    sourceUploadId: fields.value.sourceUploadId,
    identity: fields.value.identity
  });
  if (!source.ok) {
    return NextResponse.json({ ok: false, error: source.message }, { status: source.status });
  }

  let analyzed;
  try {
    analyzed = analyzeCandidateBuffer({
      buffer: fileResult.bytes,
      variantRole: fields.value.variantRole,
      sourceSha256: source.source.sha256
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Candidate is not a valid GLB binary." }, { status: 400 });
  }

  if (analyzed.status === "no_op_rejected") {
    return NextResponse.json(
      { ok: false, code: "no_op_rejected", error: "This candidate is identical to the source GLB and cannot be used." },
      { status: 409 }
    );
  }

  if (analyzed.analysis.externalUriCount > 0) {
    return NextResponse.json(
      { ok: false, error: "Production candidates must embed all resources; external URIs are not allowed." },
      { status: 422 }
    );
  }
  if (fields.value.variantRole === "arLite" && analyzed.analysis.extensionsRequired.length > 0) {
    return NextResponse.json(
      { ok: false, error: "AR-lite candidates must not require glTF extensions (disable Draco/Meshopt)." },
      { status: 422 }
    );
  }

  const created = await createOptimizeGlbCandidate({
    identity: fields.value.identity,
    sourceUploadId: source.source.id,
    sourceSha256: source.source.sha256,
    variantRole: fields.value.variantRole,
    presetLabel: fields.value.presetLabel,
    originalName: sanitizeCandidateFileName(file.name),
    notes: fields.value.notes,
    bytes: fileResult.bytes,
    sha256: analyzed.analysis.sha256,
    status: analyzed.status,
    budgetStatus: analyzed.budgetStatus,
    fails: analyzed.fails,
    warnings: analyzed.warnings,
    triangleCount: analyzed.analysis.triangleCount,
    vertexCount: analyzed.analysis.vertexCount,
    materialCount: analyzed.analysis.materialCount,
    textureCount: analyzed.analysis.textureCount,
    maxTextureSize: analyzed.analysis.maxTextureSize,
    owner
  });

  if (!created.ok) {
    return NextResponse.json(
      { ok: false, code: created.code, error: created.message },
      { status: created.status }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      candidate: created.record,
      compressionRatio:
        source.source.bytes > 0
          ? Number((created.record.bytes / source.source.bytes).toFixed(4))
          : null
    },
    { status: 201 }
  );
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

  // Scope candidates to the active source upload. Without this, candidates from
  // historical sources under the same identity leak into recommendations and the
  // approval path, recommending an older candidate or matching the wrong source.
  const sourceUploadId = params.get("sourceUploadId") ?? "";
  let scopedSourceSha256 = "";
  if (sourceUploadId) {
    if (!CANDIDATE_SOURCE_ID_PATTERN.test(sourceUploadId)) {
      return NextResponse.json({ ok: false, error: "sourceUploadId is invalid." }, { status: 400 });
    }
    const source = await resolveSourceUpload({ sourceUploadId, identity: identityResult.identity });
    if (!source.ok) {
      return NextResponse.json({ ok: false, error: source.message }, { status: source.status });
    }
    scopedSourceSha256 = source.source.sha256;
  }

  const list = await listOptimizeGlbCandidates(
    identityResult.identity,
    sourceUploadId ? { sourceUploadId } : {}
  );
  if (!list.ok) {
    return NextResponse.json({ ok: false, error: list.message }, { status: list.status });
  }

  const sourceSha256 = scopedSourceSha256 || list.candidates[0]?.sourceSha256 || "";
  const view = buildCandidateSetView(sourceSha256, list.candidates);

  return NextResponse.json({
    ok: true,
    configured: list.configured,
    candidates: list.candidates,
    set: {
      status: view.evaluation.status,
      canApprove: view.evaluation.canApprove,
      missingRoles: view.evaluation.missingRoles,
      totalBytes: view.evaluation.totalBytes,
      fails: view.evaluation.fails,
      warnings: view.evaluation.warnings,
      recommended: Object.fromEntries(
        Object.entries(view.recommended).map(([role, candidate]) => [role, candidate?.id ?? null])
      )
    }
  });
}
