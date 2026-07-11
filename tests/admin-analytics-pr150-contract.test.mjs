import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const observationWindow = {
  range: "7d",
  comparisonStartInclusive: "2026-06-26T12:00:00.000Z",
  comparisonEndExclusive: "2026-07-03T12:00:00.000Z",
  startInclusive: "2026-07-03T12:00:00.000Z",
  endExclusive: "2026-07-10T12:00:00.000Z"
};

const scope = { restaurantId: "r1", menuId: "m1", source: "production", metricDefinition: "all-events-v1" };

test("real analytics exposes exact raw KPIs independently from privacy breakdowns", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const events = [
    ...Array.from({ length: 5 }, (_, index) => ({ event_name: "menu_opened", created_at: `2026-07-0${index + 4}T13:00:00.000Z` })),
    ...Array.from({ length: 4 }, (_, index) => ({ event_name: "dish_opened", created_at: `2026-07-0${index + 4}T14:00:00.000Z` })),
    { event_name: "search_used", search_query: "client@example.com", created_at: "2026-07-04T15:00:00.000Z" },
    { event_name: "search_used", search_query: "+1 514 555 0199", created_at: "2026-07-04T15:01:00.000Z" },
    { event_name: "dish_3d_clicked", created_at: "2026-07-04T16:00:00.000Z" },
    { event_name: "dish_ar_clicked", created_at: "2026-07-04T16:01:00.000Z" }
  ];
  const state = buildAdminAnalyticsState({ observationWindow, events, previousEvents: [], analyticsScope: scope, availableDishCount: 9 });
  assert.equal(state.kind, "real");
  assert.deepEqual(Object.fromEntries(state.metrics.map(({ id, value }) => [id, value])), {
    "menu-opens": 5,
    "dish-opens": 4,
    searches: 2,
    immersive: 2,
    "available-dishes": 9
  });
  assert.deepEqual(state.searches, []);
});

test("metric series carry compatible current and previous points with timestamp labels", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const current = [
    ...Array.from({ length: 5 }, () => ({ event_name: "menu_opened", created_at: "2026-07-04T13:00:00.000Z" })),
    { event_name: "dish_opened", created_at: "2026-07-05T14:00:00.000Z" },
    { event_name: "search_used", search_query: "sole", created_at: "2026-07-05T15:00:00.000Z" },
    { event_name: "dish_ar_clicked", created_at: "2026-07-05T16:00:00.000Z" }
  ];
  const previous = [{ event_name: "menu_opened", created_at: "2026-06-27T13:00:00.000Z" }];
  const state = buildAdminAnalyticsState({ observationWindow, events: current, previousEvents: previous, analyticsScope: scope });
  assert.equal(state.kind, "real");
  for (const id of ["menuOpened", "dishOpened", "searches", "immersive"]) {
    assert.equal(state.metricSeries[id].id, id);
    for (const period of ["current", "previous"]) {
      for (const point of state.metricSeries[id][period]) {
        assert.deepEqual(Object.keys(point).sort(), ["bucket", "timestampLabel", "value"]);
        assert.equal(typeof point.timestampLabel, "string");
      }
    }
  }
  assert.deepEqual(state.metricSeries.menuOpened.previous, [{ bucket: "2026-06-27", value: 1, timestampLabel: "27 juin" }]);
});

test("category labels come from the selected menu and service labels do not repeat UTC", async () => {
  const { buildAdminAnalyticsPanels } = await import("../lib/admin/analyticsPresentation.ts");
  const panels = buildAdminAnalyticsPanels({
    currentEvents: Array.from({ length: 20 }, (_, index) => ({ event_name: "dish_opened", category_slug: "plats", dish_slug: "sole", created_at: `2026-07-04T13:${String(index).padStart(2, "0")}:00.000Z` })),
    previousEvents: [], currentDurationMs: 1, previousDurationMs: 1,
    selectedMenuCategories: [{ slug: "plats", label: "Plats principaux" }]
  });
  assert.deepEqual(panels.categories, { kind: "supported", data: [{ slug: "plats", label: "Plats principaux", count: 20 }] });
  assert.equal(panels.serviceWindows.kind, "supported");
  assert.ok(panels.serviceWindows.data.windows.every((item) => !item.label.includes("UTC")));
});

test("search privacy rejects common direct identifiers", async () => {
  const { isPrivacySafeAdminSearchTerm } = await import("../lib/admin/analyticsPresentation.ts");
  for (const unsafe of ["john@example.com", "+1 (514) 555-0199", "https://example.com/a", "4111 1111 1111 1111", "192.168.0.1", "Jean Dupont 5145550199"]) {
    assert.equal(isPrivacySafeAdminSearchTerm(unsafe), false, unsafe);
  }
  assert.equal(isPrivacySafeAdminSearchTerm("tartare saumon"), true);
});

test("visual fixture is a full distinct menu with previous evidence and scoped filtering", async () => {
  const fixture = await readFile("e2e/support/admin-visual-fixture-server.mjs", "utf8");
  assert.match(fixture, /dishData\.length\s*<\s*12/);
  assert.doesNotMatch(fixture, /images\/demo\/dishes\/\$\{key\}\.png/);
  assert.match(fixture, /addPeriod\("previous"/);
  assert.match(fixture, /searchParams/);
  assert.match(fixture, /restaurant_id/);
  assert.match(fixture, /menu_id/);
  assert.match(fixture, /source/);
  assert.match(fixture, /is_available/);
  assert.match(fixture, /foreign/);
});
