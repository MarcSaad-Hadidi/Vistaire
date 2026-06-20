"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MenuQrCode } from "@/components/owner/MenuQrCode";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, type BadgeTone } from "@/components/owner/OwnerUi";
import type { OwnerReadinessItem, OwnerRestaurant } from "@/lib/owner/types";

type OwnerRestaurantDashboardProps = {
  restaurant: OwnerRestaurant;
};

type TabId =
  | "overview"
  | "menu"
  | "dishes"
  | "media"
  | "qr"
  | "immersive"
  | "settings";

type RestaurantStatusAction = "archive" | "restore";

type RestaurantStatusFeedback = {
  tone: "success" | "error";
  message: string;
};

type DeleteRestaurantResponse = {
  ok?: boolean;
  error?: string;
  restaurantDeleted?: boolean;
  details?: {
    table?: string;
    supabaseMessage?: string;
  };
  storage?: {
    warnings?: string[];
  };
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "menu", label: "Menu" },
  { id: "dishes", label: "Plats" },
  { id: "media", label: "Médias" },
  { id: "qr", label: "QR" },
  { id: "immersive", label: "3D / AR" },
  { id: "settings", label: "Paramètres" }
];

function readinessTone(item: OwnerReadinessItem): BadgeTone {
  if (item.status === "ready" || item.status === "demo") return "ready";
  if (item.status === "needs_setup") return "warn";
  return "danger";
}

function qrTone(status: OwnerRestaurant["qrStatus"]): BadgeTone {
  if (status === "ready") return "ready";
  if (status === "generable") return "warn";
  return "danger";
}

function statusTone(restaurant: OwnerRestaurant): BadgeTone {
  if (restaurant.status === "active" || restaurant.status === "demo") return "ready";
  if (restaurant.status === "setup_needed") return "warn";
  return "muted";
}

function nextActionTab(restaurant: OwnerRestaurant): TabId {
  if (restaurant.qrStatus !== "ready") return "qr";
  if (restaurant.dishCount === 0) return "dishes";
  if (restaurant.incompleteDishCount > 0) return "media";
  if (restaurant.immersiveDishCount === 0) return "immersive";
  return "overview";
}

function readinessSummary(restaurant: OwnerRestaurant): string {
  if (restaurant.readinessScore >= 80) {
    return "La carte est proche d’une mise en ligne propre. Vérifiez le QR et ouvrez le menu public avant présentation.";
  }
  if (restaurant.dishCount === 0) {
    return "Commencez par les plats: sans carte détectée, le restaurant ne peut pas être présenté correctement.";
  }
  if (restaurant.qrStatus !== "ready") {
    return "Le contenu existe, mais le QR de table doit être préparé avant les tests en salle.";
  }
  return "Le restaurant est en préparation. Terminez les éléments incomplets avant de le considérer prêt.";
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-CA").format(value);
}

function checklistForRestaurant(restaurant: OwnerRestaurant) {
  const profile = restaurant.readinessItems.find((item) => item.id === "profile");
  const menu = restaurant.readinessItems.find((item) => item.id === "menu");
  const photos = restaurant.readinessItems.find((item) => item.id === "photos");
  const qr = restaurant.readinessItems.find((item) => item.id === "qr");
  const immersive = restaurant.readinessItems.find((item) => item.id === "immersive");

  return [
    {
      id: "profile",
      label: "Profil restaurant",
      detail: profile?.detail ?? "Nom, lieu et cuisine à préciser.",
      tone: profile ? readinessTone(profile) : ("warn" as BadgeTone),
      status: profile?.status === "ready" || profile?.status === "demo" ? "OK" : "À préparer"
    },
    {
      id: "menu",
      label: "Menu",
      detail: menu?.detail ?? "Structure de carte à confirmer.",
      tone: menu ? readinessTone(menu) : ("warn" as BadgeTone),
      status: restaurant.dishCount > 0 ? "OK" : "À créer"
    },
    {
      id: "dishes",
      label: "Plats",
      detail:
        restaurant.dishCount > 0
          ? `${restaurant.dishCount} plat(s) détecté(s).`
          : "Aucun plat détecté.",
      tone: restaurant.dishCount > 0 ? ("ready" as BadgeTone) : ("danger" as BadgeTone),
      status: restaurant.dishCount > 0 ? "OK" : "À ajouter"
    },
    {
      id: "photos",
      label: "Photos",
      detail: photos?.detail ?? `${restaurant.photoDishCount}/${restaurant.dishCount || 0} photos prêtes.`,
      tone: photos ? readinessTone(photos) : ("warn" as BadgeTone),
      status: restaurant.incompleteDishCount === 0 && restaurant.dishCount > 0 ? "OK" : "À compléter"
    },
    {
      id: "qr",
      label: "QR",
      detail: qr?.detail ?? restaurant.qrStatusLabel,
      tone: qr ? readinessTone(qr) : qrTone(restaurant.qrStatus),
      status: restaurant.qrStatus === "ready" ? "OK" : "À générer"
    },
    {
      id: "immersive",
      label: "3D / AR",
      detail: immersive?.detail ?? `${restaurant.immersiveDishCount} plat(s) immersif(s).`,
      tone: immersive ? readinessTone(immersive) : ("warn" as BadgeTone),
      status: restaurant.immersiveDishCount > 0 ? "OK" : "Optionnel"
    }
  ];
}

function TabPanel({
  id,
  activeTab,
  children
}: {
  id: TabId;
  activeTab: TabId;
  children: React.ReactNode;
}) {
  if (activeTab !== id) return null;

  return (
    <section
      id={`restaurant-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`restaurant-tab-${id}`}
      className={styles.restaurantTabPanel}
    >
      {children}
    </section>
  );
}

export function OwnerRestaurantDashboard({
  restaurant
}: OwnerRestaurantDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [copyStatus, setCopyStatus] = useState("");
  const [statusPending, setStatusPending] = useState<RestaurantStatusAction | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<RestaurantStatusFeedback | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteStorage, setDeleteStorage] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const primaryActionTab = useMemo(() => nextActionTab(restaurant), [restaurant]);
  const checklist = useMemo(() => checklistForRestaurant(restaurant), [restaurant]);

  async function copyMenuUrl() {
    try {
      await navigator.clipboard.writeText(restaurant.menuUrl);
      setCopyStatus("Lien de la carte copié.");
    } catch {
      setCopyStatus("Copie indisponible dans ce navigateur.");
    }
  }

  async function updateRestaurantStatus(action: RestaurantStatusAction) {
    setStatusPending(action);
    setStatusFeedback(null);

    try {
      const response = await fetch(`/api/owner/restaurants/${encodeURIComponent(restaurant.id)}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? "Le statut du restaurant n'a pas pu etre mis a jour.");
      }

      setStatusFeedback({
        tone: "success",
        message:
          action === "archive"
            ? "Restaurant archive. Ses plats, QR et medias restent conserves."
            : "Restaurant restaure. Il revient dans le portefeuille actif."
      });
      router.refresh();
    } catch (error) {
      setStatusFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Action restaurant indisponible."
      });
    } finally {
      setStatusPending(null);
    }
  }

  async function deleteRestaurant() {
    const confirmation = deleteConfirmation.trim();
    const confirmationTarget = restaurant.slug || restaurant.name.trim();
    if (confirmation !== confirmationTarget) {
      setStatusFeedback({
        tone: "error",
        message: "Tapez le slug exact du restaurant pour confirmer la suppression."
      });
      return;
    }

    setDeletePending(true);
    setStatusFeedback(null);

    try {
      const response = await fetch(`/api/owner/restaurants/${encodeURIComponent(restaurant.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, deleteStorage })
      });
      const result = (await response.json().catch(() => null)) as
        | DeleteRestaurantResponse
        | null;

      if (!response.ok || !result?.ok || result.restaurantDeleted !== true) {
        const table = result?.details?.table;
        const storageWarning = result?.storage?.warnings?.[0];
        const detail = table
          ? ` Table bloquante: ${table}.`
          : storageWarning
            ? ` Note Storage: ${storageWarning}`
            : "";
        throw new Error(
          `${result?.error ?? "Le restaurant n'a pas pu etre supprime."}${detail}`
        );
      }

      setStatusFeedback({
        tone: "success",
        message: "Restaurant supprime definitivement."
      });
      router.push("/owner/restaurants?deleted=1");
      router.refresh();
    } catch (error) {
      setStatusFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Suppression restaurant indisponible."
      });
      setDeletePending(false);
    }
  }

  const menuReady = restaurant.dishCount > 0;
  const photosReady = menuReady && restaurant.incompleteDishCount === 0;
  const hasImmersive = restaurant.immersiveDishCount > 0;

  return (
    <div className={styles.restaurantDashboard}>
      <article className={styles.restaurantCommandHeader}>
        <div>
          <Link className={styles.backLink} href="/owner" prefetch={false}>
            Retour portefeuille
          </Link>
          <h2>{restaurant.name}</h2>
          <p>
            {restaurant.location} · {restaurant.cuisineType}
          </p>
          <div className={styles.pillRow}>
            <Badge tone={statusTone(restaurant)}>{restaurant.statusLabel}</Badge>
            <Badge tone={restaurant.readinessScore >= 80 ? "ready" : "warn"}>
              Préparation {restaurant.readinessScore}%
            </Badge>
            <Badge tone={qrTone(restaurant.qrStatus)}>{restaurant.qrStatusLabel}</Badge>
          </div>
        </div>
        <div className={styles.restaurantHeaderActions}>
          <a
            className={`${styles.btnPrimary} ${styles.btn}`}
            href={restaurant.menuUrl}
            target="_blank"
            rel="noreferrer"
          >
            Voir menu public
          </a>
          {restaurant.qrStatus !== "ready" ? (
            <Link className={styles.btn} href="/owner/qr-codes" prefetch={false}>
              Générer QR
            </Link>
          ) : null}
          <button type="button" className={styles.btn} onClick={copyMenuUrl}>
            Copier le lien
          </button>
        </div>
      </article>

      {copyStatus ? (
        <p className={styles.qrStatus} role="status">
          {copyStatus}
        </p>
      ) : null}

      <nav className={styles.restaurantTabs} aria-label="Navigation restaurant" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`restaurant-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`restaurant-panel-${tab.id}`}
            className={activeTab === tab.id ? styles.restaurantTabActive : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <TabPanel id="overview" activeTab={activeTab}>
        <div className={styles.restaurantOverviewGrid}>
          <article className={styles.nextActionPanel}>
            <span className={styles.metricLabel}>Prochaine action</span>
            <strong>{restaurant.nextAction}</strong>
            <div className={styles.ownerProgress} aria-hidden="true">
              <span style={{ width: `${restaurant.readinessScore}%` }} />
            </div>
            <p>{readinessSummary(restaurant)}</p>
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.btn}`}
              onClick={() => setActiveTab(primaryActionTab)}
            >
              Ouvrir l’action
            </button>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Checklist de mise en ligne</h3>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.checklist}>
                {checklist.map((item) => (
                  <div key={item.id} className={styles.checkItem}>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                    <Badge tone={item.tone}>{item.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>

        <section className={styles.commandKpiGrid} aria-label="Résumé restaurant">
          <article>
            <span>Plats</span>
            <strong>{formatCount(restaurant.dishCount)}</strong>
            <small>{menuReady ? "Carte détectée" : "À ajouter"}</small>
          </article>
          <article>
            <span>Photos</span>
            <strong>
              {restaurant.photoDishCount}/{restaurant.dishCount || 0}
            </strong>
            <small>{photosReady ? "Couverture prête" : "À compléter"}</small>
          </article>
          <article>
            <span>QR</span>
            <strong>{restaurant.qrStatus === "ready" ? "Prêt" : "À générer"}</strong>
            <small>{restaurant.qrStatusLabel}</small>
          </article>
          <article>
            <span>3D / AR</span>
            <strong>{formatCount(restaurant.immersiveDishCount)}</strong>
            <small>{hasImmersive ? "Plat immersif prêt" : "Plat signature à choisir"}</small>
          </article>
        </section>

        <section className={styles.restaurantActionGrid} aria-label="Actions rapides">
          <button type="button" className={styles.btn} onClick={() => setActiveTab("menu")}>
            Gérer le menu
          </button>
          <button type="button" className={styles.btn} onClick={() => setActiveTab("dishes")}>
            Ajouter des plats
          </button>
          <button type="button" className={styles.btn} onClick={() => setActiveTab("media")}>
            Ajouter médias
          </button>
          <button type="button" className={styles.btn} onClick={() => setActiveTab("qr")}>
            Générer QR
          </button>
          <button type="button" className={styles.btn} onClick={() => setActiveTab("immersive")}>
            Configurer 3D/AR
          </button>
        </section>
      </TabPanel>

      <TabPanel id="menu" activeTab={activeTab}>
        <MenuPanel restaurant={restaurant} />
      </TabPanel>
      <TabPanel id="dishes" activeTab={activeTab}>
        <DishesPanel restaurant={restaurant} />
      </TabPanel>
      <TabPanel id="media" activeTab={activeTab}>
        <MediaPanel restaurant={restaurant} />
      </TabPanel>
      <TabPanel id="qr" activeTab={activeTab}>
        <QrPanel restaurant={restaurant} />
      </TabPanel>
      <TabPanel id="immersive" activeTab={activeTab}>
        <ImmersivePanel restaurant={restaurant} />
      </TabPanel>
      <TabPanel id="settings" activeTab={activeTab}>
        <SettingsPanel
          restaurant={restaurant}
          statusPending={statusPending}
          statusFeedback={statusFeedback}
          deleteConfirmation={deleteConfirmation}
          deleteStorage={deleteStorage}
          deletePending={deletePending}
          onStatusAction={updateRestaurantStatus}
          onDeleteConfirmationChange={setDeleteConfirmation}
          onDeleteStorageChange={setDeleteStorage}
          onDeleteRestaurant={deleteRestaurant}
        />
      </TabPanel>
    </div>
  );
}

function MenuPanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Menu</h3>
          <p className={styles.cellSub}>
            Structure de carte lue depuis les données restaurant et plats disponibles.
          </p>
        </div>
        <Link className={styles.btn} href="/owner/menus" prefetch={false}>
          Voir tous les menus
        </Link>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.commandKpiGrid}>
          <article>
            <span>Structure</span>
            <strong>{restaurant.dishCount > 0 ? "Détectée" : "Vide"}</strong>
            <small>{restaurant.dishCount} plat(s)</small>
          </article>
          <article>
            <span>Menu public</span>
            <strong>{restaurant.menuUrlSource === "column" ? "Configuré" : "Preview"}</strong>
            <small className={styles.breakText}>
              {restaurant.menuUrlSource === "column"
                ? restaurant.clientMenuHref
                : restaurant.publicMenuPath}
            </small>
          </article>
        </div>
      </div>
    </article>
  );
}

function DishesPanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Plats du menu</h3>
          <p className={styles.cellSub}>
            Contrôle qualité des plats rattachés à ce restaurant.
          </p>
        </div>
        <Link className={styles.btn} href="/owner/plats" prefetch={false}>
          Voir tous les plats
        </Link>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.checklist}>
          <div className={styles.checkItem}>
            <span>
              <strong>Premiers plats</strong>
              <small>{restaurant.dishCount} plat(s) détecté(s).</small>
            </span>
            <Badge tone={restaurant.dishCount > 0 ? "ready" : "danger"}>
              {restaurant.dishCount > 0 ? "OK" : "À ajouter"}
            </Badge>
          </div>
          <div className={styles.checkItem}>
            <span>
              <strong>Photos associées</strong>
              <small>
                {restaurant.photoDishCount}/{restaurant.dishCount || 0} plats avec photo.
              </small>
            </span>
            <Badge tone={restaurant.incompleteDishCount === 0 && restaurant.dishCount > 0 ? "ready" : "warn"}>
              {restaurant.incompleteDishCount} manquante(s)
            </Badge>
          </div>
        </div>
      </div>
    </article>
  );
}

function MediaPanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Médias</h3>
          <p className={styles.cellSub}>
            Suivi des photos prêtes et des manques visibles dans la carte.
          </p>
        </div>
        <Link className={styles.btn} href="/owner/medias" prefetch={false}>
          Voir tous les médias
        </Link>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.commandKpiGrid}>
          <article>
            <span>Photos prêtes</span>
            <strong>
              {restaurant.photoDishCount}/{restaurant.dishCount || 0}
            </strong>
            <small>Couverture de la carte</small>
          </article>
          <article>
            <span>À compléter</span>
            <strong>{restaurant.incompleteDishCount}</strong>
            <small>Plats sans photo détectée</small>
          </article>
        </div>
      </div>
    </article>
  );
}

function QrPanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>QR de table</h3>
          <p className={styles.cellSub}>
            Statut réel du QR et aperçu de test depuis le menu public.
          </p>
        </div>
        <Link className={`${styles.btnPrimary} ${styles.btn}`} href="/owner/qr-codes" prefetch={false}>
          Générer QR persistant
        </Link>
      </div>
      <div className={styles.panelBody}>
        <MenuQrCode
          menuUrl={restaurant.qrTargetUrl}
          restaurantName={restaurant.name}
        />
        <p className={styles.sourceNote}>
          Statut actuel : {restaurant.qrStatusLabel}. Un QR persistant se crée dans le module QR Codes.
        </p>
      </div>
    </article>
  );
}

function ImmersivePanel({ restaurant }: { restaurant: OwnerRestaurant }) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>3D / AR</h3>
          <p className={styles.cellSub}>
            Choisir les plats signatures et suivre le pipeline sans charger d’asset lourd ici.
          </p>
        </div>
        <Link className={styles.btn} href="/owner/3d-ar" prefetch={false}>
          Ouvrir le pipeline
        </Link>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.commandKpiGrid}>
          <article>
            <span>Assets détectés</span>
            <strong>{restaurant.immersiveDishCount}</strong>
            <small>{restaurant.dishCount} plat(s) dans le menu</small>
          </article>
          <article>
            <span>État</span>
            <strong>{restaurant.immersiveDishCount > 0 ? "En place" : "À choisir"}</strong>
            <small>3D sélective, pas décorative</small>
          </article>
        </div>
      </div>
    </article>
  );
}

function SettingsPanel({
  restaurant,
  statusPending,
  statusFeedback,
  deleteConfirmation,
  deleteStorage,
  deletePending,
  onStatusAction,
  onDeleteConfirmationChange,
  onDeleteStorageChange,
  onDeleteRestaurant
}: {
  restaurant: OwnerRestaurant;
  statusPending: RestaurantStatusAction | null;
  statusFeedback: RestaurantStatusFeedback | null;
  deleteConfirmation: string;
  deleteStorage: boolean;
  deletePending: boolean;
  onStatusAction: (action: RestaurantStatusAction) => void;
  onDeleteConfirmationChange: (value: string) => void;
  onDeleteStorageChange: (value: boolean) => void;
  onDeleteRestaurant: () => void;
}) {
  const isArchived = restaurant.status === "archived";
  const nextAction: RestaurantStatusAction = isArchived ? "restore" : "archive";
  const actionLabel = isArchived ? "Restaurer le restaurant" : "Archiver le restaurant";
  const deleteConfirmationTarget = restaurant.slug || restaurant.name.trim();
  const deleteConfirmed = deleteConfirmation.trim() === deleteConfirmationTarget;
  const isDisabled = restaurant.isDemo || statusPending !== null || deletePending;
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Paramètres du restaurant</h3>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.restaurantSettingsStack}>
          <dl className={styles.definitionList}>
          <div>
            <dt>ID</dt>
            <dd>{restaurant.id}</dd>
          </div>
          <div>
            <dt>Slug</dt>
            <dd>{restaurant.slug}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{restaurant.contactName || "À préciser"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{restaurant.contactEmail || "À préciser"}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{restaurant.notes || "Aucune note interne."}</dd>
          </div>
          </dl>

          <section
            className={styles.restaurantLifecycleControl}
            aria-labelledby="restaurant-lifecycle-title"
          >
            <div className={styles.restaurantLifecycleHeader}>
              <div>
                <h4 id="restaurant-lifecycle-title">Zone restaurant</h4>
                <p>
                  Archivez un restaurant pour le retirer du workflow actif sans supprimer ses plats,
                  ses QR, ses medias ou ses URLs publiques.
                </p>
              </div>
              <Badge tone={isArchived ? "muted" : "ready"}>
                {isArchived ? "Archive" : "Actif"}
              </Badge>
            </div>

            <div className={styles.restaurantLifecycleActions}>
              <button
                type="button"
                className={`${styles.btn} ${isArchived ? "" : styles.btnDanger}`}
                disabled={isDisabled}
                onClick={() => onStatusAction(nextAction)}
              >
                {statusPending === nextAction ? "Mise a jour..." : actionLabel}
              </button>
              {restaurant.isDemo ? (
                <span className={styles.sourceNote}>
                  Restaurant de demonstration protege contre l&apos;archivage.
                </span>
              ) : null}
            </div>

            {statusFeedback ? (
              <p
                className={statusFeedback.tone === "error" ? styles.errorText : styles.qrStatus}
                role="status"
              >
                {statusFeedback.message}
              </p>
            ) : null}

            <p className={styles.sourceNote}>
              L&apos;archivage est reversible et conserve les donnees rattachees.
            </p>

            <div className={styles.restaurantDeleteBlock}>
              <div>
                <h5>Suppression definitive</h5>
                <p>
                  Supprime le profil restaurant dans Supabase seulement apres nettoyage confirme
                  des donnees critiques. En cas d&apos;erreur, la table bloquante reste affichee et
                  le restaurant n&apos;est pas marque supprime.
                </p>
                <ul className={styles.restaurantDeleteList}>
                  <li>Restaurant, liens publics et statut dashboard</li>
                  <li>Plats menu_dishes, QR et configurations menu</li>
                  <li>Donnees owner, analytics et metadonnees 3D si les tables existent</li>
                  <li>Fichiers Storage/CDN seulement si la tentative ci-dessous est cochee</li>
                </ul>
              </div>

              <label className={styles.formField}>
                <span className={styles.filterLabel}>
                  Tapez {deleteConfirmationTarget} pour confirmer
                </span>
                <input
                  className={styles.control}
                  value={deleteConfirmation}
                  onChange={(event) => onDeleteConfirmationChange(event.target.value)}
                  placeholder={deleteConfirmationTarget}
                  disabled={restaurant.isDemo || deletePending}
                />
              </label>

              <label className={styles.restaurantStorageToggle}>
                <input
                  type="checkbox"
                  checked={deleteStorage}
                  onChange={(event) => onDeleteStorageChange(event.target.checked)}
                  disabled={restaurant.isDemo || deletePending}
                />
                <span>
                  Tenter aussi de supprimer les fichiers Storage/CDN sous les chemins du
                  restaurant. Si Storage echoue, la suppression DB reste conservee et un warning
                  est retourne.
                </span>
              </label>

              <div className={styles.restaurantLifecycleActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  disabled={isDisabled || !deleteConfirmed}
                  onClick={onDeleteRestaurant}
                >
                  {deletePending ? "Suppression..." : "Supprimer definitivement"}
                </button>
                {restaurant.isDemo ? (
                  <span className={styles.sourceNote}>
                    Restaurant de demonstration protege contre la suppression.
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
