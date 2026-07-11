import Link from "next/link";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminDashboardRange } from "@/lib/admin/dashboardRange";
import { AdminShell } from "../system/AdminShell";
import { AdminKpiCard, AdminPanel } from "../system/AdminPrimitives";
import { ExternalIcon, InsightsIcon, OverviewIcon } from "../system/AdminIcons";
import { AdminActivityChart } from "./AdminActivityChart";
import { AdminAvailabilityStrip } from "./AdminAvailabilityStrip";
import { AdminTopDishes } from "./AdminTopDishes";
import styles from "./AdminOverview.module.css";

const rangeLabel = (range: AdminDashboardRange) => range === "today-utc" ? "Aujourd’hui · UTC" : `${range === "7d" ? "7" : "30"} derniers jours · UTC`;

export function AdminOverview({ data, range }: { data: AdminDashboardData; range: AdminDashboardRange }) {
  const analytics = data.analytics;
  const panels = analytics.kind === "real" ? analytics.panels : null;
  const metric = (id: string) => analytics.kind === "real" ? analytics.metrics.find((item) => item.id === id)?.value : null;
  const names = new Map(data.menu.dishes.map((dish) => [dish.slug, dish.name]));
  const unavailable = { kind: analytics.kind === "unavailable" ? "unavailable" : "insufficient", reason: analytics.kind === "real" ? "no-evidence" : analytics.reason } as const;
  const categories = panels?.categories ?? unavailable;
  const totalCategories = categories.kind === "supported" ? categories.data.reduce((sum, item) => sum + item.count, 0) : 0;
  return <AdminShell restaurantName={data.restaurant.name} active="overview" actions={<><Link className={styles.headerAction} href={data.restaurant.publicMenuPath} prefetch={false}><ExternalIcon/>Ouvrir le menu</Link><Link className={styles.headerAction} href="/admin/insights"><InsightsIcon/>Voir les analyses</Link></>}>
    <div className={styles.period}>{rangeLabel(range)}<span>Fenêtre glissante, fuseau horaire non configuré</span></div>
    <section className={styles.kpis} aria-label="Indicateurs clés"><AdminKpiCard label="Ouvertures du menu" value={metric("menu-opens") ?? "—"} icon={<OverviewIcon/>}/><AdminKpiCard label="Consultations de plats" value={metric("dish-opens") ?? "—"} icon={<InsightsIcon/>}/><AdminKpiCard label="Plats disponibles" value={data.menu.readiness.counts.available} detail={`sur ${data.menu.readiness.counts.dishes}`} icon={<OverviewIcon/>}/><AdminKpiCard label="Catégories consultées" value={categories.kind === "supported" ? totalCategories : "—"} icon={<InsightsIcon/>}/><AdminKpiCard className={styles.kpiImmersive} label="Expériences 3D/AR" value={data.menu.readiness.counts.withImmersive} icon={<OverviewIcon/>}/></section>
    <div className={styles.overviewGrid}><AdminPanel className={styles.activity} title="Activité du menu" eyebrow={rangeLabel(range)} action={<Link href="/admin/insights">Détails</Link>}><AdminActivityChart evidence={panels?.currentDaily ?? unavailable}/></AdminPanel><AdminPanel className={styles.top} title="Plats les plus consultés" eyebrow="Classement"><AdminTopDishes evidence={panels?.ranking ?? unavailable} names={names}/></AdminPanel><AdminPanel className={styles.moment} title="Moments forts" eyebrow="Service · UTC">{panels?.serviceWindows?.kind === "supported" ? <p className={styles.bigStat}>{[...panels.serviceWindows.data.windows].sort((a,b) => b.count-a.count)[0]?.label}<strong>{[...panels.serviceWindows.data.windows].sort((a,b) => b.count-a.count)[0]?.count} événements</strong></p> : <p className={styles.muted}>Données de service insuffisantes.</p>}</AdminPanel><AdminPanel className={styles.category} title="Par catégorie" eyebrow="Consultations">{categories.kind === "supported" ? <ul className={styles.categoryBars}>{categories.data.slice(0,3).map((item) => <li key={item.slug}><span>{item.slug}</span><i style={{ "--value": `${totalCategories ? item.count / totalCategories * 100 : 0}%` } as React.CSSProperties}/><strong>{item.count}</strong></li>)}</ul> : <p className={styles.muted}>Données de catégorie insuffisantes.</p>}</AdminPanel><AdminPanel className={styles.availability} title="Disponibilité des plats" eyebrow="Carte en direct"><AdminAvailabilityStrip dishes={data.menu.dishes}/></AdminPanel></div>
  </AdminShell>;
}
