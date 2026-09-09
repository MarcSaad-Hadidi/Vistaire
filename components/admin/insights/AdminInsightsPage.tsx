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
import { InsightsEvidenceCharts } from "./InsightsEvidenceCharts";
import { InsightsRecommendations } from "./InsightsRecommendations";
import styles from "./AdminInsights.module.css";

type Presentation = Readonly<{ restaurantId?: string; restaurantName: string; publicMenuPath: string }>;
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

function ranking(record: AdminEvidenceRecord | undefined) {
  if (record?.state.kind !== "available" || !Array.isArray(record.state.value)) return [];
  return record.state.value.flatMap((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const candidate = value as Record<string, unknown>;
    const key = typeof candidate.term === "string" ? candidate.term : typeof candidate.key === "string" ? candidate.key.replaceAll("-", " ") : null;
    return key && typeof candidate.count === "number" && Number.isFinite(candidate.count)
      ? [{ label: key, count: candidate.count, rank: typeof candidate.rank === "number" ? candidate.rank : index + 1 }]
      : [];
  });
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
  const dishRanking = ranking(find(bundle, "dish-ranking", "current"));
  const categoryRanking = ranking(find(bundle, "category-ranking", "current"));
  const searchRanking = ranking(find(bundle, "private-search-ranking", "current"));
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
  const { restaurantId, restaurantName, publicMenuPath } = presentation;

  return <AdminShell
    restaurantName={restaurantName}
    restaurantId={restaurantId}
    menuPath={publicMenuPath}
    activeRoute="intelligence"
    pageTitle={fr ? "Intelligence menu — Comprendre l’attention des convives" : "Menu intelligence — Understand guest attention"}
    pageDescription={fr ? "Analysez les signaux observés et les zones encore non mesurées, sans inventer de ventes." : "Review observed signals and unmeasured areas without inferred sales."}
    observedAt={bundle.window.observedAt}
    timezone={bundle.window.timezone}
  >
    <section className={styles.insightsToolbar} aria-label={fr ? "Filtres d’analyse" : "Analysis filters"}>
      <div className={styles.toolbarGroup}>
        <span>{fr ? "Période" : "Period"}</span>
        <nav className={styles.periodNav} aria-label={fr ? "Période analysée" : "Analysis period"}>{(["today", "7d", "30d"] as const).map((range) => <Link key={range} href={`/admin/insights?range=${range}`} aria-current={bundle.window.range === range ? "page" : undefined}>{range === "today" ? (fr ? "Aujourd’hui" : "Today") : range === "30d" ? (fr ? "30 j" : "30 d") : range}</Link>)}</nav>
      </div>
      <div className={styles.toolbarGroup}>
        <span>{fr ? "Service" : "Service"}</span>
        <button type="button" disabled title={fr ? "Aucune preuve ventilée par service" : "No service-level evidence"}>{fr ? "Tous les services · non ventilé" : "All services · not segmented"}</button>
      </div>
      <div className={styles.toolbarGroup}>
        <span>{fr ? "Canaux" : "Channels"}</span>
        <button type="button" disabled title={fr ? "Aucune preuve ventilée par canal" : "No channel-level evidence"}>{fr ? "Tous les canaux · non ventilé" : "All channels · not segmented"}</button>
      </div>
      <div className={styles.toolbarGroup}>
        <span>{fr ? "Comparer" : "Compare"}</span>
        <button type="button" disabled>{fr ? "Période alignée précédente" : "Previous aligned period"}</button>
      </div>
    </section>
    <section className={styles.essential} aria-labelledby="intelligence-essential">
      <h2 className={styles.srOnly} id="intelligence-essential">{fr ? "Ce que les preuves permettent d’affirmer" : "What the evidence supports"}</h2>
      <div className={styles.sectionHeading}><p>{fr ? "L’essentiel Vistaire" : "Vistaire essentials"}</p></div>
      <div className={styles.essentialGrid}>
        <article className={styles.signalCard} data-tone="risk"><span>{fr ? "Signal observé" : "Observed signal"}</span><strong>{metricState(current, locale)}</strong><h3>{fr ? "ouvertures du menu" : "menu opens"}</h3><p>{fr ? "Mesure instrumentée sur la période sélectionnée, sans extrapolation de ventes." : "Instrumented on the selected period, with no inferred sales."}</p></article>
        <article className={styles.signalCard} data-tone="trend"><span>{fr ? "Tendance de période" : "Period trend"}</span><strong>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${number.format(delta)}`}</strong><h3>{fr ? "écart d’ouvertures observées" : "observed opens difference"}</h3><p>{delta === null ? (fr ? "Base comparable indisponible." : "Comparable baseline unavailable.") : (fr ? "Écart calculé depuis deux périodes alignées." : "Difference computed from two aligned periods.")}</p></article>
        <article className={styles.signalCard} data-tone="discovery"><span>{fr ? "Découverte du catalogue" : "Catalog discovery"}</span><strong>{metricState(dishes, locale)}</strong><h3>{fr ? "plats présents au menu" : "dishes in the menu"}</h3><p>{fr ? "État exact du catalogue, distinct des comportements observés." : "Exact catalog state, separate from observed behavior."}</p></article>
      </div>
    </section>

    <div className={styles.intelligenceGrid}>
      <div className={styles.searchColumn}>
        <AdminPanel className={styles.searchPanel} title={fr ? "Top recherches" : "Top searches"}>{searchRanking.length ? <ol className={styles.compactRanking}>{searchRanking.slice(0, 5).map((row) => <li key={`${row.rank}-${row.label}`}><span>{row.rank}</span><p>{row.label}</p><strong>{number.format(row.count)}</strong></li>)}</ol> : <div className={styles.emptyState}><strong>{fr ? "Non mesuré" : "Unmeasured"}</strong><p>{fr ? "Aucun classement de recherches k-anonyme n’est disponible dans ce bundle." : "No k-anonymous search ranking is available in this bundle."}</p></div>}</AdminPanel>
        <AdminPanel className={styles.noResultPanel} title={fr ? "Recherches sans résultat" : "No-result searches"}><div className={styles.emptyState}><strong>{fr ? "Non mesuré" : "Unmeasured"}</strong><p>{fr ? "Aucune preuve dédiée n’est disponible." : "No dedicated evidence is available."}</p></div></AdminPanel>
      </div>
      <AdminPanel className={styles.mapPanel} title={fr ? "Carte d’attention Vistaire" : "Vistaire attention map"}><InsightsAttentionMap ranking={dishRanking} locale={locale}/></AdminPanel>
      <AdminPanel className={styles.contextPanel} title={fr ? "Contexte" : "Context"}><div className={styles.emptyState}><strong>{fr ? "Non instrumenté" : "Not instrumented"}</strong><p>{fr ? "Appareils, langues et zones QR ne sont pas affirmés sans preuve dédiée." : "Devices, languages and QR zones are not shown without dedicated evidence."}</p></div></AdminPanel>
      <AdminPanel className={styles.funnelPanel} title={fr ? "Parcours de conversion" : "Conversion journey"}><InsightsConversionState locale={locale}/></AdminPanel>
    </div>

    <div className={styles.bottomIntelligenceGrid}>
      <AdminPanel title={fr ? "Scorecards des plats" : "Dish scorecards"}>{dishRanking.length ? <ol className={styles.dishScorecards}>{dishRanking.slice(0, 5).map((row) => <li key={`${row.rank}-${row.label}`}><span>{row.rank}</span><strong>{row.label}</strong><b>{number.format(row.count)}</b></li>)}</ol> : <dl className={styles.scorecards}><div><dt>{fr ? "Ouvertures actuelles" : "Current opens"}</dt><dd>{metricState(current, locale)}</dd></div><div><dt>{fr ? "Ouvertures précédentes" : "Previous opens"}</dt><dd>{metricState(previous, locale)}</dd></div><div><dt>{fr ? "Plats au catalogue" : "Catalog dishes"}</dt><dd>{metricState(dishes, locale)}</dd></div></dl>}</AdminPanel>
      <AdminPanel title={fr ? "Performance par catégorie" : "Category performance"}>{categoryRanking.length ? <ol className={styles.dishScorecards}>{categoryRanking.slice(0, 5).map((row) => <li key={`${row.rank}-${row.label}`}><span>{row.rank}</span><strong>{row.label}</strong><b>{number.format(row.count)}</b></li>)}</ol> : <div className={styles.emptyState}><strong>{fr ? "Non mesuré" : "Unmeasured"}</strong><p>{fr ? "Aucun classement de catégories n’est disponible dans ce bundle." : "No category ranking is available in this bundle."}</p></div>}</AdminPanel>
      <AdminPanel title={fr ? "Recommandations Vistaire" : "Vistaire recommendations"}><InsightsRecommendations answer={claims} locale={locale}/></AdminPanel>
      <AdminPanel className={styles.assistantPanel} title={fr ? "Assistant Vistaire" : "Vistaire Assistant"}>{assistantEnabled ? <AdminAssistant locale={locale} range={bundle.window.range}/> : <div className={styles.emptyState}><strong>{fr ? "Assistant en validation" : "Assistant under validation"}</strong><p>{fr ? "Le drawer sera activé lorsque le quota distribué et les gates IA seront validés." : "The drawer will activate after distributed quota and AI gates are validated."}</p></div>}</AdminPanel>
    </div>
    <InsightsEvidenceCharts key={bundle.window.range} bundle={bundle} locale={locale} />
  </AdminShell>;
}
