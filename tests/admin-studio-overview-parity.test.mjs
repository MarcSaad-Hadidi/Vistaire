import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("overview uses the approved default and four-column dish composition", async () => {
  const source = await readFile(
    "components/admin/studio/AdminStudio.tsx",
    "utf8",
  );
  assert.match(source, /useState<AdminMetricSeriesId>\("menuOpened"\)/);
  for (const label of [
    "Évolution quotidienne",
    "Consultations par plat",
    "Part des vues",
    "Explorer les plats",
  ])
    assert.ok(source.includes(label), label);
  assert.match(source, /ranking\.slice\(0, 6\)/);
  assert.match(source, /row\.count\s*\/\s*totalDishViews/);
});

test("dish detail restores the approved hero with truthful metrics and management destination", async () => {
  const source = await readFile(
    "components/admin/studio/AdminStudio.tsx",
    "utf8",
  );
  assert.ok(source.includes("Dans le regard des visiteurs"));
  assert.match(source, /className=\{styles\.detailHero\}/);
  assert.match(source, /className=\{styles\.detailMetrics\}/);
  assert.ok(source.includes("data.dishStatistics?.[dish.id]?.views"));
  assert.ok(source.includes("data.dishStatistics?.[dish.id]?.three"));
  assert.ok(source.includes("data.dishStatistics?.[dish.id]?.ar"));
  assert.ok(source.includes("#dish-${encodeURIComponent(id)}"));
  const dishes = await readFile(
    "components/admin/studio/StudioDishes.tsx",
    "utf8",
  );
  assert.ok(dishes.includes("id={`dish-${dish.id}`}"));
});

test("analysis heading follows table mode and dishes retain actual period context", async () => {
  const source = await readFile("components/admin/studio/AdminStudio.tsx", "utf8");
  assert.ok(source.includes('analysisView === "table"'));
  assert.ok(source.includes("Explorateur de données"));
  assert.ok(source.includes("onViewChange={setAnalysisView}"));
  const dishes = source.slice(source.indexOf('{page === "dishes" && ('), source.indexOf('{page === "planning" && ('));
  assert.ok(dishes.includes("{rangeLabel} · UTC"));
  assert.ok(dishes.includes("comparisonStartInclusive"));
});
