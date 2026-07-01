export type PreparedModelStatus =
  | "ready"
  | "web_ready_usdz_pending"
  | "pending_manual_usdz"
  | "usdz_conversion_failed";

type PreparedModelStoragePathArgs = {
  restaurantId: string;
  jobId: string;
  sha256: string;
};

type PreparedModelMetadataArgs = {
  webModel3dUrl: string;
  arUsdzUrl?: string;
  sourceJobId: string;
  assetVersion?: string;
  assetSha256?: string;
  modelUpdatedAt?: string;
};

type PreparedModelPublishedPathArgs = {
  restaurantId: string;
  dishSlug: string;
  assetVersion?: string;
};

type PreparedModelPublicPathOptions = {
  assetVersion?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JOB_ID_PATTERN = /^job_[a-z0-9._-]{8,80}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const ASSET_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{3,96}$/i;

export const PREPARED_GLB_PIPELINE_STEP = "prepared_usdz";
export const PREPARED_GLB_PENDING_STATUS = "pending_manual_usdz";
export const PREPARED_GLB_PUBLISHED_JOB_STATUS = "published";
export const PREPARED_GLB_FAILED_JOB_STATUS = "failed";

export function isPreparedGlbPipelineStep(value: unknown): boolean {
  return value === PREPARED_GLB_PIPELINE_STEP;
}

export function buildPreparedModelStoragePath(args: PreparedModelStoragePathArgs): string {
  if (
    !UUID_PATTERN.test(args.restaurantId) ||
    !JOB_ID_PATTERN.test(args.jobId) ||
    !SHA256_PATTERN.test(args.sha256)
  ) {
    throw new Error("Identifiants modele invalides.");
  }

  return [
    "restaurants",
    args.restaurantId,
    "models",
    "staging",
    args.jobId,
    "source.glb"
  ].join("/");
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
  if (!UUID_PATTERN.test(restaurantId) || !dishSlug || dishSlug.includes("..") || dishSlug.includes("\\")) {
    throw new Error("Identifiants modele invalides.");
  }
  return ["restaurants", restaurantId, "models", "web", publishedFileName(dishSlug, ".glb", assetVersion)].join("/");
}

export function buildPreparedModelArLiteStoragePath({
  restaurantId,
  dishSlug,
  assetVersion
}: PreparedModelPublishedPathArgs): string {
  if (!UUID_PATTERN.test(restaurantId) || !dishSlug || dishSlug.includes("..") || dishSlug.includes("\\")) {
    throw new Error("Identifiants modele invalides.");
  }
  return ["restaurants", restaurantId, "models", "ar-lite", publishedFileName(dishSlug, ".glb", assetVersion)].join("/");
}

export function buildPreparedModelUsdzStoragePath({
  restaurantId,
  dishSlug,
  assetVersion
}: PreparedModelPublishedPathArgs): string {
  if (!UUID_PATTERN.test(restaurantId) || !dishSlug || dishSlug.includes("..") || dishSlug.includes("\\")) {
    throw new Error("Identifiants modele invalides.");
  }
  return ["restaurants", restaurantId, "models", "ar-ios", publishedFileName(dishSlug, ".usdz", assetVersion)].join("/");
}

export function buildPreparedModelPublicGlbPath(
  dishId: string,
  options: PreparedModelPublicPathOptions = {}
): string {
  if (!UUID_PATTERN.test(dishId)) throw new Error("Identifiant plat invalide.");
  return `/api/public/menu-dishes/${dishId}/model/glb${versionQuery(options.assetVersion)}`;
}

export function buildPreparedModelPublicArLiteGlbPath(
  dishId: string,
  options: PreparedModelPublicPathOptions = {}
): string {
  if (!UUID_PATTERN.test(dishId)) throw new Error("Identifiant plat invalide.");
  return `/api/public/menu-dishes/${dishId}/model/glb?variant=ar-lite${versionQuery(options.assetVersion, "&")}`;
}

export function buildPreparedModelPublicUsdzPath(
  dishId: string,
  options: PreparedModelPublicPathOptions = {}
): string {
  if (!UUID_PATTERN.test(dishId)) throw new Error("Identifiant plat invalide.");
  return `/api/public/menu-dishes/${dishId}/model/usdz${versionQuery(options.assetVersion)}`;
}

export function buildPreparedModelMetadata(
  args: PreparedModelMetadataArgs
): Record<string, unknown> {
  const arUsdzUrl = args.arUsdzUrl ?? "";
  const modelStatus: PreparedModelStatus = arUsdzUrl ? "ready" : "web_ready_usdz_pending";

  const metadata: Record<string, unknown> = {
    webModel3dUrl: args.webModel3dUrl,
    model3dUrl: args.webModel3dUrl,
    arUsdzUrl,
    modelStatus,
    preparedGlbJobId: args.sourceJobId
  };
  if (args.assetVersion) metadata.modelAssetVersion = normalizeAssetVersion(args.assetVersion);
  if (args.assetSha256) metadata.modelAssetSha256 = args.assetSha256;
  if (args.modelUpdatedAt) metadata.modelUpdatedAt = args.modelUpdatedAt;
  return metadata;
}

export function mergePreparedModelMetadata(
  existing: unknown,
  prepared: Record<string, unknown>
): Record<string, unknown> {
  const metadata =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...metadata,
    ...prepared
  };
}
