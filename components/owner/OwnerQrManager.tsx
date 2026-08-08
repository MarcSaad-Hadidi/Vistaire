"use client";

import { useMemo, useState } from "react";
import styles from "@/components/owner/OwnerQrManagement.module.css";
import { OwnerQrCustomizer } from "@/components/owner/OwnerQrCustomizer";
import {
  buildOwnerQrTarget,
  type OwnerQrTargetKind
} from "@/lib/owner/menuUrlCore";
import type { OwnerRestaurant } from "@/lib/owner/types";

type OwnerQrManagerProps = {
  restaurants: OwnerRestaurant[];
  initialRestaurantId?: string;
  initialRestaurantSlug?: string;
  initialTargetKind?: OwnerQrTargetKind;
};

function getInitialRestaurantId({
  restaurants,
  initialRestaurantId,
  initialRestaurantSlug
}: OwnerQrManagerProps): string {
  return (
    restaurants.find((restaurant) => restaurant.id === initialRestaurantId)?.id ??
    restaurants.find((restaurant) => restaurant.slug === initialRestaurantSlug)?.id ??
    restaurants[0]?.id ??
    ""
  );
}

function normalizeTargetKind(value?: OwnerQrTargetKind): OwnerQrTargetKind {
  return value === "admin" ? "admin" : "menu";
}

export function OwnerQrManager({
  restaurants,
  initialRestaurantId,
  initialRestaurantSlug,
  initialTargetKind
}: OwnerQrManagerProps) {
  const [selectedId, setSelectedId] = useState(() =>
    getInitialRestaurantId({
      restaurants,
      initialRestaurantId,
      initialRestaurantSlug
    })
  );
  const [targetKind, setTargetKind] = useState<OwnerQrTargetKind>(() =>
    normalizeTargetKind(initialTargetKind)
  );
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
      <div className={styles.qrTabs} role="group" aria-label="Type de QR">
        <button
          id="qr-tab-public"
          type="button"
          aria-label="QR menu public"
          aria-pressed={targetKind === "menu"}
          className={`${styles.qrTab} ${targetKind === "menu" ? styles.qrTabActive : ""}`}
          onClick={() => setTargetKind("menu")}
        >
          <span className={styles.qrTabIcon} aria-hidden="true">◎</span>
          <span><strong>Menu public</strong><small>QR codes pour vos clients</small></span>
        </button>
        <button
          id="qr-tab-admin"
          type="button"
          aria-label="QR dashboard restaurant — Interne restaurant"
          aria-pressed={targetKind === "admin"}
          className={`${styles.qrTab} ${targetKind === "admin" ? styles.qrTabActive : ""}`}
          onClick={() => setTargetKind("admin")}
        >
          <span className={styles.qrTabIcon} aria-hidden="true">▣</span>
          <span><strong>Accès restaurant</strong><small>QR privé pour le dashboard interne · Ne pas imprimer pour les clients</small></span>
        </button>
      </div>
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

      </div>

      {selectedTarget ? (
        <div className={`${styles.qrTargetBanner} ${selectedTarget.targetKind === "admin" ? styles.qrAdminBanner : ""}`}>
          <span className={styles.badge}>{selectedTarget.badgeLabel}</span>
          <div>
            <strong>Destination exacte</strong>
            <p>
              {selectedTarget.targetKind === "admin"
                ? "URL opaque /q/… (destination interne masquée)"
                : selectedTarget.targetPath}
            </p>
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
            ? ""
            : selected.publicMenuUrl
        }
        canPerformDestructiveQrActions={
          !selected.isDemo && selected.status !== "demo"
        }
      />
    </div>
  );
}
