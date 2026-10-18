import { NextResponse, type NextRequest } from "next/server";
import { readBoundedJsonBody } from "@/lib/admin/requestBody";
import { validateAnalyticsEventContext } from "@/lib/analytics/context";
import { insertAnalyticsEvent } from "@/lib/analytics/eventStore";
import {
  isConfiguredDemoAnalyticsPayload,
  validateAnalyticsEvent
} from "@/lib/analytics/validation";
import type { AnalyticsApiResponse } from "@/lib/analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_000;
// Bounded process-local abuse guard; the database also caps each session.
const rateWindows = new Map<string, { start: number; count: number }>();
function acceptsRate(sessionId: string): boolean {
  const now = Date.now();
  for (const [key, value] of rateWindows) if (now - value.start >= 60_000) rateWindows.delete(key);
  const prior = rateWindows.get(sessionId);
  if (!prior && rateWindows.size >= 5_000) return false;
  if (prior && prior.count >= 120) return false;
  rateWindows.set(sessionId, { start: prior?.start ?? now, count: (prior?.count ?? 0) + 1 });
  return true;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return NextResponse.json<AnalyticsApiResponse>(
      { ok: false, error: "Analytics payload must be JSON." },
      { status: 415 }
    );
  }
  const bodyResult = await readBoundedJsonBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok && bodyResult.reason === "too-large") {
    return NextResponse.json<AnalyticsApiResponse>(
      { ok: false, error: "Analytics payload is too large." },
      { status: 413 }
    );
  }
  if (!bodyResult.ok) {
    return NextResponse.json<AnalyticsApiResponse>(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const validation = validateAnalyticsEvent(bodyResult.value);
  if (!validation.ok) {
    return NextResponse.json<AnalyticsApiResponse>(
      { ok: false, error: validation.error },
      { status: 400 }
    );
  }

  if (process.env.ANALYTICS_DISABLED === "true" || request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") {
    return NextResponse.json<AnalyticsApiResponse>({ ok: true, persisted: false }, { status: 202 });
  }
  if (!acceptsRate(validation.payload.sessionId)) {
    return NextResponse.json<AnalyticsApiResponse>({ ok: false, error: "Analytics rate limit exceeded." }, { status: 429 });
  }
  // A local production build is not evidence of a production deployment.
  // Self-hosted installations may explicitly set ANALYTICS_ENVIRONMENT.
  const environment = process.env.ANALYTICS_ENVIRONMENT ?? process.env.VERCEL_ENV;
  validation.payload.environment = environment === "production" ? "production"
    : environment === "preview" ? "preview" : "development";

  if (!isConfiguredDemoAnalyticsPayload(validation.payload)) {
    const context = await validateAnalyticsEventContext(validation.payload);
    if (!context.ok) {
      return NextResponse.json<AnalyticsApiResponse>(
        { ok: false, error: context.error },
        { status: context.status }
      );
    }
  }

  const inserted = await insertAnalyticsEvent(validation.payload);

  if (!inserted.ok) {
    if (validation.payload.source === "demo") {
      return NextResponse.json<AnalyticsApiResponse>(
        { ok: true, persisted: false },
        { status: 202 }
      );
    }

    return NextResponse.json<AnalyticsApiResponse>(
      { ok: true, persisted: false },
      { status: 202 }
    );
  }

  return NextResponse.json<AnalyticsApiResponse>({
    ok: true,
    persisted: true
  });
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed." },
    { status: 405 }
  );
}
