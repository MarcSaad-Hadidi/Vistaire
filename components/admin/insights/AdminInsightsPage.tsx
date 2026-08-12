import Link from "next/link";
import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import type { AdminEvidenceBundle, AdminEvidenceRecord } from "@/lib/admin/data/evidenceRegistry";
import { renderAssistantClaims } from "@/lib/admin/assistant/renderClaims";
import { buildRuleBasedAssistantClaims } from "@/lib/admin/assistant/rulesFallback";
import { AdminAssistant } from "../AdminAssistant";
import { AdminShell } from "../system/AdminShell";
import { AdminPanel } from "../system/AdminPrimitives";
import { InsightsAttentionMap } from "./InsightsAttentionMap";
import { InsightsConversionState } from "./InsightsConversionState";
import { InsightsRecommendations } from "./InsightsRecommendations";
import styles from "./AdminInsights.module.css";

type Presentation = Readonly<{ restaurantName: string; publicMenuPath: string }>;
const number = new Intl.NumberFormat("fr-CA");

function count(record: AdminEvidenceRecord | undefined): number | null {
  if (record?.state.kind !== "available") return null;
  const value = record.state.value;
  return value && typeof value === "object" && "count" in value && typeof value.count === "number"
    ? value.count
    : null;
}

function find(bundle: AdminEvidenceBundle, metricId: string, period: AdminEvidenceRecord["period"]) {
  return Object.values(bundle.records).find((record) => record.metricId === metricId && record.period === period);
}

function metricState(record: AdminEvidenceRecord | undefined, locale: AdminLocale) {
  const value = count(record);
  if (value !== null) return number.format(value);
  if (record?.state.kind === "insufficient") return locale === "fr" ? "Preuve insuffisante" : "Insufficient evidence";
  if (record?.state.kind === "unavailable") return locale === "fr" ? "Non disponible" : "Unavailable";
  if (record?.state.kind === "error") return locale === "fr" ? "Erreur récupérable" : "Recoverable error";
  return locale === "fr" ? "Non mesuré" : "Unmeasured";
}

export function AdminInsightsPage({
  bundle,
  presentation,
  locale,
  assistantEnabled
}: {
  bundle: AdminEvidenceBundle;
  presentation: Presentation;
  locale: AdminLocale;
  assistantEnabled: boolean;
}) {
  const current = find(bundle, "observed-menu-opens", "current");
  const previous = find(bundle, "observed-menu-opens", "previous");
  const dishes = find(bundle, "catalog-dishes", "snapshot");
  const currentCount = count(current);
  const previousCount = count(previous);
  const delta = currentCount !== null && previousCount !== null ? currentCount - previousCount : null;
  const claims = renderAssistantClaims({
    locale,
    bundle,
    claims: buildRuleBasedAssistantClaims(bundle),
    source: "rules"
  });
  const fr = locale === "fr";

  return <AdminShell
    restaurantName={presentation.restaurantName}
    menuPath={presentation.publicMenuPath}
    activeRoute="intelligence"
    pageTitle={fr ? "Intelligence menu — Comprendre l’attention des convives" : "Menu intelligence — Understand guest attention"}
    pageDescription={fr ? "Analysez les signaux observés et les zones encore non mesurées, sans inventer de ventes." : "Review observed signals and unmeasured areas without inferred sales."}
    headerDetails={<nav className={styles.periodNav} aria-label={fr ? "Période analysée" : "Analysis period"}>{(["today", "7d", "30d"] as const).map((range) => <Link key={range} href={`/admin/insights?range=${range}`} aria-current={bundle.window.range === range ? "page" : undefined}>{range === "today" ? (fr ? "Aujourd’hui" : "Today") : range}</Link>)}</nav>}
  >
    <section className={styles.essential} aria-labelledby="intelligence-essential">
      <div className={styles.sectionHeading}><p>{fr ? "L’essentiel Vistaire" : "Vistaire essentials"}</p><h2 id="intelligence-essential">{fr ? "Ce que les preuves permettent d’affirmer" : "What the evidence supports"}</h2></div>
      <div className={styles.essentialGrid}>
        <article className={styles.signalCard} data-tone="risk"><span>{fr ? "Observation" : "Observation"}</span><strong>{metricState(current, locale)}</strong><h3>{fr ? "ouvertures du menu observées" : "observed menu opens"}</h3><p>{fr ? "Mesure instrumentée sur la période sélectionnée." : "Instrumented measure for the selected period."}</p></article>
        <article className={styles.signalCard} data-tone="trend"><span>{fr ? "Comparaison" : "Comparison"}</span><strong>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${number.format(delta)}`}</strong><h3>{fr ? "par rapport à la période précédente" : "versus the previous period"}</h3><p>{delta === null ? (fr ? "Base comparable indisponible." : "Comparable baseline unavailable.") : (fr ? "Différence calculée depuis les deux preuves observées." : "Difference computed from both observed records.")}</p></article>
        <article className={styles.signalCard} data-tone="discovery"><span>{fr ? "Catalogue" : "Catalog"}</span><strong>{metricState(dishes, locale)}</strong><h3>{fr ? "plats présents au menu" : "dishes in the menu"}</h3><p>{fr ? "État du catalogue, distinct de l’attention observée." : "Catalog state, separate from observed attention."}</p></article>
      </div>
    </section>

    <div className={styles.intelligenceGrid}>
      <AdminPanel className={styles.searchPanel} title={fr ? "Top recherches" : "Top searches"}><div className={styles.emptyState}><strong>{fr ? "Non mesuré" : "Unmeasured"}</strong><p>{fr ? "Aucun classement de recherches k-anonyme n’est disponible dans ce bundle." : "No k-anonymous search ranking is available in this bundle."}</p></div></AdminPanel>
      <AdminPanel className={styles.mapPanel} title={fr ? "Carte d’attention Vistaire" : "Vistaire attention map"}><InsightsAttentionMap record={current} locale={locale}/></AdminPanel>
      <AdminPanel className={styles.contextPanel} title={fr ? "Contexte" : "Context"}><div className={styles.emptyState}><strong>{fr ? "Non instrumenté" : "Not instrumented"}</strong><p>{fr ? "Appareils, langues et zones QR ne sont pas affirmés sans preuve dédiée." : "Devices, languages and QR zones are not shown without dedicated evidence."}</p></div></AdminPanel>
      <AdminPanel className={styles.funnelPanel} title={fr ? "Parcours de conversion" : "Conversion journey"}><InsightsConversionState locale={locale}/></AdminPanel>
    </div>

    <div className={styles.bottomIntelligenceGrid}>
      <AdminPanel title={fr ? "Scorecards observées" : "Observed scorecards"}><dl className={styles.scorecards}><div><dt>{fr ? "Ouvertures actuelles" : "Current opens"}</dt><dd>{metricState(current, locale)}</dd></div><div><dt>{fr ? "Ouvertures précédentes" : "Previous opens"}</dt><dd>{metricState(previous, locale)}</dd></div><div><dt>{fr ? "Plats au catalogue" : "Catalog dishes"}</dt><dd>{metricState(dishes, locale)}</dd></div></dl></AdminPanel>
      <AdminPanel title={fr ? "Recommandations Vistaire" : "Vistaire recommendations"}><InsightsRecommendations answer={claims} locale={locale}/></AdminPanel>
      <AdminPanel className={styles.assistantPanel} title={fr ? "Assistant Vistaire" : "Vistaire Assistant"}>{assistantEnabled ? <AdminAssistant locale={locale} range={bundle.window.range}/> : <div className={styles.emptyState}><strong>{fr ? "Assistant en validation" : "Assistant under validation"}</strong><p>{fr ? "Le drawer sera activé lorsque le quota distribué et les gates IA seront validés." : "The drawer will activate after distributed quota and AI gates are validated."}</p></div>}</AdminPanel>
    </div>
  </AdminShell>;
}
