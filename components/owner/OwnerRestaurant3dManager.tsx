"use client";

import { useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerDishModelUploader } from "@/components/owner/OwnerDishModelUploader";
import { OwnerDishModelVisualCompare } from "@/components/owner/OwnerDishModelVisualCompare";
import { Badge, EmptyState, Panel } from "@/components/owner/OwnerUi";
import type { PublicMenuDish } from "@/lib/menu/publicMenuCore";

type OwnerRestaurant3dManagerProps = {
  restaurantId: string;
  restaurantSlug: string;
  dishes: PublicMenuDish[];
  menuError?: string;
};

function modelStatusLabel(dish: PublicMenuDish): string {
  if (dish.modelStatus === "ready") return "GLB + USDZ prets";
  if (dish.preparedGlbStoragePath) return "Conversion a finaliser";
  if (dish.webModel3dUrl) return "GLB pret, USDZ attendu";
  return "Aucun modele";
}

function comparisonStatus(dish: PublicMenuDish): {
  ready: boolean;
  label: string;
  tone: "ready" | "warn" | "muted";
} {
  if (!dish.webModel3dUrl) {
    return { ready: false, label: "GLB manquant", tone: "muted" };
  }
  if (!dish.arUsdzUrl) {
    return { ready: false, label: "USDZ manquant", tone: "warn" };
  }
  return { ready: true, label: "Voir comparaison", tone: "ready" };
}

export function OwnerRestaurant3dManager({
  restaurantId,
  restaurantSlug,
  dishes,
  menuError
}: OwnerRestaurant3dManagerProps) {
  const [selectedDishId, setSelectedDishId] = useState("");
  const [selectionMessage, setSelectionMessage] = useState("");
  const selectedDish = dishes.find((dish) => dish.id === selectedDishId) ?? null;

  function selectForComparison(dish: PublicMenuDish) {
    const status = comparisonStatus(dish);
    if (!status.ready) return;
    setSelectedDishId(dish.id);
    setSelectionMessage(`${dish.name} selectionne pour comparaison.`);
  }

  return (
    <>
      <Panel
        title="Plats du restaurant"
        action={<Badge tone="muted">{restaurantSlug}</Badge>}
      >
        {menuError ? (
          <EmptyState>{menuError}</EmptyState>
        ) : dishes.length === 0 ? (
          <EmptyState>Aucun plat charge pour ce restaurant.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Plat</th>
                  <th>Section</th>
                  <th>Statut</th>
                  <th>Comparaison</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((dish) => {
                  const status = comparisonStatus(dish);
                  const isSelected = dish.id === selectedDishId;

                  return (
                    <tr
                      key={dish.id}
                      className={isSelected ? styles.selectedMediaRow : undefined}
                      aria-selected={isSelected}
                    >
                      <td>
                        <strong className={styles.cellMain}>{dish.name}</strong>
                        {isSelected ? (
                          <span className={styles.cellSub}>Selectionne</span>
                        ) : null}
                      </td>
                      <td className={styles.cellSub}>{dish.category}</td>
                      <td>
                        <Badge tone={dish.hasImmersive ? "ready" : "warn"}>
                          {modelStatusLabel(dish)}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                      <td>
                        <div className={styles.tableActions}>
                          <OwnerDishModelUploader
                            restaurantId={restaurantId}
                            dishId={dish.id}
                            dishName={dish.name}
                            initialStatus={dish.modelStatus}
                            initialWebModel3dUrl={dish.webModel3dUrl}
                            initialWebModel3dBytes={dish.webModel3dBytes}
                            initialArUsdzUrl={dish.arUsdzUrl}
                            initialArUsdzBytes={dish.arUsdzBytes}
                            initialPreparedGlbJobId={dish.preparedGlbJobId}
                            initialPreparedGlbStoragePath={dish.preparedGlbStoragePath}
                          />
                          <button
                            className={`${styles.btn} ${styles.btnSmall}`}
                            type="button"
                            disabled={!status.ready}
                            aria-pressed={isSelected}
                            aria-label={`${status.label}: ${dish.name}`}
                            onClick={() => selectForComparison(dish)}
                          >
                            {status.label}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {selectionMessage ? (
          <p className={styles.sheetStatus} role="status" aria-live="polite">
            {selectionMessage}
          </p>
        ) : null}
      </Panel>

      <Panel title="Comparaison visuelle GLB / USDZ">
        {!selectedDish ? (
          <EmptyState>
            Selectionnez un plat pour comparer son GLB et son USDZ.
          </EmptyState>
        ) : (
          <div className={styles.modelCompareStack}>
            <OwnerDishModelVisualCompare
              key={selectedDish.id}
              dishName={selectedDish.name}
              webModel3dUrl={selectedDish.webModel3dUrl}
              webModel3dBytes={selectedDish.webModel3dBytes}
              arPreviewModelUrl={selectedDish.arModel3dUrl || selectedDish.webModel3dUrl}
              arUsdzUrl={selectedDish.arUsdzUrl}
              arUsdzBytes={selectedDish.arUsdzBytes}
            />
          </div>
        )}
      </Panel>
    </>
  );
}
