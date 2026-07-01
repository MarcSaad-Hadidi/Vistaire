import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerRestaurantSettings } from "@/components/owner/OwnerRestaurantSettings";
import { ModuleHeader, Panel } from "@/components/owner/OwnerUi";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";
import { ownerRestaurantRoute } from "@/lib/owner/restaurantPreparation";

export const dynamic = "force-dynamic";

export default async function OwnerRestaurantSettingsPage({
  params
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const dashboard = await getOwnerRestaurantDashboardData(restaurantId);
  if (!dashboard.restaurant) notFound();

  const restaurant = dashboard.restaurant;
  const menuData = await getOwnerMenuData(restaurant.id);
  const menuSettings = menuData.ok ? menuData.menu.settings : undefined;

  return (
    <>
      <ModuleHeader
        title={`Paramètres — ${restaurant.name}`}
        description="Informations du restaurant et actions de cycle de vie. Les champs restent en lecture tant qu’aucune mutation d’édition dédiée n’est disponible."
        actions={
          <>
            <Link className={styles.btn} href={ownerRestaurantRoute(restaurant)} prefetch={false}>
              Vue d’ensemble
            </Link>
            <Link className={styles.btn} href={ownerRestaurantRoute(restaurant, "qr")} prefetch={false}>
              QR & publication
            </Link>
          </>
        }
      />

      <Panel title="Informations restaurant">
        <OwnerRestaurantSettings
          restaurant={restaurant}
          menuSettings={menuSettings}
        />
      </Panel>
    </>
  );
}
