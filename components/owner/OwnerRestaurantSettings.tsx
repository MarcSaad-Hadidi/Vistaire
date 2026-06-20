"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge } from "@/components/owner/OwnerUi";
import type { OwnerRestaurant } from "@/lib/owner/types";

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

export function OwnerRestaurantSettings({
  restaurant
}: {
  restaurant: OwnerRestaurant;
}) {
  const router = useRouter();
  const [statusPending, setStatusPending] = useState<RestaurantStatusAction | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<RestaurantStatusFeedback | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteStorage, setDeleteStorage] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

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
        throw new Error(result?.error ?? "Le statut du restaurant n’a pas pu être mis à jour.");
      }

      setStatusFeedback({
        tone: "success",
        message:
          action === "archive"
            ? "Restaurant archivé. Ses plats, QR et médias restent conservés."
            : "Restaurant restauré. Il revient dans le portefeuille actif."
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
          `${result?.error ?? "Le restaurant n’a pas pu être supprimé."}${detail}`
        );
      }

      setStatusFeedback({
        tone: "success",
        message: "Restaurant supprimé définitivement."
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

  const isArchived = restaurant.status === "archived";
  const nextAction: RestaurantStatusAction = isArchived ? "restore" : "archive";
  const actionLabel = isArchived ? "Restaurer le restaurant" : "Archiver le restaurant";
  const deleteConfirmationTarget = restaurant.slug || restaurant.name.trim();
  const deleteConfirmed = deleteConfirmation.trim() === deleteConfirmationTarget;
  const isDisabled = restaurant.isDemo || statusPending !== null || deletePending;

  return (
    <div className={styles.restaurantSettingsStack}>
      <dl className={styles.definitionList}>
        <div>
          <dt>Nom</dt>
          <dd>{restaurant.name}</dd>
        </div>
        <div>
          <dt>Slug</dt>
          <dd>{restaurant.slug}</dd>
        </div>
        <div>
          <dt>Localisation</dt>
          <dd>{restaurant.location}</dd>
        </div>
        <div>
          <dt>Cuisine</dt>
          <dd>{restaurant.cuisineType}</dd>
        </div>
        <div>
          <dt>Statut</dt>
          <dd>{restaurant.statusLabel}</dd>
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
          <dt>Téléphone</dt>
          <dd>{restaurant.contactPhone || "À préciser"}</dd>
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
              ses QR, ses médias ou ses URLs publiques.
            </p>
          </div>
          <Badge tone={isArchived ? "muted" : "ready"}>
            {isArchived ? "Archivé" : "Actif"}
          </Badge>
        </div>

        <div className={styles.restaurantLifecycleActions}>
          <button
            type="button"
            className={`${styles.btn} ${isArchived ? "" : styles.btnDanger}`}
            disabled={isDisabled}
            onClick={() => void updateRestaurantStatus(nextAction)}
          >
            {statusPending === nextAction ? "Mise à jour..." : actionLabel}
          </button>
          {restaurant.isDemo ? (
            <span className={styles.sourceNote}>
              Restaurant de démonstration protégé contre l’archivage.
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
          L’archivage est réversible et conserve les données rattachées.
        </p>

        <div className={styles.restaurantDeleteBlock}>
          <div>
            <h5>Suppression définitive</h5>
            <p>
              Supprime le profil restaurant dans Supabase seulement après nettoyage confirmé
              des données critiques. En cas d’erreur, la table bloquante reste affichée et
              le restaurant n’est pas marqué supprimé.
            </p>
            <ul className={styles.restaurantDeleteList}>
              <li>Restaurant, liens publics et statut dashboard</li>
              <li>Plats menu_dishes, QR et configurations menu</li>
              <li>Données owner, analytics et métadonnées 3D si les tables existent</li>
              <li>Fichiers Storage/CDN seulement si la tentative ci-dessous est cochée</li>
            </ul>
          </div>

          <label className={styles.formField}>
            <span className={styles.filterLabel}>
              Tapez {deleteConfirmationTarget} pour confirmer
            </span>
            <input
              className={styles.control}
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={deleteConfirmationTarget}
              disabled={restaurant.isDemo || deletePending}
            />
          </label>

          <label className={styles.restaurantStorageToggle}>
            <input
              type="checkbox"
              checked={deleteStorage}
              onChange={(event) => setDeleteStorage(event.target.checked)}
              disabled={restaurant.isDemo || deletePending}
            />
            <span>
              Tenter aussi de supprimer les fichiers Storage/CDN sous les chemins du
              restaurant. Si Storage échoue, la suppression DB reste conservée et un warning
              est retourné.
            </span>
          </label>

          <div className={styles.restaurantLifecycleActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              disabled={isDisabled || !deleteConfirmed}
              onClick={() => void deleteRestaurant()}
            >
              {deletePending ? "Suppression..." : "Supprimer définitivement"}
            </button>
            {restaurant.isDemo ? (
              <span className={styles.sourceNote}>
                Restaurant de démonstration protégé contre la suppression.
              </span>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
