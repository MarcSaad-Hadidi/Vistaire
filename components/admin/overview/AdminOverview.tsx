import Link from "next/link";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminDashboardRange } from "@/lib/admin/dashboardRange";
import { AdminShell } from "../system/AdminShell";
import { AdminEvidenceState, AdminKpiCard, AdminPanel } from "../system/AdminPrimitives";
import { InsightsIcon, OverviewIcon } from "../system/AdminIcons";
import { AdminActivityChart } from "./AdminActivityChart";
import { AdminAvailabilityStrip } from "./AdminAvailabilityStrip";
import { AdminTopDishes } from "./AdminTopDishes";
import styles from "./AdminOverview.module.css";

const rangeLabel = (range: AdminDashboardRange) => range === "today-utc" ? "Aujourd’hui · UTC" : `${range === "7d" ? "7" : "30"} derniers jours · UTC`;

export function AdminOverview({ data, range }: { data: AdminDashboardData; range: AdminDashboardRange }) {
  const analytics = data.analytics;
  const panels = analytics.kind === "real" ? analytics.panels : null;
  const metric = (id: string) => analytics.kind === "real" ? analytics.metrics.find((item) => item.id === id)?.value : null;
  const rankedDishes = new Map(data.menu.dishes.map((dish) => [dish.slug, { name: dish.name, image: dish.thumbnailUrl || dish.imageUrl }]));
  const unavailable = { kind: analytics.kind === "unavailable" ? "unavailable" : "insufficient", reason: analytics.kind === "real" ? "no-evidence" : analytics.reason } as const;
  const categories = panels?.categories ?? unavailable;
  const totalCategories = categories.kind === "supported" ? categories.data.reduce((sum, item) => sum + item.count, 0) : 0;
  const totalSearches = panels?.searches.kind === "supported" ? panels.searches.data.reduce((sum, item) => sum + item.count, 0) : null;
  const serviceWindows = panels?.serviceWindows.kind === "supported" ? panels.serviceWindows.data.windows : null;
  const serviceEvidence = panels?.serviceWindows ?? unavailable;
  const serviceTotal = serviceWindows?.reduce((sum, item) => sum + item.count, 0) ?? 0;
  return <AdminShell restaurantName={data.restaurant.name} menuPath={data.restaurant.publicMenuPath} active="overview">
    <div className={styles.period}>{rangeLabel(range)}<span>Fenêtre glissante, fuseau horaire non configuré</span></div>
    <section className={styles.kpis} aria-label="Indicateurs clés"><AdminKpiCard label="Ouvertures du menu" value={metric("menu-opens") ?? "—"} icon={<OverviewIcon/>}/><AdminKpiCard label="Consultations de plats" value={metric("dish-opens") ?? "—"} icon={<InsightsIcon/>}/><AdminKpiCard label="Recherches" value={totalSearches ?? "—"} icon={<InsightsIcon/>}/><AdminKpiCard className={styles.kpiImmersive} label="Interactions 3D/AR" value={data.menu.readiness.counts.withImmersive} icon={<OverviewIcon/>}/><AdminKpiCard label="Plats disponibles" value={data.menu.readiness.counts.available} detail={`sur ${data.menu.readiness.counts.dishes}`} icon={<OverviewIcon/>}/></section>
    <div className={styles.overviewGrid}>
      <AdminPanel className={styles.activity} title="Activité du menu" action={<Link href="/admin/insights">Détails</Link>}><AdminActivityChart evidence={panels?.currentDaily ?? unavailable}/></AdminPanel>
      <AdminPanel className={styles.top} title="Plats les plus consultés"><AdminTopDishes evidence={panels?.ranking ?? unavailable} dishes={rankedDishes}/></AdminPanel>
      <AdminPanel className={styles.moment} title="Activité par moment">{serviceWindows ? <div className={styles.serviceDonut}><i aria-hidden="true"/><ul>{serviceWindows.slice(0,3).map((item)=><li key={item.id}><span>{item.label}</span><strong>{serviceTotal?Math.round(item.count/serviceTotal*100):0} %</strong></li>)}</ul></div> : <AdminEvidenceState kind={serviceEvidence.kind as "insufficient" | "unavailable"} reason={serviceEvidence.kind === "supported" ? "no-evidence" : serviceEvidence.reason}/>}</AdminPanel>
      <AdminPanel className={styles.category} title="Activité par catégorie">{categories.kind === "supported" ? <ul className={styles.categoryBars}>{categories.data.slice(0,4).map((item) => <li key={item.slug}><span>{item.slug}</span><i style={{ "--value": `${totalCategories ? item.count / totalCategories * 100 : 0}%` } as React.CSSProperties}/><strong>{item.count}</strong></li>)}</ul> : <AdminEvidenceState kind={categories.kind} reason={categories.reason}/>}</AdminPanel>
      <AdminPanel className={styles.availability} title="Disponibilité des plats"><AdminAvailabilityStrip dishes={data.menu.dishes}/></AdminPanel>
    </div>
  </AdminShell>;
}
