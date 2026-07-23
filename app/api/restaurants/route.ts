import { NextResponse, type NextRequest } from "next/server";
import {
  createRestaurant,
  getOwnerDashboardData,
  validateCreateRestaurantInput
} from "@/lib/owner/data";
import {
  requireSameOriginOwnerMutation,
  requireVistaireOwnerApi
} from "@/lib/auth/ownerApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const data = await getOwnerDashboardData();

  return NextResponse.json({
    ok: true,
    source: data.source,
    restaurants: data.restaurants,
    stats: data.stats
  });
}

export async function POST(request: NextRequest) {
  const owner = await requireVistaireOwnerApi();
  if (!owner.ok) return owner.response;

  const originError = requireSameOriginOwnerMutation(request);
  if (originError) return originError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON invalide." },
      { status: 400 }
    );
  }

  const validated = validateCreateRestaurantInput(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error },
      { status: 400 }
    );
  }

  const created = await createRestaurant(validated.value);
  if (!created.ok) {
    return NextResponse.json(
      { ok: false, error: created.error },
      { status: created.status }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      persisted: created.persisted,
      dataSource: created.dataSource,
      restaurantPersisted: created.restaurantPersisted,
      menuPersisted: created.menuPersisted,
      uiConfigPersisted: created.uiConfigPersisted,
      menuAppearancePersisted: created.menuAppearancePersisted,
      uniqueDesignPersisted: created.uniqueDesignPersisted,
      ...(created.uniqueDesignId
        ? {
            uniqueDesignId: created.uniqueDesignId,
            uniqueDesignStatus: created.uniqueDesignStatus
          }
        : {}),
      categoriesPersisted: created.categoriesPersisted,
      sectionsPersisted: created.sectionsPersisted,
      dishesPersisted: created.dishesPersisted,
      persistedCategoryCount: created.persistedCategoryCount,
      persistedDishCount: created.persistedDishCount,
      menu: created.menu,
      mediaBasePath: created.mediaBasePath,
      mediaBasePathPersisted: created.mediaBasePathPersisted,
      qrCodesHref: created.qrCodesHref,
      warnings: created.warnings,
      restaurant: created.restaurant
    },
    { status: 201 }
  );
}
