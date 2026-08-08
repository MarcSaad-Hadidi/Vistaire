import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { rotateOwnerQrCode } from "@/lib/owner/qrStore";

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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return qrJson({ ok: false, code: "invalid-input", error: "Formulaire invalide." }, 400);
  }
  const candidate = body as Record<string, unknown>;
  if (
    !id ||
    candidate.confirmed !== true ||
    typeof candidate.idempotencyKey !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      candidate.idempotencyKey
    ) ||
    !["keep-active", "pause", "revoke"].includes(
      String(candidate.previousDisposition)
    ) ||
    !Number.isSafeInteger(candidate.expectedConfigVersion) ||
    Number(candidate.expectedConfigVersion) < 1 ||
    Object.keys(candidate).some(
      (key) =>
        ![
          "confirmed",
          "idempotencyKey",
          "previousDisposition",
          "expectedConfigVersion"
        ].includes(key)
    )
  ) {
    return qrJson(
      { ok: false, code: "invalid-input", error: "Confirmation, cle UUID, previousDisposition et version sont requises." },
      400
    );
  }

  const rotated = await rotateOwnerQrCode(id, {
    confirmed: true,
    idempotencyKey: candidate.idempotencyKey,
    previousDisposition: candidate.previousDisposition as
      | "keep-active"
      | "pause"
      | "revoke",
    expectedConfigVersion: Number(candidate.expectedConfigVersion)
  });
  if (!rotated.ok) {
    const status =
      "code" in rotated && rotated.code === "canonical-unrecoverable"
        ? 409
        : "code" in rotated &&
            (rotated.code === "config-version-conflict" ||
              rotated.code === "idempotency-conflict")
          ? 409
        : "code" in rotated && rotated.code === "not-found"
          ? 404
          : "code" in rotated && rotated.code === "capability-denied"
            ? 403
          : "code" in rotated && rotated.code === "public-qr-permanent"
            ? 409
          : "code" in rotated && rotated.code === "invalid-input"
            ? 400
            : 503;
    return qrJson(
      {
        ok: false,
        error: rotated.error,
        ...("code" in rotated ? { code: rotated.code } : {}),
        ...("current" in rotated ? { current: rotated.current } : {})
      },
      status
    );
  }
  return qrJson(
    {
      ok: true,
      previous: rotated.previous,
      current: rotated.current
    },
    201
  );
}
