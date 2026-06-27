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
  parseModelLabMaxBytes,
  validateModelLabContentLength
} from "@/lib/owner/modelLab/modelLabLimits";
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
