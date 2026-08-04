import Link from "next/link";
import styles from "@/components/owner/OwnerQrManagement.module.css";
import { OwnerQrManager } from "@/components/owner/OwnerQrManager";
import { getOwnerRestaurantsData } from "@/lib/owner/data";
import type { OwnerQrTargetKind } from "@/lib/owner/menuUrlCore";

export const dynamic = "force-dynamic";

type OwnerQrCodesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
): string | undefined {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTargetKind(value: string | undefined): OwnerQrTargetKind {
  return value === "admin" ? "admin" : "menu";
}

export default async function OwnerQrCodesPage({ searchParams }: OwnerQrCodesPageProps) {
  const data = await getOwnerRestaurantsData();
  const params = await searchParams;

  return (
    <div className={`${styles.managementPage} qrManagementPage`}>
      <header className={`${styles.managementHeader} qrManagementHeader`}>
        <div className={styles.brandBlock}>
          <h1>QR Codes</h1>
          <p>Gérez vos QR codes pour vos menus publics et l’accès à votre dashboard.</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.btn} href="/apercu-restaurateur" prefetch={false}>
            Aperçu public
          </Link>
        </div>
      </header>

      <div className={styles.managementBody}>
        <OwnerQrManager
          restaurants={data.restaurants}
          initialRestaurantId={getSearchParam(params, "restaurantId")}
          initialRestaurantSlug={
            getSearchParam(params, "restaurantSlug") ?? getSearchParam(params, "restaurant")
          }
          initialTargetKind={normalizeTargetKind(getSearchParam(params, "target"))}
        />
      </div>

      <p className={styles.sourceTag}>
        <span aria-hidden="true">⌕</span> Sécurisé : chaque QR utilise un token unique et sécurisé. Ne partagez jamais le lien de votre dashboard.
      </p>
    </div>
  );
}
