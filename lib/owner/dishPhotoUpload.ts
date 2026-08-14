import { createHash } from "node:crypto";

import {
  isCanonicalUuid,
  normalizeStorageSafeIdentifier
} from "./storageSafeIdentifier.ts";
import {
  DISH_PHOTO_DERIVATIVE_VARIANTS,
  DISH_PHOTO_RECIPE,
  isDishPhotoDerivativeVariant
} from "./dishPhotoRecipe.ts";

type DishPhotoFile = {
  name: string;
  type: string;
  size: number;
  bytes: ArrayBuffer | ArrayBufferView;
};

type DishPhotoValidationResult =
  | {
      ok: true;
      extension: "jpg" | "png" | "webp";
      contentType: "image/jpeg" | "image/png" | "image/webp";
      bytes: Buffer;
      sha256: string;
    }
  | {
      ok: false;
      status: 400 | 413;
      error: string;
    };

type DishPhotoMetadataInfo = {
  storageBucket: string;
  storagePath: string;
  sha256: string;
  contentType: string;
  bytes: number;
  derivatives?: Partial<Record<DishPhotoDerivativeVariant, DishPhotoDerivativeMetadata>>;
};

export { DISH_PHOTO_DERIVATIVE_VARIANTS, DISH_PHOTO_RECIPE } from "./dishPhotoRecipe.ts";

export type DishPhotoDerivativeVariant =
  import("./dishPhotoRecipe.ts").DishPhotoDerivativeVariant;

export type DishPhotoDerivativeMetadata = {
  schemaVersion: 2;
  recipeId: "dish-photo-v2";
  variant: DishPhotoDerivativeVariant;
  storagePath: string;
  sha256: string;
  outputSha256: string;
  contentType: "image/webp";
  format: "webp";
  width: number;
  height: number;
  bytes: number;
  sourceSha256: string;
  generatedAt: string;
  encoder: string;
};

export function isValidDishPhotoDerivativeMetadata(
  value: unknown,
  expected?: { sourceSha256?: string; variant?: DishPhotoDerivativeVariant }
): value is DishPhotoDerivativeMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  const sourceSha256 = String(metadata.sourceSha256 ?? "").toLowerCase();
  const outputSha256 = String(metadata.outputSha256 ?? metadata.sha256 ?? "").toLowerCase();
  return (
    metadata.schemaVersion === 2 &&
    metadata.recipeId === DISH_PHOTO_RECIPE.id &&
    isDishPhotoDerivativeVariant(metadata.variant) &&
    (!expected?.variant || metadata.variant === expected.variant) &&
    SHA256_PATTERN.test(sourceSha256) &&
    (!expected?.sourceSha256 || sourceSha256 === expected.sourceSha256.toLowerCase()) &&
    SHA256_PATTERN.test(outputSha256) &&
    typeof metadata.storagePath === "string" &&
    metadata.storagePath.length > 0 &&
    metadata.contentType === "image/webp" &&
    metadata.format === "webp" &&
    Number.isInteger(metadata.width) && Number(metadata.width) > 0 &&
    Number.isInteger(metadata.height) && Number(metadata.height) > 0 &&
    Number.isInteger(metadata.bytes) && Number(metadata.bytes) > 0 &&
    typeof metadata.generatedAt === "string" &&
    typeof metadata.encoder === "string" && metadata.encoder.length > 0
  );
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

const MIME_TO_EXTENSION = new Map<
  string,
  { extension: "jpg" | "png" | "webp"; contentType: "image/jpeg" | "image/png" | "image/webp" }
>([
  ["image/jpeg", { extension: "jpg", contentType: "image/jpeg" }],
  ["image/png", { extension: "png", contentType: "image/png" }],
  ["image/webp", { extension: "webp", contentType: "image/webp" }]
]);

function toBuffer(bytes: ArrayBuffer | ArrayBufferView): Buffer {
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function hasMatchingSignature(contentType: string, bytes: Buffer): boolean {
  if (contentType === "image/jpeg") {
    return (
      bytes.byteLength >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (contentType === "image/png") {
    return bytes.byteLength >= 8 && bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }
  if (contentType === "image/webp") {
    return (
      bytes.byteLength >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export type DishPhotoInspection = {
  width: number;
  height: number;
  pages: number;
  channels: number;
  hasAlpha: boolean;
  orientation?: number;
  format: string;
};

/**
 * Cheap synchronous checks used before invoking Sharp. This function remains
 * synchronous for callers that only need MIME/magic-byte validation; uploads
 * must additionally call inspectDishPhotoFile below.
 */

export function validateDishPhotoFile(
  file: DishPhotoFile,
  maxBytes: number
): DishPhotoValidationResult {
  if (/[\\/]/.test(file.name) || file.name.includes("..")) {
    return {
      ok: false,
      status: 400,
      error: "Le nom de fichier photo ne doit pas contenir de chemin."
    };
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, status: 400, error: "Photo vide." };
  }
  if (size > maxBytes) {
    return { ok: false, status: 413, error: "Photo trop volumineuse." };
  }

  const contentType = (file.type || "").split(";")[0].trim().toLowerCase();
  const mime = MIME_TO_EXTENSION.get(contentType);
  if (!mime) {
    return {
      ok: false,
      status: 400,
      error: "Seules les images JPEG, PNG ou WebP sont acceptees."
    };
  }

  const bytes = toBuffer(file.bytes);
  if (bytes.byteLength !== size || bytes.byteLength > maxBytes) {
    return {
      ok: false,
      status: 400,
      error: "La taille de la photo ne correspond pas au fichier envoye."
    };
  }
  if (!hasMatchingSignature(mime.contentType, bytes)) {
    return {
      ok: false,
      status: 400,
      error: "Le contenu du fichier ne correspond pas a une image acceptee."
    };
  }

  return {
    ok: true,
    ...mime,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

/**
 * Strict, bounded image inspection. Sharp is deliberately imported lazily so
 * simple metadata/path helpers do not pull the native codec into edge code.
 */
export async function inspectDishPhotoFile(
  file: DishPhotoFile,
  maxBytes: number
): Promise<DishPhotoValidationResult & { inspection?: DishPhotoInspection }> {
  const validated = validateDishPhotoFile(file, maxBytes);
  if (!validated.ok) return validated;

  const sharpModule = await import("sharp");
  let metadata: Awaited<ReturnType<ReturnType<typeof sharpModule.default>["metadata"]>>;
  try {
    metadata = await sharpModule.default(validated.bytes, {
      failOn: DISH_PHOTO_RECIPE.sharpPolicy.failOn,
      limitInputPixels: DISH_PHOTO_RECIPE.sharpPolicy.limitInputPixels,
      limitInputChannels: DISH_PHOTO_RECIPE.sharpPolicy.limitInputChannels,
      pages: DISH_PHOTO_RECIPE.sharpPolicy.pages
    })
      .timeout({ seconds: DISH_PHOTO_RECIPE.sharpPolicy.timeoutSeconds })
      .metadata();
  } catch {
    return { ok: false, status: 400, error: "Fichier image corrompu ou non supporte." };
  }

  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  const pages = Number(metadata.pages ?? 1);
  const channels = Number(metadata.channels ?? 0);
  const pixels = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return { ok: false, status: 400, error: "Dimensions photo invalides." };
  }
  if (width > DISH_PHOTO_RECIPE.sharpPolicy.maxWidth || height > DISH_PHOTO_RECIPE.sharpPolicy.maxHeight || pixels > DISH_PHOTO_RECIPE.sharpPolicy.limitInputPixels) {
    return { ok: false, status: 413, error: "Dimensions photo trop importantes." };
  }
  if (pages !== 1) {
    return { ok: false, status: 400, error: "Les photos animees ne sont pas acceptees." };
  }
  if (!Number.isInteger(channels) || channels < 1 || channels > DISH_PHOTO_RECIPE.sharpPolicy.limitInputChannels) {
    return { ok: false, status: 400, error: "Canaux image invalides." };
  }
  if (metadata.format !== validated.extension.replace("jpg", "jpeg")) {
    return { ok: false, status: 400, error: "Le format reel de la photo ne correspond pas au MIME." };
  }
  return {
    ...validated,
    inspection: {
      width,
      height,
      pages,
      channels,
      hasAlpha: metadata.hasAlpha === true,
      orientation: metadata.orientation,
      format: metadata.format
    }
  };
}

export function buildDishPhotoStoragePath(args: {
  restaurantId: string;
  dishId: string;
  dishSlug: string;
  extension: "jpg" | "png" | "webp";
  sha256: string;
}): string {
  const restaurantId = normalizeStorageSafeIdentifier(args.restaurantId);
  if (
    !restaurantId ||
    !isCanonicalUuid(args.dishId) ||
    !SHA256_PATTERN.test(args.sha256)
  ) {
    throw new Error("Identifiants photo invalides.");
  }
  const slug = slugify(args.dishSlug) || args.dishId.toLowerCase();
  return [
    "restaurants",
    restaurantId,
    "photos",
    "originals",
    `${slug}-${args.sha256.toLowerCase().slice(0, 12)}.${args.extension}`
  ].join("/");
}

/** V2 source path: the filename is content-addressed and never overwritten. */
export function buildDishPhotoV2StoragePath(args: {
  restaurantId: string;
  sha256: string;
  extension: "jpg" | "png" | "webp";
}): string {
  const restaurantId = normalizeStorageSafeIdentifier(args.restaurantId);
  if (!restaurantId || !SHA256_PATTERN.test(args.sha256)) {
    throw new Error("Identifiants photo invalides.");
  }
  return `restaurants/${restaurantId}/photos/originals/${args.sha256.toLowerCase()}.${args.extension}`;
}

/**
 * Derivatives are immutable, content-addressed siblings of the original.
 * Keeping the source hash in the path makes retries idempotent and lets two
 * dishes that intentionally share the same source safely share bytes.
 */
export function buildDishPhotoDerivativeStoragePath(args: {
  restaurantId: string;
  sha256: string;
  variant: DishPhotoDerivativeVariant;
}): string {
  const restaurantId = normalizeStorageSafeIdentifier(args.restaurantId);
  if (!restaurantId || !SHA256_PATTERN.test(args.sha256)) {
    throw new Error("Identifiants photo invalides.");
  }
  if (!DISH_PHOTO_DERIVATIVE_VARIANTS.includes(args.variant)) {
    throw new Error("Variante photo invalide.");
  }
  return [
    "restaurants",
    restaurantId,
    "photos",
    "derivatives",
    args.sha256.toLowerCase(),
    `${args.variant}.webp`
  ].join("/");
}

/** V2 derivative path includes recipe and output hashes, so collisions are impossible. */
export function buildDishPhotoDerivativeV2StoragePath(args: {
  restaurantId: string;
  sourceSha256: string;
  recipeId: string;
  variant: DishPhotoDerivativeVariant;
  outputSha256: string;
}): string {
  const restaurantId = normalizeStorageSafeIdentifier(args.restaurantId);
  if (!restaurantId || !SHA256_PATTERN.test(args.sourceSha256) || !SHA256_PATTERN.test(args.outputSha256) || args.recipeId !== DISH_PHOTO_RECIPE.id || !isDishPhotoDerivativeVariant(args.variant)) {
    throw new Error("Identifiants derive photo invalides.");
  }
  return `restaurants/${restaurantId}/photos/derivatives/${args.sourceSha256.toLowerCase()}/${args.recipeId}/${args.variant}-${args.outputSha256.toLowerCase()}.webp`;
}

export function buildDishPhotoPublicPath(
  dishId: string,
  options?: {
    assetVersion?: string;
    variant?: DishPhotoDerivativeVariant;
  }
): string {
  if (!isCanonicalUuid(dishId)) {
    throw new Error("Identifiant plat invalide.");
  }
  const basePath = `/api/public/menu-dishes/${dishId}/photo`;
  const assetVersion = options?.assetVersion?.trim() ?? "";
  if (!assetVersion) {
    if (options?.variant) throw new Error("Version photo requise pour un derive.");
    return basePath;
  }
  if (!SHA256_PATTERN.test(assetVersion)) {
    throw new Error("Version photo invalide.");
  }
  const params = new URLSearchParams({ v: assetVersion.toLowerCase() });
  if (options?.variant) {
    if (!DISH_PHOTO_DERIVATIVE_VARIANTS.includes(options.variant)) {
      throw new Error("Variante photo invalide.");
    }
    params.set("variant", options.variant);
  }
  return `${basePath}?${params.toString()}`;
}

export function mergeDishPhotoMetadata(
  existing: unknown,
  info: DishPhotoMetadataInfo
): Record<string, unknown> {
  const metadata =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};

  return {
    ...metadata,
    photoStatus: "ready",
    photoStorageBucket: info.storageBucket,
    photoStoragePath: info.storagePath,
    photoSha256: info.sha256.toLowerCase(),
    photoContentType: info.contentType,
    photoBytes: info.bytes,
    photoDerivatives: info.derivatives ?? {}
  };
}

export function clearDishPhotoMetadata(existing: unknown): Record<string, unknown> {
  const metadata =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  delete metadata.photoStatus;
  delete metadata.photoStorageBucket;
  delete metadata.photoStoragePath;
  delete metadata.photoSha256;
  delete metadata.photoContentType;
  delete metadata.photoBytes;
  delete metadata.photoDerivatives;
  return metadata;
}
