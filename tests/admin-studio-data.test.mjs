import test from "node:test";
import assert from "node:assert/strict";

const load = () => import("../lib/admin/studioData.ts");
test("dish statistics count scoped real events by stable dish identity without inventing missing evidence", async () => {
  const { buildStudioDishStatistics } = await load();
  const dishes = [
    { id: "a", slug: "soupe" },
    { id: "b", slug: "salade" },
  ];
  const events = [
    { dish_slug: "soupe", event_name: "dish_opened" },
    { dish_slug: "soupe", event_name: "dish_3d_clicked" },
    { dish_slug: "salade", event_name: "dish_ar_clicked" },
    { dish_slug: "outside", event_name: "dish_opened" },
  ];
  assert.deepEqual(buildStudioDishStatistics(dishes, events, [], true, false), {
    a: { views: 1, three: 1, ar: 0, previousViews: null, changeRate: null },
    b: { views: 0, three: 0, ar: 1, previousViews: null, changeRate: null },
  });
  assert.deepEqual(
    buildStudioDishStatistics(dishes, events, events, false, true),
    {},
  );
});
test("dish comparison preserves unknown versus real zero and counts only the matching event", async () => {
  const { buildStudioDishStatistics } = await load();
  const dishes = [{ id: "a", slug: "soupe" }];
  const current = [
    { dish_slug: "soupe", event_name: "dish_opened" },
    { dish_slug: "soupe", event_name: "dish_opened" },
  ];
  assert.equal(
    buildStudioDishStatistics(dishes, current, [current[0]], true, true).a
      .changeRate,
    1,
  );
  assert.equal(
    buildStudioDishStatistics(dishes, current, [], true, true).a.previousViews,
    0,
  );
  assert.equal(
    buildStudioDishStatistics(dishes, current, [], true, true).a.changeRate,
    null,
  );
});
test("approved overview keeps 3D and AR clicks separate from each other and searches", async () => {
  const { buildAdminAnalyticsState } = await import(
    "../lib/admin/analyticsState.ts"
  );
  const window = {
    range: "7d",
    startInclusive: "2026-10-01T00:00:00Z",
    endExclusive: "2026-10-08T00:00:00Z",
    comparisonStartInclusive: "2026-09-24T00:00:00Z",
    comparisonEndExclusive: "2026-10-01T00:00:00Z",
  };
  const events = Array.from({ length: 12 }, (_, index) => ({
    event_name: index % 2 ? "dish_opened" : "menu_opened",
    created_at: "2026-10-02T12:00:00Z",
  }));
  events.push({
    event_name: "dish_3d_clicked",
    created_at: "2026-10-02T12:00:00Z",
  });
  const result = buildAdminAnalyticsState({
    observationWindow: window,
    events,
  });
  assert.equal(result.kind, "real");
  assert.equal(result.metrics.find((row) => row.id === "three").value, 1);
  assert.equal(result.metrics.find((row) => row.id === "ar").value, 0);
  assert.equal(result.metricSeries.three.current[1].value, 1);
  assert.equal(result.metricSeries.ar.current[1].value, 0);
});
