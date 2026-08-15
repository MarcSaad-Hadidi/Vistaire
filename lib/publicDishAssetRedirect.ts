import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCanonicalUuid,
  isStorageSafeIdentifier
} from "@/lib/owner/storageSafeIdentifier";
import {
  DISH_PHOTO_RECIPE,
  isValidDishPhotoDerivativeMetadata,
  type DishPhotoDerivativeVariant
} from "@/lib/owner/dishPhotoUpload";

export type PublicDishAssetKind = "photo" | "web-glb" | "ar-lite-glb" | "usdz";
export type PublicDishPhotoVariant = DishPhotoDerivativeVariant;

type DishAssetAdmin =
  | { ok: true; client: SupabaseClient }
  | { ok: false; reason: string };

export type DishAssetVisibilityPolicy =
  | { kind: "public-available-only" }
  | { kind: "authorized-admin"; restaurantId: string };

type PublicDishAssetProfile = {
  bucket: "vistaire-media" | "vistaire-3d";
  bucketMetadataKey:
    | "photoStorageBucket"
    | "webModel3dStorageBucket"
    | "arModel3dStorageBucket"
    | "arUsdzStorageBucket";
  pathMetadataKey:
    | "photoStoragePath"
    | "webModel3dStoragePath"
    | "arModel3dStoragePath"
    | "arUsdzStoragePath";
  versionMetadataKey: "photoSha256" | "modelAssetVersion";
  pathSegments: readonly string[];
  extensions: readonly string[];
};

const SIGNED_URL_TTL_SECONDS = 270;
const ADMIN_SIGNED_URL_TTL_SECONDS = 300;

export const PUBLIC_ASSET_SIGNED_URL_TTL_SECONDS = SIGNED_URL_TTL_SECONDS;
export const PUBLIC_ASSET_SIGNED_URL_REUSE_SECONDS = 120;
export const PUBLIC_ASSET_METADATA_CACHE_SECONDS = 30;
export const PUBLIC_ASSET_CDN_REDIRECT_MAX_AGE_SECONDS = 120;
export const PUBLIC_ASSET_TOKEN_SAFETY_MARGIN_SECONDS = 30;

/**
 * Public redirects are versioned/content-addressed, so a signed URL can be
 * reused briefly after the availability check has run. The public browser
 * never stores the redirect. The CDN window is bounded by both the configured
 * maximum and the signed token's remaining lifetime minus a safety margin.
 *
 * The cache is deliberately production-only. Local/test executions must keep
 * their deterministic Storage fixtures and must never retain signed tokens.
 */
// A remote instance may retain availability metadata for 30 seconds and then
// mint one last 270-second public token. This is the composed stale-access SLA.
export const PUBLIC_ASSET_REVOCATION_SLA_SECONDS =
  PUBLIC_ASSET_METADATA_CACHE_SECONDS + PUBLIC_ASSET_SIGNED_URL_TTL_SECONDS;
const SIGNED_URL_CACHE_TTL_MS =
  PUBLIC_ASSET_SIGNED_URL_REUSE_SECONDS * 1_000;
const SIGNED_URL_CACHE_MAX_ENTRIES = 512;

type SignedUrlCacheEntry = {
  signedUrl: string;
  reuseExpiresAt: number;
  tokenExpiresAt: number;
};

const signedUrlCache = new Map<string, SignedUrlCacheEntry>();
const signedUrlInFlight = new Map<
  string,
  Promise<SignedUrlCacheEntry | null>
>();

type PublicDishMetadataCacheEntry = {
  dish: Record<string, unknown>;
  expiresAt: number;
};

const PUBLIC_DISH_METADATA_CACHE_TTL_MS =
  PUBLIC_ASSET_METADATA_CACHE_SECONDS * 1_000;
const PUBLIC_DISH_METADATA_CACHE_MAX_ENTRIES = 512;
const publicDishMetadataCache = new Map<
  string,
  PublicDishMetadataCacheEntry
>();
type PublicDishMetadataLookup = {
  data: Record<string, unknown> | null;
  error: unknown;
  transportFailure: boolean;
};
const publicDishMetadataInFlight = new Map<
  string,
  Promise<PublicDishMetadataLookup>
>();
let publicDishMetadataCacheGeneration = 0;

export type DishAssetRedirectRuntime = {
  now: () => number;
  performanceNow: () => number;
  cachePublicAssets: boolean;
};

function dishAssetRedirectRuntime(
  override?: Partial<DishAssetRedirectRuntime>
): DishAssetRedirectRuntime {
  return {
    now: override?.now ?? Date.now,
    performanceNow: override?.performanceNow ?? (() => performance.now()),
    cachePublicAssets:
      override?.cachePublicAssets ?? process.env.NODE_ENV === "production"
  };
}

function publicSignedUrlCacheEnabled(runtime: DishAssetRedirectRuntime): boolean {
  return runtime.cachePublicAssets;
}

function signedUrlCacheKey(args: {
  bucket: string;
  storagePath: string;
  version: string;
}): string {
  return `${args.bucket}\u0000${args.storagePath}\u0000${args.version}`;
}

function readCachedSignedUrl(
  key: string,
  now: number
): SignedUrlCacheEntry | null {
  const entry = signedUrlCache.get(key);
  if (!entry) return null;
  if (entry.reuseExpiresAt <= now) {
    signedUrlCache.delete(key);
    return null;
  }
  // Refresh insertion order so the bounded map behaves as a small LRU.
  signedUrlCache.delete(key);
  signedUrlCache.set(key, entry);
  return entry;
}

function writeCachedSignedUrl(
  key: string,
  entry: SignedUrlCacheEntry
): void {
  signedUrlCache.delete(key);
  signedUrlCache.set(key, entry);
  while (signedUrlCache.size > SIGNED_URL_CACHE_MAX_ENTRIES) {
    const oldest = signedUrlCache.keys().next().value;
    if (typeof oldest !== "string") break;
    signedUrlCache.delete(oldest);
  }
}

function publicDishMetadataCacheKey(args: {
  dishId: string;
  kind: PublicDishAssetKind;
  version: string;
}): string {
  return `${args.kind}\u0000${args.dishId}\u0000${args.version}`;
}

function readCachedPublicDishMetadata(
  key: string,
  now: number
): Record<string, unknown> | null {
  const entry = publicDishMetadataCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    publicDishMetadataCache.delete(key);
    return null;
  }
  publicDishMetadataCache.delete(key);
  publicDishMetadataCache.set(key, entry);
  return entry.dish;
}

function writeCachedPublicDishMetadata(
  key: string,
  dish: Record<string, unknown>,
  now: number
): void {
  publicDishMetadataCache.delete(key);
  publicDishMetadataCache.set(key, {
    dish,
    expiresAt: now + PUBLIC_DISH_METADATA_CACHE_TTL_MS
  });
  while (publicDishMetadataCache.size > PUBLIC_DISH_METADATA_CACHE_MAX_ENTRIES) {
    const oldest = publicDishMetadataCache.keys().next().value;
    if (typeof oldest !== "string") break;
    publicDishMetadataCache.delete(oldest);
  }
}

/** Test/diagnostic hook; does not touch Supabase or production Storage. */
export function resetPublicDishAssetCachesForTests(): void {
  publicDishMetadataCacheGeneration += 1;
  signedUrlCache.clear();
  signedUrlInFlight.clear();
  publicDishMetadataCache.clear();
  publicDishMetadataInFlight.clear();
}

/**
 * Invalidates availability-sensitive metadata after a committed mutation.
 * In-flight reads are detached and generation-guarded so a stale completion
 * cannot repopulate the cache after invalidation.
 */
export function invalidatePublicDishAssetMetadataCache(args: {
  dishId?: string;
  restaurantId?: string;
}): number {
  const dishId = args.dishId?.trim() ?? "";
  const restaurantId = args.restaurantId?.trim() ?? "";
  publicDishMetadataCacheGeneration += 1;
  let invalidated = 0;

  for (const [key, entry] of publicDishMetadataCache) {
    const keyDishId = key.split("\u0000")[1] ?? "";
    const entryRestaurantId =
      typeof entry.dish.restaurant_id === "string"
        ? entry.dish.restaurant_id.trim()
        : "";
    if (
      (!dishId || keyDishId === dishId) &&
      (!restaurantId || entryRestaurantId === restaurantId)
    ) {
      publicDishMetadataCache.delete(key);
      invalidated += 1;
    }
  }

  for (const key of publicDishMetadataInFlight.keys()) {
    const keyDishId = key.split("\u0000")[1] ?? "";
    if (!dishId || keyDishId === dishId) {
      publicDishMetadataInFlight.delete(key);
    }
  }
  return invalidated;
}

const ASSET_PROFILES: Record<PublicDishAssetKind, PublicDishAssetProfile> = {
  photo: {
    bucket: "vistaire-media",
    bucketMetadataKey: "photoStorageBucket",
    pathMetadataKey: "photoStoragePath",
    versionMetadataKey: "photoSha256",
    pathSegments: ["photos", "originals"],
    extensions: [".png", ".jpeg", ".jpg", ".webp", ".avif"]
  },
  "web-glb": {
    bucket: "vistaire-3d",
    bucketMetadataKey: "webModel3dStorageBucket",
    pathMetadataKey: "webModel3dStoragePath",
    versionMetadataKey: "modelAssetVersion",
    pathSegments: ["models", "web"],
    extensions: [".glb"]
  },
  "ar-lite-glb": {
    bucket: "vistaire-3d",
    bucketMetadataKey: "arModel3dStorageBucket",
    pathMetadataKey: "arModel3dStoragePath",
    versionMetadataKey: "modelAssetVersion",
    pathSegments: ["models", "ar-lite"],
    extensions: [".glb"]
  },
  usdz: {
    bucket: "vistaire-3d",
    bucketMetadataKey: "arUsdzStorageBucket",
    pathMetadataKey: "arUsdzStoragePath",
    versionMetadataKey: "modelAssetVersion",
    pathSegments: ["models", "ar-ios"],
    extensions: [".usdz"]
  }
};

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataString(metadata: Record<string, unknown>, key: string): string {
  return metadataRawString(metadata, key).trim();
}

function metadataRawString(
  metadata: Record<string, unknown>,
  key: string
): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function storageErrorStatus(error: unknown): number {
  if (!error || typeof error !== "object") return Number.NaN;
  const record = error as { status?: unknown; statusCode?: unknown };
  return Number(record.status ?? record.statusCode);
}

function isMissingStorageError(error: unknown): boolean {
  const status = storageErrorStatus(error);
  if (status === 404) return true;
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return /object\s+(?:not found|does not exist)|file\s+(?:not found|does not exist)/i.test(
    message
  );
}

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "private, no-store",
  "Vercel-CDN-Cache-Control": "private, no-store"
} as const;

export function publicDishAssetJsonError(
  message: string,
  status: 404 | 503
): Response {
  return Response.json(
    { ok: false, error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

function boundedDuration(
  startedAt: number,
  runtime: DishAssetRedirectRuntime
): number {
  return Math.min(
    Math.max(runtime.performanceNow() - startedAt, 0),
    9_999.9
  );
}

function formatServerTiming(durations: {
  db: number;
  storageInfo: number;
  storageSign: number;
}): string {
  return [
    `db;dur=${durations.db.toFixed(1)}`,
    `storage-info;dur=${durations.storageInfo.toFixed(1)}`,
    `storage-sign;dur=${durations.storageSign.toFixed(1)}`
  ].join(", ");
}

function hasSafePathSyntax(storagePath: string): boolean {
  if (
    !storagePath ||
    storagePath.startsWith("/") ||
    storagePath.includes("\\") ||
    storagePath.includes("?") ||
    storagePath.includes("#") ||
    storagePath.includes("%") ||
    /^[a-z][a-z0-9+.-]*:/i.test(storagePath)
  ) {
    return false;
  }

  const segments = storagePath.split("/");
  return segments.every(
    (segment) =>
      Boolean(segment) &&
      segment !== "." &&
      segment !== ".." &&
      !segment.includes("..") &&
      /^[a-z0-9][a-z0-9._-]*$/i.test(segment)
  );
}

export function isAllowedPublicDishAssetLocation(args: {
  kind: PublicDishAssetKind;
  bucket: string;
  storagePath: string;
  restaurantId: string;
  photoVariant?: PublicDishPhotoVariant;
}): boolean {
  const profile = ASSET_PROFILES[args.kind];
  if (args.bucket !== profile.bucket || !hasSafePathSyntax(args.storagePath)) {
    return false;
  }

  if (args.kind === "photo" && args.photoVariant) {
    const pathSegments = args.storagePath.split("/");
    const expectedPrefix = [
      "restaurants",
      args.restaurantId,
      "photos",
      "derivatives"
    ];
    const sourceSha = pathSegments[4] ?? "";
    if (
      !isStorageSafeIdentifier(args.restaurantId) ||
      !expectedPrefix.every((segment, index) => pathSegments[index] === segment) ||
      !/^[a-f0-9]{64}$/i.test(sourceSha)
    ) {
      return false;
    }
    // V1 derivatives stay readable during migration. New immutable V2 paths
    // add the recipe and output hash so a path can never be overwritten.
    if (pathSegments.length === 6) {
      return pathSegments[5] === `${args.photoVariant}.webp`;
    }
    if (pathSegments.length !== 7 || pathSegments[5] !== DISH_PHOTO_RECIPE.id) {
      return false;
    }
    return new RegExp(
      `^${args.photoVariant}-[a-f0-9]{64}\\.webp$`,
      "i"
    ).test(pathSegments[6] ?? "");
  }

  const pathSegments = args.storagePath.split("/");
  const expectedPrefix = ["restaurants", args.restaurantId, ...profile.pathSegments];
  if (pathSegments.length !== expectedPrefix.length + 1) {
    return false;
  }
  if (expectedPrefix.some((segment, index) => pathSegments[index] !== segment)) {
    return false;
  }

  const filename = pathSegments.at(-1)?.toLowerCase() ?? "";
  return profile.extensions.some((extension) => filename.endsWith(extension));
}

export const isAllowedDishAssetLocation = isAllowedPublicDishAssetLocation;

function isUsableDishPhotoDerivativeV2(args: {
  derivativeRecord: unknown;
  derivativeMetadata: Record<string, unknown>;
  restaurantId: string;
  sourceSha256: string;
  outputSha256: string;
  variant: PublicDishPhotoVariant;
}): boolean {
  if (
    !isValidDishPhotoDerivativeMetadata(args.derivativeRecord, {
      sourceSha256: args.sourceSha256,
      variant: args.variant
    }) ||
    !/^[a-f0-9]{64}$/.test(args.sourceSha256) ||
    !/^[a-f0-9]{64}$/.test(args.outputSha256) ||
    metadataString(args.derivativeMetadata, "outputSha256").toLowerCase() !==
      args.outputSha256
  ) {
    return false;
  }

  const expectedStoragePath = [
    "restaurants",
    args.restaurantId,
    "photos",
    "derivatives",
    args.sourceSha256,
    DISH_PHOTO_RECIPE.id,
    `${args.variant}-${args.outputSha256}.webp`
  ].join("/");
  return (
    metadataRawString(args.derivativeMetadata, "storagePath") ===
    expectedStoragePath
  );
}

function isUsableDishPhotoDerivativeV1Legacy(args: {
  derivativeMetadata: Record<string, unknown>;
  restaurantId: string;
  sourceSha256: string;
  variant: PublicDishPhotoVariant;
}): boolean {
  if (
    Object.hasOwn(args.derivativeMetadata, "recipeId") ||
    Object.hasOwn(args.derivativeMetadata, "schemaVersion") ||
    Object.hasOwn(args.derivativeMetadata, "variant")
  ) {
    return false;
  }
  const expectedStoragePath = [
    "restaurants",
    args.restaurantId,
    "photos",
    "derivatives",
    args.sourceSha256,
    `${args.variant}.webp`
  ].join("/");
  return (
    metadataRawString(args.derivativeMetadata, "storagePath") ===
    expectedStoragePath
  );
}

function configuredSupabaseOrigin(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  try {
    const parsed = new URL(supabaseUrl);
    const isLocalHttp =
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    if (
      (parsed.protocol !== "https:" && !isLocalHttp) ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isExpectedSignedStorageUrl(args: {
  signedUrl: string;
  supabaseUrl: string | undefined;
  bucket: string;
  storagePath: string;
}): boolean {
  const expectedOrigin = configuredSupabaseOrigin(args.supabaseUrl);
  if (!expectedOrigin) return false;

  try {
    const parsed = new URL(args.signedUrl);
    const expectedPath = `/storage/v1/object/sign/${args.bucket}/${args.storagePath}`;
    return (
      parsed.origin === expectedOrigin &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === expectedPath &&
      !parsed.hash &&
      Boolean(parsed.searchParams.get("token"))
    );
  } catch {
    return false;
  }
}

async function redirectDishAsset(args: {
  admin: DishAssetAdmin;
  dishId: string;
  kind: PublicDishAssetKind;
  requestedAssetVersion?: string;
  supabaseUrl: string | undefined;
  notFoundMessage: string;
  unavailableMessage: string;
  assetVisibilityPolicy: DishAssetVisibilityPolicy;
  photoVariant?: PublicDishPhotoVariant;
  runtime?: Partial<DishAssetRedirectRuntime>;
}): Promise<Response> {
  const runtime = dishAssetRedirectRuntime(args.runtime);
  if (!isCanonicalUuid(args.dishId)) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }
  if (!args.admin.ok) {
    return publicDishAssetJsonError(args.unavailableMessage, 503);
  }
  const adminClient = args.admin.client;

  const rawRequestedVersion = args.requestedAssetVersion?.trim() ?? "";
  const requestedVersion =
    args.kind === "photo" ? rawRequestedVersion.toLowerCase() : rawRequestedVersion;
  const profile = ASSET_PROFILES[args.kind];
  const canCachePublicDishMetadata =
    args.assetVisibilityPolicy.kind === "public-available-only" &&
    Boolean(requestedVersion) &&
    publicSignedUrlCacheEnabled(runtime);
  const metadataCacheKey = canCachePublicDishMetadata
    ? publicDishMetadataCacheKey({
        dishId: args.dishId,
        kind: args.kind,
        version: requestedVersion
      })
    : null;

  let dbDuration = 0;
  const lookupDish = async (): Promise<PublicDishMetadataLookup> => {
    const dbStartedAt = runtime.performanceNow();
    try {
      const dishQuery = adminClient
        .from("menu_dishes")
        .select("id,restaurant_id,is_available,metadata")
        .eq("id", args.dishId);
      if (args.assetVisibilityPolicy.kind === "authorized-admin") {
        dishQuery.eq("restaurant_id", args.assetVisibilityPolicy.restaurantId);
      }
      const result = await dishQuery.maybeSingle();
      dbDuration = boundedDuration(dbStartedAt, runtime);
      return {
        data: (result.data as Record<string, unknown> | null) ?? null,
        error: result.error,
        transportFailure: false
      };
    } catch (error) {
      dbDuration = boundedDuration(dbStartedAt, runtime);
      return { data: null, error, transportFailure: true };
    }
  };

  let dishResult: PublicDishMetadataLookup;
  if (metadataCacheKey) {
    const cachedDish = readCachedPublicDishMetadata(
      metadataCacheKey,
      runtime.now()
    );
    if (cachedDish) {
      dishResult = { data: cachedDish, error: null, transportFailure: false };
    } else {
      const inFlight = publicDishMetadataInFlight.get(metadataCacheKey);
      if (inFlight) {
        dishResult = await inFlight;
      } else {
        const cacheGeneration = publicDishMetadataCacheGeneration;
        const lookupPromise = lookupDish();
        publicDishMetadataInFlight.set(metadataCacheKey, lookupPromise);
        try {
          dishResult = await lookupPromise;
          if (
            !dishResult.error &&
            dishResult.data &&
            cacheGeneration === publicDishMetadataCacheGeneration
          ) {
            writeCachedPublicDishMetadata(
              metadataCacheKey,
              dishResult.data,
              runtime.now()
            );
          }
        } finally {
          if (publicDishMetadataInFlight.get(metadataCacheKey) === lookupPromise) {
            publicDishMetadataInFlight.delete(metadataCacheKey);
          }
        }
      }
    }
  } else {
    dishResult = await lookupDish();
  }

  const dish = dishResult.data as Record<string, unknown> | null;
  if (dishResult.transportFailure) {
    return publicDishAssetJsonError(args.unavailableMessage, 503);
  }
  if (dishResult.error) {
    return publicDishAssetJsonError(
      args.assetVisibilityPolicy.kind === "authorized-admin"
        ? args.unavailableMessage
        : args.notFoundMessage,
      args.assetVisibilityPolicy.kind === "authorized-admin" ? 503 : 404
    );
  }
  if (!dish) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }

  const dishRestaurantId =
    typeof dish.restaurant_id === "string" ? dish.restaurant_id.trim() : "";
  if (
    args.assetVisibilityPolicy.kind === "public-available-only" &&
    dish.is_available === false
  ) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }
  if (
    args.assetVisibilityPolicy.kind === "authorized-admin" &&
    (!isStorageSafeIdentifier(args.assetVisibilityPolicy.restaurantId) ||
      dishRestaurantId !== args.assetVisibilityPolicy.restaurantId)
  ) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }

  const metadata = metadataRecord(dish.metadata);
  const activeVersion = metadataString(metadata, profile.versionMetadataKey);
  if (
    (args.kind === "photo" && Boolean(activeVersion) !== Boolean(requestedVersion)) ||
    (requestedVersion && requestedVersion !== activeVersion)
  ) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }

  const restaurantId = dishRestaurantId;
  const bucket = metadataString(metadata, profile.bucketMetadataKey) || profile.bucket;
  const originalStoragePath = metadataString(metadata, profile.pathMetadataKey);
  const derivativeRecord =
    args.kind === "photo" && args.photoVariant
      ? metadataRecord(metadata.photoDerivatives)[args.photoVariant]
      : undefined;
  const derivativeMetadata = metadataRecord(derivativeRecord);
  const derivativeStoragePath = metadataRawString(
    derivativeMetadata,
    "storagePath"
  );
  const derivativeSourceSha256 = metadataString(
    derivativeMetadata,
    "sourceSha256"
  ).toLowerCase();
  const derivativeSha256 =
    metadataString(derivativeMetadata, "outputSha256") ||
    metadataString(derivativeMetadata, "sha256");
  const derivativeBytes = Number(derivativeMetadata.bytes);
  const derivativeContentType = metadataString(derivativeMetadata, "contentType");
  const hasUsableDerivative = Boolean(
    args.kind === "photo" &&
      args.photoVariant &&
      derivativeStoragePath &&
      derivativeSourceSha256 === activeVersion.toLowerCase() &&
      /^[a-f0-9]{64}$/i.test(derivativeSha256) &&
      derivativeContentType === "image/webp" &&
      Number.isInteger(derivativeBytes) &&
      derivativeBytes > 0 &&
      (isUsableDishPhotoDerivativeV2({
        derivativeRecord,
        derivativeMetadata,
        restaurantId,
        sourceSha256: activeVersion.toLowerCase(),
        outputSha256: derivativeSha256.toLowerCase(),
        variant: args.photoVariant
      }) ||
        isUsableDishPhotoDerivativeV1Legacy({
          derivativeMetadata,
          restaurantId,
          sourceSha256: activeVersion.toLowerCase(),
          variant: args.photoVariant
        })) &&
      isAllowedDishAssetLocation({
        kind: args.kind,
        bucket,
        storagePath: derivativeStoragePath,
        restaurantId,
        photoVariant: args.photoVariant
      })
  );
  let selectedStoragePath = hasUsableDerivative
    ? derivativeStoragePath
    : originalStoragePath;
  if (
    !restaurantId ||
    !isAllowedDishAssetLocation({
      kind: args.kind,
      bucket,
      storagePath: selectedStoragePath,
      restaurantId,
      ...(hasUsableDerivative && args.photoVariant
        ? { photoVariant: args.photoVariant }
        : {})
    })
  ) {
    return publicDishAssetJsonError(args.notFoundMessage, 404);
  }

  const storage = adminClient.storage.from(bucket);
  try {
    let storageInfoDuration = 0;
    let storageSignDuration = 0;
    let signedUrl: string | undefined;
    let signedUrlTokenExpiresAt = 0;
    let signError: unknown = null;
    const canReuseSignedUrl =
      args.assetVisibilityPolicy.kind === "public-available-only" &&
      Boolean(activeVersion) &&
      publicSignedUrlCacheEnabled(runtime);
    const sign = async (storagePath = selectedStoragePath): Promise<boolean> => {
      const cacheKey = canReuseSignedUrl
        ? signedUrlCacheKey({
            bucket,
            storagePath,
            version: activeVersion
          })
        : null;
      if (cacheKey) {
        const cached = readCachedSignedUrl(cacheKey, runtime.now());
        if (cached) {
          signedUrl = cached.signedUrl;
          signedUrlTokenExpiresAt = cached.tokenExpiresAt;
          return true;
        }
        const inFlight = signedUrlInFlight.get(cacheKey);
        if (inFlight) {
          const reused = await inFlight;
          if (reused) {
            signedUrl = reused.signedUrl;
            signedUrlTokenExpiresAt = reused.tokenExpiresAt;
            return true;
          }
          return false;
        }
      }

      const signPromise = (async (): Promise<SignedUrlCacheEntry | null> => {
        const storageSignStartedAt = runtime.performanceNow();
        const signedAt = runtime.now();
        const signedUrlTtlSeconds =
          args.assetVisibilityPolicy.kind === "authorized-admin"
            ? ADMIN_SIGNED_URL_TTL_SECONDS
            : SIGNED_URL_TTL_SECONDS;
        try {
          const signed =
            args.assetVisibilityPolicy.kind === "authorized-admin"
              ? await storage.createSignedUrl(storagePath, ADMIN_SIGNED_URL_TTL_SECONDS)
              : await storage.createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
          storageSignDuration += boundedDuration(storageSignStartedAt, runtime);
          signError = signed.error;
          const candidate = signed.data?.signedUrl;
          if (
            !signed.error &&
            candidate &&
            isExpectedSignedStorageUrl({
              signedUrl: candidate,
              supabaseUrl: args.supabaseUrl,
              bucket,
              storagePath
            })
          ) {
            const tokenExpiresAt =
              signedAt + signedUrlTtlSeconds * 1_000;
            return {
              signedUrl: candidate,
              tokenExpiresAt,
              reuseExpiresAt: Math.min(
                signedAt + SIGNED_URL_CACHE_TTL_MS,
                tokenExpiresAt -
                  PUBLIC_ASSET_TOKEN_SAFETY_MARGIN_SECONDS * 1_000
              )
            };
          }
        } catch (error) {
          storageSignDuration += boundedDuration(storageSignStartedAt, runtime);
          signError = error;
        }
        return null;
      })();

      if (cacheKey) signedUrlInFlight.set(cacheKey, signPromise);
      try {
        const candidate = await signPromise;
        if (!candidate) return false;
        if (cacheKey) writeCachedSignedUrl(cacheKey, candidate);
        signedUrl = candidate.signedUrl;
        signedUrlTokenExpiresAt = candidate.tokenExpiresAt;
        return true;
      } finally {
        if (cacheKey && signedUrlInFlight.get(cacheKey) === signPromise) {
          signedUrlInFlight.delete(cacheKey);
        }
      }
    };

    const directSigning = Boolean(activeVersion);
    const signOriginal = async (): Promise<boolean> => {
      if (directSigning) return sign();
      const storageInfoStartedAt = runtime.performanceNow();
      const storagePath = selectedStoragePath;
      const objectInfo = await storage.info(storagePath);
      storageInfoDuration = boundedDuration(storageInfoStartedAt, runtime);
      if (objectInfo.error) {
        signError = objectInfo.error;
        return false;
      }
      if (!objectInfo.data) {
        signError = { status: 404, message: "Object not found" };
        return false;
      }
      return sign();
    };

    // Versioned paths are content-addressed and Supabase validates existence
    // while creating the signed URL. Keep Storage.info only for true legacy
    // photos without a version, where the historical existence contract is
    // still required.
    const derivativeSigned = hasUsableDerivative ? await sign() : false;
    if (!derivativeSigned) {
      selectedStoragePath = originalStoragePath;
      if (
        !isAllowedDishAssetLocation({
          kind: args.kind,
          bucket,
          storagePath: selectedStoragePath,
          restaurantId
        })
      ) {
        return publicDishAssetJsonError(args.notFoundMessage, 404);
      }
      if (!(await signOriginal())) {
        const missing = isMissingStorageError(signError);
        return publicDishAssetJsonError(
          missing ? args.notFoundMessage : args.unavailableMessage,
          missing ? 404 : 503
        );
      }
    }

    if (
      !signedUrl ||
      !isExpectedSignedStorageUrl({
        signedUrl,
        supabaseUrl: args.supabaseUrl,
        bucket,
        storagePath: selectedStoragePath
      })
    ) {
      return publicDishAssetJsonError(args.unavailableMessage, 503);
    }

    const isVersioned = Boolean(requestedVersion);
    const isAuthorizedAdmin =
      args.assetVisibilityPolicy.kind === "authorized-admin";
    const signedUrlRemainingSeconds = Math.max(
      0,
      Math.min(
        isAuthorizedAdmin
          ? ADMIN_SIGNED_URL_TTL_SECONDS
          : SIGNED_URL_TTL_SECONDS,
        Math.floor((signedUrlTokenExpiresAt - runtime.now()) / 1_000)
      )
    );
    const cdnRedirectMaxAgeSeconds = Math.max(
      0,
      Math.min(
        PUBLIC_ASSET_CDN_REDIRECT_MAX_AGE_SECONDS,
        signedUrlRemainingSeconds -
          PUBLIC_ASSET_TOKEN_SAFETY_MARGIN_SECONDS
      )
    );
    const isPublicCacheable =
      isVersioned && !isAuthorizedAdmin && cdnRedirectMaxAgeSeconds > 0;
    const headers: Record<string, string> = {
      Location: signedUrl,
      "Cache-Control": isAuthorizedAdmin
        ? "private, no-store"
        : "no-store",
      "CDN-Cache-Control": isAuthorizedAdmin
        ? "private, no-store"
        : isPublicCacheable
        ? `public, s-maxage=${cdnRedirectMaxAgeSeconds}, must-revalidate`
        : "private, no-store",
      "Vercel-CDN-Cache-Control": isAuthorizedAdmin
        ? "private, no-store"
        : isPublicCacheable
        ? `public, s-maxage=${cdnRedirectMaxAgeSeconds}, must-revalidate`
        : "private, no-store"
    };
    if (isPublicCacheable) {
      headers["Surrogate-Control"] =
        `public, max-age=${cdnRedirectMaxAgeSeconds}`;
      headers["X-Vistaire-Asset-Revocation-SLA"] = String(
        PUBLIC_ASSET_REVOCATION_SLA_SECONDS
      );
      headers["X-Vistaire-Signed-URL-Remaining"] = String(
        signedUrlRemainingSeconds
      );
    }
    if (process.env.VERCEL_ENV === "preview") {
      headers["Server-Timing"] = formatServerTiming({
        db: dbDuration,
        storageInfo: storageInfoDuration,
        storageSign: storageSignDuration
      });
    }

    return new Response(null, {
      status: 307,
      headers
    });
  } catch {
    return publicDishAssetJsonError(args.unavailableMessage, 503);
  }
}

export async function redirectPublicDishAsset(args: {
  admin: DishAssetAdmin;
  dishId: string;
  kind: PublicDishAssetKind;
  requestedAssetVersion?: string;
  supabaseUrl: string | undefined;
  notFoundMessage: string;
  unavailableMessage: string;
  photoVariant?: PublicDishPhotoVariant;
  runtime?: Partial<DishAssetRedirectRuntime>;
}): Promise<Response> {
  return redirectDishAsset({
    ...args,
    assetVisibilityPolicy: { kind: "public-available-only" },
    photoVariant: args.photoVariant
  });
}

export async function redirectAuthorizedAdminDishAsset(args: {
  admin: DishAssetAdmin;
  dishId: string;
  kind: PublicDishAssetKind;
  requestedAssetVersion?: string;
  supabaseUrl: string | undefined;
  restaurantId: string;
  notFoundMessage: string;
  unavailableMessage: string;
  photoVariant?: PublicDishPhotoVariant;
  runtime?: Partial<DishAssetRedirectRuntime>;
}): Promise<Response> {
  return redirectDishAsset({
    ...args,
    assetVisibilityPolicy: {
      kind: "authorized-admin",
      restaurantId: args.restaurantId
    },
    photoVariant: args.photoVariant
  });
}
