import test from "node:test";
import assert from "node:assert/strict";

test("range parser allowlists values and defaults to seven days", async () => {
  const { parseAdminDashboardRange } = await import("../lib/admin/dashboardRange.ts");
  assert.equal(parseAdminDashboardRange("today-utc"), "today-utc");
  assert.equal(parseAdminDashboardRange("30d"), "30d");
  assert.equal(parseAdminDashboardRange("Toronto"), "7d");
  assert.equal(parseAdminDashboardRange(["30d"]), "7d");
});

test("observation windows use exact UTC inclusive/exclusive bounds", async () => {
  const { resolveAdminObservationWindow } = await import("../lib/admin/dashboardRange.ts");
  const now = new Date("2026-07-10T15:42:30.000Z");
  assert.deepEqual(resolveAdminObservationWindow("today-utc", now), {
    range: "today-utc", startInclusive: "2026-07-10T00:00:00.000Z", endExclusive: "2026-07-10T15:42:30.000Z",
    comparisonStartInclusive: "2026-07-09T08:17:30.000Z", comparisonEndExclusive: "2026-07-10T00:00:00.000Z"
  });
  const seven = resolveAdminObservationWindow("7d", now);
  assert.equal(seven.startInclusive, "2026-07-03T15:42:30.000Z");
  assert.equal(seven.comparisonStartInclusive, "2026-06-26T15:42:30.000Z");
});

test("current and previous observation periods always have matching durations", async () => {
  const { resolveAdminObservationWindow } = await import("../lib/admin/dashboardRange.ts");
  for (const range of ["today-utc", "7d", "30d"]) {
    const value = resolveAdminObservationWindow(range, new Date("2026-07-10T15:42:30.000Z"));
    assert.equal(Date.parse(value.endExclusive) - Date.parse(value.startInclusive), Date.parse(value.comparisonEndExclusive) - Date.parse(value.comparisonStartInclusive));
  }
});

test("analytics partition compares parsed instants at exact inclusive and exclusive bounds", async () => {
  const { partitionAdminAnalyticsEvents } = await import("../lib/admin/analyticsPresentation.ts");
  const observationWindow = {
    range: "7d",
    comparisonStartInclusive: "2026-07-01T00:00:00.250Z",
    comparisonEndExclusive: "2026-07-02T00:00:00.250Z",
    startInclusive: "2026-07-02T00:00:00.250Z",
    endExclusive: "2026-07-03T00:00:00.250Z"
  };
  const rows = [
    { id: "previous-start", created_at: "2026-07-01T00:00:00.250+00:00" },
    { id: "current-start", created_at: "2026-07-02T00:00:00.250+00:00" },
    { id: "current-last-ms", created_at: "2026-07-03T00:00:00.249Z" },
    { id: "exclusive-end", created_at: "2026-07-03T00:00:00.250+00:00" },
    { id: "invalid", created_at: "not-a-date" }
  ];
  const result = partitionAdminAnalyticsEvents(rows, observationWindow);
  assert.deepEqual(result.previousEvents.map((row) => row.id), ["previous-start"]);
  assert.deepEqual(result.currentEvents.map((row) => row.id), ["current-start", "current-last-ms"]);
});
