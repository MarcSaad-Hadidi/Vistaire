export type AdminAnalyticsFreshness = "fresh" | "delayed" | "stale";

const freshnessCopy: Record<AdminAnalyticsFreshness, string> = {
  fresh: "Données à jour",
  delayed: "Mise à jour différée",
  stale: "Données anciennes"
};

const evidenceReasonCopy: Record<string, string> = {
  "incompatible-scope": "La comparaison n’est pas disponible pour ce périmètre.",
  configuration: "La source de données n’est pas configurée.",
  database: "La source de données est momentanément indisponible.",
  query: "La lecture des données n’a pas abouti.",
  "no-relevant-events": "Aucune activité pertinente n’a été observée sur cette période.",
  "sample-too-small": "Le volume observé est encore insuffisant pour cette analyse.",
  "instrumentation-unproven": "La mesure de cette activité n’est pas encore confirmée.",
  "incompatible-or-empty-period": "Les périodes ne permettent pas encore une comparaison fiable.",
  "source-incomplete": "La lecture des données est incomplète.",
  "no-current-events": "Aucune activité n’a été observée sur cette période.",
  "no-timestamped-events": "Aucune activité datée n’est disponible.",
  "no-category-evidence": "Le volume est insuffisant pour présenter les catégories.",
  "no-dish-ranking-evidence": "Le volume est insuffisant pour classer les plats.",
  "no-search-evidence": "Aucune recherche publiable n’est disponible."
};

export function adminFreshnessCopy(freshness: AdminAnalyticsFreshness): string {
  return freshnessCopy[freshness];
}

export function adminEvidenceReasonCopy(reason: string): string {
  return evidenceReasonCopy[reason] ?? "Les données ne permettent pas encore d’afficher cette analyse.";
}
