import {
  collectDishModelStorageTargets,
  DISH_MODEL_STORAGE_BUCKET,
  getObjectMetadata,
  getStringMetadata,
  groupTargetsByBucket,
  type DishModelSkippedTarget,
  type DishModelStorageTarget
} from "./deleteDishModelAssets.ts";
import { normalizeStorageSafeIdentifier } from "./storageSafeIdentifier.ts";

export const DISH_PHOTO_STORAGE_BUCKET = "vistaire-media";

type DishPhotoExtension = ".jpg" | ".png" | ".webp";

export type DishMediaStorageTarget =
  | (DishModelStorageTarget & { bucket: typeof DISH_MODEL_STORAGE_BUCKET })
  | {
      bucket: typeof DISH_PHOTO_STORAGE_BUCKET;
      path: string;
      kind: "photo";
      metadataPathKey: "photoStoragePath";
    };

export type DishMediaSkippedTarget =
  | DishModelSkippedTarget
  | {
      bucket: string;
      path: string;
      kind: "photo";
      metadataPathKey: "photoStoragePath";
      reason: "empty" | "unsafe_bucket" | "unsafe_path" | "duplicate";
    };

export type DishMediaStorageCollection = {
  targets: DishMediaStorageTarget[];
  skipped: DishMediaSkippedTarget[];
  warnings: string[];
};

export type DishMediaDeleteReport = {
  deleted: DishMediaStorageTarget[];
  skipped: DishMediaSkippedTarget[];
  warnings: string[];
};

type StorageClient = {
  storage?: {
    from(bucket: string): {
      remove(paths: string[]): PromiseLike<{
        data: unknown[] | null;
        error: { message?: string; details?: string; hint?: string } | null;
      }>;
    };
  };
};

function hasSuspiciousEncoding(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.includes("%");
}

function safePhotoFileName(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*\.(?:jpg|png|webp)$/i.test(value);
}

export function isSafeDishPhotoStoragePath(path: string, restaurantId: string): boolean {
  const storagePath = path.trim();
  const normalizedRestaurantId = normalizeStorageSafeIdentifier(restaurantId);
  if (!normalizedRestaurantId) return false;
  if (!storagePath || storagePath !== path) return false;
  if (
    storagePath.startsWith("/") ||
    storagePath.includes("..") ||
    storagePath.includes("\\") ||
    storagePath.includes("//") ||
    storagePath.includes("?") ||
    storagePath.includes("#") ||
    storagePath.includes(":") ||
    hasSuspiciousEncoding(storagePath)
  ) {
    return false;
  }

  const extension = storagePath.toLowerCase().slice(storagePath.lastIndexOf(".")) as DishPhotoExtension;
  if (![".jpg", ".png", ".webp"].includes(extension)) return false;

  const segments = storagePath.split("/");
  return (
    segments.length === 5 &&
    segments[0] === "restaurants" &&
    segments[1] === normalizedRestaurantId &&
    segments[2] === "photos" &&
    segments[3] === "originals" &&
    safePhotoFileName(segments[4])
  );
}

export function collectDishPhotoStorageTarget(
  metadataValue: unknown,
  restaurantId: string
): DishMediaStorageCollection {
  const metadata = getObjectMetadata(metadataValue);
  const path = getStringMetadata(metadata, "photoStoragePath");
  if (!path) return { targets: [], skipped: [], warnings: [] };

  const bucket = getStringMetadata(metadata, "photoStorageBucket") || DISH_PHOTO_STORAGE_BUCKET;
  if (bucket !== DISH_PHOTO_STORAGE_BUCKET) {
    return {
      targets: [],
      skipped: [{ bucket, path, kind: "photo", metadataPathKey: "photoStoragePath", reason: "unsafe_bucket" }],
      warnings: [`Photo Storage bucket ignored: ${bucket}.`]
    };
  }
  if (!isSafeDishPhotoStoragePath(path, restaurantId)) {
    return {
      targets: [],
      skipped: [{ bucket, path, kind: "photo", metadataPathKey: "photoStoragePath", reason: "unsafe_path" }],
      warnings: [`Photo Storage path ignored: ${path}.`]
    };
  }

  return {
    targets: [{ bucket: DISH_PHOTO_STORAGE_BUCKET, path, kind: "photo", metadataPathKey: "photoStoragePath" }],
    skipped: [],
    warnings: []
  };
}

export function collectDishMediaStorageTargets(
  metadataValue: unknown,
  restaurantId: string
): DishMediaStorageCollection {
  const photo = collectDishPhotoStorageTarget(metadataValue, restaurantId);
  const models = collectDishModelStorageTargets(metadataValue, restaurantId);
  const targets: DishMediaStorageTarget[] = [];
  const skipped: DishMediaSkippedTarget[] = [...photo.skipped, ...models.skipped];
  const warnings = [...photo.warnings];
  const seen = new Set<string>();

  for (const target of [...photo.targets, ...models.targets]) {
    const identity = `${target.bucket}:${target.path}`;
    if (seen.has(identity)) {
      skipped.push({ ...target, reason: "duplicate" });
      continue;
    }
    seen.add(identity);
    targets.push(target);
  }

  return { targets, skipped, warnings };
}

export async function deleteDishMediaStorageTargets(
  client: StorageClient,
  collection: DishMediaStorageCollection
): Promise<DishMediaDeleteReport> {
  const report: DishMediaDeleteReport = {
    deleted: [],
    skipped: [...collection.skipped],
    warnings: [...collection.warnings]
  };
  if (collection.targets.length === 0) return report;
  if (!client.storage) {
    report.warnings.push("Supabase Storage indisponible; medias du plat non supprimes.");
    return report;
  }

  const modelGroups = groupTargetsByBucket(
    collection.targets.filter(
      (target): target is DishModelStorageTarget => target.bucket === DISH_MODEL_STORAGE_BUCKET
    )
  );
  const groups = new Map<string, string[]>();
  for (const [bucket, paths] of modelGroups) groups.set(bucket, paths);
  const photoPaths = collection.targets
    .filter((target) => target.bucket === DISH_PHOTO_STORAGE_BUCKET)
    .map((target) => target.path);
  if (photoPaths.length > 0) groups.set(DISH_PHOTO_STORAGE_BUCKET, photoPaths);

  for (const [bucket, paths] of groups) {
    const removal = await client.storage.from(bucket).remove(paths);
    if (removal.error) {
      const message = removal.error.message || removal.error.details || removal.error.hint || "erreur inconnue";
      report.warnings.push(`Storage ${bucket} non supprime: ${message}`);
      continue;
    }
    const deletedPaths = new Set(paths);
    report.deleted.push(...collection.targets.filter((target) => target.bucket === bucket && deletedPaths.has(target.path)));
  }

  return report;
}
