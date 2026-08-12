import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import {
  getAdminAssistantAnswer,
  isAdminAssistantRuntimeEnabled,
  validateAdminAssistantRequest
} from "@/lib/admin/assistant";
import { readBoundedJsonBody } from "@/lib/admin/requestBody";
import { deriveLocalPreviewRequestOrigin } from "@/lib/admin/localPreviewCore";
import { isSameOriginAdminMutation } from "@/lib/admin/qrAccessInputCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_000;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function adminJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminAssistantRuntimeEnabled()) {
    return adminJson({ ok: false, error: "Assistant désactivé." }, 404);
  }
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) {
    return adminJson({ ok: false, error: "Accès admin requis." }, 401);
  }

  const requestOrigin = deriveLocalPreviewRequestOrigin({
    nodeEnv: process.env.NODE_ENV,
    host: request.headers.get("host"),
    requestProtocol: request.nextUrl.protocol
  }) ?? request.nextUrl.origin;
  if (!isSameOriginAdminMutation({
    origin: request.headers.get("origin"),
    fetchSite: request.headers.get("sec-fetch-site"),
    requestOrigin
  })) {
    return adminJson({ ok: false, error: "Requête refusée." }, 403);
  }
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) {
    return adminJson({ ok: false, error: "Corps JSON requis." }, 415);
  }

  const body = await readBoundedJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return body.reason === "too-large"
      ? adminJson({ ok: false, error: "Question trop longue." }, 413)
      : adminJson({ ok: false, error: "Question invalide." }, 400);
  }

  const validation = validateAdminAssistantRequest(body.value);
  if (!validation.ok) {
    return adminJson({ ok: false, error: validation.error }, 400);
  }

  try {
    const result = await getAdminAssistantAnswer({
      access,
      mode: validation.mode,
      locale: validation.locale,
      range: validation.range,
      question: validation.question,
    });
    if (!result) {
      return adminJson({ ok: false, error: "L’assistant est temporairement indisponible." }, 503);
    }

    return adminJson({
      ok: true,
      source: result.answer.source,
      status: result.status,
      blocks: result.answer.blocks,
      evidenceIds: result.answer.evidenceIds
    });
  } catch {
    return adminJson(
      { ok: false, error: "L’assistant est temporairement indisponible." },
      503
    );
  }
}

export function GET() {
  return adminJson({ ok: false, error: "Method not allowed." }, 405);
}
