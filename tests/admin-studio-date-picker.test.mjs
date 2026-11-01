import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("StudioDateRangePicker.module.css"))
      return {
        format: "module",
        source: "export default {};",
        shortCircuit: true,
      };
    if (url.endsWith("StudioDateRangePicker.tsx"))
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
        shortCircuit: true,
      };
    return nextLoad(url, context);
  },
});

const now = new Date("2026-10-18T15:42:30.000Z");

test("picker drafts preserve real preset tokens and normalize two calendar clicks", async () => {
  const { studioDatePresets, selectStudioDate, studioDateRangeResult } =
    await import("../components/admin/studio/StudioDateRangePicker.tsx");
  const presets = studioDatePresets(now, "fr");
  assert.deepEqual(
    presets.map(({ range }) => range),
    ["today-utc", "7d", "month", "30d", "year", "365d", "90d"],
  );
  const demo = studioDatePresets(now, "en", "2026-08-08");
  assert.deepEqual(demo.find(({ range }) => range === "7d").value, {
    from: "2026-08-02",
    to: "2026-08-08",
  });
  assert.deepEqual(demo.find(({ range }) => range === "today-utc").value, {
    from: "2026-08-08",
    to: "2026-08-08",
  });
  const week = presets.find(({ range }) => range === "7d");
  assert.deepEqual(week.value, { from: "2026-10-11", to: "2026-10-18" });
  assert.equal(
    studioDateRangeResult(week.value, "7d", undefined, now).range,
    "7d",
  );
  const start = selectStudioDate(week.value, "2026-10-10");
  assert.deepEqual(start, { from: "2026-10-10" });
  const complete = selectStudioDate(start, "2026-10-05");
  assert.deepEqual(complete, { from: "2026-10-05", to: "2026-10-10" });
  assert.equal(
    studioDateRangeResult(complete, null, undefined, now).range,
    "custom:2026-10-05:2026-10-10",
  );
});

test("picker rejects incomplete, invalid, future, over-730-day and disallowed demo ranges", async () => {
  const { studioDateRangeResult } =
    await import("../components/admin/studio/StudioDateRangePicker.tsx");
  const resolve = (value, preset = null, allowed) =>
    studioDateRangeResult(value, preset, allowed, now);
  assert.equal(resolve(null).error, "start");
  assert.equal(resolve({ from: "2026-10-05" }).error, "end");
  assert.equal(
    resolve({ from: "2026-02-30", to: "2026-03-02" }).error,
    "invalid",
  );
  assert.equal(
    resolve({ from: "2026-10-10", to: "2026-10-05" }).error,
    "order",
  );
  assert.equal(
    resolve({ from: "2026-10-18", to: "2026-10-19" }).error,
    "future",
  );
  assert.equal(
    resolve({ from: "2024-10-19", to: "2026-10-18" }).range,
    "custom:2024-10-19:2026-10-18",
  );
  assert.equal(
    resolve({ from: "2024-10-18", to: "2026-10-18" }).error,
    "duration",
  );
  assert.equal(
    resolve({ from: "2026-10-05", to: "2026-10-10" }, null, [
      "today-utc",
      "7d",
      "30d",
    ]).error,
    "unavailable",
  );
  assert.equal(
    resolve({ from: "2026-09-18", to: "2026-10-18" }, "30d", [
      "today-utc",
      "7d",
      "30d",
    ]).range,
    "30d",
  );
});

test("picker comparison starts from the observed instants and only refreshes for a changed draft", async () => {
  const { studioDatePreview } = await import("../components/admin/studio/StudioDateRangePicker.tsx");
  const observed = {
    range: "7d",
    startInclusive: "2026-07-03T15:42:30.000Z",
    endExclusive: "2026-07-10T15:42:30.000Z",
    comparisonStartInclusive: "2026-06-26T15:42:30.000Z",
    comparisonEndExclusive: "2026-07-03T15:42:30.000Z",
  };
  const initial = studioDatePreview("7d", now, observed);
  assert.equal(initial.window, observed);
  assert.equal(initial.dayCount, 7, "seven rolling days must not be labelled as eight calendar days");
  const edited = studioDatePreview("7d", now);
  assert.equal(edited.window.startInclusive, "2026-10-11T15:42:30.000Z");
  assert.equal(edited.window.comparisonStartInclusive, "2026-10-04T15:42:30.000Z");
  assert.equal(edited.dayCount, 7);
  const custom = studioDatePreview("custom:2026-07-03:2026-07-10", now);
  assert.equal(custom.window.comparisonStartInclusive, "2026-06-25T00:00:00.000Z");
  assert.equal(custom.dayCount, 8, "custom calendar ranges retain their inclusive day count");
});
