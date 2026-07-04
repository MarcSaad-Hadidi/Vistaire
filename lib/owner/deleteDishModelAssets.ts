export const DISH_MODEL_STORAGE_BUCKET = "vistaire-3d";
export const DISH_MODEL_MISSING_STATUS = "missing";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DishModelExtension = ".glb" | ".usdz" | ".json";
type DishModelFolder = "source" | "web" | "ar-lite" | "ar-ios" | "manifests" | "staging";

export type DishModelStorageTarget = {
  bucket: typeof DISH_MODEL_STORAGE_BUCKET;
  path: string;
  kind: string;
  metadataPathKey: string;
};

export type DishModelSkippedTarget = {
  bucket: string;
  path: string;
  kind: string;
  metadataPathKey: string;
  reason: "empty" | "unsafe_bucket" | "unsafe_path" | "duplicate";
};

export type DishModelStorageTargets = {
  targets: DishModelStorageTarget[];
  skipped: DishModelSkippedTarget[];
};

type StorageCandidate = {
  kind: string;
  pathKey: string;
  bucketKey?: string;
  extension: DishModelExtension;
  folders: DishModelFolder[];
};

const STORAGE_CANDIDATES: StorageCandidate[] = [
  {
    kind: "source_glb",
    pathKey: "sourceModel3dStoragePath",
    bucketKey: "sourceModel3dStorageBucket",
    extension: ".glb",
    folders: ["source"]
  },
  {
    kind: "source_glb",
    pathKey: "source_model_3d_storage_path",
    bucketKey: "source_model_3d_storage_bucket",
    extension: ".glb",
    folders: ["source"]
  },
  {
    kind: "legacy_model_glb",
    pathKey: "model3dStoragePath",
    bucketKey: "model3dStorageBucket",
    extension: ".glb",
    folders: ["source", "web", "ar-lite", "staging"]
  },
  {
    kind: "legacy_model_glb",
    pathKey: "model3d_storage_path",
    bucketKey: "model3d_storage_bucket",
    extension: ".glb",
    folders: ["source", "web", "ar-lite", "staging"]
  },
  {
    kind: "web_glb",
    pathKey: "webModel3dStoragePath",
    bucketKey: "webModel3dStorageBucket",
    extension: ".glb",
    folders: ["web"]
  },
  {
    kind: "web_glb",
    pathKey: "web_model_3d_storage_path",
    bucketKey: "web_model_3d_storage_bucket",
    extension: ".glb",
    folders: ["web"]
  },
  {
    kind: "ar_lite_glb",
    pathKey: "arModel3dStoragePath",
    bucketKey: "arModel3dStorageBucket",
    extension: ".glb",
    folders: ["ar-lite"]
  },
  {
    kind: "ar_lite_glb",
    pathKey: "ar_model_3d_storage_path",
    bucketKey: "ar_model_3d_storage_bucket",
    extension: ".glb",
    folders: ["ar-lite"]
  },
  {
    kind: "ios_usdz",
    pathKey: "arUsdzStoragePath",
    bucketKey: "arUsdzStorageBucket",
    extension: ".usdz",
    folders: ["ar-ios"]
  },
  {
    kind: "ios_usdz",
    pathKey: "ar_usdz_storage_path",
    bucketKey: "ar_usdz_storage_bucket",
    extension: ".usdz",
    folders: ["ar-ios"]
  },
  {
    kind: "ios_usdz_runtime",
    pathKey: "usdzRuntimeStoragePath",
    bucketKey: "usdzRuntimeStorageBucket",
    extension: ".usdz",
    folders: ["ar-ios"]
  },
  {
    kind: "viewer_glb",
    pathKey: "viewerGlbStoragePath",
    bucketKey: "viewerGlbStorageBucket",
    extension: ".glb",
    folders: ["web"]
  },
  {
    kind: "usdz_report",
    pathKey: "usdzOptimizationReportStoragePath",
    extension: ".json",
    folders: ["manifests"]
  },
  {
    kind: "manifest",
    pathKey: "meshyManifestStoragePath",
    bucketKey: "meshyManifestStorageBucket",
    extension: ".json",
    folders: ["manifests"]
  },
  {
    kind: "manifest",
    pathKey: "meshy_manifest_storage_path",
    bucketKey: "meshy_manifest_storage_bucket",
    extension: ".json",
    folders: ["manifests"]
  },
  {
    kind: "manifest",
    pathKey: "meshyManifestPath",
    bucketKey: "meshyManifestStorageBucket",
    extension: ".json",
    folders: ["manifests"]
  },
  {
    kind: "manifest",
    pathKey: "meshy_manifest_path",
    bucketKey: "meshy_manifest_storage_bucket",
    extension: ".json",
    folders: ["manifests"]
  },
  {
    kind: "prepared_glb",
    pathKey: "preparedGlbStoragePath",
    extension: ".glb",
    folders: ["staging"]
  },
  {
    kind: "prepared_glb",
    pathKey: "prepared_glb_storage_path",
    extension: ".glb",
    folders: ["staging"]
  }
];

export const DISH_MODEL_METADATA_KEYS = [
  "model3dUrl",
  "model3d_url",
  "model3dStorageBucket",
  "model3d_storage_bucket",
  "model3dStoragePath",
  "model3d_storage_path",
  "webModel3dUrl",
  "web_model_3d_url",
  "arModel3dUrl",
  "ar_model_3d_url",
  "usdzUrl",
  "usdz_url",
  "arUsdzUrl",
  "ar_usdz_url",
  "iosUsdzUrl",
  "ios_usdz_url",
  "modelStatus",
  "model_status",
  "hasImmersiveView",
  "has_immersive_view",
  "has3d",
  "has_3d",
  "hasAr",
  "has_ar",
  "hasIosAr",
  "has_ios_ar",
  "hasAndroidAr",
  "has_android_ar",
  "posterUrl",
  "poster_url",
  "modelPosterUrl",
  "model_poster_url",
  "modelAssetVersion",
  "model_asset_version",
  "modelAssetSha256",
  "model_asset_sha256",
  "modelUpdatedAt",
  "model_updated_at",
  "modelCacheVersion",
  "model_cache_version",
  "meshyManifestVersion",
  "meshy_manifest_version",
  "meshyManifestPath",
  "meshy_manifest_path",
  "meshyLocalManifestPath",
  "meshy_local_manifest_path",
  "meshyManifestStorageBucket",
  "meshy_manifest_storage_bucket",
  "meshyManifestStoragePath",
  "meshy_manifest_storage_path",
  "sourceModel3dStorageBucket",
  "source_model_3d_storage_bucket",
  "sourceModel3dStoragePath",
  "source_model_3d_storage_path",
  "webModel3dStorageBucket",
  "web_model_3d_storage_bucket",
  "webModel3dStoragePath",
  "web_model_3d_storage_path",
  "arModel3dStorageBucket",
  "ar_model_3d_storage_bucket",
  "arModel3dStoragePath",
  "ar_model_3d_storage_path",
  "arUsdzStorageBucket",
  "ar_usdz_storage_bucket",
  "arUsdzStoragePath",
  "ar_usdz_storage_path",
  "preparedGlbBytes",
  "prepared_glb_bytes",
  "webModel3dBytes",
  "web_model_3d_bytes",
  "webGlbBytes",
  "web_glb_bytes",
  "meshoptBytes",
  "meshopt_bytes",
  "arModel3dBytes",
  "ar_model_3d_bytes",
  "arLiteGlbBytes",
  "ar_lite_glb_bytes",
  "arLiteBytes",
  "ar_lite_bytes",
  "arUsdzBytes",
  "ar_usdz_bytes",
  "iosUsdzBytes",
  "ios_usdz_bytes",
  "usdzBytes",
  "usdz_bytes",
  "preparedGlbSha256",
  "prepared_glb_sha256",
  "preparedGlbOriginalName",
  "prepared_glb_original_name",
  "preparedGlbJobId",
  "prepared_glb_job_id",
  "preparedGlbStoragePath",
  "prepared_glb_storage_path",
  "ownerMeshyPipeline",
  "owner_meshy_pipeline",
  "viewerGlbStatus",
  "viewerGlbStorageBucket",
  "viewerGlbStoragePath",
  "viewerGlbBytes",
  "viewerGlbSha256",
  "viewerGlbOriginalName",
  "viewerGlbUploadedAt",
  "usdzRuntimeStatus",
  "usdzRuntimeStorageBucket",
  "usdzRuntimeStoragePath",
  "usdzRuntimeBytes",
  "usdzRuntimeSha256",
  "usdzRuntimeContentType",
  "usdzRuntimeUploadedAt",
  "usdzOptimizationProfile",
  "usdzOptimizationReportStoragePath",
  "usdzOptimizationWarnings",
  "usdzOptimizationFails",
  "usdzOptimizationReductionPercent",
  "usdzGeometryOptimization",
  "usdzTriangleCountBefore",
  "usdzTriangleCountAfter",
  "usdzGeometryReductionPercent",
  "usdzPhysicalScaleStatus",
  "usdzPhysicalScaleDishKind",
  "usdzPhysicalScaleDimension",
  "usdzPhysicalScaleTargetMeters",
  "usdzPhysicalScaleMinMeters",
  "usdzPhysicalScaleMaxMeters",
  "usdzPhysicalScaleHeightBeforeMeters",
  "usdzPhysicalScaleWidthBeforeMeters",
  "usdzPhysicalScaleDepthBeforeMeters",
  "usdzPhysicalScaleFootprintBeforeMeters",
  "usdzPhysicalScaleHeightAfterMeters",
  "usdzPhysicalScaleWidthAfterMeters",
  "usdzPhysicalScaleDepthAfterMeters",
  "usdzPhysicalScaleFootprintAfterMeters",
  "usdzPhysicalScaleScaleFactor",
  "usdzPhysicalScaleCenteredX",
  "usdzPhysicalScaleCenteredY",
  "usdzPhysicalScaleGrounded",
  "usdzPhysicalScaleCenterOffsetBeforeMeters",
  "usdzPhysicalScaleCenterOffsetAfterMeters",
  "usdzPhysicalScaleWarnings",
  "usdzTextureCount",
  "usdzChangedTextures",
  "usdzOptimizationAttemptCount",
  "usdzOptimizationCandidateAttempts",
  "usdzSourceOriginalName",
  "usdzSourceBytes",
  "usdzSourceSha256",
  "usdzSourceProcessedAt",
  "usdzSourceStored",
  "usdzSourceRetention",
  "quickLookQaStatus"
] as const;

/** Metadata keys grouped by deletion target for granular admin deletes. */
export const VIEWER_GLB_DELETE_KEYS = [
  "model3dUrl",
  "model3d_url",
  "webModel3dUrl",
  "web_model_3d_url",
  "arModel3dUrl",
  "ar_model_3d_url",
  "webModel3dStorageBucket",
  "webModel3dStoragePath",
  "arModel3dStorageBucket",
  "arModel3dStoragePath",
  "webModel3dBytes",
  "arModel3dBytes",
  "viewerGlbStatus",
  "viewerGlbStorageBucket",
  "viewerGlbStoragePath",
  "viewerGlbBytes",
  "viewerGlbSha256",
  "viewerGlbOriginalName",
  "viewerGlbUploadedAt"
] as const;

export const USDZ_RUNTIME_DELETE_KEYS = [
  "arUsdzUrl",
  "ar_usdz_url",
  "usdzUrl",
  "usdz_url",
  "arUsdzStorageBucket",
  "arUsdzStoragePath",
  "arUsdzBytes",
  "usdzRuntimeStatus",
  "usdzRuntimeStorageBucket",
  "usdzRuntimeStoragePath",
  "usdzRuntimeBytes",
  "usdzRuntimeSha256",
  "usdzRuntimeContentType",
  "usdzRuntimeUploadedAt",
  "usdzOptimizationProfile",
  "usdzOptimizationWarnings",
  "usdzOptimizationFails",
  "usdzOptimizationReductionPercent",
  "usdzGeometryOptimization",
  "usdzTriangleCountBefore",
  "usdzTriangleCountAfter",
  "usdzGeometryReductionPercent",
  "usdzPhysicalScaleStatus",
  "usdzPhysicalScaleDishKind",
  "usdzPhysicalScaleDimension",
  "usdzPhysicalScaleTargetMeters",
  "usdzPhysicalScaleMinMeters",
  "usdzPhysicalScaleMaxMeters",
  "usdzPhysicalScaleHeightBeforeMeters",
  "usdzPhysicalScaleWidthBeforeMeters",
  "usdzPhysicalScaleDepthBeforeMeters",
  "usdzPhysicalScaleFootprintBeforeMeters",
  "usdzPhysicalScaleHeightAfterMeters",
  "usdzPhysicalScaleWidthAfterMeters",
  "usdzPhysicalScaleDepthAfterMeters",
  "usdzPhysicalScaleFootprintAfterMeters",
  "usdzPhysicalScaleScaleFactor",
  "usdzPhysicalScaleCenteredX",
  "usdzPhysicalScaleCenteredY",
  "usdzPhysicalScaleGrounded",
  "usdzPhysicalScaleCenterOffsetBeforeMeters",
  "usdzPhysicalScaleCenterOffsetAfterMeters",
  "usdzPhysicalScaleWarnings",
  "usdzTextureCount",
  "usdzChangedTextures",
  "usdzOptimizationAttemptCount",
  "usdzOptimizationCandidateAttempts",
  "usdzSourceOriginalName",
  "usdzSourceBytes",
  "usdzSourceSha256",
  "usdzSourceProcessedAt",
  "usdzSourceStored",
  "usdzSourceRetention",
  "quickLookQaStatus"
] as const;

export const USDZ_REPORT_DELETE_KEYS = ["usdzOptimizationReportStoragePath"] as const;

export type DishModelDeleteTarget = "all" | "viewer-glb" | "usdz-runtime" | "report";

/**
 * Collects only the storage targets and metadata keys for a specific delete
 * target, so the admin can remove the viewer GLB, the runtime USDZ, or the
 * report independently. There is never a source USDZ to remove (not stored).
 */
export function collectTargetedDishModelDeletion(
  metadataValue: unknown,
  restaurantId: string,
  target: DishModelDeleteTarget
): { targets: DishModelStorageTarget[]; clearKeys: readonly string[] } {
  if (target === "all") {
    return {
      targets: collectDishModelStorageTargets(metadataValue, restaurantId).targets,
      clearKeys: DISH_MODEL_METADATA_KEYS
    };
  }

  const kindsByTarget: Record<Exclude<DishModelDeleteTarget, "all">, Set<string>> = {
    "viewer-glb": new Set(["viewer_glb", "web_glb", "ar_lite_glb", "legacy_model_glb", "source_glb", "prepared_glb"]),
    // Removing the runtime USDZ also removes its linked report to avoid orphans.
    "usdz-runtime": new Set(["ios_usdz", "ios_usdz_runtime", "usdz_report"]),
    report: new Set(["usdz_report"])
  };
  const keysByTarget: Record<Exclude<DishModelDeleteTarget, "all">, readonly string[]> = {
    "viewer-glb": VIEWER_GLB_DELETE_KEYS,
    "usdz-runtime": [...USDZ_RUNTIME_DELETE_KEYS, ...USDZ_REPORT_DELETE_KEYS],
    report: USDZ_REPORT_DELETE_KEYS
  };

  const allTargets = collectDishModelStorageTargets(metadataValue, restaurantId).targets;
  const kinds = kindsByTarget[target];
  return {
    targets: allTargets.filter((entry) => kinds.has(entry.kind)),
    clearKeys: keysByTarget[target]
  };
}

/** Removes only the requested metadata keys and recomputes modelStatus. */
export function cleanTargetedDishModelMetadata(
  metadataValue: unknown,
  clearKeys: readonly string[]
): Record<string, unknown> {
  const metadata = getObjectMetadata(metadataValue);
  for (const key of clearKeys) {
    delete metadata[key];
  }
  const hasViewer =
    (typeof metadata.webModel3dUrl === "string" && metadata.webModel3dUrl.trim().length > 0) ||
    (typeof metadata.model3dUrl === "string" && metadata.model3dUrl.trim().length > 0);
  const hasUsdz =
    typeof metadata.arUsdzUrl === "string" && metadata.arUsdzUrl.trim().length > 0;
  if (!hasViewer && !hasUsdz) {
    metadata.modelStatus = DISH_MODEL_MISSING_STATUS;
  } else if (hasViewer && hasUsdz) {
    metadata.modelStatus = "ready";
  } else if (hasViewer) {
    metadata.modelStatus = "web_ready_usdz_pending";
  } else {
    metadata.modelStatus = "ready";
  }
  return metadata;
}

const MODEL_STATUSES = new Set([
  "ready",
  "web_ready_usdz_pending",
  "pending_manual_usdz",
  "usdz_conversion_failed",
  "pipeline_meshy",
  "web_ready"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getObjectMetadata(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return { ...value };
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return isRecord(parsed) ? { ...parsed } : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function getStringMetadata(
  metadata: Record<string, unknown>,
  key: string
): string {
  const value = metadata[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function hasSuspiciousEncoding(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.includes("%") ||
    lower.includes("%2e") ||
    lower.includes("%2f") ||
    lower.includes("%5c") ||
    lower.includes("%00")
  );
}

function safeFileName(value: string, extension: DishModelExtension): boolean {
  const lower = value.toLowerCase();
  if (!lower.endsWith(extension)) return false;
  return /^[a-z0-9][a-z0-9._-]*\.(?:glb|usdz|json)$/i.test(value);
}

export function isSafeDishModelStoragePath(
  path: string,
  restaurantId: string,
  allowedExtension: DishModelExtension,
  allowedFolders?: readonly DishModelFolder[]
): boolean {
  const storagePath = path.trim();
  if (!UUID_PATTERN.test(restaurantId)) return false;
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
  if (!storagePath.toLowerCase().endsWith(allowedExtension)) return false;

  const segments = storagePath.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return false;
  }
  if (
    segments.length < 5 ||
    segments[0] !== "restaurants" ||
    segments[1] !== restaurantId ||
    segments[2] !== "models"
  ) {
    return false;
  }

  const folder = segments[3] as DishModelFolder;
  if (allowedFolders?.length && !allowedFolders.includes(folder)) return false;

  const tail = segments.slice(4);
  if (folder === "staging") {
    return (
      allowedExtension === ".glb" &&
      tail.length === 2 &&
      /^[a-z0-9][a-z0-9._-]{7,100}$/i.test(tail[0]) &&
      tail[1] === "source.glb"
    );
  }
  if (folder === "source" || folder === "web" || folder === "ar-lite") {
    return allowedExtension === ".glb" && tail.length === 1 && safeFileName(tail[0], ".glb");
  }
  if (folder === "ar-ios") {
    return allowedExtension === ".usdz" && tail.length === 1 && safeFileName(tail[0], ".usdz");
  }
  if (folder === "manifests") {
    return allowedExtension === ".json" && tail.length === 1 && safeFileName(tail[0], ".json");
  }

  return false;
}

export function collectDishModelStorageTargets(
  metadataValue: unknown,
  restaurantId: string
): DishModelStorageTargets {
  const metadata = getObjectMetadata(metadataValue);
  const targets: DishModelStorageTarget[] = [];
  const skipped: DishModelSkippedTarget[] = [];
  const seen = new Set<string>();

  for (const candidate of STORAGE_CANDIDATES) {
    const path = getStringMetadata(metadata, candidate.pathKey);
    if (!path) continue;

    const bucket = candidate.bucketKey
      ? getStringMetadata(metadata, candidate.bucketKey) || DISH_MODEL_STORAGE_BUCKET
      : DISH_MODEL_STORAGE_BUCKET;

    if (bucket !== DISH_MODEL_STORAGE_BUCKET) {
      skipped.push({
        bucket,
        path,
        kind: candidate.kind,
        metadataPathKey: candidate.pathKey,
        reason: "unsafe_bucket"
      });
      continue;
    }

    if (
      !isSafeDishModelStoragePath(
        path,
        restaurantId,
        candidate.extension,
        candidate.folders
      )
    ) {
      skipped.push({
        bucket,
        path,
        kind: candidate.kind,
        metadataPathKey: candidate.pathKey,
        reason: "unsafe_path"
      });
      continue;
    }

    const identity = `${bucket}:${path}`;
    if (seen.has(identity)) {
      skipped.push({
        bucket,
        path,
        kind: candidate.kind,
        metadataPathKey: candidate.pathKey,
        reason: "duplicate"
      });
      continue;
    }

    seen.add(identity);
    targets.push({
      bucket: DISH_MODEL_STORAGE_BUCKET,
      path,
      kind: candidate.kind,
      metadataPathKey: candidate.pathKey
    });
  }

  return { targets, skipped };
}

export function groupTargetsByBucket(
  targets: DishModelStorageTarget[]
): Map<typeof DISH_MODEL_STORAGE_BUCKET, string[]> {
  const groups = new Map<typeof DISH_MODEL_STORAGE_BUCKET, string[]>();
  for (const target of targets) {
    const paths = groups.get(target.bucket) ?? [];
    paths.push(target.path);
    groups.set(target.bucket, paths);
  }
  return groups;
}

export function cleanDishModelMetadata(metadataValue: unknown): Record<string, unknown> {
  const metadata = getObjectMetadata(metadataValue);
  for (const key of DISH_MODEL_METADATA_KEYS) {
    delete metadata[key];
  }
  return {
    ...metadata,
    modelStatus: DISH_MODEL_MISSING_STATUS
  };
}

export function hasDishModelMetadata(metadataValue: unknown): boolean {
  const metadata = getObjectMetadata(metadataValue);
  for (const key of DISH_MODEL_METADATA_KEYS) {
    if (!(key in metadata)) continue;

    if (key === "modelStatus" || key === "model_status") {
      const status = getStringMetadata(metadata, key);
      if (MODEL_STATUSES.has(status)) return true;
      continue;
    }

    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return true;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return true;
    if (typeof value === "boolean" && value) return true;
    if (Array.isArray(value) && value.length > 0) return true;
    if (isRecord(value) && Object.keys(value).length > 0) return true;
  }
  return false;
}
