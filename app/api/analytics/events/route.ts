import { NextResponse, type NextRequest } from "next/server";
import { insertAnalyticsEvent } from "@/lib/analytics/eventStore";
import { validateAnalyticsEvent } from "@/lib/analytics/validation";
import type { AnalyticsApiResponse } from "@/lib/analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_000;

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json<AnalyticsApiResponse>(
      { ok: false, error: "Analytics payload is too large." },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<AnalyticsApiResponse>(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const validation = validateAnalyticsEvent(body);
  if (!validation.ok) {
    return NextResponse.json<AnalyticsApiResponse>(
      { ok: false, error: validation.error },
      { status: 400 }
    );
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
      { ok: false, error: "Analytics event was accepted but could not be saved." },
      { status: 503 }
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
