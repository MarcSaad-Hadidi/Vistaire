"use client";

import { useMemo, useState } from "react";
import { AdminDishThumbnail } from "@/components/admin/AdminDishThumbnail";
import { AdminDishAvailabilityControl } from "@/components/admin/AdminDishAvailabilityControl";
import { AlertIcon, CheckIcon, MenuOpenIcon, SearchIcon } from "@/components/admin/system/AdminIcons";
import { AdminStatusBadge, AdminToast } from "@/components/admin/system/AdminPrimitives";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import type { AvailabilitySchedulingCapability } from "@/lib/admin/availability/contracts";
import { AvailabilityCapabilityNotice } from "./AvailabilityCapabilityNotice";
import { AvailabilityHistory } from "./AvailabilityHistory";
import { AvailabilityScheduleForm } from "./AvailabilityScheduleForm";
import { resolveAvailabilityForSource, type AvailabilityFeedback, type AvailabilityOverride } from "./availabilityMutation";
import styles from "./AdminAvailability.module.css";

type Filter = "all" | "available" | "unavailable";
type AvailabilityState = { source: AdminMenuDish[]; overrides: Record<string, AvailabilityOverride> };
const filters: Array<{ id: Filter; label: string }> = [{ id: "all", label: "Tous" }, { id: "available", label: "Disponibles" }, { id: "unavailable", label: "Indisponibles" }];

export function AdminAvailabilityList({ dishes, capability }: { dishes: AdminMenuDish[]; capability: AvailabilitySchedulingCapability }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedDish, setSelectedDish] = useState<string | undefined>();
  const [availability, setAvailability] = useState<AvailabilityState>(() => ({ source: dishes, overrides: {} }));
  const [feedback, setFeedback] = useState<AvailabilityFeedback>({ tone: null, message: null });
  const current = useMemo(() => dishes.map((dish) => ({ ...dish, available: resolveAvailabilityForSource(dish.available, dishes, availability.source, availability.overrides[dish.id]) })), [availability, dishes]);
  const available = current.filter((dish) => dish.available).length;
  const filterCount: Record<Filter, number> = { all: current.length, available, unavailable: current.length - available };
  const visible = current.filter((dish) => (filter === "all" || (filter === "available" ? dish.available : !dish.available)) && `${dish.name} ${dish.category}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")));
  const selected = current.find((dish) => dish.id === selectedDish);

  return <section className={styles.page} aria-labelledby="availability-title">
    <h2 id="availability-title" className="sr-only">Disponibilités — Gestion opérationnelle</h2>
    <div className={styles.metrics} aria-label="État du catalogue">
      <article><i aria-hidden="true"><MenuOpenIcon/></i><div><span>Total plats</span><strong>{current.length}</strong><small>dans le menu</small></div></article>
      <article><i aria-hidden="true" data-tone="available"><CheckIcon/></i><div><span>Disponibles</span><strong>{available}</strong><small>{Math.round(available / Math.max(1, current.length) * 100)} %</small></div></article>
      <article><i aria-hidden="true" data-tone="unavailable"><AlertIcon/></i><div><span>Indisponibles</span><strong>{current.length - available}</strong><small>{Math.round((current.length - available) / Math.max(1, current.length) * 100)} %</small></div></article>
    </div>
    <div className={styles.workspace}><div className={styles.catalogue}>
      <div className={styles.controls}><label><span className="sr-only">Rechercher un plat</span><SearchIcon aria-hidden="true"/><input type="search" placeholder="Rechercher un plat…" value={query} onChange={(event) => setQuery(event.target.value)}/></label><div className={styles.filters} aria-label="Filtrer les plats">{filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}><span>{item.label}</span><small aria-hidden="true">{filterCount[item.id]}</small></button>)}</div></div>
      <div className={styles.list}>{visible.map((dish, index) => <article className={styles.row} key={dish.id} data-admin-menu-dish data-dish-id={dish.id} data-category-id={dish.categorySlug ?? dish.category} data-available={dish.available}>
        <AdminDishThumbnail name={dish.name} thumbnailUrl={dish.thumbnailUrl} imageUrl={dish.imageUrl} priority={index === 0}/><div className={styles.identity}><h3>{dish.name}</h3><p>{dish.category}</p></div><AdminStatusBadge tone={dish.available ? "available" : "unavailable"}>{dish.available ? "Disponible" : "Indisponible"}</AdminStatusBadge>
        {!dish.available && capability.kind === "available" ? <button className={styles.planButton} type="button" onClick={() => setSelectedDish(dish.id)}>Planifier</button> : null}
        <AdminDishAvailabilityControl key={`${dish.id}:${dish.available}`} dishId={dish.id} dishName={dish.name} initialAvailable={dish.available} onAvailabilityChange={(value) => setAvailability((state) => ({ source: dishes, overrides: { ...(state.source === dishes ? state.overrides : {}), [dish.id]: { base: dish.available, value } } }))} onFeedback={setFeedback}/>
      </article>)}</div>
      <p className="sr-only" aria-live="polite">{visible.length} résultat{visible.length > 1 ? "s" : ""} affiché{visible.length > 1 ? "s" : ""}.</p>{visible.length === 0 ? <p className={styles.empty} role="status">Aucun plat ne correspond à cette recherche.</p> : null}
    </div><aside className={styles.rail} aria-label="Opérations de disponibilité"><AvailabilityCapabilityNotice capability={capability}/><AvailabilityScheduleForm capability={capability} dishName={selected?.name}/><section className={styles.railCard}><h2>Retours planifiés</h2><p>{capability.kind === "available" ? "Aucun retour n’est planifié." : "Aucun retour exécutable n’est disponible."}</p></section><AvailabilityHistory /></aside></div>
    {feedback.message ? <AdminToast tone={feedback.tone === "error" ? "error" : "success"}>{feedback.message}</AdminToast> : null}
  </section>;
}
