import Link from "next/link";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminDashboardRange } from "@/lib/admin/dashboardRange";
import { AdminShell } from "../system/AdminShell";
import { AdminKpiCard, AdminPanel, AdminEvidenceState } from "../system/AdminPrimitives";
import { ExternalIcon, InsightsIcon, OverviewIcon } from "../system/AdminIcons";
import { AdminActivityChart } from "../overview/AdminActivityChart";
import { AdminComparisonChart } from "./AdminComparisonChart";
import { AdminHeatmap } from "./AdminHeatmap";
import { AdminRankedBreakdown, AdminSearchBreakdown, AdminServiceBreakdown } from "./AdminBreakdowns";
import styles from "./AdminInsights.module.css";

const rangeLabel = (range: AdminDashboardRange) => range === "today-utc" ? "Aujourd’hui · UTC" : `${range === "7d" ? "7 jours" : "30 jours"} · UTC`;

export function AdminInsightsPage({ data, range }: { data: AdminDashboardData; range: AdminDashboardRange }) {
  const analytics = data.analytics;
  const panels = analytics.kind === "real" ? analytics.panels : null;
  const fallback = { kind: analytics.kind === "unavailable" ? "unavailable" : "insufficient", reason: analytics.kind === "real" ? "no-evidence" : analytics.reason } as const;
  const names = new Map(data.menu.dishes.map((dish) => [dish.slug, dish.name]));
  const metric = (id: string) => analytics.kind === "real" ? analytics.metrics.find((item) => item.id === id)?.value : null;
  const total = analytics.kind === "real" ? analytics.activitySeries.reduce((sum, point) => sum + point.count, 0) : null;
  return <AdminShell restaurantName={data.restaurant.name} active="insights" actions={<><Link className={styles.action} href={data.restaurant.publicMenuPath} prefetch={false}><ExternalIcon/>Ouvrir le menu</Link><Link className={styles.action} href="/admin"><OverviewIcon/>Vue d’ensemble</Link></>}>
    <header className={styles.insightsHeader}><div><Link href="/admin">← Retour au tableau de bord</Link><h2>Analyses détaillées</h2></div><nav aria-label="Période analysée">{(["today-utc","7d","30d"] as AdminDashboardRange[]).map((item) => <Link key={item} href={`/admin/insights?range=${item}`} aria-current={range === item ? "page" : undefined}>{item === "today-utc" ? "24 h" : item}</Link>)}</nav></header>
    <section className={styles.kpis} aria-label="Indicateurs analytiques"><AdminKpiCard label="Ouvertures du menu" value={metric("menu-opens") ?? "—"} icon={<OverviewIcon/>}/><AdminKpiCard label="Consultations de plats" value={metric("dish-opens") ?? "—"} icon={<InsightsIcon/>}/><AdminKpiCard label="Événements observés" value={total ?? "—"} icon={<InsightsIcon/>}/><AdminKpiCard label="Plats disponibles" value={data.menu.readiness.counts.available} icon={<OverviewIcon/>}/><AdminKpiCard label="Période" value={rangeLabel(range)} icon={<InsightsIcon/>}/></section>
    <div className={styles.grid}><AdminPanel className={styles.activity} title="Activité" eyebrow="Évolution"><AdminActivityChart evidence={panels?.currentDaily ?? fallback}/></AdminPanel><AdminPanel className={styles.comparison} title="Comparaison" eyebrow="Période précédente"><AdminComparisonChart evidence={panels?.dailyComparison ?? fallback}/></AdminPanel><AdminPanel className={styles.heatmap} title="Heures actives" eyebrow="UTC"><AdminHeatmap evidence={panels?.hourWeekday ?? fallback}/></AdminPanel><AdminPanel className={styles.dishes} title="Plats favoris" eyebrow="Consultations"><AdminRankedBreakdown evidence={panels?.ranking ?? fallback} names={names} label="Classement exact des plats"/></AdminPanel><AdminPanel className={styles.searches} title="Recherches" eyebrow="Termes"><AdminSearchBreakdown evidence={panels?.searches ?? fallback}/></AdminPanel><AdminPanel className={styles.categories} title="Catégories" eyebrow="Consultations"><AdminRankedBreakdown evidence={panels?.categories ?? fallback} label="Répartition exacte par catégorie"/></AdminPanel><AdminPanel className={styles.service} title="Moments de service" eyebrow="UTC"><AdminServiceBreakdown evidence={panels?.serviceWindows ?? fallback}/></AdminPanel></div><div className={styles.bottomGrid}><AdminPanel className={styles.summary} title="Synthèse de la période" eyebrow={rangeLabel(range)}>{analytics.kind === "real" ? <p className={styles.summaryCopy}>{total} événements anonymisés observés. Les valeurs affichées proviennent uniquement de la période sélectionnée.</p> : <AdminEvidenceState kind={fallback.kind} reason={fallback.reason}/>}</AdminPanel><AdminPanel className={styles.recommendations} title="À retenir" eyebrow="Lecture">{panels?.ranking.kind === "supported" ? <p className={styles.summaryCopy}>{names.get(panels.ranking.data[0]?.slug ?? "") ?? panels.ranking.data[0]?.slug} concentre le plus de consultations.</p> : <AdminEvidenceState kind={(panels?.ranking ?? fallback).kind as "insufficient" | "unavailable"} reason={(panels?.ranking ?? fallback).reason}/>}</AdminPanel></div>
  </AdminShell>;
}
