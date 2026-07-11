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
  assert.equal(state.metricSeries.menuOpened.previous.length, 7);
  assert.deepEqual(state.metricSeries.menuOpened.previous[1], { bucket: "2026-06-27", value: 1, timestampLabel: "27 juin" });
});

test("seven-day metric series are dense, aligned and retain zero buckets", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const state = buildAdminAnalyticsState({
    observationWindow,
    events: [
      ...Array.from({ length: 5 }, () => ({ event_name: "menu_opened", created_at: "2026-07-03T12:00:00.000Z" })),
      { event_name: "dish_opened", created_at: "2026-07-09T11:59:59.999Z" }
    ],
    previousEvents: [{ event_name: "search_used", created_at: "2026-06-28T12:00:00.000Z" }],
    analyticsScope: scope
  });
  assert.equal(state.kind, "real");
  for (const series of Object.values(state.metricSeries)) {
    assert.equal(series.current.length, 7, series.id);
    assert.equal(series.previous.length, 7, series.id);
    assert.deepEqual(series.current.map((point) => point.bucket), ["2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09"]);
    assert.ok(series.current.some((point) => point.value === 0), series.id);
  }
  assert.deepEqual(state.metricSeries.searches.previous.map((point) => point.value), [0, 0, 1, 0, 0, 0, 0]);
  assert.deepEqual(state.metricSeries.immersive.current.map((point) => point.value), [0, 0, 0, 0, 0, 0, 0]);
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
  assert.match(fixture, /buildAdminVisualFixtureTables/);
  assert.match(fixture, /addPeriod\("previous"/);
  assert.match(fixture, /searchParams/);
  assert.match(fixture, /restaurant_id/);
  assert.match(fixture, /menu_id/);
  assert.match(fixture, /source/);
});

test("visual fixture menu is structurally identical to canonical Maison Elysee data", async () => {
  const [{ buildAdminVisualFixtureTables }, { getAllDishes, getCategories }] = await Promise.all([
    import("../e2e/support/adminVisualFixtureData.ts"),
    import("../lib/demoMenuData.ts")
  ]);
  const tables = buildAdminVisualFixtureTables();
  const fullMenuTables = buildAdminVisualFixtureTables({ scenario: "full-menu" });
  const canonicalDishes = getAllDishes().map(({ slug, name, image, categorySlug, isAvailable }) => ({ slug, name, image_url: image, category_id: categorySlug, is_available: isAvailable }));
  const fixtureDishes = tables.menu_dishes.filter((dish) => dish.restaurant_id === tables.restaurantId && dish.menu_id === tables.menuId).map(({ slug, name, image_url, category_id, is_available }) => ({ slug, name, image_url, category_id, is_available }));
  assert.equal(fixtureDishes.length, 12);
  assert.deepEqual(fixtureDishes, canonicalDishes);
  assert.deepEqual(
    tables.menu_categories.filter((category) => category.restaurant_id === tables.restaurantId && category.menu_id === tables.menuId).map(({ slug, name }) => ({ slug, name })),
    getCategories().map(({ slug, name }) => ({ slug, name }))
  );
  assert.ok(tables.menu_dishes.some((dish) => dish.restaurant_id === "foreign-restaurant"));
  assert.ok(fixtureDishes.every((dish) => dish.slug !== "foreign"));
  const fullMenuDishes = fullMenuTables.menu_dishes.filter((dish) => dish.restaurant_id === fullMenuTables.restaurantId && dish.menu_id === fullMenuTables.menuId);
  assert.equal(fullMenuDishes.length, 12);
  assert.ok(fullMenuDishes.some((dish) => dish.is_available));
  assert.ok(fullMenuDishes.some((dish) => !dish.is_available));
  assert.deepEqual(fullMenuDishes.map((dish) => dish.id), fixtureDishes.map((dish) => tables.menu_dishes.find((candidate) => candidate.slug === dish.slug)?.id));
});
