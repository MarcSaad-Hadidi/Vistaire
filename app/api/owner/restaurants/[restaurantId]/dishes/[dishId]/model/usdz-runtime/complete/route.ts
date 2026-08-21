import { NextResponse, type NextRequest } from "next/server";
import {
  assertUsdzRuntimeJobClaimsMatchRoute,
  completeUsdzRuntimeSignedUpload,
  parseCompleteInput,
  verifyUsdzRuntimeJobToken
} from "@/lib/owner/usdzRuntimeJsonFlow";
import {
  invalidateCommittedPublicMutation,
  resolvePublicMutationIdentity
} from "@/lib/owner/menuMutationRevalidation";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON requis." }, { status: 400 });
  }
  const input = parseCompleteInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Payload complete invalide." }, { status: 400 });
  }
  const verified = verifyUsdzRuntimeJobToken(input.jobToken);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error, usdzSourceStored: false }, { status: 403 });
  }
  try {
    assertUsdzRuntimeJobClaimsMatchRoute(verified.claims, await params);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "jobToken USDZ invalide.",
        usdzSourceStored: false
      },
      { status: 403 }
    );
  }
  const capability = await requireOwnerRestaurantCapability(
    verified.claims.restaurantId,
    "canManageMedia"
  );
  if (!capability.ok) {
    return NextResponse.json(
      { ok: false, error: capability.error, usdzSourceStored: false },
      { status: capability.status }
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.reason }, { status: 503 });
  }
  const publicIdentity = await resolvePublicMutationIdentity({
    client: admin.client,
    restaurantId: verified.claims.restaurantId,
    dishSlug: verified.claims.dishSlug
  });
  let publicCommitted = false;
  const onPublicCommit = async () => {
    publicCommitted = true;
    await invalidateCommittedPublicMutation(publicIdentity);
  };

  try {
    const result = await completeUsdzRuntimeSignedUpload({
      adminClient: admin.client,
      input,
      onPublicCommit
    });
    return NextResponse.json({
      ok: true,
      ...result,
      usdzSourceStored: false,
      quickLookQaStatus: "not-tested",
      dishUpdated: true,
      warning: result.cleanup.errors[0]?.message
    });
  } catch (error) {
    if (publicCommitted) {
      await invalidateCommittedPublicMutation(publicIdentity);
      return NextResponse.json(
        {
          ok: false,
          error: "Runtime USDZ publie, mais finalisation 3D incomplete.",
          usdzSourceStored: false,
          uploaded: true,
          committed: true,
          dishUpdated: true
        },
        { status: 503 }
      );
    }
    const reportReason =
      error && typeof error === "object" && "reason" in error && typeof error.reason === "string"
        ? error.reason
        : undefined;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Finalisation USDZ impossible.",
        ...(reportReason ? { reportReason } : {}),
        usdzSourceStored: false,
        uploaded: false
      },
      { status: 503 }
    );
  }
}
