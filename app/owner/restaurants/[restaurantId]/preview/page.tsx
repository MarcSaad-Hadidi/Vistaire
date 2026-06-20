import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerCopyLinkButton } from "@/components/owner/OwnerCopyLinkButton";
import {
  Badge,
  EmptyState,
  ModuleHeader,
  Panel,
  StatGroup,
  StatTile
} from "@/components/owner/OwnerUi";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";
import {
  buildOwnerRestaurantPreparation,
  ownerRestaurantRoute
} from "@/lib/owner/restaurantPreparation";

export const dynamic = "force-dynamic";

export default async function OwnerRestaurantPreviewPage({
  params
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const dashboard = await getOwnerRestaurantDashboardData(restaurantId);
  if (!dashboard.restaurant) notFound();

  const restaurant = dashboard.restaurant;
  const menuData = await getOwnerMenuData(restaurant.id);
  const dishes = menuData.ok ? menuData.dishes : [];
  const preparation = buildOwnerRestaurantPreparation(restaurant, dishes);
  const previewPath =
    restaurant.menuUrlSource === "column"
      ? restaurant.menuUrl
      : restaurant.publicMenuPath || restaurant.clientMenuHref || restaurant.menuUrl;
  const photosVisible = preparation.summary.photoDishCount;
  const pricesReady =
    preparation.summary.dishCount > 0 &&
    preparation.summary.missingPriceCount === 0;

  return (
    <>
      <ModuleHeader
        title={`Aperçu du menu — ${restaurant.name}`}
        description="Contrôlez le menu réel que le client verra après scan QR, dans un cadre mobile."
        actions={
          <>
            <a className={`${styles.btnPrimary} ${styles.btn}`} href={restaurant.menuUrl} target="_blank" rel="noreferrer">
              Ouvrir en plein écran
            </a>
            <OwnerCopyLinkButton value={restaurant.menuUrl} />
            <Link className={styles.btn} href={ownerRestaurantRoute(restaurant, "qr")} prefetch={false}>
              Voir QR
            </Link>
          </>
        }
      />

      <StatGroup title="Contrôle rapide">
        <StatTile label="Photos visibles" value={photosVisible} primary />
        <StatTile label="Prix clairs" value={pricesReady ? "Oui" : "À vérifier"} />
        <StatTile label="QR" value={restaurant.qrStatus === "ready" ? "Prêt" : "À préparer"} />
        <StatTile label="Descriptions manquantes" value={preparation.summary.missingDescriptionCount} />
      </StatGroup>

      <div className={styles.restaurantOverviewGrid}>
        <Panel
          title="Rendu client mobile"
          action={<Badge tone={menuData.ok ? "ready" : "warn"}>{menuData.ok ? "Menu chargé" : "Indisponible"}</Badge>}
        >
          {!menuData.ok ? (
            <EmptyState>
              Aperçu indisponible tant que le menu public n’est pas configuré.
            </EmptyState>
          ) : (
            <div className={styles.menuPreviewPhone}>
              <iframe
                title={`Aperçu client ${restaurant.name}`}
                src={previewPath}
                className={styles.menuPreviewFrame}
                loading="lazy"
              />
            </div>
          )}
        </Panel>

        <Panel title="Checklist aperçu">
          <div className={styles.checklist}>
            <div className={styles.checkItem}>
              <span>
                <strong>Photos visibles</strong>
                <small>
                  {preparation.summary.photoDishCount}/{preparation.summary.dishCount || 0} plats avec photo.
                </small>
              </span>
              <Badge tone={preparation.summary.missingPhotoCount === 0 && preparation.summary.dishCount > 0 ? "ready" : "warn"}>
                {preparation.summary.missingPhotoCount === 0 && preparation.summary.dishCount > 0 ? "OK" : "À vérifier"}
              </Badge>
            </div>
            <div className={styles.checkItem}>
              <span>
                <strong>Prix clairs</strong>
                <small>{preparation.summary.missingPriceCount} prix manquant(s).</small>
              </span>
              <Badge tone={pricesReady ? "ready" : "warn"}>
                {pricesReady ? "OK" : "À vérifier"}
              </Badge>
            </div>
            <div className={styles.checkItem}>
              <span>
                <strong>QR prêt</strong>
                <small>{restaurant.qrStatusLabel}</small>
              </span>
              <Badge tone={restaurant.qrStatus === "ready" ? "ready" : "warn"}>
                {restaurant.qrStatus === "ready" ? "OK" : "À préparer"}
              </Badge>
            </div>
            <div className={styles.checkItem}>
              <span>
                <strong>Plats sans description</strong>
                <small>{preparation.summary.missingDescriptionCount} plat(s) à compléter.</small>
              </span>
              <Badge tone={preparation.summary.missingDescriptionCount === 0 ? "ready" : "warn"}>
                {preparation.summary.missingDescriptionCount === 0 ? "OK" : "À corriger"}
              </Badge>
            </div>
            <div className={styles.checkItem}>
              <span>
                <strong>Aperçu mobile vérifié</strong>
                <small>À valider manuellement avant impression du QR.</small>
              </span>
              <Badge tone="warn">À vérifier</Badge>
            </div>
          </div>
        </Panel>
      </div>

    </>
  );
}
