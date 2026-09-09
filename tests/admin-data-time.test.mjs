import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminTimeBuckets,
  resolveAdminObservationWindow,
  resolveAdminTimeZone
} from "../lib/admin/data/time.ts";

test("timezone resolution preserves configured provenance and exposes UTC fallback", () => {
  assert.deepEqual(resolveAdminTimeZone({ timezone: "America/Toronto" }), {
    kind: "configured", timezone: "America/Toronto", source: "menus.settings_json"
  });
  assert.deepEqual(resolveAdminTimeZone({}), {
    kind: "fallback", timezone: "UTC", source: "utc-fallback", reason: "missing"
  });
  assert.equal(resolveAdminTimeZone({ timezone: "Toronto" }).reason, "invalid");
});

test("Toronto spring day is a 23 hour local-calendar window", () => {
  const window = resolveAdminObservationWindow({
    range: "today", timezone: "America/Toronto", observedAt: new Date("2026-03-09T03:59:59.999Z")
  });
  assert.equal(window.current.from, "2026-03-08T05:00:00.000Z");
  assert.equal(Math.ceil((Date.parse(window.current.to) - Date.parse(window.current.from)) / 3_600_000), 23);
});

test("Toronto fall day is 25 hours and keeps both 01 h offsets", () => {
  const window = resolveAdminObservationWindow({
    range: "today", timezone: "America/Toronto", observedAt: new Date("2026-11-02T04:59:59.999Z")
  });
  assert.equal(window.current.from, "2026-11-01T04:00:00.000Z");
  assert.equal(Math.ceil((Date.parse(window.current.to) - Date.parse(window.current.from)) / 3_600_000), 25);
  const repeated = buildAdminTimeBuckets(window).filter((bucket) => bucket.localHour === "01");
  assert.equal(repeated.length, 2);
  assert.notEqual(repeated[0].utcOffset, repeated[1].utcOffset);
});

test("7d and 30d comparisons preserve calendar-day count and local cutoff", () => {
  for (const [range, days, expectedPreviousCutoff] of [
    ["7d", 7, "2026-03-03T20:30:00.000Z"],
    ["30d", 30, "2026-02-08T20:30:00.000Z"]
  ]) {
    const window = resolveAdminObservationWindow({
      range, timezone: "America/Toronto", observedAt: new Date("2026-03-10T19:30:00.000Z")
    });
    assert.equal(window.calendarDayCount, days);
    const currentCutoff = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto", hourCycle: "h23", hour: "2-digit", minute: "2-digit"
    }).format(new Date(window.current.to));
    const previousCutoff = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto", hourCycle: "h23", hour: "2-digit", minute: "2-digit"
    }).format(new Date(window.previous.to));
    assert.equal(previousCutoff, currentCutoff);
    assert.equal(window.previous.to, expectedPreviousCutoff);
    assert.equal(window.alignment, "local-calendar-v1");
  }
});

test("partial spring-forward day compares the same Toronto wall-clock cutoff", () => {
  const window = resolveAdminObservationWindow({
    range: "today", timezone: "America/Toronto", observedAt: new Date("2026-03-08T19:30:00.000Z")
  });
  assert.deepEqual(window.current, {
    from: "2026-03-08T05:00:00.000Z",
    to: "2026-03-08T19:30:00.000Z"
  });
  assert.deepEqual(window.previous, {
    from: "2026-03-07T05:00:00.000Z",
    to: "2026-03-07T20:30:00.000Z"
  });
});

test("partial fall-back day compares the same Toronto wall-clock cutoff", () => {
  const window = resolveAdminObservationWindow({
    range: "today", timezone: "America/Toronto", observedAt: new Date("2026-11-01T20:30:00.000Z")
  });
  assert.deepEqual(window.current, {
    from: "2026-11-01T04:00:00.000Z",
    to: "2026-11-01T20:30:00.000Z"
  });
  assert.deepEqual(window.previous, {
    from: "2026-10-31T04:00:00.000Z",
    to: "2026-10-31T19:30:00.000Z"
  });
});
