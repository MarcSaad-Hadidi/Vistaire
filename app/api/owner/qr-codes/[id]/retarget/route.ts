import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { retargetOwnerQrCode } from "@/lib/owner/qrStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return response;
}

function qrJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return noStore(owner.response);
  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return noStore(originError);

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return qrJson({ ok: false, code: "invalid-json", error: "JSON invalide." }, 400);
  }
  const candidate = body as Record<string, unknown> | null;
  if (
    !id ||
    !candidate ||
    Array.isArray(candidate) ||
    Object.keys(candidate).length !== 1 ||
    !Number.isSafeInteger(candidate.expectedConfigVersion) ||
    Number(candidate.expectedConfigVersion) < 1
  ) {
    return qrJson(
      { ok: false, code: "invalid-input", error: "Version attendue requise." },
      400
    );
  }
  const result = await retargetOwnerQrCode(id, {
    expectedConfigVersion: Number(candidate.expectedConfigVersion)
  });
  if (!result.ok) {
    const status =
      result.code === "config-version-conflict" ||
      result.code === "canonical-unrecoverable"
        ? 409
        : result.code === "not-found"
          ? 404
          : result.code === "invalid-input"
            ? 400
            : 503;
    return qrJson(
      {
        ok: false,
        code: result.code,
        error: result.error,
        ...("current" in result && result.current
          ? { current: result.current }
          : {}),
        ...("incidentId" in result ? { incidentId: result.incidentId } : {})
      },
      status
    );
  }
  return qrJson(result);
}
