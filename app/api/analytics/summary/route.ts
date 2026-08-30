import { NextResponse, type NextRequest } from "next/server";
import { getRestaurantInsights } from "@/lib/analytics/insights";
import { getDemoRestaurantId } from "@/lib/maisonElyseIdentity";
import { requireVistaireOwnerApi } from "@/lib/auth/ownerApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const restaurantId =
    request.nextUrl.searchParams.get("restaurantId") ?? getDemoRestaurantId();
  const result = await getRestaurantInsights(restaurantId);

  return NextResponse.json({
    ok: true,
    source: result.source,
    note: result.note,
    insights: result.insights
  });
}
