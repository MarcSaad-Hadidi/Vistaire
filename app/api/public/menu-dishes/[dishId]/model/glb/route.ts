import { NextResponse, type NextRequest } from "next/server";
import {
  buildPreparedModelPublicArLiteGlbPath,
  buildPreparedModelPublicGlbPath
} from "@/lib/owner/preparedModelWorkflow";
import { redirectPublicDishAsset } from "@/lib/publicDishAssetRedirect";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGlbRequest(
  request: NextRequest,
  { params }: { params: Promise<{ dishId: string }> }
) {
  const { dishId } = await params;
  const variant = request.nextUrl.searchParams.get("variant");
  const assetVersion = request.nextUrl.searchParams.get("v")?.trim() ?? "";
  try {
    if (variant === "ar-lite") {
      buildPreparedModelPublicArLiteGlbPath(dishId, {
        assetVersion: assetVersion || undefined
      });
    } else {
      buildPreparedModelPublicGlbPath(dishId, { assetVersion: assetVersion || undefined });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Modele introuvable." }, { status: 404 });
  }
  if (variant && variant !== "ar-lite") {
    return NextResponse.json({ ok: false, error: "Variante modele introuvable." }, { status: 404 });
  }

  return redirectPublicDishAsset({
    admin: getSupabaseAdminClient(),
    dishId,
    kind: variant === "ar-lite" ? "ar-lite-glb" : "web-glb",
    requestedAssetVersion: assetVersion || undefined,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    notFoundMessage: "Modele introuvable.",
    unavailableMessage: "Modele indisponible."
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dishId: string }> }
) {
  return handleGlbRequest(request, context);
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ dishId: string }> }
) {
  return handleGlbRequest(request, context);
}
