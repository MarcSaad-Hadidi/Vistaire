import { NextResponse, type NextRequest } from "next/server";
import { extractAdminQrToken } from "@/lib/admin/qrAccessInputCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const input = formData.get("qrAccess");
  const token =
    typeof input === "string"
      ? extractAdminQrToken(input, request.nextUrl.origin)
      : null;
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
