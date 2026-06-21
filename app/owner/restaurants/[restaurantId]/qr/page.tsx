import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuQrCode } from "@/components/owner/MenuQrCode";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerCopyLinkButton } from "@/components/owner/OwnerCopyLinkButton";
import {
  Badge,
  ModuleHeader,
  Panel,
  StatGroup,
  StatTile
} from "@/components/owner/OwnerUi";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";
import {
  buildOwnerRestaurantPreparation,
  ownerRestaurantRoute,
  qrTone
} from "@/lib/owner/restaurantPreparation";

export const dynamic = "force-dynamic";

export default async function OwnerRestaurantQrPage({
  params
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const dashboard = await getOwnerRestaurantDashboardData(restaurantId);
  if (!dashboard.restaurant) notFound();

  const restaurant = dashboard.restaurant;
  const menuData = await getOwnerMenuData(restaurant.id);
  const preparation = buildOwnerRestaurantPreparation(
    restaurant,
    menuData.ok ? menuData.dishes : []
  );
  const persistentQrHref = `/owner/qr-codes?restaurantId=${encodeURIComponent(
    restaurant.id
  )}&target=menu`;

  return (
    <>
      <ModuleHeader
        title={`QR & publication — ${restaurant.name}`}
        description="Préparez le QR du restaurant, vérifiez son URL publique et ouvrez le rendu client avant impression."
        actions={
          <>
            <a className={`${styles.btnPrimary} ${styles.btn}`} href={restaurant.menuUrl} target="_blank" rel="noreferrer">
              Ouvrir comme client
            </a>
            <OwnerCopyLinkButton value={restaurant.menuUrl} />
            <Link className={styles.btn} href={persistentQrHref} prefetch={false}>
              Personnaliser QR
            </Link>
          </>
        }
      />

      <StatGroup title="Publication">
        <StatTile label="Statut QR" value={restaurant.qrStatusLabel} primary />
        <StatTile label="Plats" value={preparation.summary.dishCount} />
        <StatTile label="Photos manquantes" value={preparation.summary.missingPhotoCount} />
        <StatTile label="Prix manquants" value={preparation.summary.missingPriceCount} />
      </StatGroup>

      <div className={styles.restaurantOverviewGrid}>
        <Panel
          title="QR du restaurant"
          action={<Badge tone={qrTone(restaurant.qrStatus)}>{restaurant.qrStatusLabel}</Badge>}
        >
          <MenuQrCode menuUrl={restaurant.qrTargetUrl} restaurantName={restaurant.name} />
          {restaurant.qrCodeUrl ? (
            <p className={styles.sourceNote}>
              QR persistant détecté: {restaurant.qrCodeUrl}
            </p>
          ) : (
            <p className={styles.sourceNote}>
              Pour un QR persistant en base, ouvrez le customizer QR du restaurant.
            </p>
          )}
        </Panel>

        <Panel title="Checklist avant publication">
          <div className={styles.checklist}>
            {preparation.checklist
              .filter((item) => ["profile", "dishes", "prices", "photos", "qr", "preview"].includes(item.id))
              .map((item) => (
                <div key={item.id} className={styles.checkItem}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <Badge tone={item.tone}>{item.status}</Badge>
                </div>
              ))}
          </div>
        </Panel>
      </div>

      <Panel title="URL publique">
        <div className={styles.urlPreview}>
          <p className={styles.metricLabel}>Destination client</p>
          <p className={`${styles.bodyText} ${styles.breakText}`}>{restaurant.menuUrl}</p>
          <div className={styles.restaurantActionGrid}>
            <Link className={styles.btn} href={ownerRestaurantRoute(restaurant, "preview")} prefetch={false}>
              Vérifier l’aperçu
            </Link>
            <Link className={styles.btn} href={ownerRestaurantRoute(restaurant, "menu")} prefetch={false}>
              Corriger la carte
            </Link>
            <Link className={styles.btn} href={ownerRestaurantRoute(restaurant, "medias")} prefetch={false}>
              Corriger les médias
            </Link>
          </div>
        </div>
      </Panel>
    </>
  );
}
