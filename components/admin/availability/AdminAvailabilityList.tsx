"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AdminDishAvailabilityControl } from "@/components/admin/AdminDishAvailabilityControl";
import { AdminStatusBadge } from "@/components/admin/system/AdminPrimitives";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import styles from "./AdminAvailability.module.css";

type Filter = "all" | "available" | "unavailable";
const FILTERS: Array<{ id: Filter; label: string }> = [{ id: "all", label: "Tous" }, { id: "available", label: "Disponibles" }, { id: "unavailable", label: "Indisponibles" }];

export function AdminAvailabilityList({ dishes }: { dishes: AdminMenuDish[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const currentDishes = useMemo(() => dishes.map((dish) => ({ ...dish, available: availability[dish.id] ?? dish.available })), [availability, dishes]);
  const availableCount = currentDishes.filter((dish) => dish.available).length;
  const visibleDishes = currentDishes.filter((dish) => (filter === "all" || (filter === "available" ? dish.available : !dish.available)) && dish.name.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")));
  return <section className={styles.page} aria-labelledby="availability-title">
    <header className={styles.summary}><div><p className={styles.eyebrow}>Carte actuelle</p><h2 id="availability-title">Disponibilité des plats</h2><p>Gérez en un geste ce que vos clients voient sur la carte.</p></div><div className={styles.metrics}><article><span>Total des plats</span><strong>{currentDishes.length}</strong></article><article><span>Disponibles</span><strong>{availableCount}</strong></article><article><span>Indisponibles</span><strong>{currentDishes.length - availableCount}</strong></article></div></header>
    <div className={styles.controls}><label><span className="sr-only">Rechercher un plat</span><input type="search" placeholder="Rechercher un plat" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className={styles.filters} aria-label="Filtrer les plats">{FILTERS.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div></div>
    <div className={styles.list}>{visibleDishes.map((dish) => <article className={styles.row} key={dish.id} data-available={dish.available}><div className={styles.image}><Image alt="" src={dish.thumbnailUrl || dish.imageUrl || "/images/placeholder-dish.svg"} fill sizes="160px" /></div><div className={styles.identity}><h3>{dish.name}</h3><p>{dish.category}</p></div><p className={styles.price}>{dish.priceLabel}</p><AdminStatusBadge tone={dish.available ? "available" : "unavailable"}>{dish.available ? "Disponible" : "Indisponible"}</AdminStatusBadge><AdminDishAvailabilityControl dishId={dish.id} dishName={dish.name} initialAvailable={dish.available} onAvailabilityChange={(available) => setAvailability((current) => ({ ...current, [dish.id]: available }))} /></article>)}</div>
    <p className="sr-only" aria-live="polite">{visibleDishes.length} résultat{visibleDishes.length > 1 ? "s" : ""} affiché{visibleDishes.length > 1 ? "s" : ""}.</p>{visibleDishes.length === 0 ? <p className={styles.empty} role="status">Aucun plat ne correspond à cette recherche.</p> : null}
  </section>;
}
