"use client";

import { useMemo, useState } from "react";
import { AdminDishThumbnail } from "@/components/admin/AdminDishThumbnail";
import { AdminDishAvailabilityControl } from "@/components/admin/AdminDishAvailabilityControl";
import { AlertIcon, CheckIcon, MenuOpenIcon, SearchIcon } from "@/components/admin/system/AdminIcons";
import { AdminStatusBadge, AdminToast } from "@/components/admin/system/AdminPrimitives";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import { resolveAvailabilityForSource, type AvailabilityFeedback, type AvailabilityOverride } from "./availabilityMutation";
import styles from "./AdminAvailability.module.css";

type Filter = "all" | "available" | "unavailable";
type AvailabilityState = { source: AdminMenuDish[]; overrides: Record<string, AvailabilityOverride> };
const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "available", label: "Disponibles" },
  { id: "unavailable", label: "Indisponibles" },
];

export function AdminAvailabilityList({ dishes }: { dishes: AdminMenuDish[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState>(() => ({ source: dishes, overrides: {} }));
  const [feedback, setFeedback] = useState<AvailabilityFeedback>({ tone: null, message: null });
  const current = useMemo(() => dishes.map((dish) => ({ ...dish, available: resolveAvailabilityForSource(dish.available, dishes, availability.source, availability.overrides[dish.id]) })), [availability, dishes]);
  const available = current.filter((dish) => dish.available).length;
  const filterCount: Record<Filter, number> = { all: current.length, available, unavailable: current.length - available };
  const visible = current.filter((dish) => (filter === "all" || (filter === "available" ? dish.available : !dish.available)) && dish.name.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")));

  return <section className={styles.page} aria-labelledby="availability-title">
    <header className={styles.summary}>
      <div><h2 id="availability-title">Disponibilité des plats</h2><p>Gérez simplement la disponibilité de chaque plat sur votre menu.</p></div>
      <div className={styles.metrics}>
        <article><i aria-hidden="true" data-availability-metric-icon><MenuOpenIcon/></i><div><span>Total des plats</span><strong>{current.length}</strong></div></article>
        <article><i aria-hidden="true" data-availability-metric-icon data-tone="available"><CheckIcon/></i><div><span>Disponibles</span><strong>{available}</strong><small>{Math.round(available / Math.max(1, current.length) * 100)} %</small></div></article>
        <article><i aria-hidden="true" data-availability-metric-icon data-tone="unavailable"><AlertIcon/></i><div><span>Indisponibles</span><strong>{current.length - available}</strong><small>{Math.round((current.length - available) / Math.max(1, current.length) * 100)} %</small></div></article>
      </div>
    </header>
    <div className={styles.controls}>
      <label><span className="sr-only">Rechercher un plat</span><SearchIcon aria-hidden="true"/><input type="search" placeholder="Rechercher un plat…" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
      <div className={styles.filters} aria-label="Filtrer les plats">{filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}><span>{item.label}</span><small aria-hidden="true">{filterCount[item.id]}</small></button>)}</div>
    </div>
    <div className={styles.list}>{visible.map((dish, index) => <article className={styles.row} key={dish.id} data-admin-menu-dish data-dish-id={dish.id} data-category-id={dish.categorySlug ?? dish.category} data-available={dish.available}>
      <AdminDishThumbnail name={dish.name} thumbnailUrl={dish.thumbnailUrl} imageUrl={dish.imageUrl} priority={index === 0}/>
      <div className={styles.identity}><h3>{dish.name}</h3><p>{dish.category}</p></div>
      <p className={styles.price}>{dish.priceLabel}</p>
      <AdminStatusBadge tone={dish.available ? "available" : "unavailable"}>{dish.available ? "Disponible" : "Indisponible"}</AdminStatusBadge>
      <AdminDishAvailabilityControl key={`${dish.id}:${dish.available}`} dishId={dish.id} dishName={dish.name} initialAvailable={dish.available} onAvailabilityChange={(value) => setAvailability((state) => ({ source: dishes, overrides: { ...(state.source === dishes ? state.overrides : {}), [dish.id]: { base: dish.available, value } } }))} onFeedback={setFeedback}/>
    </article>)}</div>
    <p className="sr-only" aria-live="polite">{visible.length} résultat{visible.length > 1 ? "s" : ""} affiché{visible.length > 1 ? "s" : ""}.</p>
    {visible.length === 0 ? <p className={styles.empty} role="status">Aucun plat ne correspond à cette recherche.</p> : null}
    {feedback.message ? <AdminToast tone={feedback.tone === "error" ? "error" : "success"}>{feedback.message}</AdminToast> : null}
  </section>;
}
