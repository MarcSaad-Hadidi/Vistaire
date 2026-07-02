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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const { restaurantId } = await params;
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
  const body = (await request.json().catch(() => null)) as
    | { locale?: unknown; dryRun?: unknown }
    | null;
  const locale = normalizePublicMenuLocale(body?.locale);
  const result = await generateOwnerMenuTranslations({
    restaurantId,
    locale,
    dryRun: body?.dryRun === true
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json(result);
}
