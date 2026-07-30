import { NextResponse, type NextRequest } from "next/server";
import { buildDishPhotoPublicPath } from "@/lib/owner/dishPhotoUpload";
import { redirectPublicDishAsset } from "@/lib/publicDishAssetRedirect";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePhotoRequest(
  _request: NextRequest,
  { params }: { params: Promise<{ dishId: string }> }
) {
  const { dishId } = await params;
  try {
    buildDishPhotoPublicPath(dishId);
  } catch {
    return NextResponse.json({ ok: false, error: "Photo introuvable." }, { status: 404 });
  }

  return redirectPublicDishAsset({
    admin: getSupabaseAdminClient(),
    dishId,
    kind: "photo",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    notFoundMessage: "Photo introuvable.",
    unavailableMessage: "Photo indisponible."
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dishId: string }> }
) {
  return handlePhotoRequest(request, context);
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ dishId: string }> }
) {
  return handlePhotoRequest(request, context);
}
