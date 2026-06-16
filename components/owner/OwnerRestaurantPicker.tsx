"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { OwnerRestaurantPortfolio } from "@/components/owner/OwnerRestaurantPortfolio";
import { OwnerRestaurantTable } from "@/components/owner/OwnerRestaurantTable";
import styles from "@/components/owner/OwnerCockpit.module.css";
import type { OwnerRestaurant, OwnerRestaurantStatus } from "@/lib/owner/types";

type OwnerRestaurantPickerProps = {
  restaurants: OwnerRestaurant[];
};

const statusOptions: Array<{ value: "all" | OwnerRestaurantStatus; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "setup_needed", label: "Setup" },
  { value: "demo", label: "Demo" },
  { value: "paused", label: "Pause" },
  { value: "archived", label: "Archive" }
];

export function OwnerRestaurantPicker({ restaurants }: OwnerRestaurantPickerProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | OwnerRestaurantStatus>("all");
  const [focus, setFocus] = useState<"all" | "needs-action" | "ready">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return restaurants.filter((restaurant) => {
      const matchesQuery =
        !q ||
        [restaurant.name, restaurant.slug, restaurant.location, restaurant.cuisineType]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesStatus = status === "all" || restaurant.status === status;
      const matchesFocus =
        focus === "all" ||
        (focus === "ready"
          ? restaurant.readinessScore >= 80
          : restaurant.readinessScore < 80 ||
            restaurant.qrStatus !== "ready" ||
            restaurant.incompleteDishCount > 0);

      return matchesQuery && matchesStatus && matchesFocus;
    });
  }, [focus, query, restaurants, status]);

  return (
    <div className={styles.ownerPicker}>
      <div className={styles.ownerPickerToolbar}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Recherche</span>
          <input
            className={styles.input}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, ville, cuisine..."
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Statut</span>
          <select
            className={styles.select}
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Focus</span>
          <select
            className={styles.select}
            value={focus}
            onChange={(event) => setFocus(event.target.value as typeof focus)}
          >
            <option value="all">Tous</option>
            <option value="needs-action">A traiter</option>
            <option value="ready">Prets</option>
          </select>
        </label>

        <Link
          className={`${styles.btnPrimary} ${styles.btn}`}
          href="/owner/restaurants/create"
          prefetch={false}
        >
          Creer restaurant
        </Link>
      </div>

      <OwnerRestaurantPortfolio restaurants={filtered} />

      <details className={styles.advancedTableDisclosure}>
        <summary>Table dense avancee</summary>
        <div className={styles.advancedTableBody}>
          <OwnerRestaurantTable restaurants={filtered} />
        </div>
      </details>
    </div>
  );
}
