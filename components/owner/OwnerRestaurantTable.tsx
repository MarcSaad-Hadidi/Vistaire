"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import type { OwnerReadinessItem, OwnerRestaurant, OwnerRestaurantStatus } from "@/lib/owner/types";

type OwnerRestaurantTableProps = {
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

type BadgeTone = "ready" | "warn" | "danger" | "muted";

function badgeClass(tone: BadgeTone): string {
  if (tone === "ready") return `${styles.badge} ${styles.badgeReady}`;
  if (tone === "warn") return `${styles.badge} ${styles.badgeWarn}`;
  if (tone === "danger") return `${styles.badge} ${styles.badgeDanger}`;
  return styles.badge;
}

function qrTone(status: OwnerRestaurant["qrStatus"]): BadgeTone {
  if (status === "ready") return "ready";
  if (status === "generable") return "warn";
  return "danger";
}

function readinessTone(item: OwnerReadinessItem): BadgeTone {
  if (item.status === "ready" || item.status === "demo") return "ready";
  if (item.status === "needs_setup") return "warn";
  return "danger";
}

export function OwnerRestaurantTable({ restaurants }: OwnerRestaurantTableProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | OwnerRestaurantStatus>("all");
  const [readiness, setReadiness] = useState<"all" | "ready" | "needs_setup">("all");
  const [qr, setQr] = useState<"all" | "ready" | "generable" | "missing">("all");
  const [menu, setMenu] = useState<"all" | "ready" | "missing">("all");
  const [photos, setPhotos] = useState<"all" | "complete" | "missing">("all");
  const [immersive, setImmersive] = useState<"all" | "available" | "missing">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      const matchesReadiness =
        readiness === "all" ||
        (readiness === "ready"
          ? restaurant.readinessScore >= 80
          : restaurant.readinessScore < 80);
      const matchesQr = qr === "all" || restaurant.qrStatus === qr;
      const matchesMenu =
        menu === "all" ||
        (menu === "ready" ? restaurant.dishCount > 0 : restaurant.dishCount === 0);
      const matchesPhotos =
        photos === "all" ||
        (photos === "complete"
          ? restaurant.dishCount > 0 && restaurant.photoDishCount >= restaurant.dishCount
          : restaurant.photoDishCount < restaurant.dishCount);
      const matchesImmersive =
        immersive === "all" ||
        (immersive === "available"
          ? restaurant.immersiveDishCount > 0
          : restaurant.immersiveDishCount === 0);
      return (
        matchesQuery &&
        matchesStatus &&
        matchesReadiness &&
        matchesQr &&
        matchesMenu &&
        matchesPhotos &&
        matchesImmersive
      );
    });
  }, [immersive, menu, photos, query, qr, readiness, restaurants, status]);

  const selected = restaurants.find((restaurant) => restaurant.id === selectedId) ?? null;

  return (
    <div>
      <div className={styles.filtersRow}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Recherche</span>
          <input
            className={styles.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, slug, cuisine"
          />
        </label>
        <Select label="Statut" value={status} onChange={(v) => setStatus(v as typeof status)} options={statusOptions} />
        <Select
          label="Readiness"
          value={readiness}
          onChange={(v) => setReadiness(v as typeof readiness)}
          options={[
            { value: "all", label: "Toutes" },
            { value: "ready", label: "Prêtes" },
            { value: "needs_setup", label: "À traiter" }
          ]}
        />
        <Select
          label="QR"
          value={qr}
          onChange={(v) => setQr(v as typeof qr)}
          options={[
            { value: "all", label: "Tous" },
            { value: "ready", label: "Prêt" },
            { value: "generable", label: "Générable" },
            { value: "missing", label: "Manquant" }
          ]}
        />
        <Select
          label="Menu"
          value={menu}
          onChange={(v) => setMenu(v as typeof menu)}
          options={[
            { value: "all", label: "Tous" },
            { value: "ready", label: "Prêt" },
            { value: "missing", label: "Vide" }
          ]}
        />
        <Select
          label="Photos"
          value={photos}
          onChange={(v) => setPhotos(v as typeof photos)}
          options={[
            { value: "all", label: "Toutes" },
            { value: "complete", label: "Complètes" },
            { value: "missing", label: "À compléter" }
          ]}
        />
        <Select
          label="3D / AR"
          value={immersive}
          onChange={(v) => setImmersive(v as typeof immersive)}
          options={[
            { value: "all", label: "Tous" },
            { value: "available", label: "Disponible" },
            { value: "missing", label: "Manquant" }
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>Aucun restaurant ne correspond aux filtres.</div>
      ) : (
        <>
          {/* Desktop dense table */}
          <div className={`${styles.tableWrap} ${styles.showDesktop}`}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Statut</th>
                  <th>Readiness</th>
                  <th>Menu</th>
                  <th>QR</th>
                  <th>Photos</th>
                  <th>3D / AR</th>
                  <th>Activité</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((restaurant) => (
                  <tr
                    key={restaurant.id}
                    className={styles.tableRow}
                    onClick={() => setSelectedId(restaurant.id)}
                  >
                    <td>
                      <div className={styles.cellMain}>{restaurant.name}</div>
                      <div className={styles.cellSub}>
                        {restaurant.slug} · {restaurant.cuisineType}
                      </div>
                    </td>
                    <td>
                      <span className={badgeClass(restaurant.status === "active" ? "ready" : restaurant.status === "setup_needed" ? "warn" : "muted")}>
                        {restaurant.statusLabel}
                      </span>
                    </td>
                    <td>
                      <div className={styles.miniBar}>
                        <div
                          className={styles.miniBarFill}
                          style={{ width: `${restaurant.readinessScore}%` }}
                        />
                      </div>
                      <div className={styles.cellSub}>{restaurant.readinessScore}%</div>
                    </td>
                    <td>{restaurant.dishCount}</td>
                    <td>
                      <span className={badgeClass(qrTone(restaurant.qrStatus))}>
                        {restaurant.qrStatusLabel}
                      </span>
                    </td>
                    <td>
                      {restaurant.photoDishCount}/{restaurant.dishCount}
                    </td>
                    <td>{restaurant.immersiveDishCount}</td>
                    <td className={styles.cellSub}>{restaurant.lastActivity}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <Link
                          className={styles.btnSmall + " " + styles.btn}
                          href={restaurant.dashboardHref}
                          prefetch={false}
                          onClick={(event) => event.stopPropagation()}
                        >
                          Ouvrir dashboard
                        </Link>
                        <button
                          type="button"
                          className={styles.btnSmall + " " + styles.btn}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(restaurant.id);
                          }}
                        >
                          Détail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className={`${styles.cardGrid} ${styles.showMobile}`}>
            {filtered.map((restaurant) => (
              <article
                key={restaurant.id}
                className={styles.moduleCard}
              >
                <p className={styles.moduleCardTitle}>{restaurant.name}</p>
                <span className={styles.moduleCardMeta}>
                  {restaurant.slug} · {restaurant.cuisineType}
                </span>
                <div className={styles.pillRow}>
                  <span className={badgeClass(restaurant.status === "active" ? "ready" : "warn")}>
                    {restaurant.statusLabel}
                  </span>
                  <span className={badgeClass(qrTone(restaurant.qrStatus))}>
                    {restaurant.qrStatusLabel}
                  </span>
                  <span className={styles.badge}>{restaurant.readinessScore}%</span>
                </div>
                <div className={styles.tableActions}>
                  <Link
                    className={styles.btnSmall + " " + styles.btn}
                    href={restaurant.dashboardHref}
                    prefetch={false}
                  >
                    Ouvrir dashboard
                  </Link>
                  <button
                    type="button"
                    className={styles.btnSmall + " " + styles.btn}
                    onClick={() => setSelectedId(restaurant.id)}
                  >
                    Détail
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <div className={`${styles.drawer} ${selected ? styles.drawerOpen : ""}`}>
        <button
          type="button"
          aria-label="Fermer le détail"
          className={styles.drawerBackdrop}
          onClick={() => setSelectedId(null)}
        />
        {selected ? (
          <div className={styles.drawerPanel} role="dialog" aria-label={`Détail ${selected.name}`}>
            <div className={styles.drawerHeader}>
              <div>
                <h3 className={styles.moduleCardTitle}>{selected.name}</h3>
                <p className={styles.cellSub}>
                  {selected.location} · {selected.cuisineType}
                </p>
              </div>
              <button type="button" className={styles.drawerClose} onClick={() => setSelectedId(null)}>
                ×
              </button>
            </div>

            <div className={styles.drawerSection}>
              <p className={styles.drawerSectionTitle}>Readiness ({selected.readinessScore}%)</p>
              {selected.readinessItems.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                  <span className={styles.cellSub}>{item.label}</span>
                  <span className={badgeClass(readinessTone(item))}>{item.detail}</span>
                </div>
              ))}
            </div>

            <div className={styles.drawerSection}>
              <p className={styles.drawerSectionTitle}>Contenu</p>
              <p className={styles.cellSub}>Plats : {selected.dishCount}</p>
              <p className={styles.cellSub}>Photos : {selected.photoDishCount}/{selected.dishCount}</p>
              <p className={styles.cellSub}>3D / AR : {selected.immersiveDishCount}</p>
              <p className={styles.cellSub}>Prochaine action : {selected.nextAction}</p>
            </div>

            <div className={styles.drawerSection}>
              <p className={styles.drawerSectionTitle}>Liens</p>
              <div className={styles.pillRow}>
                <Link className={styles.btnPrimary + " " + styles.btn} href={selected.dashboardHref} prefetch={false}>
                  Ouvrir dashboard
                </Link>
                <Link className={styles.btn} href={selected.clientMenuHref} prefetch={false}>
                  Preview client
                </Link>
                <Link className={styles.btn} href="/owner/qr-codes" prefetch={false}>
                  QR du restaurant
                </Link>
              </div>
              <p className={styles.cellSub} style={{ marginTop: 8 }}>
                Menu public : {selected.publicMenuUrl}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
