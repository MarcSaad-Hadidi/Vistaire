import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerRestaurantPicker } from "@/components/owner/OwnerRestaurantPicker";
import { OwnerRestaurantPortfolio } from "@/components/owner/OwnerRestaurantPortfolio";
import { ModuleHeader, Panel } from "@/components/owner/OwnerUi";
import { getOwnerRestaurantsData } from "@/lib/owner/data";
import { buildRestaurantDashboardPath } from "@/lib/owner/menuUrls";

export const dynamic = "force-dynamic";

export default async function OwnerRestaurantsPage({
  searchParams
}: {
  searchParams?: Promise<{ deleted?: string; restaurantId?: string }>;
}) {
  const params = await searchParams;
  if (params?.restaurantId) {
    redirect(buildRestaurantDashboardPath(params.restaurantId));
  }

  const data = await getOwnerRestaurantsData();
  const needsAttention = data.restaurants
    .filter(
      (restaurant) =>
        restaurant.readinessScore < 80 ||
        restaurant.qrStatus !== "ready" ||
        restaurant.incompleteDishCount > 0
    )
    .sort((a, b) => a.readinessScore - b.readinessScore)
    .slice(0, 3);

  return (
    <>
      <ModuleHeader
        title="Restaurants"
        description="Sélection avancée du portefeuille. Le chemin principal reste l’ouverture d’un restaurant, puis ses sections Carte, Médias, Aperçu, QR et Paramètres."
        actions={
          <>
            <Link
              className={`${styles.btnPrimary} ${styles.btn}`}
              href="/owner/restaurants/create"
              prefetch={false}
            >
              Créer restaurant
            </Link>
            <Link className={styles.btn} href="/owner" prefetch={false}>
              Vue portefeuille
            </Link>
          </>
        }
      />

      {params?.deleted === "1" ? (
        <p className={styles.qrStatus} role="status">
          Restaurant supprimé définitivement.
        </p>
      ) : null}

      {needsAttention.length > 0 ? (
        <Panel
          title="À traiter en premier"
          action={
            <span className={styles.sourceTag}>
              {data.source === "fallback" ? "Données démo" : "Supabase"}
            </span>
          }
        >
          <OwnerRestaurantPortfolio restaurants={needsAttention} />
        </Panel>
      ) : null}

      <Panel
        title={`${data.restaurants.length} restaurant(s)`}
        action={
          <span className={styles.sourceTag}>
            {data.source === "fallback" ? "Données démo" : "Supabase"}
          </span>
        }
      >
        <OwnerRestaurantPicker restaurants={data.restaurants} />
      </Panel>

      <p className={styles.sourceTag}>
        La table dense reste disponible dans le picker avancé. Les anciennes
        routes globales restent accessibles par URL directe.
      </p>
    </>
  );
}
