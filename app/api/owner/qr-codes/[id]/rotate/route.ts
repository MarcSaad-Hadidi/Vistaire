import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { rotateOwnerQrCode } from "@/lib/owner/qrStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Formulaire invalide." }, { status: 400 });
  }
  const candidate = body as Record<string, unknown>;
  if (
    !id ||
    candidate.confirmed !== true ||
    Object.keys(candidate).some((key) => key !== "confirmed")
  ) {
    return NextResponse.json(
      { ok: false, error: "Confirmation explicite de rotation requise." },
      { status: 400 }
    );
  }

  const rotated = await rotateOwnerQrCode(id, { confirmed: true });
  if (!rotated.ok) {
    const status =
      "code" in rotated && rotated.code === "canonical-unrecoverable"
        ? 409
        : "code" in rotated && rotated.code === "not-found"
          ? 404
          : "code" in rotated && rotated.code === "invalid-input"
            ? 400
            : 503;
    return NextResponse.json(
      {
        ok: false,
        error: rotated.error,
        ...("code" in rotated ? { code: rotated.code } : {})
      },
      { status }
    );
  }
  return NextResponse.json(
    {
      ok: true,
      previous: rotated.previous,
      current: rotated.current
    },
    { status: 201 }
  );
}
