import type {
  AdminRecommendation,
  DemoAdminInsights,
  InterestLevel,
  SearchInsight,
  TopDishInsight
} from "@/lib/demoAdminInsights";

export type DishInterestInput = {
  views: number;
  immersiveInteractions: number;
  relatedSearchCount?: number;
  averageSeconds?: number | null;
  maxRawScore?: number;
};

export type AssistantAnswerInput = {
  insights: DemoAdminInsights;
  mode: "summary" | "question";
  question?: string;
};

const FORBIDDEN_BUSINESS_METRIC_PATTERNS = [
  /\bvente[s]?\b/i,
  /\bvendu[s]?\b/i,
  /\brevenu[s]?\b/i,
  /\bprofit[s]?\b/i,
  /\bchiffre d affaires\b/i,
  /\bca\b/i,
  /\bmarge\b/i,
  /\brentabilite\b/i,
  /\brecette[s]?\b/i,
  /\bconversion[s]?\b/i,
  /\broi\b/i,
  /\bcommande[s]?\b/i,
  /\bcommande(?:e|es|s)?\b/i,
  /\bdemande[s]? de plat[s]?\b/i,
  /\bintention[s]? de commande\b/i,
  /\bpanier moyen\b/i,
  /\bticket moyen\b/i,
  /\bcouvert[s]?\b/i,
  /\bsatisfaction\b/i,
  /\bavis\b/i,
  /\brating\b/i,
  /\bsales\b/i,
  /\border[s]?\b/i,
  /\brevenue\b/i,
  /\breservation[s]?\b/i
];

const FORBIDDEN_MENU_CRITIQUE_PATTERNS = [
  /\bamelior(?:er|ez|ation|e|é|ée|es|és)\b/i,
  /\bclarifi(?:er|ez|cation|e|é|ée|es|és)\b/i,
  /\bcorrig(?:er|ez|e|é|ée|es|és)\b/i,
  /\bpas clair\b/i,
  /\bmanque(?:nt|r|z)?\b/i,
  /\bprobleme\b/i,
  /\bproblème\b/i,
  /\bmieux organis/i,
  /\brendre plus visible\b/i,
  /\bplus facile[s]? a reperer\b/i,
  /\bplus facile[s]? à repérer\b/i,
  /\bphoto\b/i,
  /\bphotos\b/i,
  /\bdesign\b/i,
  /\bconfiguration\b/i,
  /\bimage de presentation\b/i,
  /\bimage de présentation\b/i,
  /\bpresentation\b/i,
  /\bprésentation\b/i,
  /\bposition dans (?:la|le) (?:carte|menu)\b/i,
  /\bplace du plat\b/i,
  /\blibelle du bouton\b/i,
  /\blibellé du bouton\b/i,
  /\bconfus(?:e|es)?\b/i,
  /\bmal (?:mis|mise|présenté|presente|présentée)\b/i,
  /\bne comprend(?: pas|ent pas)\b/i,
  /\bqualite du menu\b/i,
  /\bqualité du menu\b/i
];

const MENU_AUDIT_QUESTION_PATTERNS = [
  /\bcomment\s+amelior/i,
  /\bcomment\s+amélior/i,
  /\bqu['’]est-ce qui ne va pas\b/i,
  /\bprobleme\b/i,
  /\bproblème\b/i,
  /\bcorrig/i,
  /\bmal present/i,
  /\bmal présent/i,
  /\bpas clair\b/i,
  /\bclarifi/i,
  /\bmieux organis/i,
  /\bdesign\b/i,
  /\bphoto\b/i,
  /\bphotos\b/i,
  /\bconfiguration\b/i,
  /\bqualite\b/i,
  /\bqualité\b/i
];

const OFF_TOPIC_TERMS = [
  "profit",
  "revenu",
  "vente",
  "vendu",
  "chiffre d'affaires",
  "marge",
  "rentabilite",
  "rentabilité",
  "recette",
  "conversion",
  "commande",
  "panier",
  "ticket moyen",
  "couverts",
  "reservation",
  "réservation",
  "avis",
  "satisfaction",
  "email",
  "telephone",
  "téléphone",
  "ip",
  "secret",
  "cle api",
  "clé api",
  "mot de passe",
  "prompt",
  "system",
  "meteo",
  "météo",
  "chanson",
  "code"
];

const OFF_TOPIC_PATTERNS = [/\bca\b/i, /\broi\b/i];

const IN_SCOPE_TERMS = [
  "menu",
  "plat",
  "plats",
  "categorie",
  "catégorie",
  "categories",
  "catégories",
  "client",
  "clients",
  "cherche",
  "cherchent",
  "recherche",
  "recherches",
  "immersive",
  "immersion",
  "3d",
  "ar",
  "afficher devant moi",
  "activité",
  "activite",
  "service",
  "soir",
  "soirée",
  "midi",
  "attention",
  "consulté",
  "consulte",
  "consultés",
  "consultes",
  "faible",
  "populaire",
  "mettre en avant",
  "surveiller"
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function metricValue(insights: DemoAdminInsights, id: string): string {
  return insights.summary.find((item) => item.id === id)?.value ?? "non suivi";
}

function compactDishName(name: string): string {
  return name
    .replace(", bisque corsée & fenouil", "")
    .replace(", bisque corsÃ©e & fenouil", "")
    .trim();
}

function formatPercent(value: number): string {
  return `${Math.max(0, Math.round(value))} %`;
}

export function containsForbiddenBusinessMetric(text: string): boolean {
  const normalized = normalizeText(text);
  return FORBIDDEN_BUSINESS_METRIC_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
}

export function containsForbiddenMenuCritique(text: string): boolean {
  const normalized = normalizeText(text);
  return FORBIDDEN_MENU_CRITIQUE_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
}

export function containsForbiddenAdminAssistantContent(text: string): boolean {
  return (
    containsForbiddenBusinessMetric(text) ||
    containsForbiddenMenuCritique(text)
  );
}

export function calculateDishInterestScore(input: DishInterestInput): number {
  const rawScore =
    Math.max(0, input.views) +
    Math.max(0, input.immersiveInteractions) * 3 +
    Math.max(0, input.relatedSearchCount ?? 0) * 2 +
    (input.averageSeconds && input.averageSeconds > 0
      ? clampNumber(input.averageSeconds / 12, 0, 10)
      : 0);
  const maxRawScore = Math.max(1, input.maxRawScore ?? rawScore);

  return Math.round(clampNumber((rawScore / maxRawScore) * 100, 0, 100));
}

export function getInterestLevelFromScore(score: number): InterestLevel {
  if (score >= 75) return "Très fort";
  if (score >= 45) return "Bon";
  if (score >= 20) return "À observer";
  return "Plus discret";
}

export function getSearchInterpretation(term: string): string {
  const normalized = normalizeText(term);

  if (normalized.includes("gluten") || normalized.includes("allerg")) {
    return "Préférences alimentaires présentes";
  }
  if (normalized.includes("homard") || normalized.includes("signature")) {
    return "Fort intérêt signature";
  }
  if (normalized.includes("dessert") || normalized.includes("chocolat")) {
    return "Intérêt en fin de repas";
  }
  if (normalized.includes("vegetarien") || normalized.includes("vegan")) {
    return "Préférence alimentaire suivie";
  }
  if (normalized.includes("cocktail") || normalized.includes("negroni")) {
    return "Attention en fin de soirée";
  }
  if (normalized.includes("poisson") || normalized.includes("saumon")) {
    return "Intérêt pour les produits de mer";
  }

  return "Lecture à suivre";
}

export function enrichSearchInsights(searches: SearchInsight[]): SearchInsight[] {
  return searches.map((search) => ({
    ...search,
    interpretation: search.interpretation ?? getSearchInterpretation(search.term)
  }));
}

export function isAdminAssistantQuestionInScope(question: string): boolean {
  const normalized = normalizeText(question);
  if (!normalized || normalized.length > 260) return false;
  if (/https?:\/\//i.test(question)) return false;
  if (OFF_TOPIC_TERMS.some((term) => normalized.includes(normalizeText(term)))) {
    return false;
  }
  if (OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  return IN_SCOPE_TERMS.some((term) => normalized.includes(normalizeText(term)));
}

export function isMenuAuditQuestion(question: string): boolean {
  const normalized = normalizeText(question);
  return MENU_AUDIT_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function topSearch(insights: DemoAdminInsights): SearchInsight | undefined {
  return [...insights.searchInsights].sort((a, b) => b.count - a.count)[0];
}

function weakestDish(dishes: TopDishInsight[]): TopDishInsight | undefined {
  return [...dishes]
    .filter((item) => item.views > 0)
    .sort((a, b) => a.views - b.views)[0];
}

function immersiveOpportunity(dishes: TopDishInsight[]): TopDishInsight | undefined {
  return [...dishes]
    .filter((item) => item.views >= 20)
    .sort((a, b) => {
      const aRatio = a.immersiveInteractions / Math.max(1, a.views);
      const bRatio = b.immersiveInteractions / Math.max(1, b.views);
      return aRatio - bRatio;
    })[0];
}

function getPopularCategory(insights: DemoAdminInsights): string {
  return metricValue(insights, "top-category");
}

function getImmersiveUsage(insights: DemoAdminInsights): string {
  return (
    insights.immersiveInsights.find((item) =>
      normalizeText(item.label).includes("taux")
    )?.value ?? metricValue(insights, "immersive-views")
  );
}

export function buildRuleBasedAdminRecommendations(
  insights: DemoAdminInsights
): AdminRecommendation[] {
  const recommendations: AdminRecommendation[] = [];
  const topDishInsight = insights.topDishes[0];
  const topDishHasTrackedActivity =
    Boolean(topDishInsight) &&
    ((topDishInsight?.views ?? 0) > 0 ||
      (topDishInsight?.immersiveInteractions ?? 0) > 0);
  const search = topSearch(insights);
  const lowDish = weakestDish(insights.topDishes);
  const immersiveCandidate = immersiveOpportunity(insights.topDishes);
  const popularCategory = getPopularCategory(insights);

  if (topDishInsight && topDishHasTrackedActivity) {
    recommendations.push({
      type: "Fort intérêt",
      title: `${compactDishName(topDishInsight.dish.name)} attire beaucoup d'attention.`,
      body: "Les clients ouvrent souvent sa fiche et utilisent la vue immersive : c'est le signal d'intérêt le plus fort du service."
    });
  }

  if (search) {
    recommendations.push({
      type: "Recherche fréquente",
      title: `Les recherches « ${search.term} » reviennent souvent.`,
      body: `${search.interpretation ?? getSearchInterpretation(search.term)}. C'est un signal d'intérêt client à suivre pendant le service.`
    });
  }

  if (
    immersiveCandidate &&
    immersiveCandidate.views > 0 &&
    immersiveCandidate.immersiveInteractions / immersiveCandidate.views < 0.08
  ) {
    recommendations.push({
      type: "Vue immersive",
      title: `${compactDishName(immersiveCandidate.dish.name)} reçoit moins d'interactions immersives aujourd'hui.`,
      body: topDishInsight
        ? `Les interactions immersives sont plus fortes sur ${compactDishName(topDishInsight.dish.name)} aujourd'hui.`
        : "Les interactions immersives se concentrent sur d'autres plats aujourd'hui."
    });
  }

  if (lowDish && topDishInsight && lowDish.dish.slug !== topDishInsight.dish.slug) {
    recommendations.push({
      type: "À observer",
      title: `${compactDishName(lowDish.dish.name)} reçoit moins d'attention.`,
      body: `Les clients se concentrent davantage sur ${compactDishName(topDishInsight.dish.name)} dans l'activité collectée.`
    });
  }

  if (popularCategory !== "non suivi") {
    recommendations.push({
      type: "Tendance du service",
      title: `${popularCategory} concentre l'intérêt client.`,
      body: "Les consultations se regroupent dans cette section pendant le service."
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: "Signal client",
      title: "Les tendances se préciseront après plus d'ouvertures du menu.",
      body: "Vistaire affichera les plats, recherches et moments de service les plus observés dès que l'activité sera suffisante."
    });
  }

  return recommendations
    .filter(
      (item) =>
        !containsForbiddenAdminAssistantContent(
          `${item.type} ${item.title} ${item.body}`
        )
    )
    .slice(0, 5);
}

export function buildRuleBasedAdminAssistantAnswer({
  insights,
  mode,
  question = ""
}: AssistantAnswerInput): string {
  const topDishInsight = insights.topDishes[0];
  const topDishHasTrackedActivity =
    Boolean(topDishInsight) &&
    ((topDishInsight?.views ?? 0) > 0 ||
      (topDishInsight?.immersiveInteractions ?? 0) > 0);
  const search = topSearch(insights);
  const popularCategory = getPopularCategory(insights);
  const immersiveUsage = getImmersiveUsage(insights);
  const lowDish = weakestDish(insights.topDishes);
  const normalizedQuestion = normalizeText(question);
  const reframePrefix =
    "Je peux surtout vous aider à lire le comportement des clients.";

  if (mode === "question" && !isAdminAssistantQuestionInScope(question)) {
    return `${reframePrefix} Je suis les plats consultés, les recherches, les catégories ouvertes, les vues immersives et les moments de service.`;
  }

  if (mode === "question" && isMenuAuditQuestion(question)) {
    return topDishInsight && topDishHasTrackedActivity
      ? `${reframePrefix} Aujourd'hui, les clients consultent surtout ${compactDishName(topDishInsight.dish.name)}. Les recherches fréquentes${search ? ` autour de « ${search.term} »` : ""} indiquent aussi un signal d'intérêt à suivre pendant le service.`
      : `${reframePrefix} Les tendances se préciseront avec plus d'ouvertures, de recherches et de vues immersives.`;
  }

  if (mode === "summary") {
    const parts = [
      `${metricValue(insights, "menu-opens")} ouvertures du menu sont visibles sur l'activité collectée.`,
      topDishInsight && topDishHasTrackedActivity
        ? `${compactDishName(topDishInsight.dish.name)} génère le signal le plus fort.`
        : "Les plats les plus consultés se préciseront avec plus d'activité.",
      search
        ? `Les clients cherchent surtout « ${search.term} » : ${search.interpretation ?? getSearchInterpretation(search.term).toLowerCase()}.`
        : "Aucune recherche client fiable n'est encore remontée.",
      `Usage immersif : ${immersiveUsage}.`,
      topDishInsight && topDishHasTrackedActivity
        ? `Signal client : ${compactDishName(topDishInsight.dish.name)} concentre l'attention, tandis que les recherches fréquentes montrent les sujets que les clients explorent.`
        : "Signal client : laissez le suivi collecter davantage d'ouvertures, de recherches et de vues immersives."
    ];

    return parts.join(" ");
  }

  if (
    normalizedQuestion.includes("mettre en avant") ||
    normalizedQuestion.includes("quel plat") ||
    normalizedQuestion.includes("ce soir")
  ) {
    return topDishInsight && topDishHasTrackedActivity
      ? `${compactDishName(topDishInsight.dish.name)} attire le plus d'attention dans l'activité du menu, avec ${topDishInsight.views} ouvertures de fiche et ${topDishInsight.immersiveInteractions} vues immersives.`
      : search
        ? `Aucun plat consulté ne se détache encore nettement. Pour ce service, le signal le plus présent vient des recherches « ${search.term} ».`
        : "Aucun plat ne se détache encore nettement. Les tendances se préciseront après plus d'ouvertures du menu.";
  }

  if (normalizedQuestion.includes("cherch")) {
    return search
      ? `Les clients cherchent surtout « ${search.term} » (${search.count} recherches). Lecture simple : ${search.interpretation ?? getSearchInterpretation(search.term)}.`
      : "Aucune recherche fréquente n'est encore disponible sur l'activité collectée.";
  }

  if (
    normalizedQuestion.includes("immers") ||
    normalizedQuestion.includes("3d") ||
    normalizedQuestion.includes("ar") ||
    normalizedQuestion.includes("afficher devant moi")
  ) {
    return `Oui, le suivi montre un usage immersif à observer : ${immersiveUsage}. Les clients explorent surtout les plats qui concentrent déjà le plus d'attention.`;
  }

  if (
    normalizedQuestion.includes("moins") ||
    normalizedQuestion.includes("peu") ||
    normalizedQuestion.includes("faible") ||
    normalizedQuestion.includes("surveiller")
  ) {
    return lowDish
      ? `${compactDishName(lowDish.dish.name)} reçoit moins d'attention dans la liste actuelle. Les clients se concentrent davantage sur ${topDishInsight ? compactDishName(topDishInsight.dish.name) : "les plats les plus consultés"} aujourd'hui.`
        : "Aucun signal discret n'est encore identifiable avec suffisamment de confiance.";
  }

  if (normalizedQuestion.includes("categorie") || normalizedQuestion.includes("catégorie")) {
    return `${popularCategory} attire le plus l'attention. Les consultations se concentrent surtout dans cette catégorie pendant le service.`;
  }

  return buildRuleBasedAdminAssistantAnswer({ insights, mode: "summary" });
}

export function buildEngagementFunnel(args: {
  menuOpens: number;
  categoryViews: number;
  dishOpens: number;
  immersiveViews: number;
}): DemoAdminInsights["engagementFunnel"] {
  const firstStep = Math.max(0, args.menuOpens);
  const denominator = Math.max(1, firstStep);
  const steps = [
    {
      id: "menu-opened",
      label: "Menu ouvert",
      value: firstStep,
      helper: "Ouvertures de la carte Vistaire."
    },
    {
      id: "category-viewed",
      label: "Catégorie consultée",
      value: Math.max(0, args.categoryViews),
      helper: "Clients qui explorent une section."
    },
    {
      id: "dish-opened",
      label: "Plat ouvert",
      value: Math.max(0, args.dishOpens),
      helper: "Fiches plats ouvertes."
    },
    {
      id: "immersive-launched",
      label: "Vue immersive lancée",
      value: Math.max(0, args.immersiveViews),
      helper: "Vues 3D ou option « Afficher devant moi »."
    }
  ];

  return steps.map((step, index) => ({
    ...step,
    share: index === 0 ? 100 : Math.round((step.value / denominator) * 100)
  }));
}

export function formatAssistantMetricPercent(value: number, total: number): string {
  if (total <= 0) return "0 %";
  return formatPercent((value / total) * 100);
}
