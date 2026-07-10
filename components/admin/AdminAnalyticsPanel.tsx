import { buildAnalyticsPresentation, type TargetAnalyticsState } from "./adminDashboardViewModel";
import styles from "./AdminDashboard.module.css";
import analyticsStyles from "./AdminAnalytics.module.css";

function assertNever(value: never): never { throw new Error(`Présentation inconnue: ${String(value)}`); }
export function AdminAnalyticsPanel({ state }: { state: TargetAnalyticsState }) {
  const p = buildAnalyticsPresentation(state);
  switch (p.kind) {
    case "real": { const max=Math.max(1,...p.activity.map(point=>point.value)); return <div><div className={styles.metrics}>{p.metrics.slice(0,5).map(metric=><article key={metric.id}><span>{metric.label}</span><strong>{metric.value.toLocaleString("fr-CA")}</strong><small>{metric.unit}</small></article>)}</div><figure className={styles.chart} aria-labelledby="activity-title activity-desc"><figcaption><strong id="activity-title">Activité du menu</strong><span id="activity-desc">Signaux anonymes par période, avec valeurs exactes.</span></figcaption><div className={analyticsStyles.bars} role="img" aria-label={p.summary}>{p.activity.map(point=><div className={analyticsStyles.bar} key={point.label}><span className={analyticsStyles.barFill} style={{height:`${Math.max(4,point.value/max*100)}%`}}/><small>{point.label}</small></div>)}</div><table><caption>Valeurs exactes de l’activité</caption><thead><tr><th>Période</th><th>Signaux</th></tr></thead><tbody>{p.activity.map(point=><tr key={point.label}><th>{point.label}</th><td>{point.value}</td></tr>)}</tbody></table><p>{p.summary} Période : {p.observationWindow.label ?? `${p.observationWindow.startedAt} — ${p.observationWindow.endedAt} UTC`}. Dernière mise à jour : {p.lastUpdatedAt ?? "Non disponible"}. Provenance : {p.provenance}. Fraîcheur : {p.freshness}.</p></figure></div>; }
    case "insufficient": return <div className={styles.evidence} role="status"><strong>{p.title}</strong><p>Raison : {p.reason}. Complétude : {p.completeness}.</p>{p.availableEvidence.map((item,index)=>{const evidence=typeof item==="object"&&item!==null&&"label" in item&&"value" in item?item as {label:string;value:string|number}:{label:`Preuve ${index+1}`,value:String(item)};return <p key={evidence.label}>{evidence.label} : {evidence.value}</p>})}<ul>{p.missingEvidence.map(item=><li key={item}>{item}</li>)}</ul><p>Non mesuré tant que ces preuves manquent.</p></div>;
    case "unavailable": return <div className={styles.evidence} role="alert"><strong>{p.title}</strong><p>{p.explanation}</p><p>Raison : {p.reason}. Complétude : {p.completeness}.</p>{p.retryable?<p>Vous pouvez réessayer en actualisant la page.</p>:null}</div>;
    default: return assertNever(p);
  }
}
