import { NextResponse, type NextRequest } from "next/server";
import { readBoundedJsonBody } from "@/lib/admin/requestBody";
import { validateAnalyticsEventContext } from "@/lib/analytics/context";
import { insertAnalyticsEvent } from "@/lib/analytics/eventStore";
import {
  isConfiguredDemoAnalyticsPayload,
  isAnalyticsRequestSameOrigin,
  validateAnalyticsEvent
} from "@/lib/analytics/validation";
import type { AnalyticsApiResponse } from "@/lib/analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_000;

export async function POST(request: NextRequest) {
  if (!isAnalyticsRequestSameOrigin({
    secFetchSite: request.headers.get("sec-fetch-site"),
    origin: request.headers.get("origin"),
    expectedOrigin: request.nextUrl.origin
  })) {
    return NextResponse.json<AnalyticsApiResponse>(
      { ok: false, error: "Cross-site analytics payload refused." },
      { status: 403 }
    );
  }
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

  if (!isConfiguredDemoAnalyticsPayload(validation.payload)) {
    const context = await validateAnalyticsEventContext(validation.payload);
    if (!context.ok) {
      return NextResponse.json<AnalyticsApiResponse>(
        { ok: false, error: context.error },
        { status: context.status }
      );
    }
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const inserted = await insertAnalyticsEvent(validation.payload, userAgent);

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
