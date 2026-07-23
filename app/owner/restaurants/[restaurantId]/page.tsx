import { notFound } from "next/navigation";
import { OwnerRestaurantDashboard } from "@/components/owner/OwnerRestaurantDashboard";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";
import { buildOwnerRestaurantPreparation } from "@/lib/owner/restaurantPreparation";
import { getOwnerMenuUiConfig } from "@/lib/owner/menuUiConfigStore";
import { normalizePublicMenuStyle } from "@/lib/menu/publicMenuSettings";
import { readPublicMenuSettingsWithFallbacks } from "@/lib/owner/publicMenuSettingsFallback";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export default async function OwnerRestaurantDashboardPage({
  params
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const data = await getOwnerRestaurantDashboardData(restaurantId);

  if (!data.restaurant) {
    notFound();
  }

  const menuData = await getOwnerMenuData(data.restaurant.id);
  const dishes = menuData.ok ? menuData.dishes : [];

  let publicMenuStyle = normalizePublicMenuStyle(undefined);
  let uniqueDesignStatus = null as
    | "pending"
    | "draft"
    | "ready"
    | "published"
    | "archived"
    | null;

  const admin = getSupabaseAdminClient();
  if (admin.ok) {
    try {
      const settings = await readPublicMenuSettingsWithFallbacks({
        client: admin.client,
        restaurantId: data.restaurant.id
      });
      publicMenuStyle = settings.publicMenuStyle;
    } catch {
      // Keep default style when settings cannot be loaded.
    }
  }

  const uiConfig = await getOwnerMenuUiConfig(data.restaurant.id);
  uniqueDesignStatus = uiConfig.record.config.uniqueDesign?.status ?? null;

  const preparation = buildOwnerRestaurantPreparation(data.restaurant, dishes, {
    publicMenuStyle,
    uniqueDesignStatus
  });

  return (
    <OwnerRestaurantDashboard
      restaurant={data.restaurant}
      preparation={preparation}
      uniqueUi={
        publicMenuStyle === "unique"
          ? {
              statusLabel:
                uniqueDesignStatus === "published"
                  ? "Publié"
                  : uniqueDesignStatus === "draft"
                    ? "En développement"
                    : uniqueDesignStatus === "ready"
                      ? "Prêt à publier"
                      : uniqueDesignStatus === "archived"
                        ? "Archivé"
                        : "À construire",
              designStudioHref: `/owner/menu-builder?restaurantId=${encodeURIComponent(data.restaurant.id)}&restaurantSlug=${encodeURIComponent(data.restaurant.slug)}`,
              uniqueUiHref: `/owner/restaurants/${encodeURIComponent(data.restaurant.id)}/unique-ui`,
              publicMenuHref: data.restaurant.publicMenuUrl
            }
          : null
      }
    />
  );
}
