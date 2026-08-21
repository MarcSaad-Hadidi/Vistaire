import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  generateOwnerMenuTranslations,
  getOwnerMenuTranslationOverview
} from "@/lib/owner/menuTranslations";
import { normalizePublicMenuLocale } from "@/lib/menu/publicMenuSettings";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";
import {
  invalidateCommittedPublicMutation,
  resolvePublicMutationIdentity
} from "@/lib/owner/menuMutationRevalidation";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const { restaurantId } = await params;
  const capability = await requireOwnerRestaurantCapability(
    restaurantId,
    "canManageTranslations"
  );
  if (!capability.ok) {
    return NextResponse.json(
      { ok: false, error: capability.error },
      { status: capability.status }
    );
  }
  const result = await getOwnerMenuTranslationOverview(restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json(result);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const { restaurantId } = await params;
  const capability = await requireOwnerRestaurantCapability(
    restaurantId,
    "canManageTranslations"
  );
  if (!capability.ok) {
    return NextResponse.json(
      { ok: false, error: capability.error },
      { status: capability.status }
    );
  }
  const body = (await request.json().catch(() => null)) as
    | { locale?: unknown; dryRun?: unknown }
    | null;
  const locale = normalizePublicMenuLocale(body?.locale);
  const admin = getSupabaseAdminClient();
  const mutationIdentity = admin.ok
    ? await resolvePublicMutationIdentity({
        client: admin.client,
        restaurantId
      })
    : null;
  const result = await generateOwnerMenuTranslations({
    restaurantId,
    locale,
    dryRun: body?.dryRun === true,
    onPublicCommit: async () => {
      await invalidateCommittedPublicMutation(mutationIdentity);
    }
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json(result);
}
