import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  updateRestaurantStatusRecord,
  validateRestaurantStatusAction
} from "@/lib/owner/restaurantStatus";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const { restaurantId } = await params;
  if (!restaurantId) {
    return NextResponse.json({ ok: false, error: "Restaurant requis." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 });
  }

  const validated = validateRestaurantStatusAction(body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const updated = await updateRestaurantStatusRecord(restaurantId, validated.action, {
    admin: getSupabaseAdminClient()
  });

  if (!updated.ok) {
    return NextResponse.json(
      { ok: false, error: updated.error },
      { status: updated.status }
    );
  }

  return NextResponse.json({
    ok: true,
    restaurantId: updated.restaurantId,
    status: updated.status
  });
}
