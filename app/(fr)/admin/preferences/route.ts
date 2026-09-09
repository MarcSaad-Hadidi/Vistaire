import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginAdminMutation } from "@/lib/admin/qrAccessInputCore";
import { deriveLocalPreviewRequestOrigin } from "@/lib/admin/localPreviewCore";
import {
  ADMIN_LOCALE_COOKIE,
  ADMIN_PREFERENCE_COOKIE_MAX_AGE,
  ADMIN_THEME_COOKIE,
  parseAdminPreferenceMutation,
  sanitizeAdminReturnTo
} from "@/lib/admin/preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer"
} as const;

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: SECURITY_HEADERS });
}

export async function POST(request: NextRequest) {
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
    return errorResponse(403, "Forbidden");
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") {
    return errorResponse(415, "Unsupported media type");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const normalizedLength = declaredLength.trim();
    if (!/^\d+$/.test(normalizedLength) || Number(normalizedLength) > 1_024) {
      return errorResponse(413, "Payload too large");
    }
  }

  const mutation = parseAdminPreferenceMutation(await request.formData());
  if (!mutation) return errorResponse(400, "Invalid preference");

  const returnTo = sanitizeAdminReturnTo(request.headers.get("referer"), requestOrigin);
  const response = NextResponse.redirect(new URL(returnTo, requestOrigin), { status: 303 });
  response.headers.set("Cache-Control", SECURITY_HEADERS["Cache-Control"]);
  response.headers.set("Referrer-Policy", SECURITY_HEADERS["Referrer-Policy"]);
  response.cookies.set(
    mutation.kind === "locale" ? ADMIN_LOCALE_COOKIE : ADMIN_THEME_COOKIE,
    mutation.value,
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/admin",
      secure: process.env.NODE_ENV === "production",
      maxAge: ADMIN_PREFERENCE_COOKIE_MAX_AGE
    }
  );
  return response;
}
