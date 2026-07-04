"use client";

import { useMemo, useRef, useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  OwnerDishModelUploader,
  OwnerDishModelUploadQueueProvider
} from "@/components/owner/OwnerDishModelUploader";
import { OwnerDishModelVisualCompare } from "@/components/owner/OwnerDishModelVisualCompare";
import { Badge, EmptyState, Panel } from "@/components/owner/OwnerUi";
import type { PublicMenuDish } from "@/lib/menu/publicMenuCore";

type OwnerRestaurant3dManagerProps = {
  restaurantId: string;
  restaurantSlug: string;
  dishes: PublicMenuDish[];
  menuError?: string;
};

const ALL_SECTION_FILTER = "all";

function modelStatusLabel(dish: PublicMenuDish): string {
  const hasViewer = Boolean(dish.webModel3dUrl);
  const hasUsdz = Boolean(dish.arUsdzUrl);
  if (hasViewer && hasUsdz) return "GLB viewer + USDZ runtime prets";
  if (hasViewer) return "GLB viewer pret · USDZ runtime manquant";
  if (hasUsdz) return "USDZ runtime pret · GLB viewer manquant";
  return "Aucun modele";
}

function comparisonStatus(dish: PublicMenuDish): {
  ready: boolean;
  label: string;
  tone: "ready" | "warn" | "muted";
} {
  if (!dish.webModel3dUrl) {
    return { ready: false, label: "GLB viewer manquant", tone: "muted" };
  }
  if (!dish.arUsdzUrl) {
    return { ready: false, label: "USDZ runtime manquant", tone: "warn" };
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
  const [sectionFilter, setSectionFilter] = useState(ALL_SECTION_FILTER);
  const comparisonRef = useRef<HTMLDivElement | null>(null);
  const sectionOptions = useMemo(
    () =>
      Array.from(
        new Set(dishes.map((dish) => dish.category.trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "fr")),
    [dishes]
  );
  const visibleDishes = useMemo(
    () =>
      sectionFilter === ALL_SECTION_FILTER
        ? dishes
        : dishes.filter((dish) => dish.category === sectionFilter),
    [dishes, sectionFilter]
  );
  const selectedDish = dishes.find((dish) => dish.id === selectedDishId) ?? null;

  function selectForComparison(dish: PublicMenuDish) {
    const status = comparisonStatus(dish);
    if (!status.ready) return;
    setSelectedDishId(dish.id);
    setSelectionMessage(`${dish.name} selectionne pour comparaison.`);
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      comparisonRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start"
      });
    });
  }

  return (
    <OwnerDishModelUploadQueueProvider>
      <Panel
        title="Plats du restaurant"
        action={
          <div className={styles.filtersRow}>
            <Badge tone="muted">{restaurantSlug}</Badge>
            {sectionOptions.length > 1 ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Section</span>
                <select
                  className={styles.select}
                  value={sectionFilter}
                  onChange={(event) => setSectionFilter(event.target.value)}
                >
                  <option value={ALL_SECTION_FILTER}>Toutes les sections</option>
                  {sectionOptions.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        }
      >
        {menuError ? (
          <EmptyState>{menuError}</EmptyState>
        ) : dishes.length === 0 ? (
          <EmptyState>Aucun plat charge pour ce restaurant.</EmptyState>
        ) : visibleDishes.length === 0 ? (
          <EmptyState>Aucun plat dans cette section.</EmptyState>
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
                {visibleDishes.map((dish) => {
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
                            initialViewerGlbStatus={dish.viewerGlbStatus}
                            initialArUsdzUrl={dish.arUsdzUrl}
                            initialArUsdzBytes={dish.arUsdzBytes}
                            initialUsdzRuntimeStatus={dish.usdzRuntimeStatus}
                            initialUsdzOptimizationProfile={dish.usdzOptimizationProfile}
                            initialUsdzGeometryOptimization={dish.usdzGeometryOptimization}
                            initialUsdzTriangleCountBefore={dish.usdzTriangleCountBefore}
                            initialUsdzTriangleCountAfter={dish.usdzTriangleCountAfter}
                            initialUsdzGeometryReductionPercent={dish.usdzGeometryReductionPercent}
                            initialUsdzOptimizationAttemptCount={dish.usdzOptimizationAttemptCount}
                            initialUsdzChangedTextures={dish.usdzChangedTextures}
                            initialUsdzSourceBytes={dish.usdzSourceBytes}
                            initialUsdzSourceOriginalName={dish.usdzSourceOriginalName}
                            initialQuickLookQaStatus={dish.quickLookQaStatus}
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

      <div ref={comparisonRef}>
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
      </div>
    </OwnerDishModelUploadQueueProvider>
  );
}
