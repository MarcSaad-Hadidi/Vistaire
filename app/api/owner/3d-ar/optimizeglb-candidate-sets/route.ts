import { NextResponse, type NextRequest } from "next/server";
import {
  requireOwner3dRestaurantAccess,
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { validateSourceUploadIdentity } from "@/lib/owner/threeDSourceUploadModel";
import {
  evaluateSelectedCandidateSet,
  type OptimizeGlbCandidateRecord,
  type VariantRole
} from "@/lib/owner/threeDOptimizeGlbModel";
import {
  listOptimizeGlbCandidates,
  recordApprovedCandidateSet,
  resolveSourceUpload
} from "@/lib/owner/threeDOptimizeGlbCandidateStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const identityResult = validateSourceUploadIdentity(body);
  if (!identityResult.ok) {
    return NextResponse.json({ ok: false, error: identityResult.error }, { status: 400 });
  }

  const accessError = requireOwner3dRestaurantAccess(owner, identityResult.identity.restaurantSlug);
  if (accessError) return accessError;

  const sourceUploadId = asString(body.sourceUploadId);
  const selectedIds: Partial<Record<VariantRole, string>> = {
    web: asString(body.webCandidateId),
    mobile: asString(body.mobileCandidateId),
    arLite: asString(body.arLiteCandidateId)
  };
  const iosSourceId = asString(body.iosSourceCandidateId);
  if (iosSourceId) selectedIds.iosSource = iosSourceId;

  const source = await resolveSourceUpload({ sourceUploadId, identity: identityResult.identity });
  if (!source.ok) {
    return NextResponse.json({ ok: false, error: source.message }, { status: source.status });
  }

  // Scope to the active source so approval can never resolve a candidate that
  // belongs to a different (historical) source under the same identity.
  const list = await listOptimizeGlbCandidates(identityResult.identity, {
    sourceUploadId: source.source.id
  });
  if (!list.ok) {
    return NextResponse.json({ ok: false, error: list.message }, { status: list.status });
  }
  const byId = new Map(list.candidates.map((candidate) => [candidate.id, candidate]));

  const members: Partial<Record<VariantRole, OptimizeGlbCandidateRecord>> = {};
  for (const role of Object.keys(selectedIds) as VariantRole[]) {
    const id = selectedIds[role];
    if (!id) continue;
    const candidate = byId.get(id);
    if (!candidate || candidate.variantRole !== role) {
      return NextResponse.json(
        { ok: false, error: `Selected ${role} candidate does not exist for this dish version.` },
        { status: 400 }
      );
    }
    members[role] = candidate;
  }

  const evaluation = evaluateSelectedCandidateSet(source.source.sha256, members);
  if (!evaluation.canApprove) {
    return NextResponse.json(
      {
        ok: false,
        code: "set_not_approvable",
        error: "Candidate set cannot be approved yet.",
        status: evaluation.status,
        fails: evaluation.fails,
        missingRoles: evaluation.missingRoles
      },
      { status: 409 }
    );
  }

  const recorded = await recordApprovedCandidateSet({
    identity: identityResult.identity,
    sourceUploadId: source.source.id,
    sourceSha256: source.source.sha256,
    webCandidateId: (members.web as OptimizeGlbCandidateRecord).id,
    mobileCandidateId: (members.mobile as OptimizeGlbCandidateRecord).id,
    arLiteCandidateId: (members.arLite as OptimizeGlbCandidateRecord).id,
    iosSourceCandidateId: members.iosSource?.id ?? null,
    totalBytes: evaluation.totalBytes,
    visualQuality: {
      promise:
        "visually indistinguishable under deterministic multi-angle mobile dining-distance review within strict thresholds"
    },
    owner
  });
  if (!recorded.ok) {
    return NextResponse.json({ ok: false, error: recorded.message }, { status: recorded.status });
  }

  return NextResponse.json(
    {
      ok: true,
      candidateSetId: recorded.id,
      status: "approved_by_human",
      note: "Candidate set approved. CDN validation, iPhone and Android device QA, finalize, and publish remain separate gates."
    },
    { status: 201 }
  );
}
