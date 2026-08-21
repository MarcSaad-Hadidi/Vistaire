import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  cleanDishModelMetadata,
  cleanTargetedDishModelMetadata,
  collectDishModelStorageTargets,
  collectTargetedDishModelDeletion,
  DISH_MODEL_MISSING_STATUS,
  groupTargetsByBucket,
  hasDishModelMetadata,
  type DishModelDeleteTarget
} from "@/lib/owner/deleteDishModelAssets";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";
import {
  invalidateCommittedPublicMutation,
  resolvePublicMutationIdentity
} from "@/lib/owner/menuMutationRevalidation";
import {
  isCanonicalUuid,
  normalizeStorageSafeIdentifier
} from "@/lib/owner/storageSafeIdentifier";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DishRow = {
  id: string;
  restaurant_id: string;
  slug?: string | null;
  name?: string | null;
  metadata: unknown;
  has_immersive_view?: boolean | null;
};

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string; dishId: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const routeParams = await params;
  const restaurantId = normalizeStorageSafeIdentifier(routeParams.restaurantId);
  const dishId = routeParams.dishId;
  if (!restaurantId || !isCanonicalUuid(dishId)) {
    return NextResponse.json(
      { ok: false, error: "Identifiants modele invalides." },
      { status: 400 }
    );
  }
  const capability = await requireOwnerRestaurantCapability(restaurantId, "canManageMedia");
  if (!capability.ok) {
    return NextResponse.json({ ok: false, error: capability.error }, { status: capability.status });
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

  const publicIdentity = await resolvePublicMutationIdentity({
    client: admin.client,
    restaurantId,
    dishSlug: dish.slug || dish.name || dishId
  });

  const requestedTarget = request.nextUrl.searchParams.get("target") ?? "all";
  const validTargets: DishModelDeleteTarget[] = ["all", "viewer-glb", "usdz-runtime", "report"];
  const target = (validTargets as string[]).includes(requestedTarget)
    ? (requestedTarget as DishModelDeleteTarget)
    : "all";

  const isFullDelete = target === "all";
  const collectedAll = collectDishModelStorageTargets(dish.metadata, restaurantId);
  const scoped = collectTargetedDishModelDeletion(dish.metadata, restaurantId, target);

  const modelDeleted =
    scoped.targets.length > 0 ||
    (isFullDelete &&
      (collectedAll.skipped.length > 0 ||
        Boolean(dish.has_immersive_view) ||
        hasDishModelMetadata(dish.metadata)));

  let attemptedCount = 0;
  let deletedCount = 0;

  const cleanedMetadata = isFullDelete
    ? cleanDishModelMetadata(dish.metadata)
    : cleanTargetedDishModelMetadata(dish.metadata, scoped.clearKeys);

  const nextModelStatus =
    typeof cleanedMetadata.modelStatus === "string"
      ? cleanedMetadata.modelStatus
      : DISH_MODEL_MISSING_STATUS;
  const stillImmersive = nextModelStatus !== DISH_MODEL_MISSING_STATUS;

  const updated = await admin.client
    .from("menu_dishes")
    .update({
      has_immersive_view: isFullDelete ? false : stillImmersive,
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

  await invalidateCommittedPublicMutation(publicIdentity);

  try {
    for (const [bucket, paths] of groupTargetsByBucket(scoped.targets)) {
      attemptedCount += paths.length;
      const removal = await admin.client.storage.from(bucket).remove(paths);
      if (removal.error) {
        throw new Error("storage_cleanup_failed");
      }
      deletedCount += Array.isArray(removal.data) ? removal.data.length : paths.length;
    }
  } catch {
    await invalidateCommittedPublicMutation(publicIdentity);
    return NextResponse.json(
      {
        ok: false,
        error: "Modele retire du menu, mais nettoyage Storage incomplet.",
        committed: true,
        target,
        modelDeleted,
        dishUpdated: true,
        attemptedCount,
        deletedCount,
        skippedCount: collectedAll.skipped.length,
        modelStatus: nextModelStatus
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    target,
    modelDeleted,
    dishUpdated: true,
    attemptedCount,
    deletedCount,
    skippedCount: collectedAll.skipped.length,
    modelStatus: nextModelStatus
  });
}
