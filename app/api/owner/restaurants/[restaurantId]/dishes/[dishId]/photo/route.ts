import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  buildDishPhotoPublicPath,
  buildDishPhotoStoragePath,
  clearDishPhotoMetadata,
  mergeDishPhotoMetadata,
  validateDishPhotoFile
} from "@/lib/owner/dishPhotoUpload";
import {
  collectDishPhotoStorageTarget,
  deleteDishMediaStorageTargets
} from "@/lib/owner/dishMediaGarbageCollector";
import { cleanupReplacedDishAssets } from "@/lib/owner/dishAssetReplacementCleanup";
import { revalidateOwnerMenuMutationPaths } from "@/lib/owner/menuMutationRevalidation";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_BUCKET = "vistaire-media";
const DEFAULT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const HARD_PHOTO_MAX_BYTES = 25 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 512 * 1024;

function photoMaxBytes(): number {
  const parsed = Number(process.env.VISTAIRE_DISH_PHOTO_MAX_BYTES);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > HARD_PHOTO_MAX_BYTES) {
    return DEFAULT_PHOTO_MAX_BYTES;
  }
  return parsed;
}

function getMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  const maxBytes = photoMaxBytes();
  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength ? Number(rawContentLength) : 0;
  if (!rawContentLength || !Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json({ ok: false, error: "Taille upload requise." }, { status: 411 });
  }
  if (contentLength > maxBytes + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ ok: false, error: "Photo trop volumineuse." }, { status: 413 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.reason }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Formulaire invalide." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Photo requise." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const validated = validateDishPhotoFile(
    {
      name: file.name,
      type: file.type,
      size: file.size,
      bytes
    },
    maxBytes
  );
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error },
      { status: validated.status }
    );
  }

  const { data: dish, error: dishError } = await admin.client
    .from("menu_dishes")
    .select("id,restaurant_id,slug,name,metadata")
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

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
  const oldMetadata = getMetadata(dish.metadata);

  let storagePath: string;
  let imageUrl: string;
  try {
    storagePath = buildDishPhotoStoragePath({
      restaurantId,
      dishId,
      dishSlug: typeof dish.slug === "string" && dish.slug ? dish.slug : String(dish.name ?? ""),
      extension: validated.extension,
      sha256: validated.sha256
    });
    imageUrl = buildDishPhotoPublicPath(dishId, {
      assetVersion: validated.sha256
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Identifiants photo invalides." },
      { status: 400 }
    );
  }

  const uploaded = await admin.client.storage.from(MEDIA_BUCKET).upload(
    storagePath,
    validated.bytes,
    {
      contentType: validated.contentType,
      cacheControl: "31536000",
      upsert: true
    }
  );
  if (uploaded.error) {
    return NextResponse.json(
      { ok: false, error: "Upload Supabase Storage impossible." },
      { status: 503 }
    );
  }

  const metadata = mergeDishPhotoMetadata(oldMetadata, {
    storageBucket: MEDIA_BUCKET,
    storagePath,
    sha256: validated.sha256,
    contentType: validated.contentType,
    bytes: validated.bytes.byteLength
  });
  const updated = await admin.client
    .from("menu_dishes")
    .update({ image_url: imageUrl, metadata })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();

  if (updated.error || !updated.data) {
    await admin.client.storage.from(MEDIA_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { ok: false, error: "Photo uploadee mais plat impossible a mettre a jour." },
      { status: 503 }
    );
  }

  const replacementCleanup = await cleanupReplacedDishAssets({
    client: admin.client,
    dishId,
    restaurantId,
    previousMetadata: oldMetadata,
    nextMetadata: metadata,
    reason: "dish-photo-replacement"
  });
  const cleanupWarnings = replacementCleanup.errors.map(
    (error) => `Storage ${error.bucket || "metadata"} cleanup partiel: ${error.message}`
  );

  await revalidateOwnerMenuMutationPaths({
    client: admin.client,
    restaurantId,
    dishSlug: typeof dish.slug === "string" ? dish.slug : undefined
  });

  return NextResponse.json({
    ok: true,
    imageUrl,
    storagePath,
    dishUpdated: true,
    deletedCount: replacementCleanup.deleted.length,
    skippedCount:
      replacementCleanup.skippedStillReferenced.length +
      replacementCleanup.skippedUnsafeBucket.length +
      replacementCleanup.skippedUnsafePrefix.length +
      replacementCleanup.skippedMissingPath.length,
    cleanup: replacementCleanup,
    warning: cleanupWarnings[0],
    warnings: cleanupWarnings
  });
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
  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.reason }, { status: 503 });
  }

  const { data: dish, error: dishError } = await admin.client
    .from("menu_dishes")
    .select("id,restaurant_id,slug,name,metadata")
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

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

  const cleanup = await deleteDishMediaStorageTargets(
    admin.client,
    collectDishPhotoStorageTarget(dish.metadata, restaurantId)
  );
  const failedValidDelete =
    cleanup.deleted.length === 0 &&
    cleanup.skipped.length === 0 &&
    cleanup.warnings.some((warning) => warning.includes("non supprime"));
  if (failedValidDelete) {
    return NextResponse.json(
      {
        ok: false,
        error: "Suppression Storage impossible pour cette photo.",
        skippedCount: cleanup.skipped.length,
        warnings: cleanup.warnings
      },
      { status: 503 }
    );
  }

  const updated = await admin.client
    .from("menu_dishes")
    .update({
      image_url: null,
      metadata: clearDishPhotoMetadata(getMetadata(dish.metadata))
    })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();

  if (updated.error || !updated.data) {
    return NextResponse.json(
      { ok: false, error: "Photo supprimee mais plat impossible a nettoyer." },
      { status: 503 }
    );
  }

  await revalidateOwnerMenuMutationPaths({
    client: admin.client,
    restaurantId,
    dishSlug: typeof dish.slug === "string" ? dish.slug : undefined
  });

  return NextResponse.json({
    ok: true,
    imageUrl: null,
    dishUpdated: true,
    deletedCount: cleanup.deleted.length,
    skippedCount: cleanup.skipped.length,
    warnings: cleanup.warnings
  });
}
