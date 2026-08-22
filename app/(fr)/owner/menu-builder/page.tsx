import Link from "next/link";
import { MenuUiBuilder } from "@/components/owner/MenuUiBuilder";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { ModuleHeader } from "@/components/owner/OwnerUi";
import { getOwnerRestaurantsData } from "@/lib/owner/data";

export const dynamic = "force-dynamic";

export default async function OwnerMenuBuilderPage() {
  const data = await getOwnerRestaurantsData();
  const restaurants = data.restaurants.map(
    ({ id, name, slug, publicMenuPath, publicMenuUrl }) => ({
      id,
      name,
      slug,
      publicMenuPath,
      publicMenuUrl
    })
  );

  return (
    <>
      <ModuleHeader
        title="Menu Design Studio"
        description="Outil interne Vistaire : choisissez un preset, personnalisez couleurs, typography, cartes, fiches, photos et 3D/AR, puis publiez la config du menu public."
        actions={
          <>
            <Link className={styles.btn} href="/owner/menus" prefetch={false}>
              Statut menus
            </Link>
            <Link className={styles.btn} href="/owner/qr-codes" prefetch={false}>
              QR Codes
            </Link>
          </>
        }
      />

      <MenuUiBuilder
        restaurants={restaurants}
        source={data.source}
        note={data.note}
      />
    </>
  );
}
