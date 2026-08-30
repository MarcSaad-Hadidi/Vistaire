import type { AdminMetricState } from "../data/contracts.ts";
import type { AdminReportLocale, AdminReportService } from "./contracts.ts";

const labels = {
  fr: {
    "observed-menu-opens": "Ouvertures du menu observées",
    "observed-dish-opens": "Fiches plats consultées",
    "observed-immersive-intents": "Intentions 3D observées",
    "observed-ar-intents": "Intentions AR observées",
    "observed-sessions": "Sessions observées",
    "catalog-dishes": "Plats au catalogue"
  },
  en: {
    "observed-menu-opens": "Observed menu opens",
    "observed-dish-opens": "Observed dish views",
    "observed-immersive-intents": "Observed 3D intents",
    "observed-ar-intents": "Observed AR intents",
    "observed-sessions": "Observed sessions",
    "catalog-dishes": "Catalog dishes"
  }
} as const;

export function reportMetricLabel(locale: AdminReportLocale, metricId: string): string {
  return (labels[locale] as Record<string, string>)[metricId] ?? (locale === "fr" ? "Signal observé" : "Observed signal");
}
export function reportStateCopy(locale: AdminReportLocale, state: AdminMetricState<unknown>, service: AdminReportService): string {
  if (service !== "all" && state.kind === "unmeasured" && state.reason === "unsupported-signal") {
    return locale === "fr"
      ? "Le découpage fiable par service n’est pas encore mesuré."
      : "A reliable service split is not measured yet.";
  }
  if (state.kind === "available") return locale === "fr" ? "Preuve disponible" : "Evidence available";
  if (state.kind === "insufficient") return locale === "fr" ? "Preuve insuffisante pour cette période." : "Insufficient evidence for this period.";
  if (state.kind === "unmeasured") return locale === "fr" ? "Signal non mesuré avec une instrumentation vérifiée." : "Signal not measured by verified instrumentation.";
  if (state.kind === "unavailable") return locale === "fr" ? "Source indisponible pour cette période." : "Source unavailable for this period.";
  if (state.kind === "truncated") return locale === "fr" ? "Lecture tronquée : aucun total n’est affiché." : "Truncated read: no total is displayed.";
  return locale === "fr" ? "Une erreur empêche la lecture de cette preuve." : "An error prevents this evidence from being read.";
}

export function comparisonCopy(locale: AdminReportLocale, changeRate: number | null): string {
  if (changeRate === null) {
    return locale === "fr"
      ? "Écart absolu comparé à la période alignée; taux non applicable sur une base nulle."
      : "Absolute difference against the aligned period; rate is not applicable with a zero baseline.";
  }
  return locale === "fr" ? "Comparé à la période alignée." : "Compared with the aligned period.";
}
