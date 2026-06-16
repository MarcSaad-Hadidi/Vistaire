import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerRestaurantPortfolio } from "@/components/owner/OwnerRestaurantPortfolio";
import { Badge, EmptyState, ModuleHeader, Panel, StatGroup, StatTile } from "@/components/owner/OwnerUi";
import { getOwnerDashboard } from "@/lib/owner/dashboard";
import type { OwnerAction } from "@/lib/owner/types";

export const dynamic = "force-dynamic";

const PRIORITY_TONE: Record<OwnerAction["priority"], "danger" | "warn" | "muted"> = {
  high: "danger",
  medium: "warn",
  low: "muted"
};

const PRIORITY_LABEL: Record<OwnerAction["priority"], string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse"
};

export default async function OwnerOverviewPage() {
  const data = await getOwnerDashboard();
  const restaurantsToTreat = data.restaurants
    .filter(
      (restaurant) =>
        restaurant.readinessScore < 80 ||
        restaurant.qrStatus !== "ready" ||
        restaurant.incompleteDishCount > 0
    )
    .sort((a, b) => a.readinessScore - b.readinessScore);
  const missingPhotos = data.restaurants.reduce(
    (sum, restaurant) => sum + restaurant.incompleteDishCount,
    0
  );
  const qrReady = data.restaurants.filter((restaurant) => restaurant.qrStatus === "ready").length;
  const menuReady = data.restaurants.filter((restaurant) => restaurant.dishCount > 0).length;
  const topPriorities = data.actions.slice(0, 5);

  return (
    <>
      <ModuleHeader
        title="Vue portefeuille"
        description="Choisir un restaurant, puis gerer son dashboard dedie. Le global ne garde que les priorites owner et les comptes a traiter."
        actions={
          <>
            <Link
              className={`${styles.btnPrimary} ${styles.btn}`}
              href="/owner/restaurants/create"
              prefetch={false}
            >
              Creer restaurant
            </Link>
            <Link className={styles.btn} href="/owner/restaurants" prefetch={false}>
              Voir restaurants
            </Link>
            <Link className={styles.btn} href="/owner/qr-codes" prefetch={false}>
              Generer QR
            </Link>
          </>
        }
      />

      <StatGroup title="Portefeuille">
        <StatTile label="Restaurants" value={data.stats.totalRestaurants} primary hint="Actifs, setup et demo." />
        <StatTile label="Actions a traiter" value={data.stats.actionsToTreat} hint="Maximum 5 priorites affichees." />
        <StatTile label="QR prets" value={`${qrReady}/${data.restaurants.length}`} hint="Menus testables par QR." />
        <StatTile label="Photos manquantes" value={missingPhotos} hint="Plats sans photo detectee." />
        <StatTile label="Menus prets" value={`${menuReady}/${data.restaurants.length}`} hint="Restaurants avec plats." />
      </StatGroup>

      <section className={styles.ownerPortfolioLayout}>
        <Panel
          title="Restaurants a traiter"
          action={
            <span className={styles.sourceTag}>
              {data.source === "fallback" ? "Donnees demo" : "Supabase"}
            </span>
          }
        >
          <OwnerRestaurantPortfolio
            restaurants={restaurantsToTreat.length ? restaurantsToTreat : data.restaurants}
            actions={data.actions}
            limit={6}
          />
        </Panel>

        <Panel title="Priorites owner">
          {topPriorities.length === 0 ? (
            <EmptyState>Aucune priorite urgente dans les donnees disponibles.</EmptyState>
          ) : (
            <div className={styles.priorityList}>
              {topPriorities.map((priority, index) => {
                const restaurant = data.restaurants.find(
                  (item) => item.id === priority.restaurantId
                );
                return (
                  <Link
                    key={priority.id}
                    className={styles.priorityItem}
                    href={restaurant?.dashboardHref ?? priority.href}
                    prefetch={false}
                  >
                    <span className={styles.priorityIndex}>{index + 1}</span>
                    <span>
                      <strong>
                        {priority.restaurantName} - {priority.title}
                      </strong>
                      <small>{priority.body}</small>
                      <Badge tone={PRIORITY_TONE[priority.priority]}>
                        {PRIORITY_LABEL[priority.priority]}
                      </Badge>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>
      </section>

      <Panel title="Chemin principal">
        <div className={styles.workflowStrip}>
          <span>1. Vue portefeuille</span>
          <span>2. Creation guidee</span>
          <span>3. Selection restaurant</span>
          <span>4. Dashboard dedie</span>
        </div>
        <p className={styles.sourceNote}>
          Les routes globales QR, menus, plats, medias et 3D/AR restent
          accessibles. Le chemin principal passe maintenant par le restaurant.
        </p>
      </Panel>
    </>
  );
}
