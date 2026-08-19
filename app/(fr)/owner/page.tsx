import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerRestaurantPortfolio } from "@/components/owner/OwnerRestaurantPortfolio";
import { ModuleHeader, Panel, StatGroup, StatTile } from "@/components/owner/OwnerUi";
import { getOwnerDashboard } from "@/lib/owner/dashboard";

export const dynamic = "force-dynamic";

type OwnerDashboardRestaurant = Awaited<
  ReturnType<typeof getOwnerDashboard>
>["restaurants"][number];

function isActivePortfolioRestaurant(restaurant: OwnerDashboardRestaurant) {
  return restaurant.status !== "archived" && restaurant.status !== "paused";
}

function restaurantNeedsAction(restaurant: OwnerDashboardRestaurant) {
  return (
    isActivePortfolioRestaurant(restaurant) &&
    (restaurant.readinessScore < 80 ||
      restaurant.qrStatus !== "ready" ||
      restaurant.incompleteDishCount > 0)
  );
}

function statusSortWeight(restaurant: OwnerDashboardRestaurant) {
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
        description="Choisissez un restaurant pour préparer sa carte, ses médias, son aperçu client et son QR."
        actions={
          <>
            <Link className={styles.btn} href="/owner/model-lab" prefetch={false}>
              Model Lab
            </Link>
          <Link
            className={`${styles.btnPrimary} ${styles.btn}`}
            href="/owner/restaurants/create"
            prefetch={false}
          >
            Créer un restaurant
          </Link>
          </>
        }
      />

      <StatGroup title="Portefeuille">
        <StatTile label="Restaurants" value={data.stats.totalRestaurants} primary />
        <StatTile label="À traiter" value={restaurantsToTreat.length} />
        <StatTile label="QR à préparer" value={qrToPrepare} />
        <StatTile label="Menus incomplets" value={incompleteMenus} />
      </StatGroup>

      <Panel
        title="Restaurants à ouvrir"
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
