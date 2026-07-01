import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  cleanDishModelMetadata,
  collectDishModelStorageTargets,
  DISH_MODEL_MISSING_STATUS,
  groupTargetsByBucket,
  hasDishModelMetadata
} from "@/lib/owner/deleteDishModelAssets";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DishRow = {
  id: string;
  restaurant_id: string;
  slug?: string | null;
  name?: string | null;
  metadata: unknown;
  has_immersive_view?: boolean | null;
};

function validUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function getString(row: Record<string, unknown> | null | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function revalidatePublicDishModelPaths(restaurantSlug: string, dishSlug: string): void {
  if (!restaurantSlug) return;
  revalidatePath(`/menu/${restaurantSlug}`);
  if (dishSlug) revalidatePath(`/menu/${restaurantSlug}/dishes/${dishSlug}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const { restaurantId, dishId } = await params;
  if (!validUuid(restaurantId) || !validUuid(dishId)) {
    return NextResponse.json(
      { ok: false, error: "Identifiants modele invalides." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.reason }, { status: 503 });
  }

  const { data: dish, error: dishError } = await admin.client
    .from("menu_dishes")
    .select("id,restaurant_id,slug,name,metadata,has_immersive_view")
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle<DishRow>();

  if (dishError) {
    return NextResponse.json(
      { ok: false, error: "Plat impossible a verifier." },
      { status: 503 }
    );
  }
  if (!dish) {
    return NextResponse.json(
      { ok: false, error: "Plat introuvable pour ce restaurant." },
      { status: 404 }
    );
  }

  const restaurant = await admin.client
    .from("restaurants")
    .select("slug")
    .eq("id", restaurantId)
    .maybeSingle();
  const restaurantSlug = slugifyRestaurantSlug(getString(restaurant.data, "slug") || restaurantId);
  const dishSlug = slugifyRestaurantSlug(dish.slug || dish.name || dishId);

  const collected = collectDishModelStorageTargets(dish.metadata, restaurantId);
  const modelDeleted =
    collected.targets.length > 0 ||
    collected.skipped.length > 0 ||
    Boolean(dish.has_immersive_view) ||
    hasDishModelMetadata(dish.metadata);

  let attemptedCount = 0;
  let deletedCount = 0;

  for (const [bucket, paths] of groupTargetsByBucket(collected.targets)) {
    attemptedCount += paths.length;
    const removal = await admin.client.storage.from(bucket).remove(paths);
    if (removal.error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Suppression Storage impossible pour ce modele.",
          deletedCount,
          skippedCount: collected.skipped.length,
          modelStatus: DISH_MODEL_MISSING_STATUS
        },
        { status: 503 }
      );
    }
    deletedCount += Array.isArray(removal.data) ? removal.data.length : paths.length;
  }

  const cleanedMetadata = cleanDishModelMetadata(dish.metadata);
  const updated = await admin.client
    .from("menu_dishes")
    .update({
      has_immersive_view: false,
      metadata: cleanedMetadata
    })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();

  if (updated.error || !updated.data) {
    return NextResponse.json(
      { ok: false, error: "Modele supprime mais plat impossible a nettoyer." },
      { status: 503 }
    );
  }

  revalidatePublicDishModelPaths(restaurantSlug, dishSlug);

  return NextResponse.json({
    ok: true,
    modelDeleted,
    dishUpdated: true,
    attemptedCount,
    deletedCount,
    skippedCount: collected.skipped.length,
    modelStatus: DISH_MODEL_MISSING_STATUS
  });
}
