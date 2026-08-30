"use client";

import { useMemo, useState } from "react";
import { AdminDishThumbnail } from "@/components/admin/AdminDishThumbnail";
import { AdminDishAvailabilityControl } from "@/components/admin/AdminDishAvailabilityControl";
import { AlertIcon, CheckIcon, EventIcon, MenuOpenIcon, MoreIcon, PeriodIcon, SearchIcon } from "@/components/admin/system/AdminIcons";
import { AdminStatusBadge, AdminToast } from "@/components/admin/system/AdminPrimitives";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import type { AvailabilityOperationsState, AvailabilitySchedulingCapability } from "@/lib/admin/availability/contracts";
import { AvailabilityCapabilityNotice } from "./AvailabilityCapabilityNotice";
import { AvailabilityHistory } from "./AvailabilityHistory";
import { AvailabilityScheduleForm } from "./AvailabilityScheduleForm";
import { AvailabilityScheduleList } from "./AvailabilityScheduleList";
import { resolveAvailabilityForSource, type AvailabilityFeedback, type AvailabilityOverride } from "./availabilityMutation";
import styles from "./AdminAvailability.module.css";

type Filter = "all" | "available" | "unavailable" | "scheduled";
type AvailabilityState = { source: AdminMenuDish[]; overrides: Record<string, AvailabilityOverride> };
const PAGE_SIZE = 6;
const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "available", label: "Disponibles" },
  { id: "unavailable", label: "Indisponibles" },
  { id: "scheduled", label: "Planifiés" }
];

export function AdminAvailabilityList({ dishes, capability, canWrite, operations, timezone }: { dishes: AdminMenuDish[]; capability: AvailabilitySchedulingCapability; canWrite: boolean; operations: AvailabilityOperationsState; timezone: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedDish, setSelectedDish] = useState<string | undefined>();
  const [bulkPending, setBulkPending] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityState>(() => ({ source: dishes, overrides: {} }));
  const [feedback, setFeedback] = useState<AvailabilityFeedback>({ tone: null, message: null });
  const current = useMemo(() => dishes.map((dish) => ({ ...dish, available: resolveAvailabilityForSource(dish.available, dishes, availability.source, availability.overrides[dish.id]) })), [availability, dishes]);
  const available = current.filter((dish) => dish.available).length;
  const scheduledByDish = operations.kind === "available" ? new Map(operations.schedules.filter((item) => item.status === "pending").map((item) => [item.dishId, item])) : new Map();
  const failedSchedules = operations.kind === "available" ? operations.schedules.filter((item) => item.status === "failed") : [];
  const scheduledCount = current.filter((dish) => scheduledByDish.has(dish.id)).length;
  const filterCount: Record<Filter, number> = { all: current.length, available, unavailable: current.length - available, scheduled: scheduledCount };
  const categories = Array.from(new Set(current.map((dish) => dish.category))).sort((left, right) => left.localeCompare(right, "fr"));
  const visible = current.filter((dish) => {
    const matchesStatus = filter === "all" || (filter === "available" ? dish.available : filter === "unavailable" ? !dish.available : scheduledByDish.has(dish.id));
    return matchesStatus && (category === "all" || dish.category === category) && `${dish.name} ${dish.category}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"));
  });
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount - 1);
  const pageDishes = visible.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const selected = current.find((dish) => dish.id === selectedDish);
  const recentChanges = operations.kind === "available" ? operations.history.length : null;
  const plannedReturns = operations.kind === "available" ? operations.schedules.filter((item) => item.status === "pending").length : null;
  const latestChange = operations.kind === "available" ? operations.history[0]?.createdAt : undefined;
  const formatPercent = (count: number) => new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 }).format(count / Math.max(1, current.length) * 100);
  const formatSchedule = (value: string) => { try { return new Intl.DateTimeFormat("fr-CA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value)); } catch { return "Échéance invalide"; } };
  const formatLatestChange = () => { if (!latestChange) return recentChanges === null ? "registre indisponible" : "aucune modification"; try { return `dernière modif. ${new Intl.DateTimeFormat("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(latestChange))}`; } catch { return "dernière modification enregistrée"; } };
  const historyByDish = new Map();
  if (operations.kind === "available") {
    for (const item of operations.history) {
      if (!historyByDish.has(item.dishId)) historyByDish.set(item.dishId, item);
    }
  }

  async function applyBulk(nextAvailable: boolean) {
    if (!canWrite || bulkPending) return;
    const targets = current.filter((dish) => dish.available !== nextAvailable);
    if (!targets.length) {
      setFeedback({ tone: "success", message: nextAvailable ? "Tous les plats affichés sont déjà disponibles." : "Tous les plats affichés sont déjà indisponibles." });
      return;
    }
    setBulkPending(true);
    setFeedback({ tone: null, message: null });
    try {
      for (const dish of targets) {
        const response = await fetch(`/admin/api/dishes/${encodeURIComponent(dish.id)}/availability`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ available: nextAvailable })
        });
        const result = await response.json() as { ok?: boolean; error?: string };
        if (!response.ok || !result.ok) {
          setFeedback({ tone: "error", message: result.error ?? "La mise à jour groupée a échoué." });
          return;
        }
        setAvailability((state) => ({
          source: dishes,
          overrides: { ...(state.source === dishes ? state.overrides : {}), [dish.id]: { base: dish.available, value: nextAvailable } }
        }));
      }
      setFeedback({ tone: "success", message: nextAvailable ? "Les plats ciblés sont disponibles." : "Les plats ciblés sont indisponibles." });
    } catch {
      setFeedback({ tone: "error", message: "La mise à jour groupée a échoué." });
    } finally {
      setBulkPending(false);
    }
  }

  return <section className={styles.page} aria-labelledby="availability-title">
    <h2 id="availability-title" className="sr-only">Disponibilités — Gestion opérationnelle</h2>
    <div className={styles.metrics} aria-label="État du catalogue">
      <article><i aria-hidden="true"><MenuOpenIcon/></i><div><span>Total plats</span><strong>{current.length}</strong><small>dans le menu</small></div></article>
      <article><i aria-hidden="true" data-tone="available"><CheckIcon/></i><div><span>Disponibles</span><strong>{available}</strong><small>{formatPercent(available)} %</small></div></article>
      <article><i aria-hidden="true" data-tone="unavailable"><AlertIcon/></i><div><span>Indisponibles</span><strong>{current.length - available}</strong><small>{formatPercent(current.length - available)} %</small></div></article>
      <article><i aria-hidden="true"><EventIcon/></i><div><span>Modifiés aujourd’hui</span><strong>{recentChanges ?? "—"}</strong><small>{formatLatestChange()}</small></div></article>
      <article><i aria-hidden="true"><PeriodIcon/></i><div><span>Retours planifiés</span><strong>{plannedReturns ?? "—"}</strong><small>{plannedReturns === null ? "registre indisponible" : "à venir"}</small></div></article>
    </div>
    <div className={styles.workspace}><div className={styles.catalogue}>
      <div className={styles.controls}>
        <label className={styles.search}><span className="sr-only">Rechercher un plat</span><SearchIcon aria-hidden="true"/><input type="search" placeholder="Rechercher un plat…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }}/></label>
        <label className={styles.categoryFilter}><span className="sr-only">Filtrer par service</span><select disabled title="Aucune preuve ventilée par service"><option>Tous les services</option></select></label>
        <label className={styles.categoryFilter}><span className="sr-only">Filtrer par catégorie</span><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(0); }}><option value="all">Toutes les catégories</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <div className={styles.filters} aria-label="Filtrer les plats">{filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setPage(0); }}><span>{item.label}</span><small aria-hidden="true">{filterCount[item.id]}</small></button>)}</div>
      </div>
      <div className={styles.tableHeader} aria-hidden="true"><span>Plat</span><span>Catégorie</span><span>Statut actuel</span><span>Retour planifié</span><span>Raison</span><span>Disponibilité</span></div>
      <div className={styles.list}>{pageDishes.map((dish, index) => { const scheduled = scheduledByDish.get(dish.id); const history = historyByDish.get(dish.id); const expanded = selectedDish === dish.id; return <div className={styles.rowGroup} key={dish.id}>
        <article className={styles.row} data-admin-menu-dish data-dish-id={dish.id} data-category-id={dish.categorySlug ?? dish.category} data-available={dish.available} data-expanded={expanded || undefined}>
        <span className={styles.rowHandle} aria-hidden="true"><MoreIcon/></span><AdminDishThumbnail name={dish.name} thumbnailUrl={dish.thumbnailUrl} imageUrl={dish.imageUrl} priority={index === 0}/><div className={styles.identity}><h3>{dish.name}</h3><p>{dish.description || "Description non renseignée"}</p></div><span className={styles.categoryCell}>{dish.category}</span><div className={styles.statusCell}><AdminStatusBadge tone={dish.available ? "available" : "unavailable"}>{dish.available ? "Disponible" : "Indisponible"}</AdminStatusBadge></div>
        <div className={styles.returnCell} data-visible={Boolean(scheduled || (!dish.available && canWrite && capability.kind === "available"))}>{scheduled ? <time dateTime={scheduled.scheduledFor}>{formatSchedule(scheduled.scheduledFor)}</time> : !dish.available && canWrite && capability.kind === "available" ? <button className={styles.planButton} type="button" onClick={() => setSelectedDish(expanded ? undefined : dish.id)}>{expanded ? "Fermer" : "Planifier"}</button> : <span>—</span>}</div>
        <span className={styles.reasonCell}>{history && !dish.available ? (history.actorKind === "schedule_worker" ? "Retour planifié appliqué" : "Mise à jour restaurant") : "—"}</span>
        <AdminDishAvailabilityControl key={`${dish.id}:${dish.available}`} dishId={dish.id} dishName={dish.name} initialAvailable={dish.available} canWrite={canWrite} onAvailabilityChange={(value) => setAvailability((state) => ({ source: dishes, overrides: { ...(state.source === dishes ? state.overrides : {}), [dish.id]: { base: dish.available, value } } }))} onFeedback={setFeedback}/>
      </article>
      {expanded && canWrite && capability.kind === "available" ? <div className={styles.expandedPanel}><AvailabilityScheduleForm capability={capability} dishId={dish.id} dishName={dish.name}/></div> : null}
      </div>; })}</div>
      <footer className={styles.listFooter}><span>{visible.length ? `Affichage de ${activePage * PAGE_SIZE + 1} à ${Math.min((activePage + 1) * PAGE_SIZE, visible.length)} sur ${visible.length} plat${visible.length > 1 ? "s" : ""}` : "Aucun plat affiché"}</span>{visible.length > PAGE_SIZE ? <nav className={styles.pagination} aria-label="Pagination du catalogue"><button type="button" aria-label="Page précédente" disabled={activePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>‹</button>{Array.from({ length: pageCount }, (_, index) => <button type="button" aria-current={activePage === index ? "page" : undefined} aria-label={`Page ${index + 1}`} key={index} onClick={() => setPage(index)}>{index + 1}</button>)}<button type="button" aria-label="Page suivante" disabled={activePage === pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>›</button></nav> : null}</footer>
      <p className="sr-only" aria-live="polite">{visible.length} résultat{visible.length > 1 ? "s" : ""} affiché{visible.length > 1 ? "s" : ""}.</p>{visible.length === 0 ? <p className={styles.empty} role="status">Aucun plat ne correspond à cette recherche.</p> : null}
    </div><aside className={styles.rail} aria-label="Opérations de disponibilité">
      <section className={styles.railCard} aria-labelledby="bulk-actions-title">
        <h2 id="bulk-actions-title">Actions groupées</h2>
        <p>{canWrite ? "Les actions s’appliquent plat par plat via le même contrat d’écriture." : "Ces actions restent visibles, mais elles restent inactives sans droit d’écriture."}</p>
        <div className={styles.bulkActions}>
          <button type="button" disabled={!canWrite || bulkPending} onClick={() => applyBulk(true)}>Tout rendre disponible</button>
          <button type="button" disabled={!canWrite || bulkPending} onClick={() => applyBulk(false)}>Tout rendre indisponible</button>
          <button type="button" disabled={!canWrite || capability.kind !== "available"} onClick={() => {
            const target = current.find((dish) => !dish.available);
            if (target) setSelectedDish(target.id);
            else setFeedback({ tone: "success", message: "Aucun plat indisponible à planifier." });
          }}>Programmer les retours</button>
        </div>
      </section>
      <AvailabilityCapabilityNotice capability={capability}/>
      {canWrite && capability.kind === "available" && selected && selectedDish && !pageDishes.some((dish) => dish.id === selected.id) ? <AvailabilityScheduleForm capability={capability} dishId={selected.id} dishName={selected.name}/> : null}
      <AvailabilityScheduleList operations={operations} dishes={dishes} canWrite={canWrite && capability.kind === "available"} timezone={timezone}/>
      <AvailabilityHistory operations={operations} dishes={dishes} timezone={timezone}/>
      <section className={styles.railCard} data-tone="alert" aria-labelledby="availability-alerts-title">
        <h2 id="availability-alerts-title">Alertes disponibilité</h2>
        {current.length - available === 0 && failedSchedules.length === 0 ? <p>Aucune alerte mesurée sur le catalogue actuel.</p> : <ol>
          {current.length - available > 0 ? <li><strong>Indisponibilités actives</strong><span>{current.length - available} plat{(current.length - available) > 1 ? "s" : ""} actuellement masqué{(current.length - available) > 1 ? "s" : ""}.</span></li> : null}
          {failedSchedules.length > 0 ? <li><strong>Retours en échec</strong><span>{failedSchedules.length} planification{(failedSchedules.length) > 1 ? "s" : ""} n’a pas pu être appliquée.</span></li> : null}
        </ol>}
      </section>
    </aside></div>
    {feedback.message ? <AdminToast tone={feedback.tone === "error" ? "error" : "success"}>{feedback.message}</AdminToast> : null}
  </section>;
}
