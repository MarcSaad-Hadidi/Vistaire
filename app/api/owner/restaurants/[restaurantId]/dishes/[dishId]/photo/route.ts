import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  buildDishPhotoPublicPath,
  buildDishPhotoStoragePath,
  clearDishPhotoMetadata,
  buildDishPhotoDerivativeStoragePath,
  mergeDishPhotoMetadata,
  validateDishPhotoFile
} from "@/lib/owner/dishPhotoUpload";
import { generateDishPhotoDerivatives } from "@/lib/owner/dishPhotoDerivatives";
import {
  cleanupReplacedDishAssets,
  type CleanupReplacedDishAssetsReport
} from "@/lib/owner/dishAssetReplacementCleanup";
import {
  invalidateCommittedPublicMutation,
  resolvePublicMutationIdentity,
  type PublicMutationIdentity
} from "@/lib/owner/menuMutationRevalidation";
import { requireOwnerRestaurantCapability } from "@/lib/owner/demoCapabilities";
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

function deferredCleanupReport(): CleanupReplacedDishAssetsReport {
  return {
    candidates: [],
    deleted: [],
    skippedStillReferenced: [],
    skippedUnsafeBucket: [],
    skippedUnsafePrefix: [],
    skippedMissingPath: [],
    errors: [
      {
        bucket: "",
        paths: [],
        message: "Nettoyage differe apres mise a jour publique."
      }
    ]
  };
}

async function committedPhotoCleanup(args: {
  identity: PublicMutationIdentity | null;
  cleanup: () => Promise<CleanupReplacedDishAssetsReport>;
}): Promise<CleanupReplacedDishAssetsReport> {
  await invalidateCommittedPublicMutation(args.identity);
  try {
    return await args.cleanup();
  } catch {
    await invalidateCommittedPublicMutation(args.identity);
    return deferredCleanupReport();
  }
}

function getPreviouslyReferencedPhotoPaths(
  metadata: Record<string, unknown>
): Set<string> {
  const paths = new Set<string>();
  if (typeof metadata.photoStoragePath === "string" && metadata.photoStoragePath.trim()) {
    paths.add(metadata.photoStoragePath.trim());
  }
  const derivatives = metadata.photoDerivatives;
  if (derivatives && typeof derivatives === "object" && !Array.isArray(derivatives)) {
    for (const value of Object.values(derivatives as Record<string, unknown>)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const path = (value as Record<string, unknown>).storagePath;
        if (typeof path === "string" && path.trim()) paths.add(path.trim());
      }
    }
  }
  return paths;
}

async function getOtherReferencedPhotoPaths(args: {
  client: SupabaseClient;
  restaurantId: string;
  dishId: string;
}): Promise<Set<string> | null> {
  // This query is used only after a failed metadata update. Derivative paths
  // are content-addressed and may be shared by another dish, so rollback must
  // fail safe rather than deleting an object whose active reference is unknown.
  try {
    const { data, error } = await args.client
      .from("menu_dishes")
      .select("id,metadata")
      .eq("restaurant_id", args.restaurantId)
      .neq("id", args.dishId);
    if (error || !Array.isArray(data)) return null;
    const paths = new Set<string>();
    for (const row of data as Array<{ metadata?: unknown }>) {
      for (const path of getPreviouslyReferencedPhotoPaths(getMetadata(row.metadata))) {
        paths.add(path);
      }
    }
    return paths;
  } catch {
    return null;
  }
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
  const publicIdentity = await resolvePublicMutationIdentity({
    client: admin.client,
    restaurantId,
    dishSlug: typeof dish.slug === "string" ? dish.slug : undefined
  });
  const oldMetadata = getMetadata(dish.metadata);
  const previouslyReferencedPhotoPaths = getPreviouslyReferencedPhotoPaths(oldMetadata);

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

  const uploadedStoragePaths: string[] = [];
  const derivativeWarnings: string[] = [];
  let generatedDerivatives: Awaited<ReturnType<typeof generateDishPhotoDerivatives>> = {};
  try {
    generatedDerivatives = await generateDishPhotoDerivatives(
      validated.bytes,
      validated.sha256
    );
  } catch {
    derivativeWarnings.push(
      "Derives photo non generes; la photo originale reste disponible."
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
  uploadedStoragePaths.push(storagePath);

  const derivativeMetadata: Record<string, {
    storagePath: string;
    sha256: string;
    contentType: "image/webp";
    bytes: number;
    sourceSha256: string;
  }> = {};
  for (const variant of ["thumbnail", "display"] as const) {
    const generated = generatedDerivatives[variant];
    if (!generated) continue;
    let derivativePath: string;
    try {
      derivativePath = buildDishPhotoDerivativeStoragePath({
        restaurantId,
        sha256: validated.sha256,
        variant
      });
    } catch {
      derivativeWarnings.push(`Derive ${variant} ignore: chemin invalide.`);
      continue;
    }
    const derivativeUpload = await admin.client.storage
      .from(MEDIA_BUCKET)
      .upload(derivativePath, generated.bytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true
      });
    if (derivativeUpload.error) {
      derivativeWarnings.push(`Derive ${variant} non uploadee.`);
      continue;
    }
    uploadedStoragePaths.push(derivativePath);
    derivativeMetadata[variant] = {
      ...generated.metadata,
      storagePath: derivativePath
    };
  }

  const metadata = mergeDishPhotoMetadata(oldMetadata, {
    storageBucket: MEDIA_BUCKET,
    storagePath,
    sha256: validated.sha256,
    contentType: validated.contentType,
    bytes: validated.bytes.byteLength,
    derivatives: derivativeMetadata
  });
  const updated = await admin.client
    .from("menu_dishes")
    .update({ image_url: imageUrl, metadata })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();

  if (updated.error || !updated.data) {
    const otherReferencedPhotoPaths = await getOtherReferencedPhotoPaths({
      client: admin.client,
      restaurantId,
      dishId
    });
    const rollbackPaths = uploadedStoragePaths.filter((path) => {
      if (previouslyReferencedPhotoPaths.has(path)) return false;
      // If the cross-dish reference check failed, preserve every uploaded
      // object. Deleting an uncertain shared derivative is worse than leaving
      // a deterministic object available for a later retry/GC pass.
      return otherReferencedPhotoPaths ? !otherReferencedPhotoPaths.has(path) : false;
    });
    if (rollbackPaths.length) {
      await admin.client.storage.from(MEDIA_BUCKET).remove(rollbackPaths);
    }
    return NextResponse.json(
      { ok: false, error: "Photo uploadee mais plat impossible a mettre a jour." },
      { status: 503 }
    );
  }

  const replacementCleanup = await committedPhotoCleanup({
    identity: publicIdentity,
    cleanup: () =>
      cleanupReplacedDishAssets({
        client: admin.client,
        dishId,
        restaurantId,
        previousMetadata: oldMetadata,
        nextMetadata: metadata,
        reason: "dish-photo-replacement"
      })
  });
  const cleanupWarnings = replacementCleanup.errors.map(
    (error) => `Storage ${error.bucket || "metadata"} cleanup partiel: ${error.message}`
  );

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
    warning: [...derivativeWarnings, ...cleanupWarnings][0],
    warnings: [...derivativeWarnings, ...cleanupWarnings],
    derivatives: derivativeMetadata
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

  const publicIdentity = await resolvePublicMutationIdentity({
    client: admin.client,
    restaurantId,
    dishSlug: typeof dish.slug === "string" ? dish.slug : undefined
  });

  const oldMetadata = getMetadata(dish.metadata);
  const clearedMetadata = clearDishPhotoMetadata(oldMetadata);
  const updated = await admin.client
    .from("menu_dishes")
    .update({
      image_url: null,
      metadata: clearedMetadata
    })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();

  if (updated.error || !updated.data) {
    return NextResponse.json(
      { ok: false, error: "Photo impossible a supprimer du plat." },
      { status: 503 }
    );
  }

  // The DB is now authoritative: the dish no longer references the photo.
  // Cleanup re-reads this row and every other dish in the restaurant before
  // removing any object, preserving shared content-addressed derivatives and
  // leaving safe orphans when the cross-reference lookup is uncertain.
  const cleanup = await committedPhotoCleanup({
    identity: publicIdentity,
    cleanup: () =>
      cleanupReplacedDishAssets({
        client: admin.client,
        dishId,
        restaurantId,
        previousMetadata: oldMetadata,
        nextMetadata: clearedMetadata,
        reason: "dish-photo-delete"
      })
  });
  const cleanupWarnings = cleanup.errors.map(
    (error) => `Storage ${error.bucket || "metadata"} cleanup partiel: ${error.message}`
  );
  const skippedCount =
    cleanup.skippedStillReferenced.length +
    cleanup.skippedUnsafeBucket.length +
    cleanup.skippedUnsafePrefix.length +
    cleanup.skippedMissingPath.length;

  return NextResponse.json({
    ok: true,
    imageUrl: null,
    dishUpdated: true,
    deletedCount: cleanup.deleted.length,
    skippedCount,
    warnings: cleanupWarnings
  });
}
