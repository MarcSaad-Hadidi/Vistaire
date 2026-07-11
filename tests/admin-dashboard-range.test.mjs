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
