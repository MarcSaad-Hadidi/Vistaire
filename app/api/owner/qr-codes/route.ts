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
import {
  getOrCreateOwnerQrCode,
  getOwnerCanonicalQrCode
} from "@/lib/owner/qrStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0"
};

function failureStatus(result: object): number {
  if (!("code" in result)) return 503;
  if (result.code === "canonical-unrecoverable") return 409;
  if (result.code === "invalid-input") return 400;
  if (result.code === "QR_CREATE_RESTAURANT_NOT_FOUND") return 404;
  return 503;
}

export async function GET(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const url = new URL(request.url);
  const restaurantId = (url.searchParams.get("restaurantId") ?? "").slice(0, 80);
  const targetKind = url.searchParams.get("targetKind");
  const purposeKey = url.searchParams.get("purposeKey") ?? "default";
  if (
    !restaurantId ||
    (targetKind !== "menu" && targetKind !== "admin")
  ) {
    return NextResponse.json(
      { ok: false, error: "Restaurant et type QR requis." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const read = await getOwnerCanonicalQrCode({
    restaurantId,
    targetKind,
    purposeKey
  });
  if ("ok" in read && read.ok === false) {
    return NextResponse.json(
      { ok: false, error: read.error, code: read.code, incidentId: read.incidentId },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
  return NextResponse.json(
    { ok: true, ...read },
    { headers: NO_STORE_HEADERS }
  );
}

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
    typeof candidate.restaurantId === "string"
      ? candidate.restaurantId.trim().slice(0, 80)
      : "";
  const label = typeof candidate.label === "string" ? candidate.label : "QR menu";
  const targetPath =
    typeof candidate.targetPath === "string" ? candidate.targetPath : "";
  const targetKind: OwnerQrTargetKind | null =
    candidate.targetKind === "menu" || candidate.targetKind === "admin"
      ? candidate.targetKind
      : null;
  const purposeKey =
    typeof candidate.purposeKey === "string" ? candidate.purposeKey : "default";
  const sanitizedTargetPath = sanitizeOwnerQrTargetPath(targetPath);

  if (
    !restaurantId ||
    !targetKind ||
    !sanitizedTargetPath ||
    !isOwnerQrTargetPathAllowed(targetKind, sanitizedTargetPath)
  ) {
    return NextResponse.json(
      { ok: false, error: "Chemin de destination invalide." },
      { status: 400 }
    );
  }

  const created = await getOrCreateOwnerQrCode({
    restaurantId,
    label,
    targetKind,
    purposeKey,
    targetPath: sanitizedTargetPath,
    style: candidate.style
  });

  if (!created.ok) {
    const diagnostic =
      "code" in created && "incidentId" in created
        ? { code: created.code, incidentId: created.incidentId }
        : {};
    return NextResponse.json(
      {
        ok: false,
        error: created.error,
        ...("code" in created ? { code: created.code } : {}),
        ...diagnostic
      },
      { status: failureStatus(created) }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      created: created.created,
      redirectUrl: created.record.redirectUrl,
      targetPath: created.record.targetPath,
      targetKind: created.record.targetKind,
      persisted: created.persisted,
      record: created.record
    },
    { status: created.created ? 201 : 200 }
  );
}
