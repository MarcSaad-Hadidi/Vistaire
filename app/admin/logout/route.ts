import { NextResponse, type NextRequest } from "next/server";
import { LOCAL_ADMIN_PREVIEW_COOKIE } from "@/lib/admin/localPreviewCore";
import {
  ADMIN_ACCESS_COOKIE_NAME,
  getExpiredAdminAccessCookieOptions
} from "@/lib/admin/accessSessionCore";
import { isSameOriginAdminMutation } from "@/lib/admin/qrAccessInputCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginAdminMutation({
    origin: request.headers.get("origin"),
    fetchSite: request.headers.get("sec-fetch-site"),
    requestOrigin: request.nextUrl.origin
  })) {
    return NextResponse.json(
      { ok: false, error: "Logout must be same-origin." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const response = NextResponse.redirect(new URL("/admin", request.url), {
    status: 303
  });
  const expiredCookie = getExpiredAdminAccessCookieOptions(process.env.NODE_ENV);
  response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, "", expiredCookie);
  response.cookies.set(LOCAL_ADMIN_PREVIEW_COOKIE, "", expiredCookie);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
