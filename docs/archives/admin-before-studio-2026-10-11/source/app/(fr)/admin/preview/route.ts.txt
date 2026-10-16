import { NextResponse, type NextRequest } from "next/server";
import {
  createLocalAdminPreviewGrant,
  deriveLocalPreviewRequestOrigin
} from "@/lib/admin/localPreviewCore";
import { getLocalAdminPreviewSecret } from "@/lib/admin/localPreviewSecret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestOrigin = deriveLocalPreviewRequestOrigin({
    nodeEnv: process.env.NODE_ENV,
    host: request.headers.get("host"),
    requestProtocol: request.nextUrl.protocol
  });
  const secret = getLocalAdminPreviewSecret();
  const grant = createLocalAdminPreviewGrant({
    nodeEnv: process.env.NODE_ENV,
    origin: request.headers.get("origin"),
    requestOrigin: requestOrigin ?? "",
    secret: secret ?? ""
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
