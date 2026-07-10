import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import {
  isOwnerQrTargetPathAllowed,
  sanitizeOwnerQrTargetPath,
  type OwnerQrTargetKind
} from "@/lib/owner/menuUrlCore";
import { createOwnerQrCode } from "@/lib/owner/qrStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "Formulaire invalide." },
      { status: 400 }
    );
  }

  const candidate = body as Record<string, unknown>;
  const restaurantId =
    typeof candidate.restaurantId === "string" ? candidate.restaurantId.slice(0, 80) : "";
  const label = typeof candidate.label === "string" ? candidate.label : "QR menu";
  const targetPath =
    typeof candidate.targetPath === "string" ? candidate.targetPath : "";
  const targetKind: OwnerQrTargetKind | null =
    candidate.targetKind === "menu" || candidate.targetKind === "admin"
      ? candidate.targetKind
      : null;
  const sanitizedTargetPath = sanitizeOwnerQrTargetPath(targetPath);

  if (
    !targetKind ||
    !sanitizedTargetPath ||
    !isOwnerQrTargetPathAllowed(targetKind, sanitizedTargetPath)
  ) {
    return NextResponse.json(
      { ok: false, error: "Chemin de destination invalide." },
      { status: 400 }
    );
  }

  const created = await createOwnerQrCode({
    restaurantId,
    label,
    targetKind,
    targetPath: sanitizedTargetPath,
    style: candidate.style
  });

  if (!created.ok) {
    const diagnostic =
      "code" in created && "incidentId" in created
        ? { code: created.code, incidentId: created.incidentId }
        : {};
    return NextResponse.json(
      { ok: false, error: created.error, ...diagnostic },
      { status: 503 }
    );
  }

  // The raw token is returned ONCE so the client can render/encode the QR.
  return NextResponse.json(
    {
      ok: true,
      token: created.token,
      redirectUrl: created.record.redirectUrl,
      targetPath: created.record.targetPath,
      targetKind: created.record.targetKind,
      persisted: created.persisted,
      record: created.record
    },
    { status: 201 }
  );
}
