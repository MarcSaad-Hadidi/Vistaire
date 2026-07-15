import test from "node:test";
import assert from "node:assert/strict";

const window = { range: "7d", startInclusive: "a", endExclusive: "b", comparisonStartInclusive: "c", comparisonEndExclusive: "a" };

test("evidence never promotes failures, truncation or unproven zero", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  assert.equal(buildAdminAnalyticsState({ observationWindow: window, databaseError: true }).kind, "unavailable");
  assert.equal(buildAdminAnalyticsState({ observationWindow: window, truncated: true }).completeness, "truncated");
  assert.equal(buildAdminAnalyticsState({ observationWindow: window, partialSource: true }).completeness, "partial-source");
  assert.equal(buildAdminAnalyticsState({ observationWindow: window, instrumentationProven: false, eventCount: 0 }).reason, "instrumentation-unproven");
});

test("complete zero and small samples remain distinct and comparisons avoid division by zero", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const zero = buildAdminAnalyticsState({ observationWindow: window, instrumentationProven: true, eventCount: 0 });
  assert.equal(zero.kind, "insufficient");
  assert.equal(zero.reason, "no-relevant-events");
  const limited = buildAdminAnalyticsState({ observationWindow: window, instrumentationProven: true, eventCount: 5, metrics: [{ id: "opens", value: 3, baseline: 0 }] });
  assert.equal(limited.completeness, "limited-sample");
  assert.equal(limited.metrics[0].changeRate, null);
});

test("final real state carries the complete evidence contract and thresholds", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const state = buildAdminAnalyticsState({ observationWindow: window, instrumentationProven: true, eventCount: 25, metrics: [] });
  assert.equal(state.kind, "real");
  for (const key of ["freshness", "coverage", "metrics", "activitySeries", "categoryBreakdown", "topDishes", "searches", "immersive", "funnel", "comparison"]) assert.ok(key in state, key);
  const small = buildAdminAnalyticsState({ observationWindow: window, instrumentationProven: true, eventCount: 2 });
  assert.equal(small.kind, "insufficient");
  assert.equal(small.reason, "sample-too-small");
});

test("cta-only traffic never proves menu or dish instrumentation", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const events = Array.from({ length: 25 }, (_, index) => ({ id: `${index}`, event_name: "cta_clicked", session_id: `s${index}`, created_at: `2026-07-0${(index % 2) + 1}T10:00:00.000Z` }));
  const state = buildAdminAnalyticsState({ observationWindow: window, events });
  assert.equal(state.kind, "insufficient");
  assert.equal(state.reason, "instrumentation-unproven");
});

test("analytics aggregates obey independent evidence thresholds", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const events = [];
  for (let index = 0; index < 20; index++) {
    const session_id = `s${index}`;
    const created_at = `2026-07-${index < 10 ? "03" : "04"}T10:00:00.000Z`;
    events.push({ id: `m${index}`, event_name: "menu_opened", session_id, created_at });
    events.push({ id: `d${index}`, event_name: "dish_opened", session_id, created_at, dish_slug: index < 5 ? "a" : "b", category_slug: "plats" });
    events.push({ id: `q${index}`, event_name: "search_used", session_id, created_at, search_query: index < 3 ? "saumon" : "" });
  }
  const state = buildAdminAnalyticsState({ observationWindow: window, events });
  assert.equal(state.kind, "real");
  assert.equal(state.activitySeries.length, 2);
  assert.deepEqual(state.topDishes.map((item) => item.slug), ["b", "a"]);
  assert.deepEqual(state.searches, [{ term: "saumon", count: 3 }]);
  assert.equal(state.funnel.kind, "measured");
});

test("panel evidence derives compatible current and previous UTC days", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  const scope = { restaurantId: "r1", menuId: "m1", source: "production", metricDefinition: "all-events-v1" };
  const panels = buildAdminAnalyticsPanels({
    currentEvents: [
      { event_name: "menu_opened", created_at: "2026-07-10T10:00:00.000Z" },
      { event_name: "dish_opened", created_at: "2026-07-10T11:00:00.000Z", dish_slug: "sole", category_slug: "plats" }
    ],
    previousEvents: [
      { event_name: "menu_opened", created_at: "2026-07-03T10:00:00.000Z" },
      { event_name: "dish_opened", created_at: "2026-07-03T11:00:00.000Z", dish_slug: "sole", category_slug: "plats" }
    ],
    currentDurationMs: 86_400_000,
    previousDurationMs: 86_400_000,
    currentScope: scope,
    previousScope: scope
  });
  assert.equal(panels.dailyComparison.kind, "supported");
  assert.deepEqual(panels.dailyComparison.data.current, [{ day: "2026-07-10", count: 2 }]);
  assert.deepEqual(panels.dailyComparison.data.previous, [{ day: "2026-07-03", count: 2 }]);
});

test("panel evidence exposes UTC heatmap, category and service windows without inferred timezone", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  const panels = buildAdminAnalyticsPanels({
    currentEvents: [
      { event_name: "menu_opened", created_at: "2026-07-06T12:15:00.000Z" },
      { event_name: "dish_opened", created_at: "2026-07-06T19:30:00.000Z", dish_slug: "sole", category_slug: "plats" }
    ],
    previousEvents: [], currentDurationMs: 1, previousDurationMs: 1
  });
  assert.deepEqual(panels.hourWeekday, { kind: "supported", data: [{ weekdayUtc: 1, hourUtc: 12, count: 1 }, { weekdayUtc: 1, hourUtc: 19, count: 1 }] });
  assert.equal(panels.serviceWindows.kind, "supported");
  assert.equal(panels.serviceWindows.data.timezone, "UTC");
  assert.deepEqual(panels.serviceWindows.data.windows.filter((item) => item.count), [
    { id: "lunch", label: "Midi", startHourUtc: 11, endHourUtc: 15, count: 1 },
    { id: "dinner", label: "Soirée", startHourUtc: 18, endHourUtc: 24, count: 1 }
  ]);
  assert.deepEqual(panels.categories, { kind: "insufficient", reason: "no-category-evidence" });
});

test("single buckets are supported while absent and incomplete sources stay explicit", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  const scope = { restaurantId: "r1", menuId: "m1", source: "production", metricDefinition: "all-events-v1" };
  const single = buildAdminAnalyticsPanels({ currentEvents: [{ event_name: "menu_opened", created_at: "2026-07-10T10:00:00.000Z" }], previousEvents: [], currentDurationMs: 1, previousDurationMs: 1, currentScope: scope, previousScope: scope });
  assert.equal(single.currentDaily.kind, "supported");
  assert.equal(single.dailyComparison.kind, "insufficient");
  assert.equal(single.categories.kind, "insufficient");
  const unavailable = buildAdminAnalyticsPanels({ currentEvents: [], previousEvents: [], currentDurationMs: 1, previousDurationMs: 1, currentScope: scope, previousScope: scope, sourceComplete: false });
  for (const panel of Object.values(unavailable)) assert.equal(panel.kind, "unavailable");
});

test("dense comparison stays insufficient without valid previous in-window evidence", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  const scope = { restaurantId: "r1", menuId: "m1", source: "production", metricDefinition: "all-events-v1" };
  const base = {
    currentEvents: [{ event_name: "menu_opened", created_at: "2026-07-10T10:00:00.000Z" }],
    currentDurationMs: 86_400_000,
    previousDurationMs: 86_400_000,
    currentScope: scope,
    previousScope: scope,
    currentPeriod: { startInclusive: "2026-07-10T00:00:00.000Z", endExclusive: "2026-07-11T00:00:00.000Z", bucketCount: 1 },
    previousPeriod: { startInclusive: "2026-07-09T00:00:00.000Z", endExclusive: "2026-07-10T00:00:00.000Z", bucketCount: 1 }
  };
  for (const previousEvents of [[], [{ event_name: "menu_opened", created_at: "invalid" }], [{ event_name: "menu_opened", created_at: "2026-07-08T10:00:00.000Z" }]]) {
    const panels = buildAdminAnalyticsPanels({ ...base, previousEvents });
    assert.deepEqual(panels.dailyComparison, { kind: "insufficient", reason: "incompatible-or-empty-period" });
  }
});

test("valid ranking samples retain every exact dish and category count", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  const counts = [8, 5, 3, 2, 1, 1];
  const currentEvents = counts.flatMap((count, item) => Array.from({ length: count }, (_, index) => ({
    event_name: "dish_opened",
    created_at: `2026-07-10T10:${String(item * 8 + index).padStart(2, "0")}:00.000Z`,
    dish_slug: `dish-${item + 1}`,
    category_slug: `category-${item + 1}`
  })));
  const panels = buildAdminAnalyticsPanels({ currentEvents, previousEvents: [], currentDurationMs: 1, previousDurationMs: 1 });
  assert.equal(panels.ranking.kind, "supported");
  assert.equal(panels.categories.kind, "supported");
  assert.deepEqual(panels.ranking.data.map(({ count }) => count), counts);
  assert.deepEqual(panels.categories.data.map(({ count }) => count), counts);
  assert.equal(panels.ranking.data.reduce((sum, item) => sum + item.count, 0), 20);
  assert.equal(panels.categories.data.reduce((sum, item) => sum + item.count, 0), 20);
});

test("category evidence is joined to the selected menu allowlist", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  const panels = buildAdminAnalyticsPanels({
    currentEvents: Array.from({ length: 20 }, (_, index) => ({
      event_name: "dish_opened",
      created_at: `2026-07-10T10:${String(index).padStart(2, "0")}:00.000Z`,
      category_slug: index < 5 ? "plats" : "ancienne-carte"
    })),
    previousEvents: [], currentDurationMs: 1, previousDurationMs: 1,
    selectedMenuCategorySlugs: ["plats"]
  });
  assert.deepEqual(panels.categories, { kind: "supported", data: [{ slug: "plats", count: 5 }] });
});

test("panel searches require three normalized occurrences", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  for (const occurrenceCount of [1, 2]) {
    const panels = buildAdminAnalyticsPanels({
      currentEvents: Array.from({ length: occurrenceCount }, (_, index) => ({
        event_name: "search_used",
        created_at: `2026-07-10T10:0${index}:00.000Z`,
        search_query: " Saumon "
      })),
      previousEvents: [], currentDurationMs: 1, previousDurationMs: 1
    });
    assert.deepEqual(panels.searches, { kind: "insufficient", reason: "no-search-evidence" });
  }
});

test("panel dish and category rankings require twenty dish opens", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  const panels = buildAdminAnalyticsPanels({
    currentEvents: Array.from({ length: 19 }, (_, index) => ({
      event_name: "dish_opened",
      created_at: `2026-07-10T10:${String(index).padStart(2, "0")}:00.000Z`,
      dish_slug: "sole",
      category_slug: "plats"
    })),
    previousEvents: [], currentDurationMs: 1, previousDurationMs: 1,
    selectedMenuCategorySlugs: ["plats"]
  });
  assert.deepEqual(panels.ranking, { kind: "insufficient", reason: "no-dish-ranking-evidence" });
  assert.deepEqual(panels.categories, { kind: "insufficient", reason: "no-category-evidence" });
});

test("panel rankings retain low-count items after the overall sample qualifies", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  const currentEvents = Array.from({ length: 20 }, (_, index) => ({
    event_name: "dish_opened",
    created_at: `2026-07-10T10:${String(index).padStart(2, "0")}:00.000Z`,
    dish_slug: index < 5 ? "sole" : `hidden-${index}`,
    category_slug: index < 5 ? "plats" : `hidden-${index}`
  }));
  const panels = buildAdminAnalyticsPanels({
    currentEvents, previousEvents: [], currentDurationMs: 1, previousDurationMs: 1
  });
  assert.equal(panels.ranking.kind, "supported");
  assert.equal(panels.categories.kind, "supported");
  assert.equal(panels.ranking.data.length, 16);
  assert.equal(panels.categories.data.length, 16);
  assert.equal(panels.ranking.data.reduce((sum, item) => sum + item.count, 0), 20);
  assert.equal(panels.categories.data.reduce((sum, item) => sum + item.count, 0), 20);
});

test("panel comparison fails closed when restaurant, menu, source or metric scope differs", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  const event = { event_name: "menu_opened", created_at: "2026-07-10T10:00:00.000Z" };
  const currentScope = { restaurantId: "r1", menuId: "m1", source: "production", metricDefinition: "all-events-v1" };
  for (const previousScope of [
    { ...currentScope, restaurantId: "r2" },
    { ...currentScope, menuId: "m2" },
    { ...currentScope, source: "demo" },
    { ...currentScope, metricDefinition: "menu-opens-v1" }
  ]) {
    const panels = buildAdminAnalyticsPanels({ currentEvents: [event], previousEvents: [event], currentDurationMs: 1, previousDurationMs: 1, currentScope, previousScope });
    assert.equal(panels.dailyComparison.kind, "unavailable");
    assert.equal(panels.dailyComparison.reason, "incompatible-scope");
  }
});
