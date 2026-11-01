import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAdminDashboardRange,
  resolveAdminObservationWindow,
} from "../lib/admin/dashboardRange.ts";
test("studio custom dates are inclusive UTC dates, bounded and calendar-valid", () => {
  assert.equal(
    parseAdminDashboardRange("custom:2026-09-01:2026-09-30"),
    "custom:2026-09-01:2026-09-30",
  );
  for (const invalid of [
    "custom:2026-02-30:2026-03-02",
    "custom:2026-10-10:2026-10-01",
    "custom:2020-01-01:2026-01-01",
  ])
    assert.equal(parseAdminDashboardRange(invalid), "7d");
  const result = resolveAdminObservationWindow(
    "custom:2026-09-01:2026-09-30",
    new Date("2026-10-11T10:30Z"),
  );
  assert.equal(result.startInclusive, "2026-09-01T00:00:00.000Z");
  assert.equal(result.endExclusive, "2026-10-01T00:00:00.000Z");
  assert.equal(result.comparisonStartInclusive, "2026-08-02T00:00:00.000Z");
});
test("month and year windows end now and retain equal-duration comparisons", () => {
  for (const range of ["90d", "365d", "month", "year"])
    assert.equal(parseAdminDashboardRange(range), range);
  const now = new Date("2026-10-11T10:30Z");
  assert.equal(
    resolveAdminObservationWindow("month", now).startInclusive,
    "2026-10-01T00:00:00.000Z",
  );
  assert.equal(
    resolveAdminObservationWindow("year", now).startInclusive,
    "2026-01-01T00:00:00.000Z",
  );
});
test("partial calendar periods use 24-hour buckets instead of duplicate date labels", async () => {
  const { buildAdminAnalyticsState } = await import(
    "../lib/admin/analyticsState.ts"
  );
  const window = resolveAdminObservationWindow(
    "month",
    new Date("2026-10-11T10:30Z"),
  );
  const events = Array.from({ length: 20 }, (_, i) => ({
    event_name: i % 2 ? "dish_opened" : "menu_opened",
    created_at: "2026-10-01T23:00:00Z",
    dish_slug: "soupe",
  }));
  const state = buildAdminAnalyticsState({ observationWindow: window, events });
  assert.equal(state.kind, "real");
  const points = state.metricSeries.dishOpened.current;
  assert.equal(
    new Set(points.map((point) => point.bucket)).size,
    points.length,
  );
  assert.equal(points[0].value, 10);
  assert.equal(points.at(-1).bucket, "2026-10-11");
  assert.equal(state.panels.currentDaily.data[0].count, 20);
  assert.equal(state.panels.currentDaily.data.at(-1).day, "2026-10-11");
});
