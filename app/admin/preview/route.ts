import { NextResponse, type NextRequest } from "next/server";
import { createLocalAdminPreviewGrant } from "@/lib/admin/localPreviewCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const grant = createLocalAdminPreviewGrant({
    nodeEnv: process.env.NODE_ENV,
    hostname: request.nextUrl.hostname,
    origin: request.headers.get("origin"),
    requestOrigin: request.nextUrl.origin
  });
  if (!grant.ok) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const response = NextResponse.redirect(
    new URL(grant.redirectPath, grant.redirectOrigin),
    { status: 303 }
  );
  response.cookies.set(
    grant.cookie.name,
    grant.cookie.value,
    grant.cookie.options
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
