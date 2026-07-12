export type AdminAnalyticsFreshness = "fresh" | "delayed" | "stale";

const freshnessCopy: Record<AdminAnalyticsFreshness, string> = {
  fresh: "À jour",
  delayed: "Mise à jour retardée",
  stale: "Données à actualiser"
};

const evidenceReasonCopy: Record<string, string> = {
  "incompatible-scope": "La comparaison n’est pas disponible pour ce périmètre.",
  configuration: "La source de données n’est pas configurée.",
  database: "La source de données est momentanément indisponible.",
  query: "La lecture des données n’a pas abouti.",
  "no-relevant-events": "Aucune activité pertinente n’a été observée sur cette période.",
  "sample-too-small": "Le volume observé est encore insuffisant pour cette analyse.",
  "instrumentation-unproven": "La mesure de cette activité n’est pas encore confirmée.",
  "incompatible-or-empty-period": "La période précédente ne contient pas encore assez de données comparables.",
  "source-incomplete": "Les données sont temporairement incomplètes.",
  "no-current-events": "Aucune activité n’a été observée sur cette période.",
  "no-timestamped-events": "Aucune activité datée n’est disponible.",
  "no-category-evidence": "Les consultations par catégorie apparaîtront après davantage d’activité.",
  "no-dish-ranking-evidence": "Le classement des plats apparaîtra après davantage de consultations.",
  "no-search-evidence": "Aucune tendance de recherche fiable n’est encore disponible."
};

export function adminFreshnessCopy(freshness: AdminAnalyticsFreshness): string {
  return freshnessCopy[freshness];
}

export function adminEvidenceReasonCopy(reason: string): string {
  return evidenceReasonCopy[reason] ?? "Les données ne permettent pas encore d’afficher cette analyse.";
}
