import { NextResponse, type NextRequest } from "next/server";
import {
  assertUsdzRuntimeJobClaimsMatchRoute,
  parseRollbackInput,
  rollbackUsdzRuntimeSignedUpload,
  verifyUsdzRuntimeJobToken
} from "@/lib/owner/usdzRuntimeJsonFlow";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const input = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const jobToken = typeof input.jobToken === "string" ? input.jobToken : "";
  const verified = verifyUsdzRuntimeJobToken(jobToken);
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

  const rollbackInput = parseRollbackInput(input);
  if (rollbackInput && (rollbackInput.runtimeStoragePath || rollbackInput.reportStoragePath)) {
    const admin = getSupabaseAdminClient();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.reason, usdzSourceStored: false }, { status: 503 });
    }
    try {
      const rollback = await rollbackUsdzRuntimeSignedUpload({
        adminClient: admin.client,
        input: rollbackInput
      });
      return NextResponse.json({
        ok: true,
        jobId: verified.claims.jobId,
        status: "failed",
        rollback,
        usdzSourceStored: false
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Rollback USDZ impossible.",
          usdzSourceStored: false
        },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    jobId: verified.claims.jobId,
    status: "failed",
    usdzSourceStored: false
  });
}
