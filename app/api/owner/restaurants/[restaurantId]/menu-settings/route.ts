import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  serializePublicMenuSettings,
  validatePublicMenuSettingsInput
} from "@/lib/menu/publicMenuSettings";
import {
  updateOwnerMenuSettings,
  type SupabaseMenuSettingsClient
} from "@/lib/owner/menuSettingsMutation";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";
import { revalidateOwnerMenuMutationPaths } from "@/lib/owner/menuMutationRevalidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function settingsInputFromBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const candidate = body as Record<string, unknown>;
  return candidate.publicMenuSettings ?? candidate.settings ?? candidate.settings_json ?? body;
}

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

  const capability = await requireOwnerRestaurantCapability(
    restaurantId,
    "canEditMenuSettings"
  );
  if (!capability.ok) {
    return NextResponse.json(
      { ok: false, error: capability.error },
      { status: capability.status }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 });
  }

  const validated = validatePublicMenuSettingsInput(settingsInputFromBody(body));
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const settings = serializePublicMenuSettings(validated.value);
  const adminResult = getSupabaseAdminClient();
  if (!adminResult.ok) {
    return NextResponse.json(
      { ok: false, error: adminResult.reason },
      { status: 503 }
    );
  }

  const result = await updateOwnerMenuSettings({
    client: adminResult.client as unknown as SupabaseMenuSettingsClient,
    restaurantId,
    settings
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  await revalidateOwnerMenuMutationPaths({
    client: adminResult.client,
    restaurantId
  });

  return NextResponse.json({
    ok: true,
    restaurantId: result.restaurantId,
    menuId: result.menuId,
    settings: result.settings,
    storage: result.storage
  });
}
