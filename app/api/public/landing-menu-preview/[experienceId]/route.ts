import { NextResponse, type NextRequest } from "next/server";
import type { Locale } from "@/lib/i18n";
import {
  getLandingMenuPreviewPayload,
  isLandingExperienceId
} from "@/lib/landing/menuExperiences";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff"
} as const;

function requestedLocale(request: NextRequest): Locale | null {
  const value = request.nextUrl.searchParams.get("locale");
  return value === "fr" || value === "en" ? value : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ experienceId: string }> }
) {
  const { experienceId } = await context.params;
  const locale = requestedLocale(request);
  if (!isLandingExperienceId(experienceId) || !locale) {
    return NextResponse.json(
      { ok: false, error: "Invalid landing menu preview request." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const payload = await getLandingMenuPreviewPayload(experienceId, locale);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "Landing menu preview unavailable." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, payload },
    { headers: RESPONSE_HEADERS }
  );
}
