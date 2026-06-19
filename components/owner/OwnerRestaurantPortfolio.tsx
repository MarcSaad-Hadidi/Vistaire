import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, type BadgeTone } from "@/components/owner/OwnerUi";
import type { OwnerAction, OwnerRestaurant } from "@/lib/owner/types";

type OwnerRestaurantPortfolioProps = {
  restaurants: OwnerRestaurant[];
  actions?: OwnerAction[];
  limit?: number;
};

function qrTone(status: OwnerRestaurant["qrStatus"]): BadgeTone {
  if (status === "ready") return "ready";
  if (status === "generable") return "warn";
  return "danger";
}

function statusTone(restaurant: OwnerRestaurant): BadgeTone {
  if (restaurant.status === "paused" || restaurant.status === "archived") return "muted";
  if (restaurant.readinessScore >= 80 && restaurant.qrStatus === "ready") return "ready";
  if (restaurant.readinessScore >= 50 || restaurant.qrStatus === "generable") return "warn";
  return "danger";
}

function portfolioStatus(restaurant: OwnerRestaurant): string {
  if (restaurant.status === "paused") return "En pause";
  if (restaurant.status === "archived") return "Archivé";
  if (restaurant.readinessScore >= 80 && restaurant.qrStatus === "ready") return "Prêt";
  if (restaurant.qrStatus !== "ready" || restaurant.dishCount === 0) {
    return "Attention requise";
  }
  return "À configurer";
}

function restaurantPrimaryAction(
  restaurant: OwnerRestaurant,
  actions: OwnerAction[]
): string {
  return actions.find((action) => action.restaurantId === restaurant.id)?.title ?? restaurant.nextAction;
}

export function OwnerRestaurantPortfolio({
  restaurants,
  actions = [],
  limit
}: OwnerRestaurantPortfolioProps) {
  const visibleRestaurants = typeof limit === "number" ? restaurants.slice(0, limit) : restaurants;

  if (visibleRestaurants.length === 0) {
    return (
      <div className={styles.emptyState}>
        Aucun restaurant disponible. Créez un restaurant pour lancer le portefeuille.
      </div>
    );
  }

  return (
    <div className={styles.ownerRestaurantGrid}>
      {visibleRestaurants.map((restaurant) => {
        const primaryAction = restaurantPrimaryAction(restaurant, actions);

        return (
          <article key={restaurant.id} className={styles.ownerRestaurantCard}>
            <div className={styles.ownerRestaurantCardTop}>
              <div>
                <span className={styles.restaurantSlug}>{restaurant.slug}</span>
                <h3>{restaurant.name}</h3>
                <p>
                  {restaurant.location} · {restaurant.cuisineType}
                </p>
              </div>
              <div className={styles.ownerScore} aria-label={`${restaurant.readinessScore}% de mise en ligne`}>
                <strong>{restaurant.readinessScore}%</strong>
                <span>Mise en ligne</span>
              </div>
            </div>

            <div className={styles.ownerProgress} aria-hidden="true">
              <span style={{ width: `${restaurant.readinessScore}%` }} />
            </div>

            <div className={styles.pillRow}>
              <Badge tone={statusTone(restaurant)}>{portfolioStatus(restaurant)}</Badge>
              <Badge tone={qrTone(restaurant.qrStatus)}>{restaurant.qrStatusLabel}</Badge>
            </div>

            <div className={styles.ownerNextAction}>
              <span>Prochaine action</span>
              <strong>{primaryAction}</strong>
            </div>

            <div className={styles.restaurantEssentials} aria-label="Indicateurs essentiels">
              <span>{restaurant.dishCount} plats</span>
              <span>
                Photos {restaurant.photoDishCount}/{restaurant.dishCount || 0}
              </span>
              <span>QR {restaurant.qrStatus === "ready" ? "prêt" : "à faire"}</span>
              <span>3D/AR {restaurant.immersiveDishCount}</span>
            </div>

            <Link
              className={styles.ownerOpenLink}
              href={restaurant.dashboardHref}
              prefetch={false}
              aria-label={`Ouvrir ${restaurant.name}`}
            >
              Ouvrir
            </Link>
          </article>
        );
      })}
    </div>
  );
}
