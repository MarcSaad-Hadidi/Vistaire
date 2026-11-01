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
    { dish_id: "a", dish_slug: "soupe", event_name: "dish_opened" },
    { dish_id: "a", dish_slug: "soupe", event_name: "dish_3d_clicked" },
    { dish_id: "b", dish_slug: "salade", event_name: "dish_ar_clicked" },
    { dish_slug: "outside", event_name: "dish_opened" },
  ];
  assert.deepEqual(buildStudioDishStatistics(dishes, events, [], true, false), {
    a: { views: 1, three: 1, ar: 0, previousViews: null, previousThree: null, previousAr: null, changeRate: null },
    b: { views: 0, three: 0, ar: 1, previousViews: null, previousThree: null, previousAr: null, changeRate: null },
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
    { dish_id: "a", dish_slug: "soupe", event_name: "dish_opened" },
    { dish_id: "a", dish_slug: "soupe", event_name: "dish_opened" },
  ];
  assert.equal(
    buildStudioDishStatistics(dishes, current, [current[0]], true, true).a
      .changeRate,
    1,
  );
  assert.equal(
    buildStudioDishStatistics(dishes, current, [], true, true).a.previousViews,
    null,
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

test("stable dish IDs survive renamed slugs and previous immersive metrics are retained", async () => {
 const {buildStudioDishStatistics}=await load();
 const dishes=[{id:"a",slug:"new"}];
 const events=[{dish_id:"a",dish_slug:"old",event_name:"dish_3d_clicked"},{dish_id:"a",dish_slug:"old",event_name:"dish_ar_clicked"},{dish_id:"deleted",dish_slug:"new",event_name:"dish_opened"}];
 const row=buildStudioDishStatistics(dishes,events,events,true,true).a;
 assert.equal(row.three,1);assert.equal(row.ar,1);assert.equal(row.views,0);assert.equal(row.previousThree,1);assert.equal(row.previousAr,1);
});
test('menu-only prior evidence does not manufacture a zero dish comparison',async()=>{
 const {buildStudioDishStatistics}=await load();
 const rows=buildStudioDishStatistics([{id:'a',slug:'soup'}],[{dish_id:'a',event_name:'dish_opened'}],[{event_name:'menu_opened'}],true,true);
 assert.equal(rows.a.previousViews,null);assert.equal(rows.a.previousThree,null);assert.equal(rows.a.previousAr,null);
});
