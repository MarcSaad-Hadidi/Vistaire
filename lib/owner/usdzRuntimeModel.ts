import { createHash } from "node:crypto";

import {
  buildPreparedModelPublicArLiteGlbPath,
  buildPreparedModelPublicGlbPath,
  buildPreparedModelPublicUsdzPath,
  buildPreparedModelUsdzStoragePath,
  buildPreparedModelWebStoragePath
} from "./preparedModelWorkflow.ts";

export const MODEL_BUCKET = "vistaire-3d";

/**
 * Fields that must NEVER be persisted on a dish. They would imply the heavy
 * source/master USDZ (or a raw/failed candidate) is stored durably. The P0
 * guarantee is that only the optimized runtime USDZ is ever uploaded, so these
 * keys are hard-forbidden and asserted by both this module and a repo test.
 */
export const FORBIDDEN_SOURCE_STORAGE_FIELDS = [
  "usdzSourceStoragePath",
  "sourceUsdzStoragePath",
  "masterUsdzStoragePath",
  "usdzSourceStorageBucket",
  "sourceUsdzPublicUrl",
  "masterUsdzUrl",
  "rawUsdzStoragePath",
  "unoptimizedUsdzStoragePath",
  "failedCandidateUsdzStoragePath"
] as const;

export type UsdzOptimizationProfile = "premium" | "balanced" | "light" | "emergency";

export type UsdzOptimizationProfileConfig = {
  slug: UsdzOptimizationProfile;
  label: string;
  baseColorMax: number;
  normalMax: number;
  ormMax: number;
  jpegQuality: number;
  targetMaxBytes: number;
};

/**
 * Texture/size targets per profile. These are honest optimization budgets,
 * not "texture 640 + JPEG Q56". Data maps (normal/roughness/metallic/AO) are
 * kept at higher resolution and are never re-encoded as lossy sRGB by the
 * worker; only base color is JPEG-compressed.
 */
export const USDZ_OPTIMIZATION_PROFILES: Record<
  UsdzOptimizationProfile,
  UsdzOptimizationProfileConfig
> = {
  premium: {
    slug: "premium",
    label: "Premium",
    baseColorMax: 2048,
    normalMax: 1536,
    ormMax: 1536,
    jpegQuality: 90,
    targetMaxBytes: 16 * 1024 * 1024
  },
  balanced: {
    slug: "balanced",
    label: "Balanced",
    baseColorMax: 1536,
    normalMax: 1280,
    ormMax: 1024,
    jpegQuality: 88,
    targetMaxBytes: 12 * 1024 * 1024
  },
  light: {
    slug: "light",
    label: "Light",
    baseColorMax: 1024,
    normalMax: 1024,
    ormMax: 1024,
    jpegQuality: 84,
    targetMaxBytes: 10 * 1024 * 1024
  },
  emergency: {
    slug: "emergency",
    label: "Emergency",
    baseColorMax: 768,
    normalMax: 768,
    ormMax: 768,
    jpegQuality: 76,
    targetMaxBytes: 5.5 * 1024 * 1024
  }
};

export const DEFAULT_USDZ_OPTIMIZATION_PROFILE: UsdzOptimizationProfile = "balanced";

export function isUsdzOptimizationProfile(value: unknown): value is UsdzOptimizationProfile {
  return value === "premium" || value === "balanced" || value === "light" || value === "emergency";
}

export const DEFAULT_USDZ_SOURCE_MAX_BYTES = 150 * 1024 * 1024;
export const HARD_USDZ_SOURCE_MAX_BYTES = 512 * 1024 * 1024;
export const DEFAULT_USDZ_RUNTIME_MAX_BYTES = 16 * 1024 * 1024;
export const HARD_USDZ_RUNTIME_MAX_BYTES = 64 * 1024 * 1024;

type UploadEnv = Record<string, string | undefined>;

function parsePositiveIntEnv(
  raw: string | undefined,
  fallback: number,
  hardMax: number
): { ok: true; maxBytes: number } | { ok: false; error: string } {
  if (!raw) return { ok: true, maxBytes: fallback };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > hardMax) {
    return { ok: false, error: "Upload size cap is invalid." };
  }
  return { ok: true, maxBytes: parsed };
}

export function parseUsdzSourceUploadLimit(env: UploadEnv) {
  return parsePositiveIntEnv(
    env.VISTAIRE_USDZ_SOURCE_UPLOAD_MAX_BYTES,
    DEFAULT_USDZ_SOURCE_MAX_BYTES,
    HARD_USDZ_SOURCE_MAX_BYTES
  );
}

export function parseUsdzRuntimeMaxBytes(env: UploadEnv) {
  return parsePositiveIntEnv(
    env.VISTAIRE_USDZ_RUNTIME_MAX_BYTES,
    DEFAULT_USDZ_RUNTIME_MAX_BYTES,
    HARD_USDZ_RUNTIME_MAX_BYTES
  );
}

const ALLOWED_USDZ_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "model/vnd.usdz+zip",
  "model/vnd.pixar.usd",
  "model/vnd.usd+zip"
]);

const ZIP_LOCAL_FILE_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_EOCD_SIGNATURE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const GIT_LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";

function normalizeBytes(bytes: ArrayBuffer | ArrayBufferView): Buffer {
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function isGitLfsPointer(bytes: Buffer): boolean {
  return bytes.subarray(0, 120).toString("utf8").startsWith(GIT_LFS_POINTER_PREFIX);
}

export function sha256Hex(bytes: ArrayBuffer | ArrayBufferView): string {
  return createHash("sha256").update(normalizeBytes(bytes)).digest("hex");
}

export function sanitizeUsdzOriginalName(value: string): string {
  const basename = value.split(/[\\/]+/).filter(Boolean).pop() ?? "source.usdz";
  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return cleaned || "source.usdz";
}

/**
 * Validates a USDZ file's outer shape. This is a fast structural gate used for
 * BOTH the source upload (before transient processing) and the runtime output
 * (before Supabase upload). It never trusts the extension alone.
 */
export function validateUsdzFile(
  file: {
    name: string;
    type: string;
    size: number;
    bytes: ArrayBuffer | ArrayBufferView;
  },
  maxBytes: number
):
  | { ok: true; originalName: string; bytes: Buffer }
  | { ok: false; error: string; status: 400 | 413 } {
  const originalName = sanitizeUsdzOriginalName(file.name);
  const lowerName = originalName.toLowerCase();

  if (/[\\/]/.test(file.name) || file.name.includes("..")) {
    return { ok: false, error: "Le nom du fichier USDZ ne doit pas contenir de chemin.", status: 400 };
  }
  if (!lowerName.endsWith(".usdz")) {
    return { ok: false, error: "Seuls les fichiers .usdz sont acceptes.", status: 400 };
  }

  const declaredSize = Number(file.size);
  if (!Number.isFinite(declaredSize) || declaredSize <= 0) {
    return { ok: false, error: "Le fichier USDZ est vide.", status: 400 };
  }
  if (declaredSize > maxBytes) {
    return { ok: false, error: "Le fichier USDZ depasse la limite d'upload.", status: 413 };
  }

  const bytes = normalizeBytes(file.bytes);
  if (bytes.byteLength !== declaredSize || bytes.byteLength > maxBytes) {
    return { ok: false, error: "La taille du fichier USDZ ne correspond pas au corps de la requete.", status: 400 };
  }

  const mimeType = (file.type || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_USDZ_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "Le type MIME du fichier USDZ n'est pas accepte.", status: 400 };
  }

  const structureError = validateUsdzStructure(bytes);
  if (structureError) return { ok: false, error: structureError, status: 400 };

  return { ok: true, originalName, bytes };
}

/**
 * Structural validation of USDZ bytes (a ZIP with USD payload). Used to gate
 * the runtime output before upload. Returns an error string or null.
 */
export function validateUsdzStructure(bytes: Buffer): string | null {
  if (bytes.byteLength < 40) return "Le fichier USDZ est incomplet.";
  if (isGitLfsPointer(bytes)) return "Le fichier USDZ est un pointeur Git LFS, pas un vrai binaire.";
  if (!bytes.subarray(0, 4).equals(ZIP_LOCAL_FILE_SIGNATURE)) {
    return "Signature USDZ/ZIP invalide.";
  }
  if (!bytes.includes(ZIP_EOCD_SIGNATURE)) {
    return "Le marqueur de fin d'archive USDZ (EOCD) est manquant.";
  }
  return null;
}

export type RuntimeUsdzGateInput = {
  runtimeBytes: Buffer;
  sourceBytes: number;
  sourceSha256: string;
  maxRuntimeBytes: number;
  reportGenerated: boolean;
  sourceCleaned: boolean;
  optimizationExpected: boolean;
};

export type RuntimeUsdzGateResult =
  | { ok: true; runtimeSha256: string }
  | { ok: false; error: string };

/**
 * The hard gate that must pass before ANY runtime USDZ is uploaded to Supabase.
 * If it fails, the caller must upload nothing and clean temp files.
 */
export function evaluateRuntimeUsdzUploadGate(input: RuntimeUsdzGateInput): RuntimeUsdzGateResult {
  const structureError = validateUsdzStructure(input.runtimeBytes);
  if (structureError) return { ok: false, error: `Runtime USDZ invalide: ${structureError}` };

  if (input.runtimeBytes.byteLength <= 0) {
    return { ok: false, error: "Runtime USDZ vide." };
  }
  if (input.runtimeBytes.byteLength > input.maxRuntimeBytes) {
    return { ok: false, error: "Runtime USDZ au-dessus de la limite runtime." };
  }
  if (!input.reportGenerated) {
    return { ok: false, error: "Rapport d'optimisation manquant." };
  }
  if (!input.sourceCleaned) {
    return { ok: false, error: "Nettoyage du fichier source non confirme." };
  }

  const runtimeSha256 = sha256Hex(input.runtimeBytes);
  if (
    input.optimizationExpected &&
    runtimeSha256 === input.sourceSha256 &&
    input.runtimeBytes.byteLength === input.sourceBytes
  ) {
    return { ok: false, error: "Le runtime USDZ est identique au source; optimisation non appliquee." };
  }

  return { ok: true, runtimeSha256 };
}

const DATE_TAG_PATTERN = /-/g;

function dateTag(): string {
  return new Date().toISOString().slice(0, 10).replace(DATE_TAG_PATTERN, "");
}

/**
 * A shared, monotonic-ish model asset version. It is re-stamped on every
 * upload (viewer GLB or USDZ runtime) so the two public proxies, which both
 * compare against a single `modelAssetVersion`, always agree and caches bust.
 */
export function createModelAssetVersion(seedSha256?: string): string {
  const seed =
    seedSha256 && /^[a-f0-9]{6,}$/i.test(seedSha256)
      ? seedSha256.slice(0, 8)
      : createHash("sha256").update(`${Date.now()}:${Math.random()}`).digest("hex").slice(0, 8);
  return `${dateTag()}-${seed}`.toLowerCase();
}

export function createUsdzRuntimeAssetVersion(args: {
  profile: UsdzOptimizationProfile;
  runtimeSha256: string;
}): string {
  const seed = createHash("sha256")
    .update(`${args.profile}:${args.runtimeSha256}`)
    .digest("hex");
  return createModelAssetVersion(seed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getMetadataObject(value: unknown): Record<string, unknown> {
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

/**
 * Hard guard: throws if metadata contains any forbidden source-storage field
 * with a non-empty value. Called right before persisting dish metadata.
 */
export function assertNoForbiddenSourceStorage(metadata: Record<string, unknown>): void {
  for (const field of FORBIDDEN_SOURCE_STORAGE_FIELDS) {
    const value = metadata[field];
    const present =
      (typeof value === "string" && value.trim().length > 0) ||
      (typeof value === "number" && value > 0) ||
      value === true ||
      isRecord(value) ||
      Array.isArray(value);
    if (present) {
      throw new Error(`Champ de stockage source interdit detecte: ${field}.`);
    }
  }
}

export type ViewerGlbUploadInputs = {
  restaurantId: string;
  dishId: string;
  dishSlug: string;
  version: string;
  bytes: number;
  sha256: string;
  originalName: string;
  uploadedAt: string;
};

export type ViewerGlbStoragePlan = {
  bucket: string;
  webStoragePath: string;
};

export function buildViewerGlbStoragePlan(args: {
  restaurantId: string;
  dishSlug: string;
  version: string;
}): ViewerGlbStoragePlan {
  return {
    bucket: MODEL_BUCKET,
    webStoragePath: buildPreparedModelWebStoragePath({
      restaurantId: args.restaurantId,
      dishSlug: args.dishSlug,
      assetVersion: args.version
    })
  };
}

/**
 * Metadata keys that describe an Android AR-lite GLB. A viewer GLB is NOT an
 * AR-lite asset, so a viewer upload clears these to guarantee the public never
 * reports Android AR ready from a viewer-only dish.
 */
export const VIEWER_GLB_CLEARED_AR_LITE_FIELDS = [
  "arModel3dUrl",
  "ar_model_3d_url",
  "arModel3dStorageBucket",
  "ar_model_3d_storage_bucket",
  "arModel3dStoragePath",
  "ar_model_3d_storage_path",
  "arModel3dBytes",
  "ar_model_3d_bytes"
] as const;

/**
 * The metadata patch for a viewer GLB upload. Preserves the web public contract
 * (webModel3dUrl/model3dUrl + storage paths + version) and adds additive
 * viewerGlb* fields. It NEVER sets any AR-lite (arModel3d*) field, so a
 * viewer-only dish is not treated as Android AR ready, and it never derives or
 * references any USDZ.
 */
export function buildViewerGlbMetadataPatch(
  inputs: ViewerGlbUploadInputs,
  plan: ViewerGlbStoragePlan
): Record<string, unknown> {
  const webUrl = buildPreparedModelPublicGlbPath(inputs.dishId, { assetVersion: inputs.version });

  return {
    model3dUrl: webUrl,
    webModel3dUrl: webUrl,
    webModel3dStorageBucket: plan.bucket,
    webModel3dStoragePath: plan.webStoragePath,
    webModel3dBytes: inputs.bytes,
    modelAssetVersion: inputs.version,
    modelAssetSha256: inputs.sha256,
    modelUpdatedAt: inputs.uploadedAt,
    viewerGlbStatus: "ready",
    viewerGlbStorageBucket: plan.bucket,
    viewerGlbStoragePath: plan.webStoragePath,
    viewerGlbBytes: inputs.bytes,
    viewerGlbSha256: inputs.sha256,
    viewerGlbOriginalName: inputs.originalName,
    viewerGlbUploadedAt: inputs.uploadedAt
  };
}

export type UsdzRuntimeUploadInputs = {
  restaurantId: string;
  dishId: string;
  dishSlug: string;
  version: string;
  runtimeBytes: number;
  runtimeSha256: string;
  reportStoragePath: string;
  profile: UsdzOptimizationProfile;
  warnings: string[];
  fails: string[];
  reductionPercent?: number;
  geometryOptimization?: string;
  triangleCountBefore?: number;
  triangleCountAfter?: number;
  geometryReductionPercent?: number;
  textureCount?: number;
  changedTextures?: number;
  candidateAttempts?: unknown[];
  attemptCount?: number;
  source: {
    originalName: string;
    bytes: number;
    sha256: string;
    processedAt: string;
  };
  uploadedAt: string;
};

export function buildUsdzRuntimeStoragePath(args: {
  restaurantId: string;
  dishSlug: string;
  version: string;
}): string {
  return buildPreparedModelUsdzStoragePath({
    restaurantId: args.restaurantId,
    dishSlug: args.dishSlug,
    assetVersion: args.version
  });
}

/**
 * The metadata patch for a validated runtime USDZ. Stores ONLY the runtime and
 * non-binary source metadata. `usdzSourceStored:false` and Quick Look QA
 * remains `not-tested` until a real iPhone validates it.
 */
export function buildUsdzRuntimeMetadataPatch(
  inputs: UsdzRuntimeUploadInputs,
  runtimeStoragePath: string
): Record<string, unknown> {
  const usdzUrl = buildPreparedModelPublicUsdzPath(inputs.dishId, { assetVersion: inputs.version });

  return {
    arUsdzUrl: usdzUrl,
    usdzUrl: "",
    arUsdzStorageBucket: MODEL_BUCKET,
    arUsdzStoragePath: runtimeStoragePath,
    arUsdzBytes: inputs.runtimeBytes,
    modelAssetVersion: inputs.version,
    usdzRuntimeStatus: "ready",
    usdzRuntimeStorageBucket: MODEL_BUCKET,
    usdzRuntimeStoragePath: runtimeStoragePath,
    usdzRuntimeBytes: inputs.runtimeBytes,
    usdzRuntimeSha256: inputs.runtimeSha256,
    usdzRuntimeContentType: "model/vnd.usdz+zip",
    usdzRuntimeUploadedAt: inputs.uploadedAt,
    usdzOptimizationProfile: inputs.profile,
    usdzOptimizationReportStoragePath: inputs.reportStoragePath,
    usdzOptimizationWarnings: inputs.warnings,
    usdzOptimizationFails: inputs.fails,
    usdzOptimizationReductionPercent: inputs.reductionPercent ?? 0,
    usdzGeometryOptimization: inputs.geometryOptimization ?? "unknown",
    usdzTriangleCountBefore: inputs.triangleCountBefore ?? 0,
    usdzTriangleCountAfter: inputs.triangleCountAfter ?? 0,
    usdzGeometryReductionPercent: inputs.geometryReductionPercent ?? 0,
    usdzTextureCount: inputs.textureCount ?? 0,
    usdzChangedTextures: inputs.changedTextures ?? 0,
    usdzOptimizationAttemptCount: inputs.attemptCount ?? 0,
    usdzOptimizationCandidateAttempts: inputs.candidateAttempts ?? [],
    usdzSourceOriginalName: inputs.source.originalName,
    usdzSourceBytes: inputs.source.bytes,
    usdzSourceSha256: inputs.source.sha256,
    usdzSourceProcessedAt: inputs.source.processedAt,
    usdzSourceStored: false,
    usdzSourceRetention: "none",
    quickLookQaStatus: "not-tested"
  };
}

/**
 * Re-stamps the public URLs of assets already present in metadata to a new
 * shared version. Storage paths are left untouched (the proxies resolve via
 * storage path and only compare `?v=` against modelAssetVersion).
 */
export function restampPublicModelUrls(
  metadata: Record<string, unknown>,
  dishId: string,
  version: string
): Record<string, unknown> {
  const next = { ...metadata };
  const hasWeb = typeof metadata.webModel3dStoragePath === "string" && metadata.webModel3dStoragePath.trim().length > 0;
  const hasArLite = typeof metadata.arModel3dStoragePath === "string" && metadata.arModel3dStoragePath.trim().length > 0;
  const hasUsdz = typeof metadata.arUsdzStoragePath === "string" && metadata.arUsdzStoragePath.trim().length > 0;

  if (hasWeb) {
    const webUrl = buildPreparedModelPublicGlbPath(dishId, { assetVersion: version });
    next.webModel3dUrl = webUrl;
    next.model3dUrl = webUrl;
  }
  if (hasArLite) {
    next.arModel3dUrl = buildPreparedModelPublicArLiteGlbPath(dishId, { assetVersion: version });
  }
  if (hasUsdz) {
    next.arUsdzUrl = buildPreparedModelPublicUsdzPath(dishId, { assetVersion: version });
  }
  next.modelAssetVersion = version;
  return next;
}

/**
 * Computes the legacy `modelStatus` from the split viewer/runtime state so the
 * existing public renderer and admin fallbacks keep working.
 */
export function computeSplitModelStatus(metadata: Record<string, unknown>): string {
  const hasViewer =
    (typeof metadata.webModel3dUrl === "string" && metadata.webModel3dUrl.trim().length > 0) ||
    (typeof metadata.model3dUrl === "string" && metadata.model3dUrl.trim().length > 0);
  const hasRuntimeUsdz =
    typeof metadata.arUsdzUrl === "string" && metadata.arUsdzUrl.trim().length > 0;

  if (hasViewer && hasRuntimeUsdz) return "ready";
  if (hasViewer && !hasRuntimeUsdz) return "web_ready_usdz_pending";
  if (!hasViewer && hasRuntimeUsdz) return "ready";
  return "missing";
}
