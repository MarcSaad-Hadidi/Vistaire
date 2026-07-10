import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_ACCESS_COOKIE_NAME,
  createAdminAccessToken,
  getAdminAccessCookieOptions
} from "@/lib/admin/accessSessionCore";
import { resolveQrToken } from "@/lib/owner/qrStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QrRouteContext = { params: Promise<{ token: string }> };

function protectedRedirect(request: NextRequest, targetPath: string): NextResponse {
  const response = NextResponse.redirect(new URL(targetPath, request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest, context: QrRouteContext) {
  const { token } = await context.params;
  const resolved = await resolveQrToken(token);
  if (!resolved.ok) return protectedRedirect(request, "/q/invalid");

  if (resolved.targetKind === "menu") {
    return protectedRedirect(request, resolved.targetPath);
  }

  const secret = process.env.VISTAIRE_ADMIN_SESSION_SECRET;
  if (!secret) return protectedRedirect(request, "/q/invalid");

  try {
    const accessToken = createAdminAccessToken(
      { qrId: resolved.qrId, restaurantId: resolved.restaurantId },
      secret
    );
    const response = protectedRedirect(request, "/admin");
    response.cookies.set(
      ADMIN_ACCESS_COOKIE_NAME,
      accessToken,
      getAdminAccessCookieOptions(process.env.NODE_ENV)
    );
    return response;
  } catch {
    return protectedRedirect(request, "/q/invalid");
  }
}
