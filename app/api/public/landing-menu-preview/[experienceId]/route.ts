import { NextResponse, type NextRequest } from "next/server";
import type { Locale } from "@/lib/i18n";
import {
  getLandingMenuPreviewPayload,
  isLandingExperienceId,
  LandingMenuPreviewError
} from "@/lib/landing/menuExperiences";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "private, no-store",
  "Vercel-CDN-Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff"
} as const;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS });
}

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
    return privateJson(
      {
        ok: false,
        error: {
          code: "invalid_landing_menu_preview_request",
          message: "Invalid landing menu preview request."
        }
      },
      400
    );
  }

  let payload;
  try {
    payload = await getLandingMenuPreviewPayload(experienceId, locale);
  } catch (error) {
    if (error instanceof LandingMenuPreviewError) {
      return privateJson(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        },
        error.status
      );
    }
    console.error("Landing menu preview resolution failed.", {
      errorType: error instanceof Error ? error.name : typeof error,
      experienceId,
      locale
    });
    return privateJson(
      {
        ok: false,
        error: {
          code: "landing_menu_preview_temporarily_unavailable",
          message: "Landing menu preview temporarily unavailable."
        }
      },
      503
    );
  }
  if (!payload) {
    return privateJson(
      {
        ok: false,
        error: {
          code: "landing_menu_preview_unavailable",
          message: "Landing menu preview unavailable."
        }
      },
      404
    );
  }

  return privateJson({ ok: true, payload });
}
