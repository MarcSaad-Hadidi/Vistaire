import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerRestaurantTable } from "@/components/owner/OwnerRestaurantTable";
import { RestaurantCreateForm } from "@/components/owner/RestaurantCreateForm";
import { ModuleHeader, Panel } from "@/components/owner/OwnerUi";
import { getOwnerRestaurantsData } from "@/lib/owner/data";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function OwnerRestaurantsPage() {
  const data = await getOwnerRestaurantsData();
  const siteOrigin = getSiteUrl().origin;

  return (
    <>
      <ModuleHeader
        title="Restaurants"
        description="Comptes, readiness, menu, QR, photos et 3D/AR — table dense et fiche détail."
      />

      <Panel title={`${data.restaurants.length} restaurant(s)`} action={<span className={styles.sourceTag}>{data.source === "fallback" ? "Données demo" : "Supabase"}</span>}>
        <OwnerRestaurantTable restaurants={data.restaurants} />
      </Panel>

      <section id="create">
        <Panel title="Créer un restaurant">
          <RestaurantCreateForm siteOrigin={siteOrigin} />
        </Panel>
      </section>
    </>
  );
}
