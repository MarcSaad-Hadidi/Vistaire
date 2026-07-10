function numberFrom(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function stringFrom(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function eventName(row) {
  return stringFrom(row, ["event_name", "eventName", "event_type"]);
}

function rowsFromEvents(events) {
  const dishes = new Map();
  const searches = new Map();
  const categories = new Map();

  for (const row of events) {
    const name = eventName(row);
    const dishSlug = stringFrom(row, ["dish_slug"]);
    if (dishSlug) {
      const current = dishes.get(dishSlug) ?? {
        dish_slug: dishSlug,
        dish_opened_count: 0,
        immersive_interaction_count: 0
      };
      if (name === "dish_opened") current.dish_opened_count += 1;
      if (name === "dish_3d_clicked" || name === "dish_ar_clicked") current.immersive_interaction_count += 1;
      dishes.set(dishSlug, current);
    }
    if (name === "search_used") {
      const term = stringFrom(row, ["search_query"]).toLowerCase();
      if (term) searches.set(term, (searches.get(term) ?? 0) + 1);
    }
    if (name === "category_viewed") {
      const categorySlug = stringFrom(row, ["category_slug"]);
      if (categorySlug) categories.set(categorySlug, (categories.get(categorySlug) ?? 0) + 1);
    }
  }

  return {
    dishRows: [...dishes.values()],
    searchRows: [...searches].map(([search_query, search_count]) => ({ search_query, search_count })),
    categoryRows: [...categories].map(([category_slug, category_viewed_count]) => ({ category_slug, category_viewed_count }))
  };
}

function metricsFromEvents(events) {
  return {
    menuOpens: events.filter((row) => eventName(row) === "menu_opened").length,
    sessions: new Set(events.map((row) => stringFrom(row, ["session_id"])).filter(Boolean)).size,
    dishViews: events.filter((row) => eventName(row) === "dish_opened").length,
    searches: events.filter((row) => eventName(row) === "search_used").length,
    filters: events.filter((row) => eventName(row) === "filter_used").length,
    immersive: events.filter((row) => ["dish_3d_clicked", "dish_ar_clicked"].includes(eventName(row))).length,
    ar: events.filter((row) => eventName(row) === "dish_ar_clicked").length,
    categoryViews: events.filter((row) => eventName(row) === "category_viewed").length
  };
}

function metricsFromDaily(rows) {
  const sum = (keys) => rows.reduce((total, row) => total + numberFrom(row, keys), 0);
  return {
    menuOpens: sum(["menu_opened_count", "menu_opens", "menu_opened"]),
    sessions: sum(["unique_sessions", "session_count"]),
    dishViews: sum(["dish_opened_count", "dish_views", "dish_opened"]),
    searches: sum(["search_used_count", "search_count", "searches"]),
    filters: sum(["filter_used_count", "filter_count", "filters"]),
    immersive: sum(["immersive_interaction_count", "dish_3d_clicked_count", "dish_ar_clicked_count", "immersive_interactions"]),
    ar: sum(["dish_ar_clicked_count", "dish_ar_clicked", "ar_clicks"]),
    categoryViews: sum(["category_viewed_count", "category_views"])
  };
}

/**
 * Builds strictly period-scoped metrics. Event dimensions intentionally have no
 * all-time fallback: an observed zero in this window is a real zero.
 */
export function buildPeriodAnalytics({ dailyRows = [], eventRows = [] }) {
  const useEvents = eventRows.length > 0;
  return {
    metrics: useEvents ? metricsFromEvents(eventRows) : metricsFromDaily(dailyRows),
    ...(rowsFromEvents(eventRows))
  };
}

export function hasPeriodActivity(metrics) {
  return Object.values(metrics).some((value) => value > 0);
}

export function resolveAnalyticsSourceHealth({ hasActivity, eventReadOk, eventTruncated, dailyReadOk, failedReads = 0 }) {
  if (eventTruncated || !eventReadOk || !dailyReadOk || failedReads > 0) return "partial";
  return hasActivity ? "real" : "empty";
}
