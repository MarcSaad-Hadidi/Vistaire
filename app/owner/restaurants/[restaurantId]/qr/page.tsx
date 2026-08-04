import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuQrCode } from "@/components/owner/MenuQrCode";
import { OwnerCopyLinkButton } from "@/components/owner/OwnerCopyLinkButton";
import styles from "./QrPublicationPage.module.css";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";
import { getOwnerCanonicalQrCode } from "@/lib/owner/qrStore";
import type {
  OwnerQrCanonicalRead,
  OwnerQrCodeRecord
} from "@/lib/owner/types";
import {
  buildOwnerRestaurantPreparation,
  ownerRestaurantRoute
} from "@/lib/owner/restaurantPreparation";

export const dynamic = "force-dynamic";

function isCanonicalRead(
  value: Awaited<ReturnType<typeof getOwnerCanonicalQrCode>>
): value is OwnerQrCanonicalRead {
  return "found" in value;
}

function isUsableQr(
  record: OwnerQrCodeRecord | null
): record is OwnerQrCodeRecord & { redirectUrl: string } {
  return Boolean(
    record?.status === "active" && record.recoverable && record.redirectUrl
  );
}

function statusLabel(record: OwnerQrCodeRecord | null): string {
  if (!record) return "À préparer";
  if (!record.recoverable || !record.redirectUrl) return "Indisponible";
  if (record.status === "active") return "QR actif";
  if (record.status === "paused") return "QR en pause";
  if (record.status === "revoked") return "QR révoqué";
  return "QR archivé";
}

function statusTone(record: OwnerQrCodeRecord | null): "ready" | "warn" | "danger" {
  if (!record || record.status === "paused") return "warn";
  if (!isUsableQr(record)) return "danger";
  return "ready";
}

function LineIcon({ kind }: { kind: "info" | "menu" | "tag" | "image" | "qr" | "eye" | "link" | "download" | "map" }) {
  const paths: Record<string, string> = {
    info: "M12 8.4v.1M12 11.5v5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    menu: "M5 4.5h14v15H5zM8 8h8M8 12h8M8 16h5",
    tag: "m20.5 13-7.4 7.4a2 2 0 0 1-2.8 0l-7.7-7.7V4h8.7l7.7 7.7a2 2 0 0 1 1.5 1.3Z",
    image: "M4 5h16v14H4zM7 15l3-3 2.3 2.2 1.8-1.8L18 16M8 9h.1",
    qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z",
    eye: "M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
    link: "M9.5 14.5 14.5 9.5M7 17H5.5a3.5 3.5 0 0 1 0-7H9M15 7h1.5a3.5 3.5 0 0 1 0 7H15",
    download: "M12 3v11M8 10l4 4 4-4M5 20h14",
    map: "M4 5.5 9 3l6 3 5-2.5v14L15 20l-6-3-5 2.5zM9 3v14M15 6v14"
  };
  return (
    <svg className={styles.lineIcon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[kind].split(" M").map((path, index) => (
        <path key={`${kind}-${index}`} d={`${index ? "M" : ""}${path}`} />
      ))}
    </svg>
  );
}

function StatusDot({ tone }: { tone: "ready" | "warn" | "danger" }) {
  return <span className={`${styles.statusDot} ${styles[`statusDot${tone}`]}`} aria-hidden="true" />;
}

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
  const canonicalQr = await getOwnerCanonicalQrCode({
    restaurantId: restaurant.id,
    targetKind: "menu",
    purposeKey: "default"
  });
  const canonicalRead = isCanonicalRead(canonicalQr) ? canonicalQr : null;
  const canonicalReadError = canonicalRead === null;
  const canonicalRecord = canonicalRead?.record ?? null;
  const usableQr = isUsableQr(canonicalRecord);
  const qrUrl = usableQr ? canonicalRecord.redirectUrl : "";
  const publicDestination = restaurant.publicMenuUrl || restaurant.menuUrl;
  const qrStatus = canonicalReadError
    ? "Vérification impossible"
    : statusLabel(canonicalRecord);
  const qrTone = canonicalReadError ? "danger" : statusTone(canonicalRecord);

  const checklist = preparation.checklist.filter((item) =>
    ["profile", "dishes", "prices", "photos", "qr", "preview"].includes(item.id)
  ).map((item) => {
    if (item.id !== "qr") return item;
    return {
      ...item,
      detail: canonicalReadError ? "Lecture du QR impossible" : qrStatus,
      status: usableQr && !canonicalReadError ? "OK" : "À vérifier",
      tone:
        canonicalReadError
          ? "danger" as const
          : usableQr
            ? "ready" as const
            : "warn" as const
    };
  });

  return (
    <div className={styles.publicationPage}>
      <header className={styles.publicationIntro}>
        <div>
          <h2>QR &amp; publication — {restaurant.name}</h2>
          <p>Aperçu global de votre publication : lien public, QR et readiness avant la mise en ligne.</p>
        </div>
        <div className={styles.introActions}>
          <a className={styles.primaryButton} href={restaurant.menuUrl} target="_blank" rel="noreferrer">
            Ouvrir comme client
          </a>
          {usableQr ? <OwnerCopyLinkButton value={qrUrl} label="Copier le lien" /> : null}
          <Link className={styles.secondaryButton} href={`/owner/qr-codes?restaurantId=${encodeURIComponent(restaurant.id)}&target=menu`} prefetch={false}>
            Gérer les QR
          </Link>
        </div>
      </header>

      <section className={styles.statGrid} aria-label="Résumé de publication">
        <article className={`${styles.statCard} ${styles.statCardWide}`}>
          <span>Cible sélectionnée</span>
          <strong>QR client public</strong>
        </article>
        <article className={styles.statCard}>
          <span>Statut QR</span>
          <strong className={styles.statStatus}><StatusDot tone={qrTone} />{qrStatus}</strong>
        </article>
        <article className={styles.statCard}><span>Plats</span><strong>{preparation.summary.dishCount}</strong></article>
        <article className={styles.statCard}><span>Photos manquantes</span><strong>{preparation.summary.missingPhotoCount}</strong></article>
        <article className={styles.statCard}><span>Prix manquants</span><strong>{preparation.summary.missingPriceCount}</strong></article>
      </section>

      <div className={styles.primaryGrid}>
        <section className={styles.surfacePanel} aria-labelledby="public-qr-title">
          <div className={styles.panelHeading}>
            <h3 id="public-qr-title">QR client public</h3>
            <span className={`${styles.smallStatus} ${styles[`tone${qrTone}`]}`}><StatusDot tone={qrTone} />{qrStatus}</span>
          </div>
          {canonicalReadError ? (
            <div className={styles.qrEmpty}>
              <LineIcon kind="info" />
              <strong>QR indisponible</strong>
              <p>
                Le statut du QR canonique n’a pas pu être vérifié. Aucun QR ne
                doit être créé ou imprimé pendant cette indisponibilité.
              </p>
              <Link className={styles.secondaryButton} href={`/owner/qr-codes?restaurantId=${encodeURIComponent(restaurant.id)}&target=menu`} prefetch={false}>
                Réessayer dans la gestion QR
              </Link>
            </div>
          ) : usableQr ? (
            <MenuQrCode
              className={styles.publicQr}
              menuUrl={qrUrl}
              displayUrl={publicDestination}
              restaurantName={restaurant.name}
              style={canonicalRecord.style}
              targetKind="menu"
              configVersion={canonicalRecord.configVersion}
              qrId={canonicalRecord.id}
              qrLabel="QR client public"
              copyLabel="Copier le lien du QR"
              downloadLabel="Télécharger le QR"
              fileNamePrefix="vistaire-menu-qr"
            />
          ) : (
            <div className={styles.qrEmpty}>
              <LineIcon kind="qr" />
              <strong>QR public à préparer</strong>
              <p>Créez le QR canonique depuis la gestion QR avant de l’imprimer ou de le partager.</p>
              <Link className={styles.primaryButton} href={`/owner/qr-codes?restaurantId=${encodeURIComponent(restaurant.id)}&target=menu`} prefetch={false}>Gérer les QR</Link>
            </div>
          )}
          <div className={styles.publicQrNote}><LineIcon kind="info" /><span>Tous les QR publics restent actifs. Créer un nouveau QR ne désactive pas les QR déjà imprimés.</span></div>
        </section>

        <section className={styles.surfacePanel} aria-labelledby="checklist-title">
          <div className={styles.panelHeading}><h3 id="checklist-title">Checklist avant publication</h3></div>
          <div className={styles.checklist}>
            {checklist.map((item) => (
              <div className={styles.checkItem} key={item.id}>
                <span className={styles.checkIcon}><LineIcon kind={item.id === "profile" || item.id === "dishes" ? "menu" : item.id === "prices" ? "tag" : item.id === "photos" ? "image" : item.id === "qr" ? "qr" : "eye"} /></span>
                <span className={styles.checkCopy}><strong>{item.label}</strong><small>{item.detail}</small></span>
                <span className={`${styles.checkBadge} ${styles[`tone${item.tone}`]}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.urlPanel} aria-labelledby="public-url-title">
        <div className={styles.panelHeading}><h3 id="public-url-title">URL publique</h3></div>
        <div className={styles.urlInner}>
          <span className={styles.kicker}>Destination sélectionnée</span>
          <p>{publicDestination}</p>
          <div className={styles.urlActions}>
            <Link className={styles.secondaryButton} href={ownerRestaurantRoute(restaurant, "preview")} prefetch={false}><LineIcon kind="eye" />Vérifier l’aperçu</Link>
            <Link className={styles.secondaryButton} href={ownerRestaurantRoute(restaurant, "menu")} prefetch={false}><LineIcon kind="map" />Corriger la carte</Link>
            <Link className={styles.secondaryButton} href={ownerRestaurantRoute(restaurant, "medias")} prefetch={false}><LineIcon kind="image" />Corriger les médias</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
