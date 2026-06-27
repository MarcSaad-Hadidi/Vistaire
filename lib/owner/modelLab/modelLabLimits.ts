import type { ModelLabInspectionReport } from "@/lib/owner/modelLab/inspectGlb";
import type { ModelLabPresetId } from "@/lib/owner/modelLab/modelLabPresets";

export const DEFAULT_MODEL_LAB_MAX_BYTES = 25 * 1024 * 1024;
export const HARD_MODEL_LAB_MAX_BYTES = 50 * 1024 * 1024;
export const MODEL_LAB_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
export const MODEL_LAB_OPTIMIZE_TIMEOUT_MS = 45_000;
export const MODEL_LAB_OPTIMIZED_MAX_BYTES = HARD_MODEL_LAB_MAX_BYTES;

export const MODEL_LAB_COMPLEXITY_LIMITS = {
  triangles: 500_000,
  vertices: 1_000_000,
  accessors: 5_000,
  accessorElements: 3_000_000,
  meshCount: 1_000,
  primitives: 2_000,
  images: 48,
  maxTexturePixels: 67_108_864,
  totalTexturePixels: 100_000_000,
  animations: 8,
  animationChannels: 512,
  animationSamplers: 512
} as const;

const REJECTED_REQUIRED_SOURCE_EXTENSIONS = new Set([
  "KHR_draco_mesh_compression",
  "KHR_texture_basisu"
]);

type EnvLike = Record<string, string | undefined>;

export function parseModelLabMaxBytes(
  env: EnvLike
): { ok: true; maxBytes: number } | { ok: false; error: string } {
  const raw = env.VISTAIRE_MODEL_LAB_MAX_BYTES;
  if (!raw) return { ok: true, maxBytes: DEFAULT_MODEL_LAB_MAX_BYTES };

  const parsed = Number(raw);
  if (
    !Number.isInteger(parsed) ||
    parsed <= 0 ||
    parsed > HARD_MODEL_LAB_MAX_BYTES
  ) {
    return { ok: false, error: "Model Lab upload size cap is invalid." };
  }

  return { ok: true, maxBytes: parsed };
}

export function validateModelLabContentLength(
  rawContentLength: string | null,
  maxBytes: number
): { ok: true; contentLength: number } | { ok: false; status: 411 | 413; error: string } {
  const contentLength = rawContentLength ? Number(rawContentLength) : 0;
  if (!rawContentLength || !Number.isFinite(contentLength) || contentLength <= 0) {
    return {
      ok: false,
      status: 411,
      error: "Upload content length is required."
    };
  }

  if (contentLength > maxBytes + MODEL_LAB_MULTIPART_OVERHEAD_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "GLB is larger than the Model Lab upload cap."
    };
  }

  return { ok: true, contentLength };
}

export function validateModelLabOptimizationBudget(
  report: ModelLabInspectionReport,
  mode: ModelLabPresetId
): { ok: true } | { ok: false; status: 422; errors: string[] } {
  const errors: string[] = [];
  const limits = MODEL_LAB_COMPLEXITY_LIMITS;

  if (report.triangles > limits.triangles) {
    errors.push(`Triangle count is over the Model Lab cap (${report.triangles}/${limits.triangles}).`);
  }
  if (report.vertices > limits.vertices) {
    errors.push(`Vertex count is over the Model Lab cap (${report.vertices}/${limits.vertices}).`);
  }
  if (report.accessors > limits.accessors) {
    errors.push(`Accessor count is over the Model Lab cap (${report.accessors}/${limits.accessors}).`);
  }
  if (report.accessorElements > limits.accessorElements) {
    errors.push(`Accessor element count is over the Model Lab cap (${report.accessorElements}/${limits.accessorElements}).`);
  }
  if (report.meshCount > limits.meshCount) {
    errors.push(`Mesh count is over the Model Lab cap (${report.meshCount}/${limits.meshCount}).`);
  }
  if (report.primitives > limits.primitives) {
    errors.push(`Primitive count is over the Model Lab cap (${report.primitives}/${limits.primitives}).`);
  }
  if (report.images > limits.images) {
    errors.push(`Image count is over the Model Lab cap (${report.images}/${limits.images}).`);
  }
  if ((report.maxTexturePixels ?? 0) > limits.maxTexturePixels) {
    errors.push(`Largest texture is over the decoded pixel cap (${report.maxTexturePixels}/${limits.maxTexturePixels}).`);
  }
  if (report.totalTexturePixels > limits.totalTexturePixels) {
    errors.push(`Total decoded texture pixels are over the Model Lab cap (${report.totalTexturePixels}/${limits.totalTexturePixels}).`);
  }
  if (report.animations > limits.animations) {
    errors.push(`Animation count is over the Model Lab cap (${report.animations}/${limits.animations}).`);
  }
  if (report.animationChannels > limits.animationChannels) {
    errors.push(`Animation channel count is over the Model Lab cap (${report.animationChannels}/${limits.animationChannels}).`);
  }
  if (report.animationSamplers > limits.animationSamplers) {
    errors.push(`Animation sampler count is over the Model Lab cap (${report.animationSamplers}/${limits.animationSamplers}).`);
  }

  const rejectedExtensions = report.extensionsRequired.filter((extension) =>
    REJECTED_REQUIRED_SOURCE_EXTENSIONS.has(extension)
  );
  if (rejectedExtensions.length > 0) {
    errors.push(`Required extension is not supported by the in-route Model Lab optimizer (${rejectedExtensions.join(", ")}).`);
  }
  if (mode === "ar-lite" && report.extensionsRequired.length > 0) {
    errors.push(`AR Lite starts only from GLBs without required extensions (${report.extensionsRequired.join(", ")}).`);
  }

  return errors.length > 0 ? { ok: false, status: 422, errors } : { ok: true };
}
