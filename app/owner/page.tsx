import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerRestaurantPortfolio } from "@/components/owner/OwnerRestaurantPortfolio";
import { ModuleHeader, Panel, StatGroup, StatTile } from "@/components/owner/OwnerUi";
import { getOwnerDashboard } from "@/lib/owner/dashboard";

export const dynamic = "force-dynamic";

function isActivePortfolioRestaurant(
  restaurant: Awaited<ReturnType<typeof getOwnerDashboard>>["restaurants"][number]
) {
  return restaurant.status !== "archived" && restaurant.status !== "paused";
}

function restaurantNeedsAction(
  restaurant: Awaited<ReturnType<typeof getOwnerDashboard>>["restaurants"][number]
) {
  return (
    isActivePortfolioRestaurant(restaurant) &&
    (restaurant.readinessScore < 80 ||
      restaurant.qrStatus !== "ready" ||
      restaurant.incompleteDishCount > 0)
  );
}

function statusSortWeight(
  restaurant: Awaited<ReturnType<typeof getOwnerDashboard>>["restaurants"][number]
) {
  if (restaurant.status === "archived") return 2;
  if (restaurant.status === "paused") return 1;
  return 0;
}

export default async function OwnerOverviewPage() {
  const data = await getOwnerDashboard();
  const activeRestaurants = data.restaurants.filter(isActivePortfolioRestaurant);
  const restaurantsToTreat = data.restaurants.filter(restaurantNeedsAction);
  const qrToPrepare = activeRestaurants.filter(
    (restaurant) => restaurant.qrStatus !== "ready"
  ).length;
  const incompleteMenus = activeRestaurants.filter(
    (restaurant) => restaurant.dishCount === 0 || restaurant.incompleteDishCount > 0
  ).length;
  const sortedRestaurants = [...data.restaurants].sort((a, b) => {
    const statusWeight = statusSortWeight(a) - statusSortWeight(b);
    if (statusWeight !== 0) return statusWeight;

    const aNeedsAction = restaurantNeedsAction(a);
    const bNeedsAction = restaurantNeedsAction(b);
    if (aNeedsAction !== bNeedsAction) return aNeedsAction ? -1 : 1;
    return a.readinessScore - b.readinessScore;
  });

  return (
    <>
      <ModuleHeader
        title="Restaurants"
        description="Choisissez le restaurant à ouvrir pour gérer sa carte, son QR et sa mise en ligne."
        actions={
          <>
            <Link
              className={`${styles.btnPrimary} ${styles.btn}`}
              href="/owner/restaurants/create"
              prefetch={false}
            >
              Créer un restaurant
            </Link>
            {qrToPrepare > 0 ? (
              <Link className={styles.btn} href="/owner/qr-codes" prefetch={false}>
                Préparer QR
              </Link>
            ) : null}
          </>
        }
      />

      <StatGroup title="Portefeuille">
        <StatTile label="Restaurants" value={data.stats.totalRestaurants} primary />
        <StatTile label="À traiter" value={restaurantsToTreat.length} />
        <StatTile label="QR manquants" value={qrToPrepare} />
        <StatTile label="Menus incomplets" value={incompleteMenus} />
      </StatGroup>

      <Panel
        title="Quel restaurant ouvrir maintenant ?"
        action={
          <span className={styles.sourceTag}>
            {data.source === "fallback" ? "Données de démonstration" : "Portefeuille connecté"}
          </span>
        }
      >
        <OwnerRestaurantPortfolio restaurants={sortedRestaurants} actions={data.actions} />
      </Panel>
    </>
  );
}
