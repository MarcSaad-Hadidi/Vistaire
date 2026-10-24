import type { AdminDashboardData } from "./dashboardData";
import type { AdminObservationWindow } from "./dashboardRange";
import type { AdminPanelEvidence } from "./analyticsPresentation";
import { isPrivacySafeAdminSearchTerm } from "./analyticsPresentation.ts";

export type ExportValue = string | number | boolean | null;
export type ExportColumn = { key: string; label: string; type: "string" | "number" | "percent" | "boolean" | "date" };
export type ExportDataset = { id: string; title: string; columns: ExportColumn[]; rows: Record<string, ExportValue>[]; status: "supported" | "insufficient" | "unavailable"; reason: string | null };
export type StudioExport = {
  schemaVersion: 1;
  title: string;
  synthetic: boolean;
  generatedAt: string;
  observationWindow: AdminObservationWindow | null;
  analytics: { status: AdminDashboardData["analytics"]["kind"]; completeness: string; reason: string | null; lastUpdatedAt: string | null; freshness: string | null; coverage: { menuOpened: boolean; dishOpened: boolean } | null };
  comparison: { available: boolean; from: string | null; to: string | null };
  notes: string[];
  datasets: ExportDataset[];
};

const column = (key: string, label: string, type: ExportColumn["type"] = "string"): ExportColumn => ({ key, label, type });
const metricLabels: Record<string, string> = { "menu-opens": "Ouvertures du menu", "dish-opens": "Consultations de plats", searches: "Recherches", immersive: "Clics 3D et AR", three: "Clics 3D", ar: "Clics AR", "available-dishes": "Plats disponibles" };
const seriesLabels = { menuOpened: "Ouvertures du menu", dishOpened: "Consultations de plats", searches: "Recherches", immersive: "Clics 3D et AR", three: "Clics 3D", ar: "Clics AR" };
const finite = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value : null;

/** Only the authenticated, tenant-scoped dashboard projection is accepted. No event logs are serialized. */
export function createStudioExport(data: AdminDashboardData, { generatedAt = new Date().toISOString(), synthetic = false }: { generatedAt?: string; synthetic?: boolean } = {}): StudioExport {
  const analytics = data.analytics;
  const real = analytics.kind === "real" ? analytics : null;
  const observed = analytics.kind === "unavailable" ? null : analytics.observationWindow;
  const observationWindow = observed ? { range: observed.range, startInclusive: observed.startInclusive, endExclusive: observed.endExclusive, comparisonStartInclusive: observed.comparisonStartInclusive, comparisonEndExclusive: observed.comparisonEndExclusive } : null;
  const comparisonAvailable = real?.panels.dailyComparison.kind === "supported";
  const datasets: ExportDataset[] = [];
  const add = (id: string, title: string, columns: ExportColumn[], rows: Record<string, ExportValue>[], status: ExportDataset["status"] = "supported", reason: string | null = null) => datasets.push({ id, title, columns, rows, status, reason });
  const unavailableStatus = analytics.kind === "real" ? "insufficient" : analytics.kind;
  const unavailableReason = analytics.kind === "real" ? "no-evidence" : analytics.reason;
  function panel<T>(id: string, title: string, columns: ExportColumn[], evidence: AdminPanelEvidence<T> | undefined, rows: (value: T) => Record<string, ExportValue>[]) {
    add(id, title, columns, evidence?.kind === "supported" ? rows(evidence.data) : [], evidence?.kind ?? unavailableStatus, evidence && evidence.kind !== "supported" ? evidence.reason : evidence ? null : unavailableReason);
  }

  add("summary", "Synthèse", [column("id", "Identifiant"), column("metric", "Mesure"), column("current", "Actuel", "number"), column("previous", "Précédent", "number"), column("change", "Évolution", "percent")], real ? real.metrics.map((metric) => ({ id: metric.id, metric: metricLabels[metric.id] ?? metric.id, current: finite(metric.value), previous: comparisonAvailable ? finite(metric.baseline) : null, change: comparisonAvailable ? finite(metric.changeRate) : null })) : [], real ? "supported" : unavailableStatus, real ? null : unavailableReason);
  add("restaurant", "Restaurant", [column("field", "Champ"), column("value", "Valeur")], [
    { field: "Identifiant du restaurant", value: data.restaurant.id }, { field: "Nom", value: data.restaurant.name }, { field: "Slug", value: data.restaurant.slug }, { field: "Ville", value: data.restaurant.location }, { field: "Cuisine", value: data.restaurant.cuisineType }, { field: "Fuseau du restaurant", value: data.restaurant.timezone }, { field: "Menu public", value: data.restaurant.publicMenuPath }, { field: "Identifiant du menu", value: data.menu.id }, { field: "Statut du menu", value: data.menu.status }
  ]);
  add("dishes", "Plats", [column("id", "Identifiant"), column("name", "Plat"), column("category", "Catégorie"), column("description", "Description"), column("priceCents", "Prix en centimes", "number"), column("priceLabel", "Prix affiché"), column("available", "Disponible", "boolean"), column("views", "Consultations", "number"), column("three", "Clics 3D", "number"), column("ar", "Clics AR", "number"), column("previousViews", "Consultations précédentes", "number"), column("changeRate", "Évolution consultations", "percent")], data.menu.dishes.map((dish) => {
    const stats = real?.panels.ranking.kind === "supported" ? data.dishStatistics?.[dish.id] : undefined;
    return { id: dish.id, name: dish.name, category: dish.category, description: dish.description, priceCents: finite(dish.priceCents), priceLabel: dish.priceLabel, available: dish.available, views: finite(stats?.views), three: finite(stats?.three), ar: finite(stats?.ar), previousViews: comparisonAvailable ? finite(stats?.previousViews) : null, changeRate: comparisonAvailable ? finite(stats?.changeRate) : null };
  }));
  add("dish_media", "Détails et médias", [column("id", "Identifiant plat"), column("slug", "Slug"), column("categorySlug", "Slug catégorie"), column("imageUrl", "Photo"), column("thumbnailUrl", "Miniature"), column("hasPhoto", "Avec photo", "boolean"), column("photoStatus", "État photo"), column("hasImmersive", "Immersion", "boolean"), column("has3d", "3D", "boolean"), column("hasAr", "AR", "boolean")], data.menu.dishes.map((dish) => ({ id: dish.id, slug: dish.slug, categorySlug: dish.categorySlug ?? null, imageUrl: dish.imageUrl, thumbnailUrl: dish.thumbnailUrl, hasPhoto: dish.hasPhoto, photoStatus: dish.photoStatus, hasImmersive: dish.hasImmersive, has3d: dish.has3d, hasAr: dish.hasAr })));
  add("categories", "Catégories du menu", [column("id", "Identifiant"), column("label", "Catégorie"), column("slug", "Slug")], data.menu.categories.map(({ id, label, slug }) => ({ id, label, slug })));
  const readinessLabels = { categories: "Catégories", dishes: "Plats", available: "Disponibles", unavailable: "Indisponibles", missingPrice: "Sans prix", missingDescription: "Sans description", missingPhoto: "Sans photo", withPhoto: "Avec photo", withImmersive: "Avec immersion" };
  add("readiness", "Qualité de la carte", [column("metric", "Mesure"), column("value", "Valeur", "number")], [{ metric: "Score de préparation sur 100", value: finite(data.menu.readiness.score) }, ...Object.entries(readinessLabels).map(([key, label]) => ({ metric: label, value: finite(data.menu.readiness.counts[key as keyof typeof readinessLabels]) }))]);
  add("actions", "Actions sur la carte", [column("kind", "Type"), column("label", "Action"), column("count", "Nombre", "number")], data.menu.readiness.actions.map(({ kind, label, count }) => ({ kind, label, count: finite(count) })));

  const dailyColumns = [column("metric", "Mesure"), column("bucket", "Début du créneau (UTC)", "date"), column("value", "Événements", "number")];
  for (const previous of [false, true]) {
    const supported = Boolean(real && (!previous || comparisonAvailable));
    add(previous ? "previous_metric_daily" : "metric_daily", previous ? "Mesures précédentes" : "Mesures quotidiennes", dailyColumns, supported && real ? (Object.keys(seriesLabels) as (keyof typeof seriesLabels)[]).flatMap((key) => (real.metricSeries[key]?.[previous ? "previous" : "current"] ?? []).map((point) => ({ metric: seriesLabels[key], bucket: point.bucket, value: finite(point.value) }))) : [], supported ? "supported" : previous && real ? real.panels.dailyComparison.kind === "unavailable" ? "unavailable" : "insufficient" : unavailableStatus, supported ? null : previous && real && real.panels.dailyComparison.kind !== "supported" ? real.panels.dailyComparison.reason : unavailableReason);
  }
  const activityColumns = [column("day", "Début du créneau (UTC)", "date"), column("count", "Tous événements", "number")];
  panel("daily", "Activité quotidienne", activityColumns, real?.panels.currentDaily, (rows) => rows.map(({ day, count }) => ({ day, count: finite(count) })));
  panel("previous_daily", "Activité précédente", activityColumns, real?.panels.dailyComparison, ({ previous }) => previous.map(({ day, count }) => ({ day, count: finite(count) })));
  panel("hour_weekday", "Jours et heures UTC", [column("weekdayUtc", "Jour (0 = dimanche)", "number"), column("hourUtc", "Heure UTC", "number"), column("count", "Tous événements", "number")], real?.panels.hourWeekday, (rows) => rows.map(({ weekdayUtc, hourUtc, count }) => ({ weekdayUtc, hourUtc, count: finite(count) })));
  panel("category_activity", "Activité par catégorie", [column("slug", "Slug"), column("label", "Catégorie"), column("count", "Consultations", "number")], real?.panels.categories, (rows) => rows.map(({ slug, label, count }) => ({ slug, label: label ?? data.menu.categories.find((category) => category.slug === slug)?.label ?? slug, count: finite(count) })));
  panel("service_windows", "Créneaux UTC", [column("id", "Identifiant"), column("label", "Créneau"), column("startHourUtc", "Début UTC", "number"), column("endHourUtc", "Fin UTC", "number"), column("count", "Tous événements", "number")], real?.panels.serviceWindows, ({ windows }) => windows.map(({ id, label, startHourUtc, endHourUtc, count }) => ({ id, label, startHourUtc, endHourUtc, count: finite(count) })));
  panel("ranking", "Classement des plats", [column("slug", "Slug"), column("name", "Plat"), column("count", "Consultations", "number")], real?.panels.ranking, (rows) => rows.map(({ slug, count }) => ({ slug, name: data.menu.dishes.find((dish) => dish.slug === slug)?.name ?? slug, count: finite(count) })));
  panel("searches", "Recherches agrégées", [column("term", "Recherche"), column("count", "Occurrences", "number"), column("previousCount", "Occurrences précédentes", "number"), column("changeRate", "Évolution", "percent")], real?.panels.searches, (rows) => rows.filter(({ term }) => isPrivacySafeAdminSearchTerm(term)).map(({ term, count, previousCount, changeRate }) => ({ term, count: finite(count), previousCount: comparisonAvailable ? finite(previousCount) : null, changeRate: comparisonAvailable ? finite(changeRate) : null })));
  panel("search_daily", "Recherches quotidiennes", [column("term", "Recherche"), column("bucket", "Créneau (1 = premier)", "number"), column("count", "Occurrences", "number")], real?.panels.searches, (rows) => rows.filter(({ term }) => isPrivacySafeAdminSearchTerm(term)).flatMap(({ term, daily }) => daily.map((count, index) => ({ term, bucket: index + 1, count: finite(count) }))));
  add("immersive", "Interactions immersives", [column("name", "Événement"), column("count", "Clics", "number")], real ? real.immersive.map(({ name, count }) => ({ name, count: finite(count) })) : [], real ? "supported" : unavailableStatus, real ? null : unavailableReason);
  add("funnel", "Parcours agrégé", [column("sessions", "Sessions avec menu", "number"), column("dishOpened", "Sessions avec plat ensuite", "number"), column("rate", "Taux", "percent")], real?.funnel.kind === "measured" ? [{ sessions: finite(real.funnel.sessions), dishOpened: finite(real.funnel.dishOpened), rate: finite(real.funnel.rate) }] : [], real?.funnel.kind === "measured" ? "supported" : unavailableStatus, real ? real.funnel.kind === "unsupported" ? "insufficient-session-evidence" : null : unavailableReason);

  return {
    schemaVersion: 1, title: `${data.restaurant.name} — Rapport complet`, synthetic, generatedAt, observationWindow,
    analytics: { status: analytics.kind, completeness: analytics.completeness, reason: analytics.kind === "real" ? null : analytics.reason, lastUpdatedAt: real?.lastUpdatedAt ?? null, freshness: real?.freshness ?? null, coverage: real ? { menuOpened: real.coverage.menuOpened, dishOpened: real.coverage.dishOpened } : null },
    comparison: { available: comparisonAvailable, from: comparisonAvailable ? observationWindow!.comparisonStartInclusive : null, to: comparisonAvailable ? observationWindow!.comparisonEndExclusive : null },
    notes: [
      synthetic ? "Données fictives de démonstration. Aucun restaurant réel, visiteur ou service privé n’est connecté à cet aperçu." : "Données du tableau de bord authentifié, limitées au restaurant et au menu sélectionnés. Tous les plats et agrégats disponibles sont inclus, indépendamment de la page affichée.",
      "Période analytique exacte : début inclus, fin exclue, en UTC. Les créneaux quotidiens suivent les bornes de cette période glissante ; leur date indique le début du créneau. Aucun historique supplémentaire n’est chargé.",
      "Les mesures comptent des événements, pas des personnes ni des ventes. Les recherches sont agrégées et soumises aux seuils de confidentialité du tableau de bord. Aucun événement individuel ni identifiant de session n’est exporté.",
      "N/A signifie indisponible, preuve insuffisante ou comparaison non prise en charge. Les tableaux supprimés restent vides et leur état est indiqué. Les valeurs absentes ne sont jamais remplacées par zéro.",
      "La carte, ses médias et disponibilités reflètent l’instantané déjà chargé du menu, indépendamment de la période analytique. Aucun planning de disponibilité non chargé n’est inclus. Le fuseau du restaurant n’est pas déduit.",
      "L’activité, les jours et les créneaux regroupent tous les types d’événements. Les classements et catégories comptent les consultations de plats. La comparaison n’est exportée que si les périodes et périmètres sont compatibles."
    ], datasets
  };
}

export function safeExportText(value: unknown): string {
  const text = String(value ?? "");
  return /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(text) ? `'${text}` : text;
}

export function exportMetadata(report: StudioExport): [string, ExportValue][] {
  return [
    ["Rapport", report.title], ["Généré le", report.generatedAt], ["Données synthétiques", report.synthetic], ["Début inclus (UTC)", report.observationWindow?.startInclusive ?? null], ["Fin exclue (UTC)", report.observationWindow?.endExclusive ?? null], ["Période sélectionnée", report.observationWindow?.range ?? null], ["Comparaison disponible", report.comparison.available], ["Comparaison : début inclus", report.comparison.from], ["Comparaison : fin exclue", report.comparison.to], ["État analytique", report.analytics.status], ["Complétude", report.analytics.completeness], ["Motif", report.analytics.reason], ["Dernier événement", report.analytics.lastUpdatedAt], ["Fraîcheur", report.analytics.freshness], ["Couverture ouvertures du menu", report.analytics.coverage?.menuOpened ?? null], ["Couverture consultations de plats", report.analytics.coverage?.dishOpened ?? null], ...report.notes.map((note, index): [string, string] => [`Note ${index + 1}`, note]), ...report.datasets.map((dataset): [string, string] => [dataset.title, `${dataset.status}${dataset.reason ? ` : ${dataset.reason}` : ""}`])
  ];
}

export function reportJSON(report: StudioExport): string { return JSON.stringify(report, null, 2); }

export function reportCSV(report: StudioExport): string {
  const rows: ExportValue[][] = [["jeu", "ligne", "champ", "libelle", "type", "valeur"]];
  for (const [key, value] of exportMetadata(report)) rows.push(["metadata", 1, key, key, typeof value, value]);
  for (const dataset of report.datasets) {
    rows.push([dataset.id, 0, "_status", dataset.title, "string", `${dataset.status}${dataset.reason ? ` : ${dataset.reason}` : ""}`]);
    dataset.rows.forEach((row, index) => dataset.columns.forEach((col) => rows.push([dataset.id, index + 1, col.key, col.label, col.type, row[col.key] ?? null])));
  }
  return "\uFEFF" + rows.map((row) => row.map((value) => `"${(typeof value === "string" ? safeExportText(value) : String(value ?? "N/A")).replaceAll('"', '""')}"`).join(";")).join("\r\n");
}

