import { NextResponse, type NextRequest } from "next/server";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";
import { generateMistralMenuStyleAdvice } from "@/lib/ai/mistral";
import {
  buildFallbackMenuStyleAdvice,
  sanitizeMenuStyleAdvisorInput,
  sanitizeMenuStyleAdvisorOutput,
  type MenuStyleAdvisorInput
} from "@/lib/menu/menuStyleAdvisor";
import { getOwnerMenuData } from "@/lib/owner/menuData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function advisorInputFromBody(
  body: Record<string, unknown>
): Promise<MenuStyleAdvisorInput> {
  const sanitized = sanitizeMenuStyleAdvisorInput(body);
  const restaurantId = sanitized.restaurantId;

  if (!restaurantId) {
    return sanitized;
  }

  const menuData = await getOwnerMenuData(restaurantId);
  if (!menuData.ok) {
    return sanitized;
  }

  const dishes = menuData.dishes;

  return {
    restaurantId,
    restaurantName: menuData.restaurant.name,
    restaurantSlug: menuData.restaurant.slug,
    cuisineType: menuData.menu.cuisineType,
    location: menuData.menu.location,
    dishCount: dishes.length,
    categories: menuData.categories.map((category) => category.label),
    sampleDishes: dishes.slice(0, 8).map((dish) => dish.name),
    photoCount: dishes.filter((dish) => dish.hasPhoto).length,
    modelCount: dishes.filter((dish) => dish.has3d).length,
    arCount: dishes.filter((dish) => dish.hasAr).length,
    currentConfig: sanitized.currentConfig
  };
}

export async function POST(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  const body = await readBody(request);
  if (!body) {
    return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 });
  }

  const input = await advisorInputFromBody(body);
  const fallback = buildFallbackMenuStyleAdvice(input);
  const mistralOutput = await generateMistralMenuStyleAdvice(
    sanitizeMenuStyleAdvisorInput(input)
  );
  const recommendation = mistralOutput
    ? sanitizeMenuStyleAdvisorOutput(mistralOutput, input)
    : fallback;

  return NextResponse.json({
    ok: true,
    source: recommendation.source,
    recommendation
  });
}
