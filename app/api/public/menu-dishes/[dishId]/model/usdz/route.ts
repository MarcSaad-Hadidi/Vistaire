import type { NextRequest } from "next/server";
import { buildPreparedModelPublicUsdzPath } from "@/lib/owner/preparedModelWorkflow";
import {
  publicDishAssetJsonError,
  redirectPublicDishAsset
} from "@/lib/publicDishAssetRedirect";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleUsdzRequest(
  request: NextRequest,
  { params }: { params: Promise<{ dishId: string }> }
) {
  const { dishId } = await params;
  const assetVersion = request.nextUrl.searchParams.get("v")?.trim() ?? "";
  try {
    buildPreparedModelPublicUsdzPath(dishId, { assetVersion: assetVersion || undefined });
  } catch {
    return publicDishAssetJsonError("USDZ introuvable.", 404);
  }

  return redirectPublicDishAsset({
    admin: getSupabaseAdminClient(),
    dishId,
    kind: "usdz",
    requestedAssetVersion: assetVersion || undefined,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    notFoundMessage: "USDZ introuvable.",
    unavailableMessage: "USDZ indisponible."
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dishId: string }> }
) {
  return handleUsdzRequest(request, context);
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ dishId: string }> }
) {
  return handleUsdzRequest(request, context);
}
