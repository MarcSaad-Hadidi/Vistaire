import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminDashboardRange } from "@/lib/admin/dashboardRange";
import { adminFreshnessCopy } from "@/lib/admin/analyticsPresentationCopy";
import { AvailableDishIcon, DishViewsIcon, ImmersiveIcon, MenuOpenIcon, SearchIcon } from "../system/AdminIcons";
import { AdminShell } from "../system/AdminShell";
import { AdminEvidenceState, AdminKpiCard, AdminPanel } from "../system/AdminPrimitives";
import { Sparkline } from "../charts/Sparkline";
import { AdminComparisonChart } from "./AdminComparisonChart";
import { AdminHeatmap } from "./AdminHeatmap";
import { AdminCategoryBreakdown, AdminRankedBreakdown, AdminSearchBreakdown, AdminServiceBreakdown } from "./AdminBreakdowns";
import { InsightsActivityChart } from "./InsightsActivityChart";
import styles from "./AdminInsights.module.css";

const number = new Intl.NumberFormat("fr-CA");
const day = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });
const moment = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const endDay = (value: string) => new Date(new Date(value).getTime() - 1);
const rangeLabel = (start: string, end: string) => `${day.format(new Date(start))} – ${day.format(endDay(end))}`;
const trendCopy = (rate: number | null) => rate === null ? "Sans base comparable" : `${rate >= 0 ? "↗" : "↘"} ${Math.abs(Math.round(rate * 100))} % vs période précédente`;

function Trend({ rate, values }: { rate: number | null; values: number[] }) {
  return <div className={styles.kpiTrendContent} data-kpi-trend data-tone={rate !== null && rate < 0 ? "down" : "up"}><span>{trendCopy(rate)}</span>{values.length > 1 ? <Sparkline values={values} label="Tendance quotidienne" interactive/> : null}</div>;
}

export function AdminInsightsPage({ data, range }: { data: AdminDashboardData; range: AdminDashboardRange }) {
  const analytics = data.analytics;
  const panels = analytics.kind === "real" ? analytics.panels : null;
  const fallback = { kind: analytics.kind === "unavailable" ? "unavailable" : "insufficient", reason: analytics.kind === "real" ? "no-evidence" : analytics.reason } as const;
  const metrics = analytics.kind === "real" ? new Map(analytics.metrics.map((metric) => [metric.id, metric])) : new Map();
  const dishes = new Map(data.menu.dishes.map((dish) => [dish.slug, dish]));
  const metric = (id: string) => metrics.get(id);
  const series = analytics.kind === "real" ? analytics.metricSeries : null;
  const eventIds = ["menu-opens", "dish-opens", "searches", "immersive"];
  const eventTotal = eventIds.reduce((sum, id) => sum + (metric(id)?.value ?? 0), 0);
  const coverage = analytics.kind === "real" ? [analytics.coverage.menuOpened, analytics.coverage.dishOpened].filter(Boolean).length : 0;
  const bestDish = panels?.ranking.kind === "supported" ? panels.ranking.data[0] : null;
  const bestService = panels?.serviceWindows.kind === "supported" ? [...panels.serviceWindows.data.windows].sort((a, b) => b.count - a.count)[0] : null;
  const insights: string[] = [];
  const menuRate = metric("menu-opens")?.changeRate ?? null;
  if (menuRate !== null) insights.push(`Les ouvertures du menu ont ${menuRate >= 0 ? "progressé" : "reculé"} de ${Math.abs(Math.round(menuRate * 100))} % par rapport à la période précédente.`);
  if (bestDish) insights.push(`${dishes.get(bestDish.slug)?.name ?? bestDish.label ?? "Plat du menu"} reste le plat le plus consulté avec ${number.format(bestDish.count)} consultations.`);
  if ((metric("immersive")?.value ?? 0) > 0) insights.push(`Les expériences 3D/AR ont généré ${number.format(metric("immersive")!.value)} interactions.`);
  if (bestService) insights.push(`${bestService.label} concentre le plus d’activité avec ${number.format(bestService.count)} interactions.`);
  if (analytics.kind === "real" && insights.length < 2) insights.push(`${number.format(data.menu.readiness.counts.available)} plats sur ${number.format(data.menu.readiness.counts.dishes)} sont actuellement disponibles.`);
  if (analytics.kind === "real" && insights.length < 2) insights.push(`${number.format(eventTotal)} interactions mesurées composent le résumé de cette période.`);

  const window = analytics.kind === "real" || analytics.kind === "insufficient" ? analytics.observationWindow : null;
  const headerDetails: ReactNode = window ? <div className={styles.rangeDetails}>
    <span className={styles.rangeControl}>{rangeLabel(window.startInclusive, window.endExclusive)}</span>
    <span>vs {rangeLabel(window.comparisonStartInclusive, window.comparisonEndExclusive)}</span>
  </div> : null;
  const headerStatus = <div className={styles.headerStatus}>
    <div><span>Dernière mise à jour</span><strong>{analytics.kind === "real" && analytics.lastUpdatedAt ? moment.format(new Date(analytics.lastUpdatedAt)) : "Non disponible"}</strong>{analytics.kind === "real" ? <em>{adminFreshnessCopy(analytics.freshness)}</em> : null}</div>
    <nav aria-label="Période analysée">{(["today-utc", "7d", "30d"] as AdminDashboardRange[]).map((option) => <Link key={option} href={`/admin/insights?range=${option}`} aria-current={range === option ? "page" : undefined}>{option === "today-utc" ? "24 h" : option === "7d" ? "7 j" : "30 j"}</Link>)}</nav>
  </div>;

  const kpi = (id: string, label: string, icon: ReactNode, definition: string, seriesId?: "menuOpened" | "dishOpened" | "searches" | "immersive") => {
    const item = metric(id);
    return <AdminKpiCard data-insights-kpi label={label} value={item ? number.format(item.value) : "—"} icon={icon} definition={definition} evidence={item ? undefined : fallback} trend={item && seriesId && series ? <Trend rate={item.changeRate} values={series[seriesId].current.map((point) => point.value)}/> : undefined}/>;
  };

  return <AdminShell restaurantName={data.restaurant.name} menuPath={data.restaurant.publicMenuPath} active="insights" headerDetails={headerDetails} headerStatus={headerStatus}>
    <Link className={styles.srBack} href="/admin">Retour au tableau de bord</Link>
    <section className={styles.kpis} data-insights-kpis aria-label="Indicateurs analytiques">
      {kpi("menu-opens", "Ouvertures du menu", <DishViewsIcon/>, "Nombre exact d’ouvertures du menu public.", "menuOpened")}
      {kpi("dish-opens", "Consultations de plats", <MenuOpenIcon/>, "Nombre exact de fiches de plats consultées.", "dishOpened")}
      {kpi("searches", "Recherches", <SearchIcon/>, "Nombre exact de recherches effectuées dans le menu.", "searches")}
      {kpi("immersive", "Interactions 3D/AR", <ImmersiveIcon/>, "Ouvertures exactes des expériences 3D et AR.", "immersive")}
      <AdminKpiCard data-insights-kpi label="Plats disponibles" value={`${data.menu.readiness.counts.available} / ${data.menu.readiness.counts.dishes}`} detail={`${Math.round(data.menu.readiness.counts.available / Math.max(1, data.menu.readiness.counts.dishes) * 100)} % du menu`} icon={<AvailableDishIcon/>} definition="Plats actuellement visibles comme disponibles dans le menu."/>
    </section>

    <div className={styles.primaryGrid}>
      <AdminPanel className={styles.activity} data-insights-panel>{series ? <InsightsActivityChart series={series}/> : <AdminEvidenceState kind={fallback.kind} reason={fallback.reason}/>}</AdminPanel>
      <AdminPanel className={styles.comparison} data-insights-panel>{<AdminComparisonChart evidence={panels?.dailyComparison ?? fallback}/>}</AdminPanel>
      <AdminPanel className={styles.heatmapPanel} data-insights-panel title="Moments d’activité" action={<p id="insights-utc-note" className={styles.utcNote}>Heures affichées en UTC</p>}><AdminHeatmap evidence={panels?.hourWeekday ?? fallback}/></AdminPanel>
    </div>
    <div className={styles.secondaryGrid}>
      <AdminPanel className={styles.dishes} data-insights-panel title="Top plats consultés"><AdminRankedBreakdown evidence={panels?.ranking ?? fallback} dishes={dishes}/></AdminPanel>
      <AdminPanel className={styles.searches} data-insights-panel title="Top recherches"><AdminSearchBreakdown evidence={panels?.searches ?? fallback}/></AdminPanel>
      <AdminPanel className={styles.categories} data-insights-panel><AdminCategoryBreakdown evidence={panels?.categories ?? fallback}/></AdminPanel>
      <AdminPanel className={styles.service} data-insights-panel><AdminServiceBreakdown evidence={panels?.serviceWindows ?? fallback}/></AdminPanel>
    </div>
    <div className={styles.bottomGrid}>
      <AdminPanel className={styles.summary} data-insights-panel data-insights-summary title="Résumé de la période">{analytics.kind === "real" ? <div className={styles.summaryMetrics}>{eventIds.map((id) => <span key={id}>{id === "menu-opens" ? "Ouvertures" : id === "dish-opens" ? "Consultations" : id === "searches" ? "Recherches" : "3D/AR"}<strong>{number.format(metric(id)!.value)}</strong></span>)}<span>Plats au menu<strong>{data.menu.readiness.counts.dishes}</strong></span><span>Fraîcheur<strong>{adminFreshnessCopy(analytics.freshness)}</strong></span><span>Couverture<strong>{coverage} / 2 mesures</strong></span><span>Comparaison<strong>{panels?.dailyComparison.kind === "supported" ? "Disponible" : "À venir"}</strong></span><span>Total suivi<strong>{number.format(eventTotal)}</strong></span></div> : <AdminEvidenceState kind={fallback.kind} reason={fallback.reason}/>}</AdminPanel>
      <AdminPanel className={styles.recommendations} data-insights-panel data-insights-key-insights title="Insights clés">{insights.length >= 2 ? <ul className={styles.insightsList}>{insights.slice(0, 4).map((insight) => <li key={insight}>{insight}</li>)}</ul> : <AdminEvidenceState kind={fallback.kind} reason={fallback.reason}/>}</AdminPanel>
    </div>
  </AdminShell>;
}
