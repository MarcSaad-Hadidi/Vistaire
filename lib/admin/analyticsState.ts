export type AdminAnalyticsSource = "real" | "partial" | "empty" | "preview";

export type AdminAnalyticsState<TInsights> =
  | { kind: "real"; note: string; insights: TInsights }
  | {
      kind: "partial";
      title: string;
      message: string;
      note: string;
      insights: TInsights;
    }
  | { kind: "empty" | "preview"; title: string; message: string };

export function buildAdminAnalyticsState<TInsights>(result: {
  source: AdminAnalyticsSource;
  note: string;
  insights: TInsights;
}): AdminAnalyticsState<TInsights> {
  if (result.source === "real") {
    return { kind: "real", note: result.note, insights: result.insights };
  }

  if (result.source === "partial") {
    return {
      kind: "partial",
      title: "Données en cours de consolidation",
      message:
        "Données réelles — échantillon encore limité. Les tendances seront plus fiables avec davantage de consultations.",
      note: result.note,
      insights: result.insights
    };
  }

  if (result.source === "preview") {
    return {
      kind: "preview",
      title: "Prévisualisation locale",
      message:
        "Les chiffres de présentation restent masqués dans le dashboard restaurant."
    };
  }

  return {
    kind: "empty",
    title: "Pas encore de données d’activité",
    message:
      "Les premières tendances apparaîtront après les prochaines consultations du menu."
  };
}
