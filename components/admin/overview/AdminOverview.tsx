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
import styles from "./AdminOverview.module.css";

export function AdminOverview({data,range}:{data:AdminDashboardData;range:AdminDashboardRange}){
 const analytics=data.analytics,panels=analytics.kind==="real"?analytics.panels:null,metric=(id:string)=>analytics.kind==="real"?analytics.metrics.find(item=>item.id===id)?.value:null;
 const fallback={kind:analytics.kind==="unavailable"?"unavailable":"insufficient",reason:analytics.kind==="real"?"no-evidence":analytics.reason} as const;
 const dishMap=new Map(data.menu.dishes.map(d=>[d.slug,{name:d.name,image:d.thumbnailUrl||d.imageUrl}]));
 const series=analytics.kind==="real"?analytics.metricSeries:null,categories=panels?.categories,services=panels?.serviceWindows;
 return <AdminShell restaurantName={data.restaurant.name} menuPath={data.restaurant.publicMenuPath} active="overview"><div className={styles.period}>{range==="today-utc"?"Aujourd’hui":range==="7d"?"7 derniers jours":"30 derniers jours"}<span>Heures affichées en UTC</span></div><section className={styles.kpis} aria-label="Indicateurs clés"><AdminKpiCard label="Ouvertures du menu" value={metric("menu-opens")??"—"} icon={<MenuOpenIcon/>}/><AdminKpiCard label="Consultations de plats" value={metric("dish-opens")??"—"} icon={<DishViewsIcon/>}/><AdminKpiCard label="Recherches" value={metric("searches")??"—"} icon={<SearchIcon/>}/><AdminKpiCard className={styles.kpiImmersive} label="Interactions 3D/AR" value={metric("immersive")??"—"} icon={<ImmersiveIcon/>}/><AdminKpiCard label="Plats disponibles" value={data.menu.readiness.counts.available} detail={`sur ${data.menu.readiness.counts.dishes}`} icon={<AvailableDishIcon/>}/></section><div className={styles.overviewGrid}>
 <AdminPanel className={styles.activity} title="Activité du menu" action={<Link className={styles.insightsCta} href="/admin/insights">Voir les statistiques détaillées</Link>}>{series?<AdminMetricLineChart series={series} period={range}/>:<AdminEvidenceState kind={fallback.kind} reason={fallback.reason}/>}</AdminPanel>
 <AdminPanel className={styles.top} title="Top plats consultés"><AdminTopDishes evidence={panels?.ranking??fallback} dishes={dishMap}/></AdminPanel>
 <AdminPanel className={styles.moment} title="Activité par moment" eyebrow="Heures affichées en UTC">{services?.kind==="supported"?<InteractiveDonut data={services.data.windows.map(x=>({label:x.label,value:x.count}))} title="Activité par moment" description="Répartition sur les cinq moments de service" period={range} unit="interactions" summary="Toutes les périodes de service sont affichées."/>:<AdminEvidenceState kind={(services??fallback).kind as "insufficient"|"unavailable"} reason={(services??fallback).reason}/>}</AdminPanel>
 <AdminPanel className={styles.category} title="Activité par catégorie">{categories?.kind==="supported"?<ul className={styles.categoryBars}>{categories.data.map(x=><li key={x.slug}><span>{x.label??x.slug}</span><i style={{"--value":`${x.count/Math.max(...categories.data.map(c=>c.count),1)*100}%`} as React.CSSProperties}/><strong>{x.count}</strong></li>)}</ul>:<AdminEvidenceState kind={(categories??fallback).kind as "insufficient"|"unavailable"} reason={(categories??fallback).reason}/>}</AdminPanel>
 <AdminPanel className={styles.availability} title="Disponibilité des plats"><AdminAvailabilityStrip dishes={data.menu.dishes}/></AdminPanel></div></AdminShell>;
}
