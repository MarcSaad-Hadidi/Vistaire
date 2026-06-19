import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { RestaurantCreateForm } from "@/components/owner/RestaurantCreateForm";
import { ModuleHeader, Panel } from "@/components/owner/OwnerUi";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function OwnerRestaurantCreatePage() {
  const siteOrigin = getSiteUrl().origin;

  return (
    <>
      <ModuleHeader
        title="Creer restaurant"
        description="Profil, menu, plats et revue finale. Supabase confirme apres sauvegarde ce qui a ete persiste."
        actions={
          <Link className={styles.btn} href="/owner/restaurants" prefetch={false}>
            Retour restaurants
          </Link>
        }
      />

      <Panel
        title="Creation guidee"
        action={
          <span className={styles.sourceTag}>
            Creation Supabase avec rapport de persistance
          </span>
        }
      >
        <RestaurantCreateForm siteOrigin={siteOrigin} />
      </Panel>
    </>
  );
}
