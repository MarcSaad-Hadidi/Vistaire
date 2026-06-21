import Link from "next/link";
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
        title={`Carte & plats — ${restaurant.name}`}
        description="Gérez la carte visible par les clients: catégories, plats, prix, disponibilité, descriptions et médias associés."
        actions={
          <>
            <Link className={styles.btn} href={ownerRestaurantRoute(restaurant)} prefetch={false}>
              Vue d’ensemble
            </Link>
            <Link
              className={styles.btn}
              href={ownerRestaurantRoute(restaurant, "preview")}
              prefetch={false}
            >
              Aperçu client
            </Link>
          </>
        }
      />

      <StatGroup title="Carte">
        <StatTile label="Catégories" value={summary.categoryCount} primary />
        <StatTile label="Plats" value={summary.dishCount} />
        <StatTile label="Prix manquants" value={summary.missingPriceCount} />
        <StatTile label="Descriptions à compléter" value={summary.missingDescriptionCount} />
      </StatGroup>

      <Panel
        title="Actions carte"
        action={<Badge tone="muted">{menuData.ok ? menuData.source : "indisponible"}</Badge>}
      >
        <div className={styles.restaurantActionGrid}>
          <button className={styles.btn} type="button" disabled>
            Ajouter plat · à brancher
          </button>
          <button className={styles.btn} type="button" disabled>
            Importer un menu · à venir
          </button>
          <Link className={styles.btn} href="/owner/menu-builder" prefetch={false}>
            Ajuster le design du menu
          </Link>
        </div>
      </Panel>

      <Panel title="Catégories">
        {!menuData.ok ? (
          <EmptyState>{menuData.error}</EmptyState>
        ) : menuData.categories.length === 0 ? (
          <EmptyState>Aucune catégorie visible pour ce restaurant.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Description</th>
                  <th>Plats</th>
                </tr>
              </thead>
              <tbody>
                {menuData.categories.map((category) => (
                  <tr key={category.id}>
                    <td className={styles.cellMain}>{category.label}</td>
                    <td className={styles.cellSub}>{category.description}</td>
                    <td>{category.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Plats">
        {!menuData.ok ? (
          <EmptyState>{menuData.error}</EmptyState>
        ) : dishes.length === 0 ? (
          <EmptyState>Aucun plat chargé pour ce restaurant.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Plat</th>
                  <th>Prix</th>
                  <th>Disponibilité</th>
                  <th>Description</th>
                  <th>Photo</th>
                  <th>Média</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((dish) => (
                  <tr key={dish.id}>
                    <td>
                      <strong className={styles.cellMain}>{dish.name}</strong>
                      <span className={styles.cellSub}>{dish.category}</span>
                    </td>
                    <td>{dish.priceLabel || <Badge tone="warn">Prix manquant</Badge>}</td>
                    <td>
                      <Badge tone={dish.available ? "ready" : "muted"}>
                        {dish.available ? "Disponible" : "Indisponible"}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={dish.description ? "ready" : "warn"}>
                        {dish.description ? "Prête" : "À compléter"}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={dish.hasPhoto ? "ready" : "warn"}>
                        {dish.hasPhoto ? "Photo prête" : dish.photoStatus}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={dish.hasImmersive ? "ready" : "muted"}>
                        {dish.hasImmersive ? "Modèle prêt" : "Aucun modèle"}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        className={`${styles.btn} ${styles.btnSmall}`}
                        href={ownerRestaurantRoute(restaurant, "medias")}
                        prefetch={false}
                      >
                        Médias
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
