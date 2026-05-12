import "server-only";

import {
  getCategoryBySlug,
  getDishBySlug,
  type Category,
  type Dish
} from "@/lib/demoMenuData";
import {
  getDemoAdminInsights,
  type DemoAdminInsights,
  type SearchTrend,
  type ServiceActivity,
  type TopDishInsight
} from "@/lib/demoAdminInsights";
import {
  buildEngagementFunnel,
  buildRuleBasedAdminRecommendations,
  calculateDishInterestScore,
  enrichSearchInsights,
  getInterestLevelFromScore,
  getSearchInterpretation
} from "@/lib/admin/recommendations";
import {
  filterRowsByRestaurantId,
  getNumber,
  getString,
  readSupabaseRows,
  type AnyRow,
  type DataSourceStatus
} from "@/lib/analytics/serverRows";

export type RestaurantInsightsResult = {
  insights: DemoAdminInsights;
  source: DataSourceStatus;
  note: string;
};

const DEMO_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ??
  "11111111-1111-1111-1111-111111111111";

function compactDishName(name: string): string {
  return name
    .replace(", bisque corsée & fenouil", "")
    .replace(", bisque corsÃ©e & fenouil", "");
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-CA").format(Math.max(0, Math.round(value)));
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 s";
  if (value < 60) return `${Math.round(value)} s`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
}

function fallbackCategory(slug: string, name: string): Category {
  return {
    id: `category-${slug || "unknown"}`,
    slug: slug || "plats",
    name: name || "Carte",
    description: "",
    order: 99
  };
}

function fallbackDish(row: AnyRow, rank: number): Dish {
  const slug = getString(row, ["dish_slug", "dishSlug", "slug"], `plat-${rank}`);
  const name = getString(row, ["dish_name", "dishName", "name"], "Plat consulté");
  const categorySlug = getString(
    row,
    ["category_slug", "categorySlug"],
    "plats-signatures"
  );

  return {
    id: `dish-${slug}`,
    slug,
    name,
    categorySlug,
    shortDescription: "",
    description: "",
    price: 0,
    image: null,
    ingredients: [],
    allergens: [],
    options: [],
    sides: [],
    chefRecommendation: "",
    isSignature: false,
    isRecommended: false,
    isAvailable: true,
    preparationTime: "",
    model3dUrl: "",
    usdzUrl: ""
  };
}

function getDishViews(row: AnyRow): number {
  return getNumber(row, [
    "dish_views",
    "dish_view_count",
    "dish_opened",
    "views",
    "view_count",
    "total_views"
  ]);
}

function getImmersiveCount(row: AnyRow): number {
  return getNumber(row, [
    "immersive_interactions",
    "immersive_count",
    "dish_3d_clicked",
    "dish_ar_clicked",
    "three_d_clicks",
    "ar_clicks",
    "view_3d_count"
  ]);
}

function getEventName(row: AnyRow): string {
  return getString(row, ["event_name", "eventName", "event_type"], "");
}

function getEventDate(row: AnyRow): Date | null {
  const rawDate = getString(row, ["created_at", "timestamp", "occurred_at", "date", "day", "service_date"], "");
  if (!rawDate) return null;
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function filterRowsForCurrentDay(rows: AnyRow[]): {
  rows: AnyRow[];
  isCurrentDay: boolean;
} {
  const datedRows = rows.filter((row) => getEventDate(row));
  if (datedRows.length === 0) return { rows, isCurrentDay: false };

  const today = new Date();
  const currentRows = datedRows.filter((row) => {
    const date = getEventDate(row);
    return (
      date &&
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  });

  return currentRows.length > 0
    ? { rows: currentRows, isCurrentDay: true }
    : { rows: datedRows, isCurrentDay: false };
}

function getMetadataNumber(row: AnyRow, keys: string[]): number {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return 0;
  }

  return getNumber(metadata as AnyRow, keys);
}

function buildDishRowsFromEvents(eventRows: AnyRow[]): AnyRow[] {
  const bySlug = new Map<string, AnyRow>();

  for (const row of eventRows) {
    const eventName = getEventName(row);
    const slug = getString(row, ["dish_slug", "dishSlug"], "");
    if (!slug) continue;

    const current = bySlug.get(slug) ?? {
      dish_slug: slug,
      dish_opened: 0,
      dish_3d_clicked: 0,
      dish_ar_clicked: 0,
      cta_clicked: 0,
      total_duration_ms: 0,
      duration_events: 0
    };

    if (eventName === "dish_opened") {
      current.dish_opened = getNumber(current, ["dish_opened"]) + 1;
    }
    if (eventName === "dish_3d_clicked") {
      current.dish_3d_clicked = getNumber(current, ["dish_3d_clicked"]) + 1;
    }
    if (eventName === "dish_ar_clicked") {
      current.dish_ar_clicked = getNumber(current, ["dish_ar_clicked"]) + 1;
    }
    if (eventName === "cta_clicked") {
      current.cta_clicked = getNumber(current, ["cta_clicked"]) + 1;
    }
    if (eventName === "session_duration") {
      const durationMs = getMetadataNumber(row, ["durationMs", "duration_ms"]);
      if (durationMs > 0) {
        current.total_duration_ms =
          getNumber(current, ["total_duration_ms"]) + durationMs;
        current.duration_events = getNumber(current, ["duration_events"]) + 1;
      }
    }

    const categorySlug = getString(row, ["category_slug", "categorySlug"], "");
    if (categorySlug && !current.category_slug) current.category_slug = categorySlug;
    bySlug.set(slug, current);
  }

  return [...bySlug.values()].map((row) => {
    const durationEvents = getNumber(row, ["duration_events"]);
    return {
      ...row,
      dish_views: getNumber(row, ["dish_opened"]),
      immersive_interactions:
        getNumber(row, ["dish_3d_clicked"]) + getNumber(row, ["dish_ar_clicked"]),
      average_seconds:
        durationEvents > 0
          ? Math.round(getNumber(row, ["total_duration_ms"]) / durationEvents / 1_000)
          : 0
    };
  });
}

function buildSearchRowsFromEvents(eventRows: AnyRow[]): AnyRow[] {
  const byTerm = new Map<string, number>();

  for (const row of eventRows) {
    if (getEventName(row) !== "search_used") continue;
    const term = getString(row, ["search_query", "searchQuery", "search_term"], "");
    if (!term) continue;
    const key = term.toLowerCase();
    byTerm.set(key, (byTerm.get(key) ?? 0) + 1);
  }

  return [...byTerm.entries()].map(([term, count]) => ({
    search_query: term,
    count
  }));
}

function buildCategoryRowsFromEvents(eventRows: AnyRow[]): AnyRow[] {
  const bySlug = new Map<string, number>();

  for (const row of eventRows) {
    const eventName = getEventName(row);
    const categorySlug = getString(row, ["category_slug", "categorySlug"], "");
    if (!categorySlug) continue;
    if (eventName !== "category_viewed" && eventName !== "dish_opened") continue;
    bySlug.set(categorySlug, (bySlug.get(categorySlug) ?? 0) + 1);
  }

  return [...bySlug.entries()].map(([slug, count]) => {
    const category = getCategoryBySlug(slug);
    return {
      category_slug: slug,
      category_name: category?.name ?? "Carte",
      views: count
    };
  });
}

function countEvents(rows: AnyRow[], eventName: string): number {
  return rows.filter((row) => getEventName(row) === eventName).length;
}

function countDistinctSessions(rows: AnyRow[]): number {
  const sessions = new Set(
    rows
      .map((row) => getString(row, ["session_id", "sessionId"], ""))
      .filter(Boolean)
  );
  return sessions.size;
}

function countRelatedSearches(
  dishName: string,
  slug: string,
  searches: DemoAdminInsights["searchInsights"]
): number {
  const normalizedName = dishName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const slugTokens = slug.split("-").filter((token) => token.length >= 4);

  return searches.reduce((sum, search) => {
    const term = search.term
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    const matches =
      normalizedName.includes(term) ||
      slugTokens.some((token) => term.includes(token));
    return matches ? sum + search.count : sum;
  }, 0);
}

function buildTopDishes(
  rows: AnyRow[],
  searches: DemoAdminInsights["searchInsights"]
): TopDishInsight[] {
  const sorted = [...rows]
    .sort((a, b) => getDishViews(b) - getDishViews(a))
    .slice(0, 6);
  const rawScores = sorted.map((row, index) => {
    const slug = getString(row, ["dish_slug", "dishSlug", "slug"], `plat-${index + 1}`);
    const dish = (slug ? getDishBySlug(slug) : undefined) ?? fallbackDish(row, index + 1);
    const views = getDishViews(row);
    const immersiveInteractions = getImmersiveCount(row);
    const relatedSearchCount = countRelatedSearches(dish.name, slug, searches);
    const averageSeconds = getNumber(row, [
      "average_seconds",
      "average_duration_seconds",
      "avg_duration_seconds",
      "avg_seconds",
      "average_time_seconds"
    ]);

    return {
      slug,
      raw:
        views +
        immersiveInteractions * 3 +
        relatedSearchCount * 2 +
        (averageSeconds > 0 ? Math.min(10, averageSeconds / 12) : 0)
    };
  });
  const maxRawScore = Math.max(100, ...rawScores.map((item) => item.raw));

  return sorted.map((row, index) => {
    const slug = getString(row, ["dish_slug", "dishSlug", "slug"], "");
    const dish = (slug ? getDishBySlug(slug) : undefined) ?? fallbackDish(row, index + 1);
    const category =
      getCategoryBySlug(dish.categorySlug) ??
      fallbackCategory(
        dish.categorySlug,
        getString(row, ["category_name", "categoryName"], "Carte")
      );
    const views = getDishViews(row);
    const immersiveInteractions = getImmersiveCount(row);
    const averageSeconds = getNumber(row, [
      "average_seconds",
      "average_duration_seconds",
      "avg_duration_seconds",
      "avg_seconds",
      "average_time_seconds"
    ]);
    const relatedSearchCount = countRelatedSearches(dish.name, slug, searches);
    const interestScore = calculateDishInterestScore({
      views,
      immersiveInteractions,
      relatedSearchCount,
      averageSeconds: averageSeconds || null,
      maxRawScore
    });

    return {
      rank: index + 1,
      dish,
      category,
      views,
      averageTime: averageSeconds > 0 ? formatSeconds(averageSeconds) : "Non suivi",
      immersiveInteractions,
      interestScore,
      interestLevel: getInterestLevelFromScore(interestScore)
    };
  });
}

function buildSearchInsights(rows: AnyRow[]): DemoAdminInsights["searchInsights"] {
  return enrichSearchInsights([...rows]
    .sort((a, b) => getNumber(b, ["count", "search_count", "total"]) - getNumber(a, ["count", "search_count", "total"]))
    .slice(0, 7)
    .map((row) => {
      const count = getNumber(row, ["count", "search_count", "searches", "total"]);
      const trendRaw = getString(row, ["trend", "search_trend"], "Stable");
      const trend: SearchTrend =
        trendRaw === "En hausse" || trendRaw === "À observer" || trendRaw === "Stable"
          ? trendRaw
          : "Stable";

      return {
        term: getString(row, ["term", "search_query", "searchQuery", "search_term"], "Recherche"),
        count,
        trend,
        interpretation: getSearchInterpretation(
          getString(row, ["term", "search_query", "searchQuery", "search_term"], "Recherche")
        )
      };
    }));
}

function buildServiceActivity(rows: AnyRow[]): ServiceActivity[] {
  const buckets = [
    { label: "Midi", from: 11, to: 14, detail: "Ouvertures concentrées autour du service du midi." },
    { label: "Après-midi", from: 14, to: 18, detail: "Consultations entre les services." },
    { label: "Souper", from: 18, to: 23, detail: "Pic d'intérêt pendant le service du soir." },
    { label: "Fin de soirée", from: 23, to: 24, detail: "Explorations tardives du menu." }
  ];
  const counts = buckets.map(() => 0);

  for (const row of rows) {
    const eventName = getString(row, ["event_name", "eventName", "event_type"], "");
    if (eventName !== "menu_opened" && eventName !== "session_started") continue;
    const rawDate = getString(row, ["created_at", "timestamp", "occurred_at"], "");
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) continue;
    const hour = date.getHours();
    const index = buckets.findIndex((bucket) =>
      bucket.label === "Fin de soirée"
        ? hour >= bucket.from || hour < 2
        : hour >= bucket.from && hour < bucket.to
    );
    if (index >= 0) counts[index] += 1;
  }

  const total = counts.reduce((sum, value) => sum + value, 0);
  return buckets.map((bucket, index) => ({
    label: bucket.label,
    count: counts[index],
    share: total > 0 ? Math.round((counts[index] / total) * 100) : 0,
    detail: bucket.detail
  }));
}

function hasFilledMetric(insights: DemoAdminInsights, id: string): boolean {
  const value = insights.summary.find((item) => item.id === id)?.value.trim();
  return Boolean(value && value !== "0" && value !== "0 %" && value !== "Non suivi");
}

function hasCompleteAdminInsights(insights: DemoAdminInsights): boolean {
  const requiredMetrics = [
    "menu-opens",
    "anonymous-sessions",
    "dish-views",
    "searches",
    "immersive-views",
    "ar-option-used",
    "top-dish",
    "top-category"
  ];

  return (
    requiredMetrics.every((id) => hasFilledMetric(insights, id)) &&
    insights.topDishes.length >= 5 &&
    insights.searchInsights.length >= 5 &&
    insights.serviceActivity.some((item) => item.count > 0)
  );
}

function buildRealInsights(args: {
  dailyRows: AnyRow[];
  dishRows: AnyRow[];
  searchRows: AnyRow[];
  categoryRows: AnyRow[];
  eventRows: AnyRow[];
}): DemoAdminInsights | null {
  const dailyWindow = filterRowsForCurrentDay(args.dailyRows);
  const eventWindow = filterRowsForCurrentDay(args.eventRows);
  const dishWindow = filterRowsForCurrentDay(args.dishRows);
  const searchWindow = filterRowsForCurrentDay(args.searchRows);
  const categoryWindow = filterRowsForCurrentDay(args.categoryRows);
  const daily = dailyWindow.rows;
  const eventRows = eventWindow.rows;
  const effectiveSearchRows =
    searchWindow.rows.length > 0
      ? searchWindow.rows
      : buildSearchRowsFromEvents(eventRows);
  const searches = buildSearchInsights(effectiveSearchRows);
  const effectiveDishRows =
    dishWindow.rows.length > 0 ? dishWindow.rows : buildDishRowsFromEvents(eventRows);
  const topDishes = buildTopDishes(effectiveDishRows, searches);
  if (topDishes.length === 0) return null;

  const effectiveCategoryRows =
    categoryWindow.rows.length > 0
      ? categoryWindow.rows
      : buildCategoryRowsFromEvents(eventRows);
  const isCurrentDay =
    dailyWindow.isCurrentDay ||
    eventWindow.isCurrentDay ||
    dishWindow.isCurrentDay ||
    searchWindow.isCurrentDay ||
    categoryWindow.isCurrentDay;
  const activityScope = isCurrentDay ? "aujourd'hui" : "sur l'activité collectée";
  const menuOpens =
    daily.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "menu_opens",
          "menu_opened",
          "open_count",
          "sessions",
          "session_count"
        ]),
      0
    ) || countEvents(eventRows, "menu_opened");
  const anonymousSessions =
    daily.reduce(
      (sum, row) =>
        sum +
        getNumber(row, [
          "anonymous_sessions",
          "sessions",
          "session_count",
          "unique_sessions",
          "clients"
        ]),
      0
    ) || countDistinctSessions(eventRows);
  const dishViews =
    daily.reduce((sum, row) => sum + getDishViews(row), 0) ||
    topDishes.reduce((sum, dish) => sum + dish.views, 0);
  const searchCount =
    daily.reduce(
      (sum, row) => sum + getNumber(row, ["searches", "search_count", "search_used"]),
      0
    ) || searches.reduce((sum, search) => sum + search.count, 0);
  const immersiveCount =
    daily.reduce((sum, row) => sum + getImmersiveCount(row), 0) ||
    topDishes.reduce((sum, dish) => sum + dish.immersiveInteractions, 0);
  const arCount =
    daily.reduce(
      (sum, row) => sum + getNumber(row, ["ar_clicks", "dish_ar_clicked", "ar_count"]),
      0
    ) || countEvents(eventRows, "dish_ar_clicked");
  const categoryViews =
    daily.reduce(
      (sum, row) =>
        sum + getNumber(row, ["category_views", "category_viewed", "category_clicks"]),
      0
    ) || countEvents(eventRows, "category_viewed");
  const topCategoryRow = [...effectiveCategoryRows].sort(
    (a, b) =>
      getNumber(b, ["views", "view_count", "dish_views", "total"]) -
      getNumber(a, ["views", "view_count", "dish_views", "total"])
  )[0];
  const topCategory = topCategoryRow
    ? getString(topCategoryRow, ["category_name", "categoryName", "name"], "Carte")
    : topDishes[0]?.category.name ?? "Carte";
  const engagementFunnel = buildEngagementFunnel({
    menuOpens,
    categoryViews,
    dishOpens: dishViews,
    immersiveViews: immersiveCount
  });

  return {
    generatedFor: "Maison Élyse",
    serviceLabel: isCurrentDay
      ? "Aujourd'hui · Activité réelle"
      : "Activité collectée · Données réelles",
    dailySummary:
      topDishes.length > 0
        ? `${compactDishName(topDishes[0].dish.name)} génère le signal le plus fort. ${searches[0] ? `Les recherches « ${searches[0].term} » reviennent souvent dans l'activité client.` : "Les recherches se préciseront avec plus d'activité."}`
        : "Les tendances du menu se préciseront avec plus d'activité.",
    summary: [
      {
        id: "menu-opens",
        label: isCurrentDay
          ? "Ouvertures du menu aujourd'hui"
          : "Ouvertures du menu collectées",
        value: formatCount(menuOpens),
        helper: `Clients qui ont ouvert la carte Vistaire ${activityScope}.`
      },
      {
        id: "anonymous-sessions",
        label: "Sessions clients estimées",
        value: anonymousSessions > 0 ? formatCount(anonymousSessions) : "Non suivi",
        helper:
          anonymousSessions > 0
            ? "Sessions anonymes uniques observées sur le menu."
            : "Disponible quand les sessions anonymes sont collectées."
      },
      {
        id: "dish-views",
        label: "Plats consultés",
        value: formatCount(dishViews),
        helper: "Fiches plats vues pendant le service."
      },
      {
        id: "searches",
        label: "Recherches effectuées",
        value: formatCount(searchCount),
        helper: "Mots saisis dans la recherche du menu."
      },
      {
        id: "immersive-views",
        label: "Vues immersives",
        value: formatCount(immersiveCount),
        helper: "Clients qui ont exploré un plat en détail."
      },
      {
        id: "ar-option-used",
        label: "« Afficher devant moi »",
        value: formatCount(arCount),
        helper: "Moments où un client a voulu projeter le plat à table."
      },
      {
        id: "top-dish",
        label: "Plat le plus consulté",
        value: compactDishName(topDishes[0].dish.name),
        helper: "Le signal le plus fort du jour."
      },
      {
        id: "top-category",
        label: "Catégorie la plus populaire",
        value: topCategory,
        helper: "La section qui concentre le plus d'intérêt."
      }
    ],
    topDishes,
    searchInsights: searches,
    immersiveInsights: [
      {
        label: "Clients qui ont ouvert une vue immersive",
        value: formatCount(immersiveCount),
        helper: "Les plats que les clients prennent le temps d'explorer avant de choisir."
      },
      {
        label: "Clients qui ont utilisé « Afficher devant moi »",
        value: formatCount(arCount),
        helper: "Un signal fort d'envie et de projection à table."
      },
      {
        label: "Plat le plus exploré en vue immersive",
        value: compactDishName(topDishes[0].dish.name),
        helper: "Le plat qui déclenche le plus d'interactions avancées."
      },
      {
        label: "Taux d'utilisation immersive",
        value:
          dishViews > 0 ? `${Math.round((immersiveCount / dishViews) * 100)} %` : "0 %",
        helper: "Part des consultations qui déclenchent une expérience avancée."
      }
    ],
    engagementFunnel,
    serviceActivity:
      eventRows.length > 0
        ? buildServiceActivity(eventRows)
        : getDemoAdminInsights().serviceActivity.map((item) => ({ ...item, count: 0, share: 0 })),
    recommendations: buildRuleBasedAdminRecommendations({
      generatedFor: "Maison Élyse",
      serviceLabel: isCurrentDay
        ? "Aujourd'hui · Activité réelle"
        : "Activité collectée · Données réelles",
      dailySummary:
        topDishes.length > 0
          ? `${compactDishName(topDishes[0].dish.name)} génère le signal le plus fort sur l'activité collectée.`
          : "Les tendances du menu se préciseront avec plus d'activité.",
      summary: [
        {
          id: "top-category",
          label: "Catégorie la plus populaire",
          value: topCategory,
          helper: "La section qui concentre le plus d'intérêt."
        },
        {
          id: "immersive-views",
          label: "Vues immersives lancées",
          value: formatCount(immersiveCount),
          helper: "Clients qui ont exploré un plat en détail."
        }
      ],
      topDishes,
      searchInsights: searches,
      immersiveInsights: [
        {
          label: "Taux d'utilisation immersive",
          value:
            dishViews > 0
              ? `${Math.round((immersiveCount / dishViews) * 100)} %`
              : "0 %",
          helper: "Part des consultations qui déclenchent une expérience avancée."
        }
      ],
      engagementFunnel,
      serviceActivity: [],
      recommendations: []
    })
  };
}

export async function getRestaurantInsights(
  restaurantId = DEMO_RESTAURANT_ID
): Promise<RestaurantInsightsResult> {
  const [daily, dishes, searches, categories, events] = await Promise.all([
    readSupabaseRows("restaurant_daily_analytics", 90),
    readSupabaseRows("restaurant_dish_analytics", 200),
    readSupabaseRows("restaurant_search_analytics", 100),
    readSupabaseRows("restaurant_category_analytics", 100),
    readSupabaseRows("analytics_events", 1_000)
  ]);

  const realInsights =
    daily.ok || dishes.ok || searches.ok || categories.ok || events.ok
      ? buildRealInsights({
          dailyRows: daily.ok ? filterRowsByRestaurantId(daily.rows, restaurantId) : [],
          dishRows: dishes.ok ? filterRowsByRestaurantId(dishes.rows, restaurantId) : [],
          searchRows: searches.ok ? filterRowsByRestaurantId(searches.rows, restaurantId) : [],
          categoryRows: categories.ok ? filterRowsByRestaurantId(categories.rows, restaurantId) : [],
          eventRows: events.ok ? filterRowsByRestaurantId(events.rows, restaurantId) : []
        })
      : null;

  if (realInsights && hasCompleteAdminInsights(realInsights)) {
    return {
      insights: realInsights,
      source: "supabase",
      note: "Données collectées sur le menu Vistaire."
    };
  }

  return {
    insights: getDemoAdminInsights(),
    source: "fallback",
    note: "Données de démonstration pour illustrer les insights Vistaire."
  };
}

export function getDemoRestaurantId(): string {
  return DEMO_RESTAURANT_ID;
}
