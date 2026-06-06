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
        title="Menu UI Builder"
        description="Outil interne Vistaire : entrez les vraies infos du menu, choisissez le style, puis prévisualisez l’expérience mobile générée avant publication."
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
