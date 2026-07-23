import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuQrCode } from "@/components/owner/MenuQrCode";
import { OwnerRestaurantQrTargetSwitcher } from "@/components/owner/OwnerRestaurantQrTargetSwitcher";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerCopyLinkButton } from "@/components/owner/OwnerCopyLinkButton";
import {
  Badge,
  ModuleHeader,
  Panel,
  StatGroup,
  StatTile,
  type BadgeTone
} from "@/components/owner/OwnerUi";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";
import { getOwnerCanonicalQrCode } from "@/lib/owner/qrStore";
import type {
  OwnerQrCanonicalRead,
  OwnerQrCodeRecord,
  OwnerQrTargetKind
} from "@/lib/owner/types";
import {
  buildOwnerRestaurantPreparation,
  ownerRestaurantRoute
} from "@/lib/owner/restaurantPreparation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ target?: string | string[] }>;

function normalizeTarget(value: string | string[] | undefined): OwnerQrTargetKind {
  return (Array.isArray(value) ? value[0] : value) === "admin" ? "admin" : "menu";
}

function isCanonicalRead(
  value: Awaited<ReturnType<typeof getOwnerCanonicalQrCode>>
): value is OwnerQrCanonicalRead {
  return "found" in value;
}

function qrStatusLabel(record: OwnerQrCodeRecord | null, targetKind: OwnerQrTargetKind): string {
  if (!record) return targetKind === "admin" ? "QR admin absent" : "QR public generable";
  if (!record.recoverable || !record.redirectUrl) return "URL non récupérable";
  if (record.status === "active") return "QR actif";
  if (record.status === "paused") return "QR en pause";
  if (record.status === "revoked") return "QR révoqué";
  return "QR archivé";
}

function qrStatusTone(record: OwnerQrCodeRecord | null, targetKind: OwnerQrTargetKind): BadgeTone {
  if (!record) return targetKind === "admin" ? "danger" : "warn";
  if (!record.recoverable || !record.redirectUrl) return "danger";
  if (record.status === "active") return "ready";
  if (record.status === "paused") return "warn";
  return "muted";
}

function isUsableCanonicalRecord(
  record: OwnerQrCodeRecord | null
): record is OwnerQrCodeRecord & { redirectUrl: string } {
  return Boolean(
    record &&
      record.status === "active" &&
      record.recoverable &&
      record.redirectUrl
  );
}

export default async function OwnerRestaurantQrPage({
  params,
  searchParams
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: SearchParams;
}) {
  const { restaurantId } = await params;
  const query = await searchParams;
  const targetKind = normalizeTarget(query.target);
  const dashboard = await getOwnerRestaurantDashboardData(restaurantId);
  if (!dashboard.restaurant) notFound();

  const restaurant = dashboard.restaurant;
  const menuData = await getOwnerMenuData(restaurant.id);
  const preparation = buildOwnerRestaurantPreparation(
    restaurant,
    menuData.ok ? menuData.dishes : []
  );
  const canonicalQr = await getOwnerCanonicalQrCode({
    restaurantId: restaurant.id,
    targetKind,
    purposeKey: "default"
  });
  const canonicalRead = isCanonicalRead(canonicalQr) ? canonicalQr : null;
  const canonicalRecord = canonicalRead?.record ?? null;
  const canonicalError = !canonicalRead && "error" in canonicalQr ? canonicalQr.error : null;
  const usableCanonical = isUsableCanonicalRecord(canonicalRecord);
  const publicDestination = restaurant.publicMenuUrl;
  const publicQrDestination = usableCanonical && targetKind === "menu"
    ? canonicalRecord.redirectUrl
    : "";
  const adminDestination = usableCanonical && targetKind === "admin"
    ? canonicalRecord.redirectUrl
    : "";
  const targetLabel = targetKind === "admin" ? "QR admin privé" : "QR client public";
  const persistentQrHref = `/owner/qr-codes?restaurantId=${encodeURIComponent(
    restaurant.id
  )}&target=${targetKind}`;
  const selectedDestination = targetKind === "admin" ? adminDestination : publicDestination;
  const selectedQrDestination = targetKind === "admin" ? adminDestination : publicQrDestination;
  const selectedStatus = qrStatusLabel(canonicalRecord, targetKind);
  const selectedTone = qrStatusTone(canonicalRecord, targetKind);
  const selectedChecklist = preparation.checklist.map((item) =>
    item.id === "qr"
      ? {
          ...item,
          detail: selectedStatus,
          status: usableCanonical ? "OK" : "À préparer",
          tone: selectedTone
        }
      : item
  );

  return (
    <>
      <ModuleHeader
        title={`QR & publication — ${restaurant.name}`}
        description="Choisissez une cible, vérifiez l’URL canonique et préparez le rendu à imprimer. La cible sélectionnée est lue sans rotation ni mutation."
        actions={
          <>
            {targetKind === "menu" ? (
              <>
                <a
                  className={`${styles.btnPrimary} ${styles.btn}`}
                  href={restaurant.menuUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ouvrir comme client
                </a>
                <OwnerCopyLinkButton value={restaurant.menuUrl} />
              </>
            ) : usableCanonical ? (
              <>
                <a
                  className={`${styles.btnPrimary} ${styles.btn}`}
                  href={adminDestination}
                  target="_blank"
                  rel="noreferrer"
                >
                  Tester l’accès admin
                </a>
                <OwnerCopyLinkButton value={adminDestination} />
              </>
            ) : null}
            <Link className={styles.btn} href={persistentQrHref} prefetch={false}>
              Personnaliser QR
            </Link>
          </>
        }
      />

      <OwnerRestaurantQrTargetSwitcher
        restaurantId={restaurant.id}
        targetKind={targetKind}
      />

      <StatGroup title="Publication">
        <StatTile label="Cible sélectionnée" value={targetLabel} primary />
        <StatTile label="Statut QR" value={selectedStatus} />
        <StatTile label="Plats" value={preparation.summary.dishCount} />
        <StatTile label="Photos manquantes" value={preparation.summary.missingPhotoCount} />
        <StatTile label="Prix manquants" value={preparation.summary.missingPriceCount} />
      </StatGroup>

      <div className={styles.restaurantOverviewGrid}>
        <Panel
          title={targetLabel}
          action={<Badge tone={selectedTone}>{selectedStatus}</Badge>}
        >
          {targetKind === "admin" && !canonicalRecord ? (
            <div className={styles.emptyState}>
              <strong>Aucun QR admin canonique actif.</strong>
              <p className={styles.sourceNote}>
                Le QR admin n’est jamais généré par le simple changement de cible. Créez-le
                explicitement dans le customizer si vous avez besoin d’un support privé.
              </p>
            </div>
          ) : targetKind === "admin" && !usableCanonical ? (
            <div className={styles.emptyState}>
              <strong>QR admin non utilisable.</strong>
              <p className={styles.sourceNote}>
                Son état est {qrStatusLabel(canonicalRecord, targetKind).toLowerCase()}.
                Aucun lien ni token n’est affiché tant qu’il n’est pas récupérable et actif.
              </p>
            </div>
          ) : !usableCanonical ? (
            <div className={styles.emptyState}>
              <strong>
                {targetKind === "admin"
                  ? "QR admin non utilisable."
                  : "QR public canonique non utilisable."}
              </strong>
              <p className={styles.sourceNote}>
                Aucun QR n’est affiché tant qu’il n’est pas actif et récupérable. La
                cible ne crée ni ne fait tourner de QR automatiquement.
              </p>
            </div>
          ) : (
            <MenuQrCode
              menuUrl={selectedQrDestination}
              restaurantName={restaurant.name}
              qrLabel={targetKind === "admin" ? "QR admin privé" : "QR public client"}
              copyLabel="Copier l’URL canonique"
              downloadLabel="Télécharger le QR sélectionné"
              fileNamePrefix={targetKind === "admin" ? "vistaire-admin-qr" : "vistaire-menu-qr"}
            />
          )}
          {canonicalError ? (
            <p className={styles.errorText} role="alert">
              Le statut canonique n’a pas pu être vérifié. Aucun QR non récupérable n’est présenté.
            </p>
          ) : null}
          {targetKind === "menu" && !canonicalRecord ? (
            <p className={styles.sourceNote}>
              Aucun QR canonique public n’est encore enregistré. L’URL publique reste disponible
              pour la prévisualisation; utilisez le customizer pour créer le QR persistant.
            </p>
          ) : null}
        </Panel>

        <Panel title="Checklist avant publication">
          <div className={styles.checklist}>
            {selectedChecklist
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

      <Panel title={targetKind === "admin" ? "Destination admin canonique" : "URL publique"}>
        <div className={styles.urlPreview}>
          <p className={styles.metricLabel}>Destination sélectionnée</p>
          <p className={`${styles.bodyText} ${styles.breakText}`}>
            {selectedDestination || "URL non récupérable"}
          </p>
          <div className={styles.restaurantActionGrid}>
            {targetKind === "menu" ? (
              <>
                <Link className={styles.btn} href={ownerRestaurantRoute(restaurant, "preview")} prefetch={false}>
                  Vérifier l’aperçu
                </Link>
                <Link className={styles.btn} href={ownerRestaurantRoute(restaurant, "menu")} prefetch={false}>
                  Corriger la carte
                </Link>
                <Link className={styles.btn} href={ownerRestaurantRoute(restaurant, "medias")} prefetch={false}>
                  Corriger les médias
                </Link>
              </>
            ) : (
              <Link className={styles.btn} href={persistentQrHref} prefetch={false}>
                Gérer le cycle de vie du QR
              </Link>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
