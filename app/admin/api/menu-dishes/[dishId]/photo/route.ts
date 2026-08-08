import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin/apiAuth";
import {
  buildAdminDishPhotoPath
} from "@/lib/admin/dishPhotoUrl";
import {
  publicDishAssetJsonError,
  redirectAuthorizedAdminDishAsset
} from "@/lib/publicDishAssetRedirect";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePhotoRequest(
  request: NextRequest,
  { params }: { params: Promise<{ dishId: string }> }
) {
  const access = await requireAdminApiAccess("dashboard:read");
  if (!access.ok) return access.response;

  const { dishId } = await params;
  const assetVersion = request.nextUrl.searchParams.get("v")?.trim() ?? "";
  try {
    buildAdminDishPhotoPath(dishId, {
      assetVersion: assetVersion || undefined
    });
  } catch {
    return publicDishAssetJsonError("Photo introuvable.", 404);
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return publicDishAssetJsonError("Photo indisponible.", 503);
  }

  return redirectAuthorizedAdminDishAsset({
    admin,
    dishId,
    kind: "photo",
    requestedAssetVersion: assetVersion || undefined,
    restaurantId: access.restaurantId,
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
