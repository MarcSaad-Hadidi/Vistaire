import { notFound } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerRestaurant3dManager } from "@/components/owner/OwnerRestaurant3dManager";
import { ModuleHeader, StatGroup, StatTile } from "@/components/owner/OwnerUi";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";

export const dynamic = "force-dynamic";

export default async function OwnerRestaurant3dPage({
  params
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const dashboard = await getOwnerRestaurantDashboardData(restaurantId);
  if (!dashboard.restaurant) notFound();

  const restaurant = dashboard.restaurant;
  const menuData = await getOwnerMenuData(restaurant.id);
  const dishes = menuData.ok ? menuData.dishes : [];
  const webReady = dishes.filter((dish) => dish.webModel3dUrl).length;
  const usdzReady = dishes.filter((dish) => dish.arUsdzUrl).length;

  return (
    <>
      <ModuleHeader
        title={`3D / AR - ${restaurant.name}`}
        description="Ajouter un GLB Meshy prepare par plat. Vistaire garde le GLB pour le web, genere l'AR-lite et l'USDZ iOS, puis synchronise les URLs finales dans Supabase."
      />

      <StatGroup title="Modeles">
        <StatTile label="Plats" value={dishes.length || restaurant.dishCount} primary />
        <StatTile label="GLB web" value={webReady} />
        <StatTile label="USDZ iOS" value={usdzReady} />
      </StatGroup>

      <OwnerRestaurant3dManager
        restaurantId={restaurant.id}
        restaurantSlug={restaurant.slug}
        dishes={dishes}
        menuError={menuData.ok ? undefined : menuData.error}
      />

      <p className={styles.sourceTag}>
        Le GLB doit deja etre prepare avant upload. Cette page utilise le
        pipeline Meshy owner: GLB web, GLB AR-lite et USDZ Quick Look sont
        generes sous les assets restaurant, puis Supabase garde les URLs.
      </p>
    </>
  );
}
