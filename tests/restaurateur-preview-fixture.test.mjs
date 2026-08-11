import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const fixturePath = path.join(root, "lib", "restaurateurPreview", "fixture.ts");
const projectRootUrl = pathToFileURL(`${root}${path.sep}`).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = new URL(specifier.slice(2), projectRootUrl);
      for (const suffix of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const candidate = new URL(`${base.href}${suffix}`);
        if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
      }
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const suffix of ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"]) {
        const candidate = new URL(`${base.href}${suffix}`);
        if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts") || url.endsWith(".tsx")) {
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022
          }
        }).outputText,
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});

const sum = (items) => items.reduce((total, item) => total + item, 0);
const count = (item) => {
  assert.equal(typeof item.count, "number");
  assert.equal(Number.isInteger(item.count), true);
  assert.ok(item.count >= 0);
  return item.count;
};
const seriesTotal = (items) =>
  sum(items.map((item) => typeof item === "number" ? item : count(item)));
const serviceWindows = [
  { startHour: 0, endHour: 5 },
  { startHour: 5, endHour: 11 },
  { startHour: 11, endHour: 15 },
  { startHour: 15, endHour: 18 },
  { startHour: 18, endHour: 24 }
];

test("the public restaurateur fixture is deterministic, synthetic, and mathematically coherent", async () => {
  assert.equal(
    existsSync(fixturePath),
    true,
    "lib/restaurateurPreview/fixture.ts must provide the single public demo fixture"
  );
  const source = readFileSync(fixturePath, "utf8");
  assert.doesNotMatch(source, /Math\.random|Date\.now|randomUUID|new Date\s*\(\s*\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(
    source,
    /server-only|@supabase|@clerk|lib\/admin\/(?:access|dashboardData)|analytics\/serverRows/
  );

  const fixtureModule = await import(pathToFileURL(fixturePath).href);
  const fixture = fixtureModule.RESTAURATEUR_PREVIEW_FIXTURE;
  const derivePeriod = fixtureModule.deriveRestaurateurPreviewPeriod;
  assert.ok(fixture, "RESTAURATEUR_PREVIEW_FIXTURE must be exported");
  assert.equal(
    typeof derivePeriod,
    "function",
    "deriveRestaurateurPreviewPeriod must derive comparison, summary, and insights"
  );
  assert.equal(fixture.restaurant.demo, true);
  assert.equal(fixture.categories.length, 4);
  assert.equal(fixture.dishes.length, 12);
  assert.equal(new Set(fixture.categories.map(({ id }) => id)).size, 4);
  assert.equal(new Set(fixture.dishes.map(({ id }) => id)).size, 12);
  const categoryIds = new Set(fixture.categories.map(({ id }) => id));
  const categoryDishCounts = fixture.categories.map(({ id }) =>
    fixture.dishes.filter(({ categoryId }) => categoryId === id).length
  );
  assert.deepEqual([...categoryDishCounts].sort((a, b) => a - b), [2, 2, 3, 5]);
  assert.equal(sum(categoryDishCounts), 12);
  assert.equal(fixture.dishes.filter(({ available }) => available).length, 10);

  for (const dish of fixture.dishes) {
    assert.equal(categoryIds.has(dish.categoryId), true, `${dish.id} references a real category`);
    assert.equal(typeof dish.name, "string");
    assert.ok(dish.name.trim().length > 0);
    assert.equal(Number.isInteger(dish.priceCents), true);
    assert.ok(dish.priceCents > 0);
    assert.match(dish.imageSrc, /^\/(?!admin(?:\/|$)|owner(?:\/|$))/);
    assert.doesNotMatch(dish.imageSrc, /\.(?:glb|usdz|mp4|webm)(?:\?|$)/i);
  }

  assert.deepEqual(Object.keys(fixture.periods).sort(), ["24h", "30d", "7d"]);
  for (const periodId of ["24h", "7d", "30d"]) {
    const period = fixture.periods[periodId];
    const metricIds = ["menuOpens", "dishOpens", "searches", "immersive"];
    assert.deepEqual(Object.keys(period.metrics).sort(), [...metricIds].sort());
    assert.deepEqual(Object.keys(period.previousMetrics).sort(), [...metricIds].sort());
    assert.deepEqual(Object.keys(period.series).sort(), [...metricIds].sort());
    for (const metricId of metricIds) {
      assert.equal(Number.isInteger(period.metrics[metricId]), true);
      assert.ok(period.metrics[metricId] >= 0);
      assert.equal(seriesTotal(period.series[metricId]), period.metrics[metricId]);
      assert.equal(Number.isInteger(period.previousMetrics[metricId]), true);
      assert.ok(period.previousMetrics[metricId] >= 0);
      assert.equal(
        seriesTotal(period.previousSeries[metricId]),
        period.previousMetrics[metricId]
      );
    }

    assert.ok(period.topDishes.length > 0);
    assert.deepEqual(
      period.topDishes.map(({ dishId }) => dishId),
      fixture.dishes.map(({ id }) => id)
    );
    assert.ok(period.searchBreakdown.length > 0);
    assert.equal(new Set(period.topDishes.map(({ dishId }) => dishId)).size, period.topDishes.length);
    assert.equal(
      period.topDishes.every(({ dishId }) => fixture.dishes.some(({ id }) => id === dishId)),
      true
    );
    assert.ok(sum(period.topDishes.map(count)) <= period.metrics.dishOpens);
    assert.equal(sum(period.searchBreakdown.map(count)), period.metrics.searches);
    assert.equal(sum(period.categoryBreakdown.map(count)), period.metrics.dishOpens);
    assert.equal(
      new Set(period.categoryBreakdown.map(({ categoryId }) => categoryId)).size,
      period.categoryBreakdown.length
    );
    assert.equal(
      period.categoryBreakdown.every(({ categoryId }) => categoryIds.has(categoryId)),
      true
    );
    const activityTotal = sum(metricIds.map((metricId) => period.metrics[metricId]));
    assert.equal(sum(period.serviceBreakdown.map(count)), activityTotal);
    assert.equal(sum(period.heatmap.map(count)), activityTotal);
    const heatmapByServiceWindow = serviceWindows.map(({ startHour, endHour }) =>
      sum(period.heatmap
        .filter(({ hour }) => hour >= startHour && hour < endHour)
        .map(count))
    );
    assert.deepEqual(
      heatmapByServiceWindow,
      period.serviceBreakdown.map(count),
      `${periodId} service activity must be the service-window aggregation of the UTC heatmap`
    );
    const dishesById = new Map(fixture.dishes.map((dish) => [dish.id, dish]));
    const dishViewsByCategory = fixture.categories.map(({ id: categoryId }) =>
      sum(period.topDishes
        .filter(({ dishId }) => dishesById.get(dishId)?.categoryId === categoryId)
        .map(count))
    );
    assert.deepEqual(
      dishViewsByCategory,
      period.categoryBreakdown.map(count),
      `${periodId} category activity must be the category aggregation of exact dish views`
    );

    const heatmapTotalForWeekday = (weekday) => sum(
      period.heatmap.filter((cell) => cell.weekday === weekday).map(count)
    );
    if (periodId === "24h") {
      const activeWeekdays = new Set(
        period.heatmap.filter((cell) => cell.count > 0).map((cell) => cell.weekday)
      );
      assert.deepEqual([...activeWeekdays], [6], "the fixed 24 h demo window belongs to Saturday UTC");
      for (let index = 0; index < period.seriesLabels.length; index += 1) {
        const expectedBucketTotal = sum(metricIds.map((metricId) => period.series[metricId][index]));
        const hour = index * 3;
        const actualBucketTotal = sum(
          period.heatmap
            .filter((cell) => cell.weekday === 6 && cell.hour === hour)
            .map(count)
        );
        assert.equal(actualBucketTotal, expectedBucketTotal, `24 h heatmap bucket ${hour}:00 matches its series bucket`);
      }
    }
    if (periodId === "7d") {
      const mondayFirstWeekdays = [1, 2, 3, 4, 5, 6, 0];
      for (let index = 0; index < mondayFirstWeekdays.length; index += 1) {
        const expectedDayTotal = sum(metricIds.map((metricId) => period.series[metricId][index]));
        assert.equal(
          heatmapTotalForWeekday(mondayFirstWeekdays[index]),
          expectedDayTotal,
          `7 d heatmap weekday ${mondayFirstWeekdays[index]} matches its daily series`
        );
      }
    }
    if (periodId === "30d") {
      assert.ok(heatmapTotalForWeekday(6) > 0, "30 d heatmap includes Saturday activity");
      assert.ok(heatmapTotalForWeekday(0) > 0, "30 d heatmap includes Sunday activity");
    }

    const first = derivePeriod(structuredClone(period), fixture, "fr");
    const second = derivePeriod(structuredClone(period), fixture, "fr");
    assert.deepEqual(second, first);
    assert.ok(first.comparison);
    assert.ok(first.summary);
    assert.ok(Array.isArray(first.keyInsights));
    assert.ok(first.keyInsights.length >= 2);

    const changedMetrics = structuredClone(period);
    changedMetrics.metrics.menuOpens += 7;
    changedMetrics.series.menuOpens = [changedMetrics.metrics.menuOpens];
    const changedComparison = derivePeriod(changedMetrics, fixture, "fr");
    assert.notDeepEqual(changedComparison.comparison, first.comparison);
    assert.notDeepEqual(changedComparison.summary, first.summary);

    const changedRanking = structuredClone(period);
    const currentLeader = period.topDishes.reduce((leader, item) =>
      item.count > leader.count ? item : leader
    );
    const promotedDish = fixture.dishes.findLast(({ id }) => id !== currentLeader.dishId);
    assert.ok(promotedDish, "a non-leading dish must be available for the ranking mutation");
    const promotedCount = Math.max(...period.topDishes.map(({ count: value }) => value)) + 1;
    changedRanking.topDishes = changedRanking.topDishes.map((item) =>
      item.dishId === promotedDish.id ? { ...item, count: promotedCount } : item
    );
    const changedInsights = derivePeriod(changedRanking, fixture, "fr");
    assert.notDeepEqual(changedInsights.keyInsights, first.keyInsights);
    assert.equal(
      changedInsights.keyInsights.some((insight) => insight.includes(promotedDish.name)),
      true
    );
    const changedEnglishInsights = derivePeriod(changedRanking, fixture, "en");
    assert.equal(
      changedEnglishInsights.keyInsights.some((insight) => insight.includes(promotedDish.nameEn)),
      true
    );
  }

  assert.equal(fixture.restaurant.name.fr, "Maison Élyse — Démo");
  assert.equal(fixture.restaurant.name.en, "Maison Élyse — Demo");
});
