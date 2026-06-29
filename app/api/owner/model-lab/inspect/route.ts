import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  modelLabJsonHeaders,
  withModelLabNoStore
} from "@/lib/owner/modelLab/modelLabHeaders";
import {
  parseModelLabInspectionMaxBytes,
  MODEL_LAB_MULTIPART_OVERHEAD_BYTES,
  validateModelLabContentLength
} from "@/lib/owner/modelLab/modelLabLimits";
import { readModelLabMultipartRequest } from "@/lib/owner/modelLab/modelLabMultipart";
import { validateModelLabGlbFile } from "@/lib/owner/modelLab/modelLabValidation";
import { inspectGlbBuffer } from "@/lib/owner/modelLab/inspectGlb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: modelLabJsonHeaders() }
  );
}

export async function POST(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return withModelLabNoStore(owner.response);

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return withModelLabNoStore(originError);

  const limit = parseModelLabInspectionMaxBytes(process.env);
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

  const file = formData.form.file;
  if (!file) {
    return jsonError("GLB requis.", 400);
  }
  if (file.size > limit.maxBytes) {
    return jsonError("GLB is larger than the Model Lab inspection cap.", 413);
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

  let report;
  try {
    report = inspectGlbBuffer({
      bytes: validated.bytes,
      fileName: validated.originalName
    });
  } catch {
    return jsonError("GLB impossible a inspecter.", 400);
  }

  return NextResponse.json(
    { ok: true, report },
    { status: 200, headers: modelLabJsonHeaders() }
  );
}
