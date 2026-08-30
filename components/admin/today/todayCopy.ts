import type { AdminLocale } from "../../../lib/admin/foundationRoutes.ts";
import type { AdminMetricId, AdminMetricState } from "../../../lib/admin/data/contracts.ts";

export const TODAY_COPY = {
  fr: {
    pageTitle: "Aujourd’hui — Centre de pilotage du service",
    pageSubtitle: "Votre centre de commandement en temps réel pour un service d’exception.",
    briefing: "Briefing live du service",
    pulse: "Pouls du service",
    activity: "Progression du service",
    alerts: "Centre d’alertes",
    topDishes: "Top plats du service",
    timeline: "Chronologie du service",
    searches: "Recherches observées",
    menuHealth: "Santé du menu",
    quickActions: "Actions rapides autorisées",
    viewDetails: "Voir le détail",
    currentPeriod: "Période en cours",
    comparedPeriod: "Comparaison non mesurable",
    totalDishes: "Plats au catalogue",
    provenanceCatalog: "Catalogue du menu",
    provenanceObserved: "Interactions observées",
    unavailableValue: "—"
  },
  en: {
    pageTitle: "Today — Service command centre",
    pageSubtitle: "Reliable menu signals brought together to follow the service in progress.",
    briefing: "Service briefing",
    pulse: "Service pulse",
    activity: "Service progress",
    alerts: "Alert centre",
    topDishes: "Most viewed dishes",
    timeline: "Service timeline",
    searches: "Observed searches",
    menuHealth: "Menu health",
    quickActions: "Quick actions",
    viewDetails: "View details",
    currentPeriod: "Current period",
    comparedPeriod: "Comparison cannot be measured",
    totalDishes: "Dishes in the catalogue",
    provenanceCatalog: "Menu catalogue",
    provenanceObserved: "Observed interactions",
    unavailableValue: "—"
  }
} as const;

const METRIC_LABELS: Record<AdminLocale, Partial<Record<AdminMetricId, string>>> = {
  fr: {
    "observed-sessions": "Sessions observées",
    "observed-menu-opens": "Ouvertures du menu observées",
    "observed-dish-opens": "Fiches plats consultées",
    "observed-immersive-intents": "Intentions 3D observées",
    "private-search-ranking": "Recherches admises",
    "catalog-dishes": "Plats au catalogue",
    "activity-series": "Activité observée",
    "dish-ranking": "Consultations par plat",
    "time-distribution": "Répartition dans le temps",
    "asset-errors": "Alertes d’assets"
  },
  en: {
    "observed-sessions": "Observed sessions",
    "observed-menu-opens": "Observed menu opens",
    "observed-dish-opens": "Dish page views",
    "observed-immersive-intents": "Observed 3D intents",
    "private-search-ranking": "Admitted searches",
    "catalog-dishes": "Dishes in the catalogue",
    "activity-series": "Observed activity",
    "dish-ranking": "Views by dish",
    "time-distribution": "Distribution over time",
    "asset-errors": "Asset alerts"
  }
};

const STATE_COPY = {
  fr: {
    insufficient: "Le volume observé est insuffisant pour afficher cette analyse.",
    unmeasured: "Ce signal n’est pas encore mesuré de façon vérifiable.",
    unavailable: "Cette donnée n’est pas disponible pour ce périmètre.",
    error: "La preuve n’a pas pu être lue. Réessayez dans quelques instants.",
    truncated: "La lecture a atteint sa limite; aucun total incomplet n’est affiché."
  },
  en: {
    insufficient: "The observed sample is too small to show this analysis.",
    unmeasured: "This signal is not yet measured with verified instrumentation.",
    unavailable: "This evidence is unavailable for the current scope.",
    error: "The evidence could not be read. Try again in a moment.",
    truncated: "The read reached its limit; no partial total is shown."
  }
} as const;

const STATE_LABELS = {
  fr: {
    insufficient: "Preuve insuffisante",
    unmeasured: "Non mesuré",
    unavailable: "Indisponible",
    error: "Erreur de lecture",
    truncated: "Lecture tronquée"
  },
  en: {
    insufficient: "Insufficient evidence",
    unmeasured: "Not measured",
    unavailable: "Unavailable",
    error: "Read error",
    truncated: "Truncated read"
  }
} as const;

export function todayMetricLabel(locale: AdminLocale, metricId: AdminMetricId): string {
  return METRIC_LABELS[locale][metricId] ?? metricId;
}

export function todayStateCopy(
  locale: AdminLocale,
  state: Exclude<AdminMetricState<unknown>, { kind: "available" }>
): string {
  return STATE_COPY[locale][state.kind];
}

export function todayStateLabel(
  locale: AdminLocale,
  state: Exclude<AdminMetricState<unknown>, { kind: "available" }>
): string {
  return STATE_LABELS[locale][state.kind];
}
