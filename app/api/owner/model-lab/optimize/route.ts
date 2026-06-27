import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  modelLabBinaryHeaders,
  modelLabJsonHeaders,
  withModelLabNoStore
} from "@/lib/owner/modelLab/modelLabHeaders";
import {
  MODEL_LAB_MULTIPART_OVERHEAD_BYTES,
  parseModelLabOptimizationMaxBytes,
  validateModelLabContentLength,
  validateModelLabOptimizationBudget
} from "@/lib/owner/modelLab/modelLabLimits";
import { readModelLabMultipartRequest } from "@/lib/owner/modelLab/modelLabMultipart";
import { getModelLabPreset } from "@/lib/owner/modelLab/modelLabPresets";
import {
  parseModelLabMode,
  validateModelLabGlbFile
} from "@/lib/owner/modelLab/modelLabValidation";
import { inspectGlbBuffer } from "@/lib/owner/modelLab/inspectGlb";
import { optimizeGlbCandidate } from "@/lib/owner/modelLab/optimizeGlb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(
  error: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { ok: false, error, ...(extra ?? {}) },
    { status, headers: modelLabJsonHeaders() }
  );
}

export async function POST(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return withModelLabNoStore(owner.response);

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return withModelLabNoStore(originError);

  const limit = parseModelLabOptimizationMaxBytes(process.env);
  if (!limit.ok) return jsonError(limit.error, 503);

  const contentLength = validateModelLabContentLength(
    request.headers.get("content-length"),
    limit.maxBytes
  );
  if (!contentLength.ok) return jsonError(contentLength.error, contentLength.status);

  const formData = await readModelLabMultipartRequest(
    request,
    limit.maxBytes + MODEL_LAB_MULTIPART_OVERHEAD_BYTES
  );
  if (!formData.ok) return jsonError(formData.error, formData.status);

  const mode = parseModelLabMode(formData.form.fields.get("mode") ?? null);
  if (!mode.ok) return jsonError(mode.error, 400);
  const preset = getModelLabPreset(mode.mode);

  const file = formData.form.file;
  if (!file) {
    return jsonError("GLB requis.", 400);
  }
  if (file.size > limit.maxBytes) {
    return jsonError("GLB is larger than the Model Lab serverless optimization cap.", 413);
  }

  const validated = validateModelLabGlbFile(
    {
      name: file.name,
      type: file.type,
      size: file.size,
      bytes: file.bytes
    },
    limit.maxBytes
  );
  if (!validated.ok) return jsonError(validated.error, validated.status);

  const sourceReport = inspectGlbBuffer({
    bytes: validated.bytes,
    fileName: validated.originalName
  });
  if (sourceReport.externalUris.length > 0) {
    return jsonError(
      "GLB refuse: il reference des ressources externes. Emballez textures et buffers dans le GLB avant optimisation.",
      422,
      { warnings: sourceReport.warnings, externalUris: sourceReport.externalUris }
    );
  }
  const budget = validateModelLabOptimizationBudget(sourceReport, mode.mode);
  if (!budget.ok) {
    return jsonError(
      "GLB refuse: il depasse les limites de complexite du Model Lab.",
      budget.status,
      { errors: budget.errors }
    );
  }

  let optimized;
  try {
    optimized = await optimizeGlbCandidate({
      bytes: validated.bytes,
      originalName: validated.originalName,
      mode: mode.mode
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Optimisation GLB impossible.";
    return jsonError(message, message.includes("timed out") ? 504 : 422);
  }

  let optimizedReport;
  try {
    optimizedReport = inspectGlbBuffer({
      bytes: optimized.bytes,
      fileName: optimized.fileName
    });
  } catch {
    return jsonError("Candidat refuse: la sortie optimisee n'est pas un GLB valide.", 422);
  }
  if (optimizedReport.externalUris.length > 0) {
    return jsonError(
      "Candidat refuse: la sortie optimisee reference des ressources externes.",
      422,
      { externalUris: optimizedReport.externalUris }
    );
  }
  if (preset.requiresNoRequiredExtensions && optimizedReport.extensionsRequired.length > 0) {
    return jsonError(
      "Candidat AR Bridge refuse: la sortie optimisee requiert des extensions glTF.",
      422,
      { extensionsRequired: optimizedReport.extensionsRequired }
    );
  }

  return new NextResponse(Uint8Array.from(optimized.bytes), {
    status: 200,
    headers: {
      ...modelLabBinaryHeaders(optimized.fileName, optimized.bytes.byteLength),
      "X-Vistaire-Model-Lab-Mode": optimized.mode,
      "X-Vistaire-Model-Lab-Compression": optimized.compressionPath,
      "X-Vistaire-Model-Lab-Elapsed-Ms": String(optimized.elapsedMs)
    }
  });
}
