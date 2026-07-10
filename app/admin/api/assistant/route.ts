import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import {
  getAdminAssistantAnswer,
  validateAdminAssistantRequest
} from "@/lib/admin/assistant";
import { readBoundedJsonBody } from "@/lib/admin/requestBody";

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

function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) return fetchSite === "same-origin" || fetchSite === "none";
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) {
    return adminJson({ ok: false, error: "Accès admin requis." }, 401);
  }

  if (!isSameOrigin(request)) {
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
    const answer = await getAdminAssistantAnswer({
      restaurantId: access.restaurantId,
      mode: validation.mode,
      question: validation.question,
      allowMistral: true
    });

    return adminJson({
      ok: true,
      answer: answer.answer,
      source: answer.source,
      dataSource: answer.dataSource
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
