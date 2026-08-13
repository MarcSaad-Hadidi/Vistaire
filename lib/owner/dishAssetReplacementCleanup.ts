import type { SupabaseClient } from "@supabase/supabase-js";

type DishAssetKind =
  | "photo"
  | "web-glb"
  | "ar-lite-glb"
  | "ios-usdz"
  | "source-glb"
  | "manifest"
  | "report";

export type DishAssetRef = {
  kind: DishAssetKind;
  bucket: string;
  path: string;
  metadataKeys: string[];
  requiredPrefix: string;
};

export type CleanupReplacedDishAssetsReport = {
  candidates: DishAssetRef[];
  deleted: DishAssetRef[];
  skippedStillReferenced: DishAssetRef[];
  skippedUnsafeBucket: DishAssetRef[];
  skippedUnsafePrefix: DishAssetRef[];
  skippedMissingPath: DishAssetRef[];
  errors: Array<{ bucket: string; paths: string[]; message: string }>;
};

type CleanupReplacedDishAssetsArgs = {
  client: SupabaseClient;
  dishId: string;
  restaurantId: string;
  previousMetadata: unknown;
  nextMetadata: unknown;
  reason: string;
};

type MetadataCandidate = {
  kind: DishAssetKind;
  bucketKey: string;
  pathKey: string;
  defaultBucket: string;
  requiredPrefix: (restaurantId: string) => string;
};

const PHOTO_DERIVATIVE_VARIANTS = ["thumbnail", "display"] as const;

const MEDIA_BUCKET = "vistaire-media";
const MODEL_BUCKET = "vistaire-3d";
const ALLOWED_BUCKETS = new Set([MEDIA_BUCKET, MODEL_BUCKET]);

const METADATA_CANDIDATES: MetadataCandidate[] = [
  {
    kind: "photo",
    bucketKey: "photoStorageBucket",
    pathKey: "photoStoragePath",
    defaultBucket: MEDIA_BUCKET,
    requiredPrefix: (restaurantId) => `restaurants/${restaurantId}/photos/originals/`
  },
  {
    kind: "web-glb",
    bucketKey: "webModel3dStorageBucket",
    pathKey: "webModel3dStoragePath",
    defaultBucket: MODEL_BUCKET,
    requiredPrefix: (restaurantId) => `restaurants/${restaurantId}/models/web/`
  },
  {
    kind: "ar-lite-glb",
    bucketKey: "arModel3dStorageBucket",
    pathKey: "arModel3dStoragePath",
    defaultBucket: MODEL_BUCKET,
    requiredPrefix: (restaurantId) => `restaurants/${restaurantId}/models/ar-lite/`
  },
  {
    kind: "ios-usdz",
    bucketKey: "arUsdzStorageBucket",
    pathKey: "arUsdzStoragePath",
    defaultBucket: MODEL_BUCKET,
    requiredPrefix: (restaurantId) => `restaurants/${restaurantId}/models/ar-ios/`
  },
  {
    kind: "ios-usdz",
    bucketKey: "usdzRuntimeStorageBucket",
    pathKey: "usdzRuntimeStoragePath",
    defaultBucket: MODEL_BUCKET,
    requiredPrefix: (restaurantId) => `restaurants/${restaurantId}/models/ar-ios/`
  },
  {
    kind: "source-glb",
    bucketKey: "sourceModel3dStorageBucket",
    pathKey: "sourceModel3dStoragePath",
    defaultBucket: MODEL_BUCKET,
    requiredPrefix: (restaurantId) => `restaurants/${restaurantId}/models/source/`
  },
  {
    kind: "manifest",
    bucketKey: "meshyManifestStorageBucket",
    pathKey: "meshyManifestStoragePath",
    defaultBucket: MODEL_BUCKET,
    requiredPrefix: (restaurantId) => `restaurants/${restaurantId}/models/manifests/`
  },
  {
    kind: "report",
    bucketKey: "usdzOptimizationReportStorageBucket",
    pathKey: "usdzOptimizationReportStoragePath",
    defaultBucket: MODEL_BUCKET,
    requiredPrefix: (restaurantId) => `restaurants/${restaurantId}/models/manifests/`
  }
];

function getMetadataObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? { ...(parsed as Record<string, unknown>) }
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function getString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function identity(ref: Pick<DishAssetRef, "bucket" | "path">): string {
  return `${ref.bucket}\u0000${ref.path}`;
}

function emptyReport(): CleanupReplacedDishAssetsReport {
  return {
    candidates: [],
    deleted: [],
    skippedStillReferenced: [],
    skippedUnsafeBucket: [],
    skippedUnsafePrefix: [],
    skippedMissingPath: [],
    errors: []
  };
}

function hasDangerousPathShape(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    !path ||
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("//") ||
    path.includes("?") ||
    path.includes("#") ||
    path.includes(":") ||
    lower.includes("%") ||
    lower.startsWith("http://") ||
    lower.startsWith("https://")
  );
}

export function extractDishAssetRefsFromMetadata(
  metadataValue: unknown,
  restaurantId: string
): DishAssetRef[] {
  const metadata = getMetadataObject(metadataValue);
  const refs: DishAssetRef[] = [];
  const seen = new Set<string>();

  for (const candidate of METADATA_CANDIDATES) {
    const path = getString(metadata, candidate.pathKey);
    if (!path) continue;
    const bucket = getString(metadata, candidate.bucketKey) || candidate.defaultBucket;
    const ref: DishAssetRef = {
      kind: candidate.kind,
      bucket,
      path,
      metadataKeys: [candidate.bucketKey, candidate.pathKey],
      requiredPrefix: candidate.requiredPrefix(restaurantId)
    };
    const refIdentity = identity(ref);
    if (seen.has(refIdentity)) continue;
    seen.add(refIdentity);
    refs.push(ref);
  }

  const photoDerivatives = getMetadataObject(metadata.photoDerivatives);
  for (const variant of PHOTO_DERIVATIVE_VARIANTS) {
    const derivative = getMetadataObject(photoDerivatives[variant]);
    const path = getString(derivative, "storagePath");
    if (!path) continue;
    const ref: DishAssetRef = {
      kind: "photo",
      bucket: MEDIA_BUCKET,
      path,
      metadataKeys: ["photoDerivatives", variant, "storagePath"],
      requiredPrefix: `restaurants/${restaurantId}/photos/derivatives/`
    };
    const refIdentity = identity(ref);
    if (seen.has(refIdentity)) continue;
    seen.add(refIdentity);
    refs.push(ref);
  }

  return refs;
}

function isRefInSet(ref: DishAssetRef, refs: Set<string>): boolean {
  return refs.has(identity(ref));
}

function isSafeBucket(ref: DishAssetRef): boolean {
  return ALLOWED_BUCKETS.has(ref.bucket);
}

function isSafePrefix(ref: DishAssetRef): boolean {
  if (hasDangerousPathShape(ref.path) || !ref.path.startsWith(ref.requiredPrefix)) {
    return false;
  }
  if (ref.requiredPrefix.includes("/photos/derivatives/")) {
    return new RegExp(
      `^${escapeRegExp(ref.requiredPrefix)}[a-f0-9]{64}/(?:thumbnail|display)\\.webp$`,
      "i"
    ).test(ref.path);
  }
  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchCurrentDishRefs(args: {
  client: SupabaseClient;
  dishId: string;
  restaurantId: string;
}): Promise<{ refs: DishAssetRef[]; error?: string }> {
  try {
    const current = await args.client
      .from("menu_dishes")
      .select("metadata")
      .eq("id", args.dishId)
      .eq("restaurant_id", args.restaurantId)
      .maybeSingle();
    if (current.error || !current.data) {
      return { refs: [], error: "Metadata active impossible a relire avant cleanup." };
    }
    return {
      refs: extractDishAssetRefsFromMetadata(
        (current.data as { metadata?: unknown }).metadata,
        args.restaurantId
      )
    };
  } catch {
    return { refs: [], error: "Metadata active impossible a relire avant cleanup." };
  }
}

async function fetchOtherDishRefs(args: {
  client: SupabaseClient;
  dishId: string;
  restaurantId: string;
}): Promise<{ refs: DishAssetRef[]; error?: string }> {
  try {
    const rows = await args.client
      .from("menu_dishes")
      .select("id,metadata")
      .eq("restaurant_id", args.restaurantId)
      .neq("id", args.dishId);
    if (rows.error || !Array.isArray(rows.data)) {
      return { refs: [], error: "References des autres plats impossibles a verifier." };
    }

    const refs: DishAssetRef[] = [];
    for (const row of rows.data as Array<{ metadata?: unknown }>) {
      refs.push(...extractDishAssetRefsFromMetadata(row.metadata, args.restaurantId));
    }
    return { refs };
  } catch {
    return { refs: [], error: "References des autres plats impossibles a verifier." };
  }
}

export async function cleanupReplacedDishAssets(
  args: CleanupReplacedDishAssetsArgs
): Promise<CleanupReplacedDishAssetsReport> {
  const report = emptyReport();
  void args.reason;

  const previousRefs = extractDishAssetRefsFromMetadata(args.previousMetadata, args.restaurantId);
  const suppliedNextRefs = extractDishAssetRefsFromMetadata(args.nextMetadata, args.restaurantId);
  const suppliedNextIdentities = new Set(suppliedNextRefs.map(identity));
  report.candidates = previousRefs.filter((ref) => !isRefInSet(ref, suppliedNextIdentities));
  if (report.candidates.length === 0) return report;

  const current = await fetchCurrentDishRefs(args);
  if (current.error) {
    report.errors.push({ bucket: "", paths: [], message: current.error });
    report.skippedStillReferenced.push(...report.candidates);
    return report;
  }

  const activeCurrentIdentities = new Set(current.refs.map(identity));
  const other = await fetchOtherDishRefs(args);
  if (other.error) {
    report.errors.push({ bucket: "", paths: [], message: other.error });
    report.skippedStillReferenced.push(...report.candidates);
    return report;
  }
  const otherIdentities = new Set(other.refs.map(identity));
  const deletable: DishAssetRef[] = [];
  const deletableSeen = new Set<string>();

  for (const ref of report.candidates) {
    if (!ref.path) {
      report.skippedMissingPath.push(ref);
      continue;
    }
    if (!isSafeBucket(ref)) {
      report.skippedUnsafeBucket.push(ref);
      continue;
    }
    if (!isSafePrefix(ref)) {
      report.skippedUnsafePrefix.push(ref);
      continue;
    }
    if (isRefInSet(ref, activeCurrentIdentities) || isRefInSet(ref, otherIdentities)) {
      report.skippedStillReferenced.push(ref);
      continue;
    }
    const refIdentity = identity(ref);
    if (deletableSeen.has(refIdentity)) continue;
    deletableSeen.add(refIdentity);
    deletable.push(ref);
  }

  const byBucket = new Map<string, DishAssetRef[]>();
  for (const ref of deletable) {
    const refs = byBucket.get(ref.bucket) ?? [];
    refs.push(ref);
    byBucket.set(ref.bucket, refs);
  }

  for (const [bucket, refs] of byBucket) {
    const paths = refs.map((ref) => ref.path);
    if (paths.length === 0) continue;
    try {
      const removal = await args.client.storage.from(bucket).remove(paths);
      if (removal.error) {
        report.errors.push({
          bucket,
          paths,
          message: removal.error.message || "Suppression Storage impossible."
        });
        continue;
      }
      report.deleted.push(...refs);
    } catch (error) {
      report.errors.push({
        bucket,
        paths,
        message: error instanceof Error ? error.message : "Suppression Storage impossible."
      });
      continue;
    }
  }

  return report;
}
