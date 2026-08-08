import { NextResponse, type NextRequest } from "next/server";
import { parseUsdzRuntimeMaxBytes } from "@/lib/owner/usdzRuntimeModel";
import {
  assertUsdzRuntimeJobClaimsMatchRoute,
  parsePrepareUploadInput,
  prepareUsdzRuntimeSignedUpload,
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
  const input = parsePrepareUploadInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Payload prepare-upload invalide." }, { status: 400 });
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

  const runtimeLimit = parseUsdzRuntimeMaxBytes(process.env);
  if (!runtimeLimit.ok) {
    return NextResponse.json({ ok: false, error: "Optimiseur USDZ mal configure." }, { status: 503 });
  }
  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.reason }, { status: 503 });
  }

  try {
    const prepared = await prepareUsdzRuntimeSignedUpload({
      adminClient: admin.client,
      input,
      maxRuntimeBytes: runtimeLimit.maxBytes
    });
    return NextResponse.json(prepared);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Preparation upload USDZ impossible.",
        usdzSourceStored: false
      },
      { status: 400 }
    );
  }
}
