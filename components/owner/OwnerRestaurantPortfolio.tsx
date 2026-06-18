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

function readinessTone(score: number): BadgeTone {
  if (score >= 80) return "ready";
  if (score >= 50) return "warn";
  return "danger";
}

function restaurantActions(
  restaurant: OwnerRestaurant,
  actions: OwnerAction[] = []
): OwnerAction[] {
  return actions.filter((action) => action.restaurantId === restaurant.id);
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
        Aucun restaurant disponible. Creez un restaurant pour lancer le portefeuille.
      </div>
    );
  }

  return (
    <div className={styles.ownerRestaurantGrid}>
      {visibleRestaurants.map((restaurant) => {
        const scopedActions = restaurantActions(restaurant, actions);
        const primaryAction = scopedActions[0]?.title ?? restaurant.nextAction;
        const menuReady = restaurant.dishCount > 0;
        const photosReady =
          restaurant.dishCount > 0 && restaurant.incompleteDishCount === 0;

        return (
          <a
            key={restaurant.id}
            className={styles.ownerRestaurantCard}
            href={restaurant.dashboardHref}
          >
            <div className={styles.ownerRestaurantCardTop}>
              <div>
                <span className={styles.restaurantSlug}>{restaurant.slug}</span>
                <h3>{restaurant.name}</h3>
                <p>
                  {restaurant.location} · {restaurant.cuisineType}
                </p>
              </div>
              <div className={styles.ownerScore}>
                <strong>{restaurant.readinessScore}%</strong>
                <span>Ready</span>
              </div>
            </div>

            <div className={styles.ownerProgress} aria-hidden="true">
              <span style={{ width: `${restaurant.readinessScore}%` }} />
            </div>

            <div className={styles.pillRow}>
              <Badge tone={readinessTone(restaurant.readinessScore)}>
                {restaurant.statusLabel}
              </Badge>
              <Badge tone={qrTone(restaurant.qrStatus)}>{restaurant.qrStatusLabel}</Badge>
              <Badge tone={menuReady ? "ready" : "danger"}>
                {menuReady ? "Menu actif" : "Menu vide"}
              </Badge>
              <Badge tone={photosReady ? "ready" : "warn"}>
                {restaurant.photoDishCount}/{restaurant.dishCount || 0} photos
              </Badge>
            </div>

            <div className={styles.ownerMiniMetrics}>
              <span>
                <small>Plats</small>
                <strong>{restaurant.dishCount}</strong>
              </span>
              <span>
                <small>QR</small>
                <strong>{restaurant.qrStatus === "ready" ? "Pret" : "Action"}</strong>
              </span>
              <span>
                <small>3D/AR</small>
                <strong>{restaurant.immersiveDishCount}</strong>
              </span>
              <span>
                <small>Signaux</small>
                <strong>{restaurant.openingsToday}</strong>
              </span>
            </div>

            <div className={styles.ownerNextAction}>
              <span>Prochaine action</span>
              <strong>{primaryAction}</strong>
            </div>

            <span className={styles.ownerCardCta}>Ouvrir dashboard</span>
          </a>
        );
      })}
    </div>
  );
}
