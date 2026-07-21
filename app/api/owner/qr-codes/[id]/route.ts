import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { updateOwnerQrCode } from "@/lib/owner/qrStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const PATCH_ALLOWED_KEYS = new Set(["label", "style", "expectedConfigVersion"]);

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return response;
}

function qrJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return noStore(owner.response);

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return noStore(originError);

  const { id } = await params;
  if (!id) {
    return qrJson({ ok: false, code: "invalid-input", error: "QR id requis." }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return qrJson({ ok: false, code: "invalid-json", error: "JSON invalide." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return qrJson({ ok: false, code: "invalid-input", error: "Formulaire invalide." }, 400);
  }
  const candidate = body as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (
    Object.keys(candidate).length < 2 ||
    keys.some((key) => !PATCH_ALLOWED_KEYS.has(key)) ||
    (candidate.label !== undefined &&
      (typeof candidate.label !== "string" || !candidate.label.trim())) ||
    (candidate.style !== undefined &&
      (!candidate.style ||
        typeof candidate.style !== "object" ||
        Array.isArray(candidate.style) ||
        Object.keys(candidate.style).length === 0)) ||
    !Number.isSafeInteger(candidate.expectedConfigVersion) ||
    Number(candidate.expectedConfigVersion) < 1
  ) {
    return qrJson(
      { ok: false, code: "invalid-input", error: "Label/style et version attendue sont requis." },
      400
    );
  }

  const updated = await updateOwnerQrCode(id, {
    ...(candidate.style !== undefined ? { style: candidate.style } : {}),
    ...(typeof candidate.label === "string" ? { label: candidate.label } : {}),
    expectedConfigVersion: Number(candidate.expectedConfigVersion)
  });

  if (!updated.ok) {
    const status =
      "code" in updated && updated.code === "canonical-unrecoverable"
        ? 409
        : "code" in updated && updated.code === "config-version-conflict"
          ? 409
        : "code" in updated && updated.code === "not-found"
          ? 404
          : "code" in updated && updated.code === "invalid-input"
            ? 400
            : 503;
    return qrJson(
      {
        ok: false,
        error: updated.error,
        ...("code" in updated ? { code: updated.code } : {}),
        ...("current" in updated && updated.current
          ? { current: updated.current }
          : {})
      },
      status
    );
  }

  return qrJson({ ok: true, record: updated.record });
}
