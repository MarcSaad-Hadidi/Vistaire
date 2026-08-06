import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import {
  DEFAULT_USDZ_OPTIMIZATION_PROFILE,
  isUsdzOptimizationProfile,
  parseUsdzSourceUploadLimit,
  sanitizeUsdzOriginalName
} from "@/lib/owner/usdzRuntimeModel";
import { createUsdzRuntimeJobToken } from "@/lib/owner/usdzRuntimeJsonFlow";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DishRow = {
  id: string;
  restaurant_id: string;
  menu_id: string | null;
  slug: string | null;
  name: string | null;
};

function getString(row: Record<string, unknown> | null | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function jsonString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function jsonNumber(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const { restaurantId, dishId } = await params;
  const capability = await requireOwnerRestaurantCapability(restaurantId, "canManageMedia");
  if (!capability.ok) {
    return NextResponse.json({ ok: false, error: capability.error }, { status: capability.status });
  }

  const sourceLimit = parseUsdzSourceUploadLimit(process.env);
  if (!sourceLimit.ok) {
    return NextResponse.json({ ok: false, error: "Optimiseur USDZ mal configure." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON requis." }, { status: 400 });
  }
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const sourceBytes = jsonNumber(input.sourceBytes);
  if (!sourceBytes || sourceBytes > sourceLimit.maxBytes) {
    return NextResponse.json({ ok: false, error: "USDZ source trop volumineux." }, { status: 413 });
  }
  const originalName = sanitizeUsdzOriginalName(jsonString(input.originalName) || "source.usdz");
  if (!originalName.toLowerCase().endsWith(".usdz")) {
    return NextResponse.json({ ok: false, error: "Seuls les fichiers .usdz sont acceptes." }, { status: 400 });
  }
  const rawProfile = jsonString(input.profile);
  const profile = isUsdzOptimizationProfile(rawProfile)
    ? rawProfile
    : DEFAULT_USDZ_OPTIMIZATION_PROFILE;

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.reason }, { status: 503 });
  }

  const { data: dish, error: dishError } = await admin.client
    .from("menu_dishes")
    .select("id,restaurant_id,menu_id,slug,name")
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle<DishRow>();
  if (dishError) {
    return NextResponse.json({ ok: false, error: "Plat impossible a verifier." }, { status: 503 });
  }
  if (!dish) {
    return NextResponse.json({ ok: false, error: "Plat introuvable pour ce restaurant." }, { status: 404 });
  }

  const restaurant = await admin.client
    .from("restaurants")
    .select("slug")
    .eq("id", restaurantId)
    .maybeSingle();
  const menu = dish.menu_id
    ? await admin.client
        .from("menus")
        .select("slug")
        .eq("id", dish.menu_id)
        .eq("restaurant_id", restaurantId)
        .maybeSingle()
    : { data: null };

  const restaurantSlug = slugifyRestaurantSlug(getString(restaurant.data, "slug") || restaurantId);
  const menuSlug = slugifyRestaurantSlug(getString(menu.data, "slug") || "principal");
  const dishSlug = slugifyRestaurantSlug(dish.slug || dish.name || dishId);
  const token = createUsdzRuntimeJobToken({
    owner: { userId: owner.userId, email: owner.emailAddresses[0] ?? null },
    restaurantId,
    restaurantSlug,
    menuSlug,
    dishId,
    dishSlug,
    sourceOriginalName: originalName,
    sourceBytes,
    profile
  });
  if (!token.ok) {
    return NextResponse.json({ ok: false, error: token.error }, { status: 503 });
  }

  const basePath = `/api/owner/restaurants/${encodeURIComponent(restaurantId)}/dishes/${encodeURIComponent(dishId)}/model/usdz-runtime`;
  return NextResponse.json({
    ok: true,
    jobId: token.jobId,
    jobToken: token.token,
    expiresAt: token.expiresAt,
    profile,
    sourceBytes,
    usdzSourceStored: false,
    endpoints: {
      prepareUpload: `${basePath}/prepare-upload`,
      complete: `${basePath}/complete`,
      fail: `${basePath}/fail`
    }
  });
}
