"use client";

import { useMemo, useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerQrCustomizer } from "@/components/owner/OwnerQrCustomizer";
import {
  buildOwnerQrTarget,
  type OwnerQrTargetKind
} from "@/lib/owner/menuUrlCore";
import type { OwnerRestaurant } from "@/lib/owner/types";

type OwnerQrManagerProps = {
  restaurants: OwnerRestaurant[];
};

export function OwnerQrManager({ restaurants }: OwnerQrManagerProps) {
  const [selectedId, setSelectedId] = useState(restaurants[0]?.id ?? "");
  const [targetKind, setTargetKind] = useState<OwnerQrTargetKind>("menu");
  const selected =
    restaurants.find((restaurant) => restaurant.id === selectedId) ?? restaurants[0];
  const selectedTarget = useMemo(
    () =>
      selected
        ? buildOwnerQrTarget({
            targetKind,
            restaurantId: selected.id,
            restaurantName: selected.name,
            restaurantSlug: selected.slug
          })
        : null,
    [selected, targetKind]
  );

  if (!selected) {
    return (
      <div className={styles.emptyState}>
        Aucun restaurant disponible. Creez un restaurant pour generer son QR.
      </div>
    );
  }

  return (
    <div className={styles.qrManager}>
      <div className={styles.qrSetupGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Restaurant</span>
          <select
            className={styles.select}
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name} - {restaurant.qrStatusLabel}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.qrTypeGroup} aria-label="Type de QR">
          <button
            type="button"
            className={`${styles.qrTypeButton} ${
              targetKind === "menu" ? styles.qrTypeButtonActive : ""
            }`}
            onClick={() => setTargetKind("menu")}
          >
            <span>QR menu public</span>
            <small>A imprimer sur les tables ou a donner aux clients.</small>
          </button>
          <button
            type="button"
            className={`${styles.qrTypeButton} ${
              targetKind === "admin" ? styles.qrTypeButtonActive : ""
            }`}
            onClick={() => setTargetKind("admin")}
          >
            <span>QR admin owner</span>
            <em>Interne owner - protege</em>
            <small>Interne seulement - ne pas imprimer pour les clients.</small>
          </button>
        </div>
      </div>

      {selectedTarget ? (
        <div className={styles.qrTargetBanner}>
          <span className={styles.badge}>{selectedTarget.badgeLabel}</span>
          <div>
            <strong>Destination exacte</strong>
            <p>{selectedTarget.targetPath}</p>
          </div>
        </div>
      ) : null}

      <OwnerQrCustomizer
        key={`${selected.id}-${targetKind}`}
        restaurantId={selected.id}
        restaurantName={selected.name}
        restaurantSlug={selected.slug}
        targetKind={selectedTarget?.targetKind ?? "menu"}
        targetLabel={selectedTarget?.label ?? `QR menu - ${selected.name}`}
        targetUsage={selectedTarget?.usage ?? ""}
        targetBadgeLabel={selectedTarget?.badgeLabel ?? "Public client"}
        targetPath={selectedTarget?.targetPath ?? selected.publicMenuPath}
        targetDisplayUrl={
          selectedTarget?.targetKind === "admin"
            ? selectedTarget.targetPath
            : selected.publicMenuUrl
        }
      />
    </div>
  );
}
