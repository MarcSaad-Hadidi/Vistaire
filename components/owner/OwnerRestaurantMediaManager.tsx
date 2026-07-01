"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  OwnerDishModelUploader,
  OwnerDishModelUploadQueueProvider
} from "@/components/owner/OwnerDishModelUploader";
import { OwnerDishModelVisualCompare } from "@/components/owner/OwnerDishModelVisualCompare";
import { OwnerDishPhotoUploader } from "@/components/owner/OwnerDishPhotoUploader";
import { Badge, EmptyState, Panel } from "@/components/owner/OwnerUi";
import type { PublicMenuDish } from "@/lib/menu/publicMenuCore";

export type OwnerMediaFilter =
  | "all"
  | "photos-missing"
  | "photos-ready"
  | "models-ready"
  | "review";

export const OWNER_MEDIA_FILTERS: Array<{ id: OwnerMediaFilter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "photos-missing", label: "Photos manquantes" },
  { id: "photos-ready", label: "Photos pretes" },
  { id: "models-ready", label: "Medias 3D prets" },
  { id: "review", label: "A verifier" }
];

const ALL_SECTION_FILTER = "all";

type OwnerRestaurantMediaManagerProps = {
  restaurantId: string;
  mediasHref: string;
  activeFilter: OwnerMediaFilter;
  dishes: PublicMenuDish[];
  menuError?: string;
};

function needsReview(dish: PublicMenuDish): boolean {
  return (
    !dish.hasPhoto ||
    dish.modelStatus === "web_ready_usdz_pending" ||
    dish.modelStatus === "pending_manual_usdz" ||
    dish.modelStatus === "usdz_conversion_failed"
  );
}

function filterDishes(dishes: PublicMenuDish[], filter: OwnerMediaFilter) {
  if (filter === "photos-missing") return dishes.filter((dish) => !dish.hasPhoto);
  if (filter === "photos-ready") return dishes.filter((dish) => dish.hasPhoto);
  if (filter === "models-ready") return dishes.filter((dish) => dish.hasImmersive);
  if (filter === "review") return dishes.filter(needsReview);
  return dishes;
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

export function OwnerRestaurantMediaManager({
  restaurantId,
  mediasHref,
  activeFilter,
  dishes,
  menuError
}: OwnerRestaurantMediaManagerProps) {
  const [selectedDishId, setSelectedDishId] = useState<string>("");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [sectionFilter, setSectionFilter] = useState(ALL_SECTION_FILTER);
  const comparisonRef = useRef<HTMLDivElement | null>(null);
  const mediaFilteredDishes = useMemo(
    () => filterDishes(dishes, activeFilter),
    [activeFilter, dishes]
  );
  const sectionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          mediaFilteredDishes
            .map((dish) => dish.category.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "fr")),
    [mediaFilteredDishes]
  );
  const visibleDishes = useMemo(
    () =>
      sectionFilter === ALL_SECTION_FILTER
        ? mediaFilteredDishes
        : mediaFilteredDishes.filter((dish) => dish.category === sectionFilter),
    [mediaFilteredDishes, sectionFilter]
  );
  const selectedDish =
    visibleDishes.find((dish) => dish.id === selectedDishId) ?? null;
  const selectedComparisonStatus = selectedDish ? comparisonStatus(selectedDish) : null;
  const selectedComparisonDish =
    selectedDish && selectedComparisonStatus?.ready ? selectedDish : null;
  const selectionResetMessage =
    selectedDishId && !selectedDish
      ? "La selection est masquee par le filtre actif."
      : selectedDish && !selectedComparisonStatus?.ready
        ? "La selection n'est plus comparable car le modele du plat n'est plus complet."
        : "";
  const comparisonKey = selectedComparisonDish
    ? [
        selectedComparisonDish.id,
        selectedComparisonDish.modelAssetVersion ?? "",
        selectedComparisonDish.modelUpdatedAt ?? "",
        selectedComparisonDish.webModel3dUrl,
        selectedComparisonDish.webModel3dBytes ?? "",
        selectedComparisonDish.arModel3dUrl ?? "",
        selectedComparisonDish.arUsdzUrl,
        selectedComparisonDish.arUsdzBytes ?? "",
        selectedComparisonDish.modelStatus ?? ""
      ].join(":")
    : "";

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
        title="Plats et medias"
        action={
          <div className={styles.filtersRow}>
            {OWNER_MEDIA_FILTERS.map((filter) => (
              <Link
                key={filter.id}
                className={`${styles.btn} ${styles.btnSmall} ${
                  activeFilter === filter.id ? styles.btnPrimary : ""
                }`}
                href={`${mediasHref}?filter=${filter.id}`}
                prefetch={false}
              >
                {filter.label}
              </Link>
            ))}
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
          <EmptyState>Aucun plat dans ce filtre.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Plat</th>
                  <th>Photo</th>
                  <th>GLB</th>
                  <th>AR</th>
                  <th>Qualite media</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDishes.map((dish) => {
                  const status = comparisonStatus(dish);
                  const isSelected = selectedComparisonDish?.id === dish.id;

                  return (
                    <tr
                      key={dish.id}
                      className={isSelected ? styles.selectedMediaRow : undefined}
                      aria-selected={isSelected}
                    >
                      <td>
                        <strong className={styles.cellMain}>{dish.name}</strong>
                        <span className={styles.cellSub}>{dish.category}</span>
                        {isSelected ? (
                          <span className={styles.cellSub}>Selectionne</span>
                        ) : null}
                      </td>
                      <td>
                        <Badge tone={dish.hasPhoto ? "ready" : "warn"}>
                          {dish.hasPhoto ? "Photo prete" : dish.photoStatus}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={dish.webModel3dUrl ? "ready" : "muted"}>
                          {dish.webModel3dUrl ? "GLB pret" : "Aucun GLB"}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={dish.arUsdzUrl || dish.arModel3dUrl ? "ready" : "muted"}>
                          {dish.arUsdzUrl || dish.arModel3dUrl ? "AR pret" : "AR absent"}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={needsReview(dish) ? "warn" : "ready"}>
                          {needsReview(dish) ? "A verifier" : "Pret"}
                        </Badge>
                      </td>
                      <td>
                        <div className={styles.tableActions}>
                          <OwnerDishPhotoUploader
                            restaurantId={restaurantId}
                            dishId={dish.id}
                            dishName={dish.name}
                            initialImageUrl={dish.imageUrl}
                          />
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
                            type="button"
                            className={`${styles.btn} ${styles.btnSmall}`}
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
        {selectionResetMessage || selectionMessage ? (
          <p className={styles.sheetStatus} role="status" aria-live="polite">
            {selectionResetMessage || selectionMessage}
          </p>
        ) : null}
      </Panel>

      <div ref={comparisonRef}>
        <Panel title="Comparaison visuelle GLB / USDZ">
          {!selectedComparisonDish ? (
            <EmptyState>
              Selectionnez un plat pour comparer son GLB et son USDZ.
            </EmptyState>
          ) : (
            <div className={styles.modelCompareStack}>
              <OwnerDishModelVisualCompare
                key={comparisonKey}
                dishName={selectedComparisonDish.name}
                webModel3dUrl={selectedComparisonDish.webModel3dUrl}
                webModel3dBytes={selectedComparisonDish.webModel3dBytes}
                arPreviewModelUrl={
                  selectedComparisonDish.arModel3dUrl || selectedComparisonDish.webModel3dUrl
                }
                arUsdzUrl={selectedComparisonDish.arUsdzUrl}
                arUsdzBytes={selectedComparisonDish.arUsdzBytes}
              />
            </div>
          )}
        </Panel>
      </div>
    </OwnerDishModelUploadQueueProvider>
  );
}
