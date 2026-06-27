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
  parseModelLabMaxBytes,
  validateModelLabContentLength,
  validateModelLabOptimizationBudget
} from "@/lib/owner/modelLab/modelLabLimits";
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

  const limit = parseModelLabMaxBytes(process.env);
  if (!limit.ok) return jsonError(limit.error, 503);

  const contentLength = validateModelLabContentLength(
    request.headers.get("content-length"),
    limit.maxBytes
  );
  if (!contentLength.ok) return jsonError(contentLength.error, contentLength.status);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Formulaire Model Lab invalide.", 400);
  }

  const mode = parseModelLabMode(formData.get("mode"));
  if (!mode.ok) return jsonError(mode.error, 400);

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("GLB requis.", 400);
  }
  if (file.size > limit.maxBytes) {
    return jsonError("GLB is larger than the Model Lab upload cap.", 413);
  }

  const validated = validateModelLabGlbFile(
    {
      name: file.name,
      type: file.type,
      size: file.size,
      bytes: Buffer.from(await file.arrayBuffer())
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
  if (mode.mode === "ar-lite" && optimizedReport.extensionsRequired.length > 0) {
    return jsonError(
      "Candidat AR Lite refuse: la sortie optimisee requiert des extensions glTF.",
      422,
      { extensionsRequired: optimizedReport.extensionsRequired }
    );
  }

  return new NextResponse(Uint8Array.from(optimized.bytes), {
    status: 200,
    headers: {
      ...modelLabBinaryHeaders(optimized.fileName, optimized.bytes.byteLength),
      "X-Vistaire-Model-Lab-Mode": optimized.mode,
      "X-Vistaire-Model-Lab-Elapsed-Ms": String(optimized.elapsedMs)
    }
  });
}
