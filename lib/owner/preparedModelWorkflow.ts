import {
  isCanonicalUuid,
  normalizeStorageSafeIdentifier
} from "../storage/safeIdentifier.ts";

type PreparedModelPublishedPathArgs = {
  restaurantId: string;
  dishSlug: string;
  assetVersion?: string;
};

type PreparedModelPublicPathOptions = {
  assetVersion?: string;
};
const ASSET_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{3,96}$/i;

function storageRestaurantIdOrThrow(restaurantId: string): string {
  const normalized = normalizeStorageSafeIdentifier(restaurantId);
  if (!normalized) throw new Error("Identifiants modele invalides.");
  return normalized;
}

function normalizeAssetVersion(assetVersion: string | undefined): string {
  const value = assetVersion?.trim().toLowerCase() ?? "";
  if (!value) return "";
  if (!ASSET_VERSION_PATTERN.test(value) || value.includes("..")) {
    throw new Error("Identifiants modele invalides.");
  }
  return value;
}

function publishedFileName(dishSlug: string, extension: ".glb" | ".usdz", assetVersion?: string): string {
  const version = normalizeAssetVersion(assetVersion);
  return `${dishSlug}${version ? `-${version}` : ""}${extension}`;
}

function versionQuery(assetVersion: string | undefined, prefix: "?" | "&" = "?"): string {
  const version = normalizeAssetVersion(assetVersion);
  return version ? `${prefix}v=${encodeURIComponent(version)}` : "";
}

export function buildPreparedModelWebStoragePath({
  restaurantId,
  dishSlug,
  assetVersion
}: PreparedModelPublishedPathArgs): string {
  const normalizedRestaurantId = storageRestaurantIdOrThrow(restaurantId);
  if (!dishSlug || dishSlug.includes("..") || dishSlug.includes("\\")) {
    throw new Error("Identifiants modele invalides.");
  }
  return ["restaurants", normalizedRestaurantId, "models", "web", publishedFileName(dishSlug, ".glb", assetVersion)].join("/");
}

export function buildPreparedModelArLiteStoragePath({
  restaurantId,
  dishSlug,
  assetVersion
}: PreparedModelPublishedPathArgs): string {
  const normalizedRestaurantId = storageRestaurantIdOrThrow(restaurantId);
  if (!dishSlug || dishSlug.includes("..") || dishSlug.includes("\\")) {
    throw new Error("Identifiants modele invalides.");
  }
  return ["restaurants", normalizedRestaurantId, "models", "ar-lite", publishedFileName(dishSlug, ".glb", assetVersion)].join("/");
}

export function buildPreparedModelUsdzStoragePath({
  restaurantId,
  dishSlug,
  assetVersion
}: PreparedModelPublishedPathArgs): string {
  const normalizedRestaurantId = storageRestaurantIdOrThrow(restaurantId);
  if (!dishSlug || dishSlug.includes("..") || dishSlug.includes("\\")) {
    throw new Error("Identifiants modele invalides.");
  }
  return ["restaurants", normalizedRestaurantId, "models", "ar-ios", publishedFileName(dishSlug, ".usdz", assetVersion)].join("/");
}

export function buildPreparedModelPublicGlbPath(
  dishId: string,
  options: PreparedModelPublicPathOptions = {}
): string {
  if (!isCanonicalUuid(dishId)) throw new Error("Identifiant plat invalide.");
  return `/api/public/menu-dishes/${dishId}/model/glb${versionQuery(options.assetVersion)}`;
}

export function buildPreparedModelPublicArLiteGlbPath(
  dishId: string,
  options: PreparedModelPublicPathOptions = {}
): string {
  if (!isCanonicalUuid(dishId)) throw new Error("Identifiant plat invalide.");
  return `/api/public/menu-dishes/${dishId}/model/glb?variant=ar-lite${versionQuery(options.assetVersion, "&")}`;
}

export function buildPreparedModelPublicUsdzPath(
  dishId: string,
  options: PreparedModelPublicPathOptions = {}
): string {
  if (!isCanonicalUuid(dishId)) throw new Error("Identifiant plat invalide.");
  return `/api/public/menu-dishes/${dishId}/model/usdz${versionQuery(options.assetVersion)}`;
}
