import { notFound } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  Badge,
  EmptyState,
  ModuleHeader,
  Panel,
  StatGroup,
  StatTile
} from "@/components/owner/OwnerUi";
import { OwnerDishModelUploader } from "@/components/owner/OwnerDishModelUploader";
import { OwnerDishModelVisualCompare } from "@/components/owner/OwnerDishModelVisualCompare";
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
  const visualDishes = dishes.filter((dish) => dish.webModel3dUrl && dish.arUsdzUrl);

  return (
    <>
      <ModuleHeader
        title={`3D / AR - ${restaurant.name}`}
        description="Ajouter un GLB Meshy prepare par plat. Vistaire lance le pipeline Meshy owner, garde le GLB pour le web, genere l'AR-lite et l'USDZ iOS, puis synchronise les URLs finales dans Supabase."
      />

      <StatGroup title="Modeles">
        <StatTile label="Plats" value={dishes.length || restaurant.dishCount} primary />
        <StatTile label="GLB web" value={webReady} />
        <StatTile label="USDZ iOS" value={usdzReady} />
      </StatGroup>

      <Panel
        title="Plats du restaurant"
        action={<Badge tone="muted">{restaurant.slug}</Badge>}
      >
        {!menuData.ok ? (
          <EmptyState>{menuData.error}</EmptyState>
        ) : dishes.length === 0 ? (
          <EmptyState>Aucun plat charge pour ce restaurant.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Plat</th>
                  <th>Section</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((dish) => (
                  <tr key={dish.id}>
                    <td>
                      <strong className={styles.cellMain}>{dish.name}</strong>
                    </td>
                    <td className={styles.cellSub}>{dish.category}</td>
                    <td>
                      <Badge tone={dish.hasImmersive ? "ready" : "warn"}>
                        {dish.modelStatus === "ready"
                          ? "GLB + USDZ prets"
                          : dish.preparedGlbStoragePath
                            ? "Conversion a finaliser"
                            : dish.webModel3dUrl
                            ? "GLB pret, USDZ attendu"
                            : "Aucun modele"}
                      </Badge>
                    </td>
                    <td>
                      <OwnerDishModelUploader
                        restaurantId={restaurant.id}
                        dishId={dish.id}
                        dishName={dish.name}
                        initialStatus={dish.modelStatus}
                        initialWebModel3dUrl={dish.webModel3dUrl}
                        initialWebModel3dBytes={dish.webModel3dBytes}
                        initialArUsdzUrl={dish.arUsdzUrl}
                        initialArUsdzBytes={dish.arUsdzBytes}
                        initialPreparedGlbJobId={dish.preparedGlbJobId}
                        initialPreparedGlbStoragePath={dish.preparedGlbStoragePath}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visualDishes.length > 0 ? (
              <div className={styles.modelCompareStack}>
                {visualDishes.map((dish) => (
                  <OwnerDishModelVisualCompare
                    key={dish.id}
                    dishName={dish.name}
                    webModel3dUrl={dish.webModel3dUrl}
                    webModel3dBytes={dish.webModel3dBytes}
                    arPreviewModelUrl={dish.arModel3dUrl || dish.webModel3dUrl}
                    arUsdzUrl={dish.arUsdzUrl}
                    arUsdzBytes={dish.arUsdzBytes}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </Panel>

      <p className={styles.sourceTag}>
        Le GLB doit deja etre prepare avant upload. Cette page utilise le
        pipeline Meshy owner: GLB web, GLB AR-lite et USDZ Quick Look sont
        generes sous les assets restaurant, puis Supabase garde les URLs.
      </p>
    </>
  );
}
