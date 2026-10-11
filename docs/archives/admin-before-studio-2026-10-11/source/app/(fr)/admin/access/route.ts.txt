import { NextResponse, type NextRequest } from "next/server";
import { parseAdminQrAccessRequest } from "@/lib/admin/qrAccessInputCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = await parseAdminQrAccessRequest(request, request.nextUrl.origin);
  const targetPath = token
    ? `/q/${encodeURIComponent(token)}`
    : "/q/invalid";
  const response = NextResponse.redirect(new URL(targetPath, request.url), {
    status: 303
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
