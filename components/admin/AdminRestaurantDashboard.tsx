import { AdminDishWorklist } from "./AdminDishWorklist";
import { AdminMenuActions } from "./AdminMenuActions";
import { buildAnalyticsPresentation, type TargetAnalyticsState } from "./adminDashboardViewModel";
import styles from "./AdminDashboard.module.css";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";

type Range = "today-utc" | "7d" | "30d";
type ViewData = { restaurant: { name: string; location: string | null; cuisineType: string | null; timezone: null; publicMenuPath: string | null }; menu: { dishes: AdminDashboardData["dishes"]; readiness: AdminDashboardData["readiness"] }; analytics: TargetAnalyticsState };
const rangeLabel = (range: Range) => range === "today-utc" ? "Aujourd’hui — UTC" : `Fenêtre glissante ${range === "7d" ? "7 jours" : "30 jours"} — UTC`;

// Temporary explicit legacy boundary. Delete when target AdminDashboardData lands.
function adaptDashboardData(data: AdminDashboardData): ViewData {
  const analytics: TargetAnalyticsState = (() => { switch (data.analytics.kind) {
    case "real": case "partial": return { kind:"insufficient", reason:"instrumentation-unproven", completeness:"limited-sample", observationWindow:{startedAt:"",endedAt:""}, availableEvidence:[], missingEvidence:["Agrégation analytics cible requise"] };
    case "empty": return { kind:"insufficient", reason:"no-relevant-events", completeness:"complete", observationWindow:{startedAt:"",endedAt:""}, availableEvidence:[], missingEvidence:[data.analytics.message] };
    case "preview": return { kind:"insufficient", reason:"instrumentation-unproven", completeness:"limited-sample", observationWindow:{startedAt:"",endedAt:""}, availableEvidence:[], missingEvidence:[data.analytics.message] };
    default: return assertNever(data.analytics);
  }})();
  return { restaurant:{name:data.restaurant.name,location:null,cuisineType:null,timezone:null,publicMenuPath:data.restaurant.menuPath}, menu:{dishes:data.dishes,readiness:data.readiness}, analytics };
}
function assertNever(value: never): never { throw new Error(`État inconnu: ${String(value)}`); }

function AnalyticsPanel({ state }: { state: TargetAnalyticsState }) {
  const p = buildAnalyticsPresentation(state);
  switch (p.kind) {
    case "real": { const max=Math.max(1,...p.activity.map(point=>point.value)); return <div><div className={styles.metrics}>{p.metrics.slice(0,5).map(metric=><article key={metric.id}><span>{metric.label}</span><strong>{metric.value.toLocaleString("fr-CA")}</strong><small>{metric.unit}</small></article>)}</div><figure className={styles.chart} aria-labelledby="activity-title activity-desc"><figcaption><strong id="activity-title">Activité du menu</strong><span id="activity-desc">Signaux anonymes par période, avec valeurs exactes.</span></figcaption><div className={styles.bars} role="img" aria-label={p.summary}>{p.activity.map(point=><div key={point.label}><span style={{height:`${Math.max(4,point.value/max*100)}%`}}/><small>{point.label}</small></div>)}</div><table><caption>Valeurs exactes de l’activité</caption><thead><tr><th>Période</th><th>Signaux</th></tr></thead><tbody>{p.activity.map(point=><tr key={point.label}><th>{point.label}</th><td>{point.value}</td></tr>)}</tbody></table><p>{p.summary} Provenance : {p.provenance}. Fraîcheur : {p.freshness}.</p></figure></div>; }
    case "insufficient": return <div className={styles.evidence} role="status"><strong>{p.title}</strong><p>Raison : {p.reason}. Complétude : {p.completeness}.</p>{p.availableEvidence.map(item=><p key={item.label}>{item.label} : {item.value}</p>)}<ul>{p.missingEvidence.map(item=><li key={item}>{item}</li>)}</ul><p>Non mesuré tant que ces preuves manquent.</p></div>;
    case "unavailable": return <div className={styles.evidence} role="alert"><strong>{p.title}</strong><p>{p.explanation}</p><p>Raison : {p.reason}. Complétude : {p.completeness}.</p>{p.retryable?<p>Vous pouvez réessayer en actualisant la page.</p>:null}</div>;
    default: return assertNever(p);
  }
}

export function AdminRestaurantDashboard({ data, range }: { data: AdminDashboardData; range: Range }) {
  const view=adaptDashboardData(data); const {readiness,dishes}=view.menu;
  return <main className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>Dashboard restaurant</p><h1>{view.restaurant.name}</h1><p className={styles.muted}>Gestion de la carte client</p></div>{view.restaurant.publicMenuPath?<AdminMenuActions menuPath={view.restaurant.publicMenuPath}/>:null}<nav aria-label="Sections du dashboard"><a href="#overview">Vue d’ensemble</a><a href="#dishes">Disponibilité des plats</a></nav></header><section className={styles.context} aria-label="Contexte des données"><div><strong>{rangeLabel(range)}</strong><span>Source : activité anonyme de production</span></div><p>Le fuseau horaire du restaurant n’est pas configuré. Les périodes sont affichées en UTC.</p><div className={styles.ranges}>{(["today-utc","7d","30d"] as Range[]).map(item=><a aria-current={item===range?"page":undefined} href={`?range=${item}`} key={item}>{item==="today-utc"?"Aujourd’hui":item}</a>)}</div></section><section id="overview" className={styles.section} aria-labelledby="overview-title"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>État de la carte</p><h2 id="overview-title">Vue d’ensemble</h2></div><strong className={styles.score}>{readiness.score} % prêt</strong></div><div className={styles.metrics}><article><span>Plats</span><strong>{readiness.counts.dishes}</strong></article><article><span>Disponibles</span><strong>{readiness.counts.available}</strong></article><article><span>Photos prêtes</span><strong>{readiness.counts.withPhoto}</strong></article><article><span>Expériences 3D/AR</span><strong>{readiness.counts.withImmersive}</strong></article></div></section><section className={styles.section} aria-labelledby="evidence-title"><p className={styles.eyebrow}>Données d’activité</p><h2 id="evidence-title">Ce que les consultations permettent d’établir</h2><AnalyticsPanel state={view.analytics}/></section><section id="dishes" className={styles.section}><AdminDishWorklist dishes={dishes}/></section></main>;
}
