import Link from "next/link";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminDashboardRange } from "@/lib/admin/dashboardRange";
import { InteractiveDonut } from "../charts/InteractiveDonut";
import { AvailableDishIcon, DishViewsIcon, ImmersiveIcon, MenuOpenIcon, SearchIcon } from "../system/AdminIcons";
import { AdminShell } from "../system/AdminShell";
import { AdminEvidenceState, AdminKpiCard, AdminPanel } from "../system/AdminPrimitives";
import { AdminAvailabilityStrip } from "./AdminAvailabilityStrip";
import { AdminTopDishes } from "./AdminTopDishes";
import { AdminMetricLineChart } from "./AdminMetricLineChart";
import { buildServicePreview } from "./servicePreview";
import styles from "./AdminOverview.module.css";

const number = new Intl.NumberFormat("fr-CA");

export function AdminOverview({ data, range }: { data: AdminDashboardData; range: AdminDashboardRange }) {
  const analytics = data.analytics;
  const panels = analytics.kind === "real" ? analytics.panels : null;
  const metric = (id: string) => analytics.kind === "real" ? analytics.metrics.find((item) => item.id === id) : null;
  const fallback = { kind: analytics.kind === "unavailable" ? "unavailable" : "insufficient", reason: analytics.kind === "real" ? "no-evidence" : analytics.reason } as const;
  const dishMap = new Map(data.menu.dishes.map((dish) => [dish.slug, { name: dish.name, image: dish.thumbnailUrl || dish.imageUrl }]));
  const series = analytics.kind === "real" ? analytics.metricSeries : null;
  const categories = panels?.categories;
  const services = panels?.serviceWindows;
  const servicePreview = services?.kind === "supported" ? buildServicePreview(services.data.windows) : null;
  const serviceFallback = services?.kind === "supported" ? fallback : services ?? fallback;
  const change = (id: string) => {
    const rate = metric(id)?.changeRate;
    return rate === null || rate === undefined ? "Sans base comparable" : `${rate >= 0 ? "↗" : "↘"} ${Math.abs(Math.round(rate * 100))} % vs période précédente`;
  };
  const periodLabel = range === "today-utc" ? "Aujourd’hui" : range === "7d" ? "7 derniers jours" : "30 derniers jours";
  const headerStatus = <div className={styles.period}><span>Période analysée</span><strong>{periodLabel}</strong><em>Heures affichées en UTC</em></div>;

  return <AdminShell restaurantName={data.restaurant.name} menuPath={data.restaurant.publicMenuPath} active="overview" headerStatus={headerStatus}>
    <section className={styles.kpis} aria-label="Indicateurs clés">
      <AdminKpiCard label="Ouvertures du menu" value={metric("menu-opens") ? number.format(metric("menu-opens")!.value) : "—"} detail={change("menu-opens")} icon={<MenuOpenIcon/>}/>
      <AdminKpiCard label="Consultations de plats" value={metric("dish-opens") ? number.format(metric("dish-opens")!.value) : "—"} detail={change("dish-opens")} icon={<DishViewsIcon/>}/>
      <AdminKpiCard label="Recherches" value={metric("searches") ? number.format(metric("searches")!.value) : "—"} detail={change("searches")} icon={<SearchIcon/>}/>
      <AdminKpiCard className={styles.kpiImmersive} label="Interactions 3D/AR" value={metric("immersive") ? number.format(metric("immersive")!.value) : "—"} detail={change("immersive")} icon={<ImmersiveIcon/>}/>
      <AdminKpiCard label="Plats disponibles" value={`${data.menu.readiness.counts.available} / ${data.menu.readiness.counts.dishes}`} detail={`${Math.round(data.menu.readiness.counts.available / Math.max(1, data.menu.readiness.counts.dishes) * 100)} % du menu`} icon={<AvailableDishIcon/>}/>
    </section>
    <div className={styles.overviewGrid}>
      <AdminPanel className={styles.activity} title="Activité du menu" action={<Link className={styles.insightsCta} href="/admin/insights">Voir les statistiques détaillées</Link>}>{series ? <AdminMetricLineChart series={series} period={range}/> : <AdminEvidenceState kind={fallback.kind} reason={fallback.reason}/>}</AdminPanel>
      <AdminPanel className={styles.top} title="Top plats consultés"><AdminTopDishes evidence={panels?.ranking ?? fallback} dishes={dishMap}/></AdminPanel>
      <AdminPanel className={styles.moment} title="Activité par moment" eyebrow="Heures affichées en UTC">{servicePreview ? <InteractiveDonut data={servicePreview} title="Activité par moment" description="Répartition sur les trois moments de service" period={range} unit="interactions" summary="Déjeuner, après-midi et dîner couvrent toutes les interactions de la période."/> : <AdminEvidenceState kind={serviceFallback.kind} reason={serviceFallback.reason}/>}</AdminPanel>
      <AdminPanel className={styles.category} title="Activité par catégorie">{categories?.kind === "supported" ? <ul className={styles.categoryBars}>{categories.data.slice(0, 4).map((item) => <li key={item.slug}><span>{item.label ?? "Catégorie du menu"}</span><i style={{ "--value": `${item.count / Math.max(...categories.data.map((candidate) => candidate.count), 1) * 100}%` } as React.CSSProperties}/><strong>{item.count}</strong></li>)}</ul> : <AdminEvidenceState kind={(categories ?? fallback).kind as "insufficient" | "unavailable"} reason={(categories ?? fallback).reason}/>}</AdminPanel>
      <AdminPanel className={styles.availability} title="Disponibilité des plats" action={<Link className={styles.stripLink} href="/admin/availability">Gérer les disponibilités</Link>}><AdminAvailabilityStrip dishes={data.menu.dishes}/></AdminPanel>
    </div>
  </AdminShell>;
}
