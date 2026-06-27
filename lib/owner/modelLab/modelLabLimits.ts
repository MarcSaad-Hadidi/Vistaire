import type { ModelLabInspectionReport } from "@/lib/owner/modelLab/inspectGlb";
import type { ModelLabPresetId } from "@/lib/owner/modelLab/modelLabPresets";

export const DEFAULT_MODEL_LAB_INSPECTION_MAX_BYTES = 100 * 1024 * 1024;
export const DEFAULT_MODEL_LAB_OPTIMIZATION_MAX_BYTES = 75 * 1024 * 1024;
export const HARD_MODEL_LAB_MAX_BYTES = 250 * 1024 * 1024;
export const MODEL_LAB_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
export const MODEL_LAB_OPTIMIZE_TIMEOUT_MS = 45_000;
export const MODEL_LAB_OPTIMIZED_MAX_BYTES = HARD_MODEL_LAB_MAX_BYTES;

export const MODEL_LAB_COMPLEXITY_LIMITS = {
  triangles: 2_000_000,
  vertices: 3_000_000,
  accessors: 20_000,
  accessorElements: 12_000_000,
  meshCount: 2_500,
  primitives: 5_000,
  images: 128,
  maxTexturePixels: 134_217_728,
  totalTexturePixels: 300_000_000,
  animations: 16,
  animationChannels: 2_000,
  animationSamplers: 2_000
} as const;

const REJECTED_REQUIRED_SOURCE_EXTENSIONS = new Set([
  "KHR_draco_mesh_compression",
  "KHR_texture_basisu"
]);
const REQUIRED_EXTENSION_FREE_PRESETS = new Set<ModelLabPresetId>(["ar-bridge"]);

type EnvLike = Record<string, string | undefined>;

function parseByteLimit(args: {
  raw: string | undefined;
  defaultBytes: number;
  hardBytes: number;
  error: string;
}): { ok: true; maxBytes: number } | { ok: false; error: string } {
  if (!args.raw) return { ok: true, maxBytes: args.defaultBytes };

  const parsed = Number(args.raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > args.hardBytes) {
    return { ok: false, error: args.error };
  }

  return { ok: true, maxBytes: parsed };
}

export function parseModelLabInspectionMaxBytes(
  env: EnvLike
): { ok: true; maxBytes: number } | { ok: false; error: string } {
  return parseByteLimit({
    raw: env.VISTAIRE_MODEL_LAB_INSPECT_MAX_BYTES ?? env.VISTAIRE_MODEL_LAB_MAX_BYTES,
    defaultBytes: DEFAULT_MODEL_LAB_INSPECTION_MAX_BYTES,
    hardBytes: HARD_MODEL_LAB_MAX_BYTES,
    error: "Model Lab inspection size cap is invalid."
  });
}

export function parseModelLabOptimizationMaxBytes(
  env: EnvLike
): { ok: true; maxBytes: number } | { ok: false; error: string } {
  return parseByteLimit({
    raw: env.VISTAIRE_MODEL_LAB_OPTIMIZE_MAX_BYTES ?? env.VISTAIRE_MODEL_LAB_MAX_BYTES,
    defaultBytes: DEFAULT_MODEL_LAB_OPTIMIZATION_MAX_BYTES,
    hardBytes: HARD_MODEL_LAB_MAX_BYTES,
    error: "Model Lab optimization size cap is invalid."
  });
}

export function modelLabConfigResponse(args: {
  inspectionMaxBytes: number;
  optimizationMaxBytes: number;
}) {
  return {
    inspectionMaxBytes: args.inspectionMaxBytes,
    optimizationMaxBytes: args.optimizationMaxBytes,
    hardMaxBytes: HARD_MODEL_LAB_MAX_BYTES,
    multipartOverheadBytes: MODEL_LAB_MULTIPART_OVERHEAD_BYTES,
    notes: [
      "No storage: files stay in request memory or local Blob URLs; no Supabase, CDN, DB, or public/models writes.",
      "Large models: inspection is broader; serverless optimization remains capped and local-heavy mode is planned."
    ]
  };
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
  if (REQUIRED_EXTENSION_FREE_PRESETS.has(mode) && report.extensionsRequired.length > 0) {
    errors.push(`AR Bridge starts only from GLBs without required extensions (${report.extensionsRequired.join(", ")}).`);
  }

  return errors.length > 0 ? { ok: false, status: 422, errors } : { ok: true };
}
