import { NextResponse, type NextRequest } from "next/server";
import { requireVistaireOwnerApi } from "@/lib/auth/ownerApi";
import { listOwnerQrInventory } from "@/lib/owner/qrStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) {
    owner.response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return owner.response;
  }
  const restaurantId = new URL(request.url).searchParams
    .get("restaurantId")
    ?.trim()
    .slice(0, 80) ?? "";
  if (!restaurantId) {
    return NextResponse.json(
      { ok: false, code: "invalid-input", error: "Restaurant requis." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
  const result = await listOwnerQrInventory({ restaurantId });
  const status = result.ok
    ? 200
    : result.code === "invalid-input"
      ? 400
      : 503;
  return NextResponse.json(result, { status, headers: NO_STORE_HEADERS });
}
