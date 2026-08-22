import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  buildDishPhotoPublicPath,
  buildDishPhotoV2StoragePath,
  DISH_PHOTO_RECIPE,
  clearDishPhotoMetadata,
  buildDishPhotoDerivativeV2StoragePath,
  mergeDishPhotoMetadata,
  inspectDishPhotoFile,
  type DishPhotoDerivativeMetadata,
  type DishPhotoDerivativeVariant
} from "@/lib/owner/dishPhotoUpload";
import { generateDishPhotoDerivatives } from "@/lib/owner/dishPhotoDerivatives";
import {
  MediaCapacityError,
  MediaCapacityWorkError,
  mediaWritesEnabled,
  withMediaCapacityReservation
} from "@/lib/owner/mediaCapacity";
import {
  potentiallyCreatedMediaObjectBytes,
  rollbackPotentiallyCreatedMediaObjects,
  type PotentiallyCreatedMediaObject
} from "@/lib/owner/mediaRollback";
import { inspectImmutableStorageObject } from "@/lib/owner/mediaObjectIntegrity";
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
    skippedConcurrentReuseRisk: [],
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
  const expectedProjectRef = process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF
    ?.trim()
    .toLowerCase();
  if (!mediaWritesEnabled() || !expectedProjectRef) {
    return NextResponse.json(
      { ok: false, error: "Ecritures media desactivees ou projet Supabase non configure." },
      { status: 503 }
    );
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
  const validated = await inspectDishPhotoFile(
    // inspectDishPhotoFile performs the synchronous validateDishPhotoFile
    // magic-byte/MIME checks before bounded Sharp inspection.
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
    dishId,
    dishSlug: typeof dish.slug === "string" ? dish.slug : undefined
  });
  const oldMetadata = getMetadata(dish.metadata);
  const previouslyReferencedPhotoPaths = getPreviouslyReferencedPhotoPaths(oldMetadata);

  let storagePath: string;
  let imageUrl: string;
  try {
    storagePath = buildDishPhotoV2StoragePath({ restaurantId, extension: validated.extension, sha256: validated.sha256 });
    imageUrl = buildDishPhotoPublicPath(dishId, {
      assetVersion: validated.sha256
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Identifiants photo invalides." },
      { status: 400 }
    );
  }

  let generatedDerivatives: Awaited<ReturnType<typeof generateDishPhotoDerivatives>>;
  try {
    generatedDerivatives = await generateDishPhotoDerivatives(
      validated.bytes,
      validated.sha256
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Derives photo impossibles a generer." },
      { status: 503 }
    );
  }
  const derivativeMetadata: Partial<
    Record<DishPhotoDerivativeVariant, DishPhotoDerivativeMetadata>
  > = {};
  const uploadCandidates: Array<{
    path: string;
    bytes: Buffer;
    contentType: string;
    sha256: string;
  }> = [{
    path: storagePath,
    bytes: validated.bytes,
    contentType: validated.contentType,
    sha256: validated.sha256
  }];
  for (const variant of ["thumbnail", "card", "display"] as const) {
    const generated = generatedDerivatives[variant];
    if (!generated) {
      return NextResponse.json(
        { ok: false, error: `Derive ${variant} manquante.` },
        { status: 503 }
      );
    }
    let derivativePath: string;
    try {
      derivativePath = buildDishPhotoDerivativeV2StoragePath({
        restaurantId,
        sourceSha256: validated.sha256,
        recipeId: generated.metadata.recipeId,
        variant,
        outputSha256: generated.metadata.outputSha256
      });
    } catch {
      return NextResponse.json(
        { ok: false, error: `Chemin du derive ${variant} invalide.` },
        { status: 503 }
      );
    }
    derivativeMetadata[variant] = {
      ...generated.metadata,
      storagePath: derivativePath
    };
    uploadCandidates.push({
      path: derivativePath,
      bytes: generated.bytes,
      contentType: "image/webp",
      sha256: generated.metadata.outputSha256
    });
  }
  const bucket = admin.client.storage.from(MEDIA_BUCKET);
  const candidatesToUpload: typeof uploadCandidates = [];
  try {
    for (const candidate of uploadCandidates) {
      const integrity = await inspectImmutableStorageObject({
        bucket,
        path: candidate.path,
        expectedBytes: candidate.bytes.byteLength,
        expectedSha256: candidate.sha256,
        expectedContentType: candidate.contentType,
        maxBytes: HARD_PHOTO_MAX_BYTES,
        timeoutMs: 10_000
      });
      if (integrity.state === "missing") candidatesToUpload.push(candidate);
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Verification Storage immutable impossible." },
      { status: 503 }
    );
  }

  const requestedBytes = candidatesToUpload.reduce(
    (total, candidate) => total + candidate.bytes.byteLength,
    0
  );
  const reservationKey = `dish-photo:${restaurantId}:${dishId}:${validated.sha256}`;
  try {
    return await withMediaCapacityReservation({
      client: admin.client,
      projectRef: expectedProjectRef,
      reservationKey,
      operationId: randomUUID(),
      restaurantId,
      dishId,
      recipeId: DISH_PHOTO_RECIPE.id,
      requestedBytes,
      work: async () => {
        const potentiallyCreatedObjects: PotentiallyCreatedMediaObject[] = [];
        try {
          for (const candidate of candidatesToUpload) {
            const potentiallyCreated: PotentiallyCreatedMediaObject = {
              path: candidate.path,
              bytes: candidate.bytes.byteLength,
              creation: "ambiguous"
            };
            potentiallyCreatedObjects.push(potentiallyCreated);
            const uploaded = await bucket.upload(candidate.path, candidate.bytes, {
              contentType: candidate.contentType,
              cacheControl: "31536000",
              upsert: false
            });
            if (uploaded.error) {
              const raced = await inspectImmutableStorageObject({
                bucket,
                path: candidate.path,
                expectedBytes: candidate.bytes.byteLength,
                expectedSha256: candidate.sha256,
                expectedContentType: candidate.contentType,
                maxBytes: HARD_PHOTO_MAX_BYTES,
                timeoutMs: 10_000
              });
              if (raced.state === "missing") {
                potentiallyCreatedObjects.pop();
                throw new Error("Upload Supabase Storage impossible.");
              }
              continue;
            }
            // A successful immutable upload can already be reused by another
            // instance before that instance commits its metadata. Keep the
            // attempt ambiguous so rollback never deletes a shared path.
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
            throw new Error("Photo uploadee mais plat impossible a mettre a jour.");
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
            (error) =>
              `Storage ${error.bucket || "metadata"} cleanup partiel: ${error.message}`
          );
          return {
            newlyCreatedBytes: potentiallyCreatedMediaObjectBytes(
              potentiallyCreatedObjects
            ),
            value: NextResponse.json({
              ok: true,
              imageUrl,
              storagePath,
              dishUpdated: true,
              deletedCount: replacementCleanup.deleted.length,
              skippedCount:
                replacementCleanup.skippedStillReferenced.length +
                replacementCleanup.skippedConcurrentReuseRisk.length +
                replacementCleanup.skippedUnsafeBucket.length +
                replacementCleanup.skippedUnsafePrefix.length +
                replacementCleanup.skippedMissingPath.length,
              cleanup: replacementCleanup,
              warning: cleanupWarnings[0],
              warnings: cleanupWarnings,
              derivatives: derivativeMetadata
            })
          };
        } catch (error) {
          const otherReferencedPhotoPaths = await getOtherReferencedPhotoPaths({
            client: admin.client,
            restaurantId,
            dishId
          });
          const referencedPaths = otherReferencedPhotoPaths
            ? new Set([...previouslyReferencedPhotoPaths, ...otherReferencedPhotoPaths])
            : null;
          const rollback = await rollbackPotentiallyCreatedMediaObjects({
            bucket,
            potentiallyCreated: potentiallyCreatedObjects,
            referencedPaths
          });
          throw new MediaCapacityWorkError(
            error instanceof Error ? error.message : "Upload Supabase Storage impossible.",
            rollback.retainedBytes
          );
        }
      }
    });
  } catch (error) {
    const status = error instanceof MediaCapacityError ? error.status : 503;
    const message = error instanceof Error
      ? error.message
      : "Upload Supabase Storage impossible.";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
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
  const expectedProjectRef = process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF
    ?.trim()
    .toLowerCase();
  if (!mediaWritesEnabled() || !expectedProjectRef) {
    return NextResponse.json(
      { ok: false, error: "Ecritures media desactivees ou projet Supabase non configure." },
      { status: 503 }
    );
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
    dishId,
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
    cleanup.skippedConcurrentReuseRisk.length +
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
