import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildAdminEvidenceBundle } from "../lib/admin/data/evidenceRegistry.ts";
import { buildTodayViewModel } from "../components/admin/today/todayViewModel.ts";

const scope = {
  restaurantId: "restaurant-today",
  menuId: "menu-today",
  source: "production",
  timezone: "America/Toronto"
};

const window = {
  range: "today",
  observedAt: "2026-08-11T20:42:00.000Z",
  current: { from: "2026-08-11T04:00:00.000Z", to: "2026-08-11T20:42:00.000Z" },
  previous: { from: "2026-08-10T04:00:00.000Z", to: "2026-08-10T20:42:00.000Z" }
};

function record(metricId, period, state, overrides = {}) {
  return {
    metricId,
    definitionVersion: "today-test-v1",
    labelKey: `metrics.${metricId}`,
    state,
    period,
    provenance: { source: "production", trust: metricId.startsWith("catalog-") ? "catalog" : "observed" },
    freshness: { generatedAt: window.observedAt },
    sample: { state: state.kind },
    privacy: { classification: "aggregate", promptUnsafe: false },
    audiences: ["ui", "export", "mistral"],
    ...overrides
  };
}

function bundle(records) {
  return buildAdminEvidenceBundle({ scope, window, generatedAt: window.observedAt, records });
}

test("Today preserves available evidence identities and values without commercial claims", () => {
  const input = bundle([
    record("observed-menu-opens", "current", { kind: "available", value: { count: 1_248 } }),
    record("observed-dish-opens", "current", { kind: "available", value: { count: 2_315 } }),
    record("activity-series", "current", { kind: "available", value: [{ key: "20:00", count: 94 }, { key: "21:00", count: 121 }] }),
    record("dish-ranking", "current", { kind: "available", value: [{ key: "filet-rossini", count: 412, rank: 1 }] }),
    record("time-distribution", "current", { kind: "available", value: [{ key: "18:02", count: 12 }] }),
    record("private-search-ranking", "current", { kind: "available", value: [{ key: "sans gluten", count: 186, rank: 1 }] }),
    record("catalog-dishes", "snapshot", { kind: "available", value: { count: 48 } })
  ]);

  const output = buildTodayViewModel({ locale: "fr", bundle: input });
  assert.equal(output.generatedAt, window.observedAt);
  assert.deepEqual(
    output.pulse
      .filter((item) => item.metricId === "observed-menu-opens" || item.metricId === "observed-dish-opens")
      .map((item) => [item.metricId, item.evidenceId, item.rawValue]),
    [
      ["observed-menu-opens", "ev:observed-menu-opens:current:today-test-v1", { count: 1_248 }],
      ["observed-dish-opens", "ev:observed-dish-opens:current:today-test-v1", { count: 2_315 }]
    ]
  );
  assert.deepEqual(output.activity.data.points, [{ key: "20:00", count: 94 }, { key: "21:00", count: 121 }]);
  assert.deepEqual(output.topDishes.data, [{ key: "filet-rossini", label: "filet-rossini", count: 412, rank: 1 }]);
  assert.deepEqual(output.timeline.data, [{ key: "18:02", label: "18:02", count: 12 }]);
  assert.deepEqual(output.searches.data, [{ key: "sans gluten", label: "sans gluten", count: 186, rank: 1 }]);
  assert.equal(output.menuHealth.totalDishes, 48);
  assert.doesNotMatch(JSON.stringify(output), /clients uniques|unique customers|\bventes\b|\bsales\b|chiffre d.affaires|\brevenue\b|conversion commerciale/i);
});

test("Today keeps every evidence absence state explicit and never turns it into zero", () => {
  const states = [
    { kind: "insufficient", reason: "sample-too-small" },
    { kind: "unmeasured", reason: "instrumentation-unverified" },
    { kind: "unavailable", reason: "timezone-unconfigured" },
    { kind: "error", code: "database", retryable: true },
    { kind: "truncated", observedRows: 10_001, rowLimit: 10_000 }
  ];

  for (const state of states) {
    const output = buildTodayViewModel({
      locale: "en",
      bundle: bundle([record("observed-menu-opens", "current", state)])
    });
    const metric = output.pulse.find((item) => item.metricId === "observed-menu-opens");
    assert.deepEqual(metric.state, state);
    assert.equal(metric.value, null);
    assert.doesNotMatch(metric.displayValue, /^0(?:[.,]0+)?$/);
  }
});

test("Today marks missing registry evidence as unmeasured instead of inventing a fixture", () => {
  const output = buildTodayViewModel({ locale: "fr", bundle: bundle([]) });
  assert.equal(output.pulse.length, 6);
  assert.ok(output.pulse.every((item) => item.state.kind === "unmeasured" && item.value === null && item.evidenceId === null));
  assert.equal(output.activity.state.kind, "unmeasured");
  assert.equal(output.alerts.state.kind, "unmeasured");
  assert.equal(output.topDishes.state.kind, "unmeasured");
  assert.equal(output.timeline.state.kind, "unmeasured");
  assert.equal(output.searches.state.kind, "unmeasured");
  assert.equal(output.menuHealth.state.kind, "unmeasured");
});

test("Today preserves a null comparison rate when the baseline is zero", () => {
  const comparisonValue = { count: 12, previousCount: 0, delta: 12, changeRate: null };
  const input = bundle([
    record("observed-menu-opens", "current", { kind: "available", value: comparisonValue })
  ]);
  const output = buildTodayViewModel({ locale: "fr", bundle: input });
  const metric = output.pulse.find((item) => item.metricId === "observed-menu-opens");
  assert.deepEqual(metric.rawValue, comparisonValue);
  assert.equal(metric.changeRate, null);
  assert.notEqual(metric.changeLabel, "+0 %");
});

test("Today bounds long evidence lists without changing their order", () => {
  const ranking = Array.from({ length: 7 }, (_, index) => ({
    key: `dish-${index + 1}`,
    count: 70 - index,
    rank: index + 1
  }));
  const series = Array.from({ length: 7 }, (_, index) => ({ key: `${18 + index}:00`, count: index + 1 }));
  const output = buildTodayViewModel({
    locale: "fr",
    bundle: bundle([
      record("dish-ranking", "current", { kind: "available", value: ranking }),
      record("private-search-ranking", "current", { kind: "available", value: ranking }),
      record("time-distribution", "current", { kind: "available", value: series })
    ])
  });
  assert.deepEqual(output.topDishes.data.map((item) => item.key), ["dish-1", "dish-2", "dish-3", "dish-4", "dish-5"]);
  assert.deepEqual(output.searches.data.map((item) => item.key), ["dish-1", "dish-2", "dish-3", "dish-4", "dish-5"]);
  assert.deepEqual(output.timeline.data.map((item) => item.key), ["18:00", "19:00", "20:00", "21:00", "22:00"]);
});

test("Today sections compose Foundation primitives and expose named regions", async () => {
  const files = [
    "AdminTodayPage.tsx",
    "TodayBriefing.tsx",
    "TodayPulse.tsx",
    "TodayActivity.tsx",
    "TodayAlerts.tsx",
    "TodayTopDishes.tsx",
    "TodayTimeline.tsx",
    "TodaySearches.tsx",
    "TodayMenuHealth.tsx",
    "TodayQuickActions.tsx",
    "TodayPanelState.tsx"
  ];
  const sources = await Promise.all(files.map((file) => readFile(`components/admin/today/${file}`, "utf8")));
  const all = sources.join("\n");
  assert.match(sources[0], /AdminShell/);
  assert.match(sources[0], /activeRoute="today"/);
  assert.match(sources[0], /pageTitle=\{copy\.pageTitle\}/);
  assert.match(sources[0], /pageDescription=\{copy\.pageSubtitle\}/);
  assert.doesNotMatch(sources[0], /<h1\b|<h2\b/);
  for (const landmark of ["briefing", "pulse", "activity", "alerts", "top-dishes", "timeline", "searches", "menu-health", "quick-actions"]) {
    assert.match(all, new RegExp(`data-today-region=["']${landmark}["']`));
  }
  assert.match(all, /InteractiveLineChart/);
  assert.match(all, /exactValues|points\.map/);
  assert.match(all, /aria-live=/);
  assert.match(sources[1], /todayStateLabel\(model\.locale, item\.state\)/);
  assert.doesNotMatch(sources[1], /:\s*item\.state\.kind\s*\}/);
  assert.doesNotMatch(all, /@supabase|supabase-js|analytics_events|rawRows|demoAnalytics|fixture/i);
});

test("Today quick actions are canonical GET navigation links only", async () => {
  const source = await readFile("components/admin/today/TodayQuickActions.tsx", "utf8");
  assert.match(source, /from "next\/link"/);
  for (const path of ["/admin/availability", "/admin/insights", "/admin/reports", "/admin/more"]) {
    assert.match(source, new RegExp(path.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(source, /<form\b|<button\b|\bfetch\s*\(|use server|server action|mutation|route\.ts/i);
});

test("Today CSS is mobile-first, uses shared tokens and reserves bottom navigation space", async () => {
  const source = await readFile("components/admin/today/AdminToday.module.css", "utf8");
  assert.match(source, /var\(--admin-/);
  assert.match(source, /env\(safe-area-inset-bottom\)/);
  assert.match(source, /@media\s*\(min-width:\s*701px\)/);
  assert.match(source, /@media\s*\(min-width:\s*1180px\)/);
  assert.doesNotMatch(source, /width:\s*(?:1448|1536)px/);
});

test("Today server route derives scope from access and loads one v2 evidence bundle", async () => {
  const [route, page] = await Promise.all([
    readFile("app/admin/page.tsx", "utf8"),
    readFile("components/admin/today/AdminTodayPage.tsx", "utf8")
  ]);
  assert.match(route, /requireAdminRestaurantAccess\("dashboard:read"\)/);
  assert.match(route, /parseAdminPageSearchParams\(.*\)/s);
  assert.match(route, /loadAdminDataBundle\(access, range\)/);
  assert.match(route, /buildTodayViewModel\(\{\s*locale:\s*preferences\.locale,\s*bundle:\s*result\.bundle\s*\}\)/s);
  assert.match(route, /restaurantName=\{result\.presentation\.restaurantName\}/);
  assert.match(route, /menuPath=\{result\.presentation\.publicMenuPath\}/);
  assert.match(page, /activeRoute="today"/);
  assert.doesNotMatch(route, /loadAdminDashboardData|demoAnalytics|adminVisualFixture|searchParams[^\n]*(?:restaurant|menu|source)/i);
});

test("Today E2E is deterministic, loopback-only and forbids mutation traffic", async () => {
  const source = await readFile("e2e/admin-vnext-today.spec.ts", "utf8");
  assert.match(source, /allowedOrigins/);
  assert.match(source, /routeWebSocket/);
  assert.match(source, /\["GET", "HEAD"\]\.includes\(request\.method\(\)\)/);
  assert.match(source, /\{ width: 390, height: 844 \}/);
  assert.match(source, /\{ width: 430, height: 932 \}/);
  assert.match(source, /\{ width: 1448, height: 1086 \}/);
  assert.match(source, /English/);
  assert.match(source, /Dark/);
  assert.doesNotMatch(source, /VISTAIRE_ADMIN_E2E_QR_TOKEN|test\.(?:skip|fixme)|\.skip\(|\.fixme\(/);
});
