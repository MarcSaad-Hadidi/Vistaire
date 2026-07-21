import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import type { OwnerQrTargetKind } from "@/lib/owner/menuUrlCore";
import {
  getOrCreateOwnerQrCode,
  getOwnerCanonicalQrCode
} from "@/lib/owner/qrStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0"
};

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return response;
}

function qrJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function failureStatus(result: object): number {
  if (!("code" in result)) return 503;
  if (result.code === "canonical-unrecoverable") return 409;
  if (result.code === "invalid-input") return 400;
  if (result.code === "QR_CREATE_RESTAURANT_NOT_FOUND") return 404;
  return 503;
}

export async function GET(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return noStore(owner.response);

  const url = new URL(request.url);
  const restaurantId = (url.searchParams.get("restaurantId") ?? "").slice(0, 80);
  const targetKind = url.searchParams.get("targetKind");
  const purposeKey = url.searchParams.get("purposeKey") ?? "default";
  if (
    !restaurantId ||
    (targetKind !== "menu" && targetKind !== "admin") ||
    purposeKey !== "default"
  ) {
    return qrJson(
      { ok: false, code: "invalid-input", error: "Restaurant, type et purpose QR invalides." },
      400
    );
  }

  const read = await getOwnerCanonicalQrCode({
    restaurantId,
    targetKind,
    purposeKey
  });
  if ("ok" in read && read.ok === false) {
    return qrJson(
      {
        ok: false,
        error: read.error,
        code: read.code,
        ...("incidentId" in read ? { incidentId: read.incidentId } : {})
      },
      "incidentId" in read ? 503 : failureStatus(read)
    );
  }
  return qrJson({ ok: true, ...read });
}

export async function POST(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return noStore(owner.response);

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return noStore(originError);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return qrJson({ ok: false, code: "invalid-json", error: "JSON invalide." }, 400);
  }

  if (!body || typeof body !== "object") {
    return qrJson({ ok: false, code: "invalid-input", error: "Formulaire invalide." }, 400);
  }

  const candidate = body as Record<string, unknown>;
  const restaurantId =
    typeof candidate.restaurantId === "string"
      ? candidate.restaurantId.trim().slice(0, 80)
      : "";
  const label = typeof candidate.label === "string" ? candidate.label : "QR menu";
  const targetKind: OwnerQrTargetKind | null =
    candidate.targetKind === "menu" || candidate.targetKind === "admin"
      ? candidate.targetKind
      : null;
  const purposeKey = candidate.purposeKey ?? "default";
  const allowedKeys = new Set([
    "restaurantId",
    "label",
    "targetKind",
    "purposeKey",
    "style"
  ]);

  if (
    !restaurantId ||
    !targetKind ||
    purposeKey !== "default" ||
    Object.keys(candidate).some((key) => !allowedKeys.has(key))
  ) {
    return qrJson(
      { ok: false, code: "invalid-input", error: "Parametres QR invalides." },
      400
    );
  }

  const created = await getOrCreateOwnerQrCode({
    restaurantId,
    label,
    targetKind,
    purposeKey,
    style: candidate.style
  });

  if (!created.ok) {
    const diagnostic =
      "code" in created && "incidentId" in created
        ? { code: created.code, incidentId: created.incidentId }
        : {};
    return qrJson(
      {
        ok: false,
        error: created.error,
        ...("code" in created ? { code: created.code } : {}),
        ...diagnostic
      },
      failureStatus(created)
    );
  }

  return qrJson(
    {
      ok: true,
      created: created.created,
      redirectUrl: created.record.redirectUrl,
      targetPath: created.record.targetPath,
      targetKind: created.record.targetKind,
      persisted: created.persisted,
      record: created.record
    },
    created.created ? 201 : 200
  );
}
