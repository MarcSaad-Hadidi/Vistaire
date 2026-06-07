import { NextResponse, type NextRequest } from "next/server";
import { requireVistaireOwnerApi } from "@/lib/auth/ownerApi";
import { getOwnerMenuData } from "@/lib/owner/menuData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? "";
  const data = await getOwnerMenuData(restaurantId);

  if (!data.ok) {
    return NextResponse.json(
      { ok: false, error: data.error },
      { status: data.status }
    );
  }

  return NextResponse.json(data);
}

