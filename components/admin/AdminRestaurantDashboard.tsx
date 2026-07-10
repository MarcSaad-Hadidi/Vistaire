import { AdminDishWorklist } from "./AdminDishWorklist";
import { AdminMenuActions } from "./AdminMenuActions";
import styles from "./AdminDashboard.module.css";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";

type Range = "today-utc" | "7d" | "30d";
type CompatData = AdminDashboardData & { restaurant: AdminDashboardData["restaurant"] & { location?: string|null; cuisineType?: string|null; timezone?: null; publicMenuPath?: string }; menu?: { dishes: AdminDashboardData["dishes"]; readiness: AdminDashboardData["readiness"] } };
const rangeLabel = (range: Range) => range === "today-utc" ? "Aujourd’hui — UTC" : `Fenêtre glissante ${range === "7d" ? "7 jours" : "30 jours"} — UTC`;

export function AdminRestaurantDashboard({ data, range }: { data: AdminDashboardData; range: Range }) {
  const view = data as CompatData;
  const dishes = view.menu?.dishes ?? view.dishes;
  const readiness = view.menu?.readiness ?? view.readiness;
  const menuPath = view.restaurant.publicMenuPath ?? view.restaurant.menuPath;
  const analytics = view.analytics as { kind: string; title?: string; message?: string };
  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Dashboard restaurant</p><h1>{view.restaurant.name}</h1><p className={styles.muted}>{[view.restaurant.location, view.restaurant.cuisineType].filter(Boolean).join(" · ") || "Gestion de la carte client"}</p></div>
      {menuPath ? <AdminMenuActions menuPath={menuPath}/> : null}
      <nav aria-label="Sections du dashboard"><a href="#overview">Vue d’ensemble</a><a href="#dishes">Disponibilité des plats</a></nav>
    </header>
    <section className={styles.context} aria-label="Contexte des données"><div><strong>{rangeLabel(range)}</strong><span>Source : activité anonyme de production</span></div><p>Le fuseau horaire du restaurant n’est pas configuré. Les périodes sont affichées en UTC.</p><div className={styles.ranges}>{(["today-utc","7d","30d"] as Range[]).map(item=><a aria-current={item===range?"page":undefined} href={`?range=${item}`} key={item}>{item==="today-utc"?"Aujourd’hui":item}</a>)}</div></section>
    <section id="overview" className={styles.section} aria-labelledby="overview-title"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>État de la carte</p><h2 id="overview-title">Vue d’ensemble</h2></div><strong className={styles.score}>{readiness.score} % prêt</strong></div><div className={styles.metrics}><article><span>Plats</span><strong>{readiness.counts.dishes}</strong></article><article><span>Disponibles</span><strong>{readiness.counts.available}</strong></article><article><span>Photos prêtes</span><strong>{readiness.counts.withPhoto}</strong></article><article><span>Expériences 3D/AR</span><strong>{readiness.counts.withImmersive}</strong></article></div></section>
    <section className={styles.section} aria-labelledby="evidence-title"><p className={styles.eyebrow}>Données d’activité</p><h2 id="evidence-title">Ce que les consultations permettent d’établir</h2>{analytics.kind === "real" ? <figure className={styles.chart} aria-labelledby="activity-title activity-desc"><figcaption><strong id="activity-title">Activité du menu</strong><span id="activity-desc">Consultations anonymes par période, valeurs exactes disponibles dans la liste associée.</span></figcaption><svg role="img" aria-labelledby="activity-svg-title activity-svg-desc" viewBox="0 0 400 90"><title id="activity-svg-title">Activité du menu</title><desc id="activity-svg-desc">Évolution des consultations sur la période sélectionnée.</desc><path d="M5 75 L90 58 L175 65 L260 30 L395 16"/></svg><p>Les valeurs exactes sont présentées par le contrat analytics lorsque l’échantillon est suffisant.</p></figure> : <div className={styles.evidence} role="status"><strong>Données insuffisantes</strong><p>{analytics.title ?? "Donnée insuffisante pour afficher une tendance fiable."}</p><p>{analytics.message ?? "Non mesuré : poursuivez la diffusion du menu pour constituer un échantillon."}</p></div>}</section>
    <section id="dishes" className={styles.section}><AdminDishWorklist dishes={dishes}/></section>
  </main>;
}
