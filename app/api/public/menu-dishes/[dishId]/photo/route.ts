import type { NextRequest } from "next/server";
import {
  buildDishPhotoPublicPath,
  type DishPhotoDerivativeVariant
} from "@/lib/owner/dishPhotoUpload";
import {
  publicDishAssetJsonError,
  redirectPublicDishAsset
} from "@/lib/publicDishAssetRedirect";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePhotoRequest(
  request: NextRequest,
  { params }: { params: Promise<{ dishId: string }> }
) {
  const { dishId } = await params;
  const assetVersion = request.nextUrl.searchParams.get("v")?.trim() ?? "";
  const rawVariant = request.nextUrl.searchParams.get("variant")?.trim() ?? "";
  const photoVariant: DishPhotoDerivativeVariant | undefined =
    rawVariant === "thumbnail" || rawVariant === "display"
      ? rawVariant
      : undefined;
  if (rawVariant && !photoVariant) {
    return publicDishAssetJsonError("Photo introuvable.", 404);
  }
  try {
    buildDishPhotoPublicPath(dishId, {
      assetVersion: assetVersion || undefined,
      variant: photoVariant
    });
  } catch {
    return publicDishAssetJsonError("Photo introuvable.", 404);
  }

  return redirectPublicDishAsset({
    admin: getSupabaseAdminClient(),
    dishId,
    kind: "photo",
    requestedAssetVersion: assetVersion || undefined,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    notFoundMessage: "Photo introuvable.",
    unavailableMessage: "Photo indisponible.",
    photoVariant
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
