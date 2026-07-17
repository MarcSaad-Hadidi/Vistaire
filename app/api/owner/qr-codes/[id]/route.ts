import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { updateOwnerQrCode } from "@/lib/owner/qrStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATCH_ALLOWED_KEYS = new Set(["label", "style"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "QR id requis." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Formulaire invalide." },
      { status: 400 }
    );
  }
  const candidate = body as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (
    Object.keys(candidate).length === 0 ||
    keys.some((key) => !PATCH_ALLOWED_KEYS.has(key)) ||
    (candidate.label !== undefined &&
      (typeof candidate.label !== "string" || !candidate.label.trim())) ||
    (candidate.style !== undefined &&
      (!candidate.style ||
        typeof candidate.style !== "object" ||
        Array.isArray(candidate.style) ||
        Object.keys(candidate.style).length === 0))
  ) {
    return NextResponse.json(
      { ok: false, error: "Seuls label et style non vides sont acceptes." },
      { status: 400 }
    );
  }

  const updated = await updateOwnerQrCode(id, {
    ...(candidate.style !== undefined ? { style: candidate.style } : {}),
    ...(typeof candidate.label === "string" ? { label: candidate.label } : {})
  });

  if (!updated.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: updated.error,
        ...("code" in updated ? { code: updated.code } : {})
      },
      { status: "code" in updated && updated.code === "canonical-unrecoverable" ? 409 : 503 }
    );
  }

  return NextResponse.json({ ok: true, record: updated.record });
}
