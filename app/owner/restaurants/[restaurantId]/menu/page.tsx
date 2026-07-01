import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerRestaurantMenuManager } from "@/components/owner/OwnerRestaurantMenuManager";
import { ModuleHeader, StatGroup, StatTile } from "@/components/owner/OwnerUi";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";
import {
  buildOwnerPreparationSummary,
  ownerRestaurantRoute
} from "@/lib/owner/restaurantPreparation";

export const dynamic = "force-dynamic";

export default async function OwnerRestaurantMenuPage({
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
  const summary = buildOwnerPreparationSummary(restaurant, dishes);

  return (
    <>
      <ModuleHeader
        title={`Carte & plats - ${restaurant.name}`}
        description="Gerez la carte visible par les clients: categories, plats, prix, disponibilite, descriptions et medias associes."
        actions={
          <>
            <Link className={styles.btn} href={ownerRestaurantRoute(restaurant)} prefetch={false}>
              Vue globale
            </Link>
            <Link
              className={styles.btn}
              href={ownerRestaurantRoute(restaurant, "preview")}
              prefetch={false}
            >
              Apercu client
            </Link>
          </>
        }
      />

      <StatGroup title="Carte">
        <StatTile label="Categories" value={summary.categoryCount} primary />
        <StatTile label="Plats" value={summary.dishCount} />
        <StatTile label="Prix manquants" value={summary.missingPriceCount} />
        <StatTile
          label="Descriptions a completer"
          value={summary.missingDescriptionCount}
        />
      </StatGroup>

      <OwnerRestaurantMenuManager
        restaurantId={restaurant.id}
        categories={menuData.ok ? menuData.categories : []}
        dishes={dishes}
        source={menuData.ok ? menuData.source : "fallback"}
        menuError={menuData.ok ? undefined : menuData.error}
        mediasHref={ownerRestaurantRoute(restaurant, "medias")}
      />
    </>
  );
}
