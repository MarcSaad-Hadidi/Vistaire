import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import {
  assertUsdzRuntimeJobClaimsMatchRoute,
  completeUsdzRuntimeSignedUpload,
  parseCompleteInput,
  verifyUsdzRuntimeJobToken
} from "@/lib/owner/usdzRuntimeJsonFlow";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function revalidatePublicDishModelPaths(restaurantSlug: string, dishSlug: string): void {
  if (!restaurantSlug) return;
  revalidatePath(`/menu/${restaurantSlug}`);
  if (dishSlug) revalidatePath(`/menu/${restaurantSlug}/dishes/${dishSlug}`);
}

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

  try {
    const result = await completeUsdzRuntimeSignedUpload({
      adminClient: admin.client,
      input
    });
    revalidatePublicDishModelPaths(verified.claims.restaurantSlug, verified.claims.dishSlug);
    return NextResponse.json({
      ok: true,
      ...result,
      usdzSourceStored: false,
      quickLookQaStatus: "not-tested",
      dishUpdated: true,
      warning: result.cleanup.errors[0]?.message
    });
  } catch (error) {
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
