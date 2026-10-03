import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import {
  invalidateCommittedPublicMutation,
  resolvePublicMutationIdentity
} from "@/lib/owner/menuMutationRevalidation";
import {
  parseSourceUploadLimit,
  validateSourceGlbFile
} from "@/lib/owner/threeDSourceUploadModel";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

type DishRow = {
  id: string;
  restaurant_id: string;
  menu_id: string | null;
  slug: string | null;
  name: string | null;
  metadata: unknown;
};

function getString(row: Record<string, unknown> | null | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function failure(error: string, status: number) {
  return { ok: false as const, response: NextResponse.json({ ok: false, error }, { status }) };
}

/**
 * Shared front half of the owner GLB upload routes: owner + same-origin + media
 * capability checks, dish lookup scoped to the restaurant, bounded multipart read and
 * GLB validation, then the public identity used to invalidate the menu after commit.
 */
export async function prepareOwnerGlbUpload(
  request: NextRequest,
  params: Promise<{ restaurantId: string; dishId: string }>
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return { ok: false as const, response: owner.response };

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return { ok: false as const, response: originError };

  const { restaurantId, dishId } = await params;
  const capability = await requireOwnerRestaurantCapability(restaurantId, "canManageMedia");
  if (!capability.ok) return failure(capability.error, capability.status);

  const uploadLimit = parseSourceUploadLimit(process.env);
  if (!uploadLimit.ok) return failure("Upload GLB mal configure.", 503);

  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength ? Number(rawContentLength) : 0;
  if (!rawContentLength || !Number.isFinite(contentLength) || contentLength <= 0) {
    return failure("Taille upload requise.", 411);
  }
  if (contentLength > uploadLimit.maxBytes + MULTIPART_OVERHEAD_BYTES) {
    return failure("GLB trop volumineux.", 413);
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) return failure(admin.reason, 503);

  const { data: dish, error: dishError } = await admin.client
    .from("menu_dishes")
    .select("id,restaurant_id,menu_id,slug,name,metadata")
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle<DishRow>();
  if (dishError) return failure("Plat impossible a verifier.", 503);
  if (!dish) return failure("Plat introuvable pour ce restaurant.", 404);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("Formulaire invalide.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return failure("GLB requis.", 400);
  if (file.size > uploadLimit.maxBytes) return failure("GLB trop volumineux.", 413);

  const bytes = Buffer.from(await file.arrayBuffer());
  const validated = validateSourceGlbFile(
    { name: file.name, type: file.type, size: file.size, bytes },
    uploadLimit.maxBytes
  );
  if (!validated.ok) return failure(validated.error, validated.status);

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
  const publicIdentity = await resolvePublicMutationIdentity({
    client: admin.client,
    restaurantId,
    dishId,
    dishSlug
  });

  let publicCommitted = false;
  return {
    ok: true as const,
    /** Arguments shared by runRestaurantMeshyDishPipeline and runViewerGlbUpload. */
    input: {
      adminClient: admin.client,
      owner: { userId: owner.userId, email: owner.emailAddresses[0] ?? null },
      restaurantId,
      restaurantSlug,
      menuSlug,
      dishId,
      dishSlug,
      existingMetadata: dish.metadata,
      sourceBytes: validated.bytes,
      originalName: validated.originalName,
      onPublicCommit: async () => {
        publicCommitted = true;
        await invalidateCommittedPublicMutation(publicIdentity);
      }
    },
    /** After a pipeline error: re-invalidate and report true when the public menu already changed. */
    async settleAfterFailure() {
      if (!publicCommitted) return false;
      await invalidateCommittedPublicMutation(publicIdentity);
      return true;
    }
  };
}
