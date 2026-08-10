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
  assert.match(fixture.restaurant.name, /d[ée]mo/i);

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
    const promotedDishId = fixture.dishes.at(-1).id;
    const promotedCount = Math.max(...period.topDishes.map(({ count: value }) => value)) + 1;
    changedRanking.topDishes = changedRanking.topDishes.map((item) =>
      item.dishId === promotedDishId ? { ...item, count: promotedCount } : item
    );
    const changedInsights = derivePeriod(changedRanking, fixture, "fr");
    assert.notDeepEqual(changedInsights.keyInsights, first.keyInsights);
  }
});
