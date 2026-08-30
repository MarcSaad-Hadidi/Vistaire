import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildAdminEvidenceBundle } from "../lib/admin/data/evidenceRegistry.ts";
import {
  buildAdminReport,
  parseAdminReportFilters
} from "../lib/admin/reports/buildReport.ts";

const scope = {
  restaurantId: "restaurant-private",
  menuId: "menu-private",
  source: "production",
  timezone: "America/Toronto"
};
const window = {
  range: "today",
  timezone: "America/Toronto",
  calendarDayCount: 1,
  observedAt: "2026-05-19T20:42:00.000Z",
  current: { from: "2026-05-19T04:00:00.000Z", to: "2026-05-19T20:42:00.000Z" },
  previous: { from: "2026-05-18T04:00:00.000Z", to: "2026-05-18T20:42:00.000Z" },
  alignment: "local-calendar-v1"
};

function record(metricId, period, state, overrides = {}) {
  return {
    metricId,
    period,
    state,
    definitionVersion: "admin-vnext-observed-v1",
    labelKey: `metrics.${metricId}`,
    provenance: {
      source: "production",
      timezone: "America/Toronto",
      alignment: "local-calendar-v1"
    },
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

test("report filters are closed allowlists", () => {
  assert.deepEqual(parseAdminReportFilters({ range: "30d", service: "dinner" }), { range: "30d", service: "dinner" });
  assert.deepEqual(parseAdminReportFilters({}), { range: "today", service: "dinner" });
  assert.deepEqual(parseAdminReportFilters({ range: "forever", service: "brunch" }), { range: "today", service: "all" });
  assert.deepEqual(parseAdminReportFilters({ range: ["7d"], service: ["lunch"] }), { range: "today", service: "all" });
});

test("available report comparisons preserve every evidence id and avoid forbidden metrics", () => {
  const report = buildAdminReport({
    locale: "fr",
    range: "today",
    service: "all",
    bundle: bundle([
      record("observed-menu-opens", "current", { kind: "available", value: { count: 1248 } }),
      record("observed-menu-opens", "previous", { kind: "available", value: { count: 1056 } }),
      record("observed-dish-opens", "current", { kind: "available", value: { count: 2315 } }),
      record("observed-dish-opens", "previous", { kind: "available", value: { count: 1892 } }),
      record("activity-series", "current", { kind: "available", value: [{ key: "20:00", count: 142 }] }),
      record("dish-ranking", "current", { kind: "available", value: [{ key: "filet-rossini", count: 412, rank: 1 }] }),
      record("private-search-ranking", "current", { kind: "available", value: [{ term: "sans gluten", count: 186 }] })
    ])
  });

  assert.equal(report.locale, "fr");
  assert.equal(report.metrics[0].comparison.state.kind, "available");
  assert.deepEqual(report.metrics[0].comparison.evidenceIds.length, 2);
  assert.equal(report.metrics[0].comparison.value.changeRate, 192 / 1056);
  assert.deepEqual(report.timeline.evidenceIds.length, 1);
  assert.deepEqual(report.topDishes.evidenceIds.length, 1);
  assert.deepEqual(report.searches.evidenceIds.length, 1);
  assert.equal(report.highlights.every((item) => item.evidenceIds.length > 0), true);
  assert.equal(report.reliability.state, "limited");
  assert.equal(report.reliability.availableEvidence, 5);
  assert.equal(report.reliability.totalEvidence, 10);
  assert.doesNotMatch(JSON.stringify(report), /revenue|sales|orders|conversion|chiffre d.affaires|ventes|commandes/i);
  assert.doesNotMatch(JSON.stringify(report), /restaurant-private|menu-private/);
});

test("zero baseline exposes the absolute delta but never a rate", () => {
  const report = buildAdminReport({
    locale: "en",
    range: "7d",
    service: "all",
    bundle: bundle([
      record("observed-menu-opens", "current", { kind: "available", value: { count: 4 } }),
      record("observed-menu-opens", "previous", { kind: "available", value: { count: 0 } })
    ])
  });
  assert.deepEqual(report.metrics[0].comparison.value, { count: 4, previousCount: 0, delta: 4, changeRate: null });
});

test("incompatible definitions, timezones and alignment fail closed", () => {
  for (const incompatiblePrevious of [
    record("observed-menu-opens", "previous", { kind: "available", value: { count: 8 } }, { definitionVersion: "other-v2" }),
    record("observed-menu-opens", "previous", { kind: "available", value: { count: 8 } }, { provenance: { source: "production", timezone: "UTC", alignment: "local-calendar-v1" } }),
    record("observed-menu-opens", "previous", { kind: "available", value: { count: 8 } }, { provenance: { source: "production", timezone: "America/Toronto", alignment: "rolling-window-v1" } })
  ]) {
    const report = buildAdminReport({
      locale: "fr",
      range: "today",
      service: "all",
      bundle: bundle([
        record("observed-menu-opens", "current", { kind: "available", value: { count: 10 } }),
        incompatiblePrevious
      ])
    });
    assert.deepEqual(report.metrics[0].comparison.state, { kind: "insufficient", reason: "comparison-unavailable" });
    assert.equal(report.metrics[0].comparison.value, null);
  }
});

test("absence states and service slices remain explicit instead of estimating", () => {
  const states = [
    { kind: "insufficient", reason: "sample-too-small" },
    { kind: "unmeasured", reason: "instrumentation-unverified" },
    { kind: "truncated", observedRows: 10001, rowLimit: 10000 }
  ];
  const report = buildAdminReport({
    locale: "fr",
    range: "today",
    service: "lunch",
    bundle: bundle(states.flatMap((state, index) => [
      record(["observed-menu-opens", "observed-dish-opens", "observed-immersive-intents"][index], "current", state)
    ]))
  });
  assert.equal(report.service, "lunch");
  assert.equal(report.metrics.every((item) => item.current.state.kind === "unmeasured"), true);
  assert.equal(report.timeline.state.kind, "unmeasured");
  assert.equal(report.reliability.state, "unavailable");
  assert.equal(report.reliability.availableEvidence, 0);
  assert.equal(report.reliability.totalEvidence, 10);
  assert.match(report.metrics[0].current.copy, /découpage|service/i);
});

test("reports route validates access and composes the v2 evidence model", async () => {
  const page = await readFile(new URL("../app/(fr)/admin/reports/page.tsx", import.meta.url), "utf8");
  assert.match(page, /requireAdminRestaurantAccess\(["']dashboard:read["']\)/);
  assert.match(page, /parseAdminReportFilters\(/);
  assert.match(page, /VISTAIRE_ADMIN_VISUAL_FIXTURE/);
  assert.match(page, /service:\s*params\.service\s*\?\?/);
  assert.match(page, /loadAdminDataBundle\(/);
  assert.match(page, /buildAdminReport\(/);
  assert.match(page, /<AdminShell[\s\S]*activeRoute=["']reports["']/);
  assert.match(page, /restaurantName=\{dataResult\.presentation\.restaurantName\}/);
  assert.match(page, /menuPath=\{dataResult\.presentation\.publicMenuPath\}/);
  assert.match(page, /pageTitle=\{`\$\{preferences\.locale === ["']fr["'] \? ["']Bilan du service["'][\s\S]*\$\{serviceLabel\}`\}/);
  assert.doesNotMatch(page, /loadAdminDashboardData|legacyRange|identityResult/);
  assert.doesNotMatch(page, /getSupabase|createClient|\.from\(/);
  const searchParamContract = page.match(/type ReportsSearchParams\s*=\s*\{[^}]+\}/)?.[0] ?? "";
  assert.match(searchParamContract, /range\?:/);
  assert.match(searchParamContract, /service\?:/);
  assert.doesNotMatch(searchParamContract, /restaurant|menu|source|timezone/i);
});

test("reports page exposes named evidence regions and responsive print-safe structure", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../components/admin/reports/AdminReportsPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/admin/reports/AdminReports.module.css", import.meta.url), "utf8")
  ]);
  for (const component of [
    "ReportHighlights", "ReportMetricGrid", "ReportTimeline", "ReportTopDishes",
    "ReportSearches", "ReportAvailabilityChanges", "ReportReliability", "ReportRecommendations"
  ]) assert.match(page, new RegExp(`<${component}\\b`));
  for (const label of ["points clés", "chronologie", "top plats", "recherches", "fiabilité"]) {
    assert.match(page, new RegExp(label, "i"));
  }
  assert.match(page, /Ce qui a changé/);
  assert.match(page, /Résumé Vistaire/);
  assert.doesNotMatch(page, /<h1\b/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /@media\s+print/);
  assert.match(css, /break-inside:\s*avoid/);
  assert.match(css, /display:\s*none\s*!important/);
  assert.doesNotMatch(css, /overflow-x:\s*(auto|scroll)/);
});

test("report actions stay local, accessible and degrade without browser APIs", async () => {
  const [actions, route] = await Promise.all([
    readFile(new URL("../components/admin/reports/ReportActions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(fr)/admin/reports/page.tsx", import.meta.url), "utf8")
  ]);
  assert.match(actions, /^[\s\S]*["']use client["']/);
  assert.match(actions, /href=\{exportHref\}/);
  assert.match(actions, /window\.print\(\)/);
  assert.match(actions, /typeof window\.print/);
  assert.match(actions, /navigator\.share\(/);
  assert.match(actions, /navigator\.clipboard\.writeText\(window\.location\.href\)/);
  assert.match(actions, /aria-live=["']polite["']/);
  assert.doesNotMatch(actions, /fetch\(|https?:\/\/|report\s*:/i);
  assert.match(route, /headerActions=\{<ReportActions\b/);
});

test("Reports Playwright proof is hermetic, assertion-bearing and unskipped", async () => {
  const source = await readFile(new URL("../e2e/admin-vnext-reports.spec.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /test\.skip|test\.fixme|describe\.skip|VISTAIRE_ADMIN_E2E_QR_TOKEN/);
  assert.match(source, /target\.origin !== appOrigin && target\.origin !== fixtureOrigin/);
  assert.match(source, /route\.abort\(["']blockedbyclient["']\)/);
  assert.match(source, /page\.routeWebSocket\(/);
  assert.match(source, /webSocketRoute\.close\(/);
  assert.match(source, /390/);
  assert.match(source, /430/);
  assert.match(source, /1448/);
  assert.match(source, /expect\(/);
});

test("Reports source and proofs contain no mojibake", async () => {
  const files = [
    "app/(fr)/admin/reports/page.tsx",
    "app/(fr)/admin/api/reports/export/route.ts",
    "components/admin/reports/AdminReportsPage.tsx",
    "components/admin/reports/ReportActions.tsx",
    "components/admin/reports/ReportAvailabilityChanges.tsx",
    "components/admin/reports/ReportFilters.tsx",
    "components/admin/reports/ReportHighlights.tsx",
    "components/admin/reports/ReportRecommendations.tsx",
    "components/admin/reports/ReportReliability.tsx",
    "components/admin/reports/ReportSearches.tsx",
    "components/admin/reports/ReportTimeline.tsx",
    "lib/admin/reports/buildReport.ts",
    "lib/admin/reports/csv.ts",
    "lib/admin/reports/reportCopy.ts",
    "tests/admin-vnext-reports.test.mjs",
    "tests/admin-vnext-reports-csv.test.mjs",
    "e2e/admin-vnext-reports.spec.ts"
  ];
  const sources = await Promise.all(files.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  const mojibakeLeadCodePoints = new Set([195, 194, 226]);
  for (const [index, source] of sources.entries()) {
    assert.equal([...source].some((character) => mojibakeLeadCodePoints.has(character.codePointAt(0))), false, `${files[index]} contains mojibake`);
  }
});
