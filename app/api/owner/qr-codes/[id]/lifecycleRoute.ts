import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { transitionOwnerQrLifecycle } from "@/lib/owner/qrStore";
import type { OwnerQrLifecycleAction } from "@/lib/owner/types";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const ACTIONS = new Set<OwnerQrLifecycleAction>([
  "pause",
  "resume",
  "archive",
  "revoke"
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return response;
}

function qrJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function handleQrLifecycleMutation(
  request: NextRequest,
  params: Promise<{ id: string }>
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
    Object.keys(candidate).length !== 3 ||
    typeof candidate.action !== "string" ||
    !ACTIONS.has(candidate.action as OwnerQrLifecycleAction) ||
    !Number.isSafeInteger(candidate.expectedConfigVersion) ||
    Number(candidate.expectedConfigVersion) < 1 ||
    typeof candidate.idempotencyKey !== "string" ||
    !UUID_PATTERN.test(candidate.idempotencyKey)
  ) {
    return qrJson(
      { ok: false, code: "invalid-input", error: "Action QR invalide." },
      400
    );
  }
  const action = candidate.action as OwnerQrLifecycleAction;
  const result = await transitionOwnerQrLifecycle(id, {
    action,
    expectedConfigVersion: Number(candidate.expectedConfigVersion),
    idempotencyKey: candidate.idempotencyKey as string
  });
  if (!result.ok) {
    const status =
      result.code === "config-version-conflict" ||
      result.code === "idempotency-conflict"
        ? 409
        : result.code === "public-qr-permanent"
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
        ...( "current" in result ? { current: result.current } : {}),
        ...( "incidentId" in result ? { incidentId: result.incidentId } : {})
      },
      status
    );
  }
  return qrJson(result);
}
