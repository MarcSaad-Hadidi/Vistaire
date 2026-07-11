import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const read = (path) => readFile(path, "utf8");
async function loadAnalyticsPanel() {
  let source = await read("components/admin/AdminAnalyticsPanel.tsx");
  source = source.replace(/import[^;]+adminDashboardViewModel[^;]+;\s*/s, "").replace(/import styles[^;]+;\s*/, "const styles = { metrics: 'metrics', chart: 'chart', evidence: 'evidence' };\n").replace(/import analyticsStyles[^;]+;\s*/, "const analyticsStyles = { bars: 'bars', bar: 'bar', barFill: 'barFill' };\n");
  const javascript = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const require = createRequire(import.meta.url);
  const reactUrl = pathToFileURL(require.resolve("react")).href;
  const viewModelUrl = pathToFileURL("components/admin/adminDashboardViewModel.ts").href;
  const loaded = await import(`data:text/javascript;base64,${Buffer.from(`import React from '${reactUrl}'; import { buildAnalyticsPresentation } from '${viewModelUrl}'; ${javascript}`).toString("base64")}`);
  return loaded.AdminAnalyticsPanel;
}

test("admin has a private dedicated shell without marketing or heavy media", async () => {
  const [layout, page, dashboard, css] = await Promise.all([
    read("app/admin/layout.tsx"), read("app/admin/page.tsx"),
    read("components/admin/AdminRestaurantDashboard.tsx"),
    read("components/admin/AdminDashboard.module.css")
  ]);
  const source = `${layout}\n${page}\n${dashboard}`;
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /follow:\s*true/);
  assert.match(layout, /noarchive:\s*true/);
  assert.match(source, /AdminDashboard\.module\.css/);
  assert.doesNotMatch(source, /VistaireRestaurateurDashboardPreview|next\/image|PhotoResto|AdminAssistant|\/api\/owner|model-viewer|\.glb|\.usdz|<canvas/i);
  assert.doesNotMatch(css, /background-image|url\(/i);
});

test("page strictly allowlists server ranges and discloses UTC timezone", async () => {
  const [page, parser, dashboard] = await Promise.all([read("app/admin/page.tsx"), read("lib/admin/pageSearchParams.ts"), read("components/admin/AdminRestaurantDashboard.tsx")]);
  assert.match(page, /parseAdminPageSearchParams\(await searchParams\)/);
  assert.match(page, /loadAdminDashboardData\(access\.restaurantId, range\)/);
  assert.match(parser, /Pick<[^>]+["']range["']/);
  assert.doesNotMatch(parser, /restaurantId|restaurant_id|slug/);
  assert.doesNotMatch(page, /searchParams\?\.|searchParams\[|as\s+RangeLoader/);
  assert.match(dashboard, /Aujourd.hui[^\n]*UTC|Fen.tre glissante[^\n]*UTC/);
  assert.match(dashboard, /fuseau horaire[^\n]*pas configur/i);
});

test("dashboard exposes evidence semantics, chart alternatives and worklist controls", async () => {
  const [dashboard, worklist, viewModel, panel] = await Promise.all([read("components/admin/AdminRestaurantDashboard.tsx"), read("components/admin/AdminDishWorklist.tsx"), read("components/admin/adminDashboardViewModel.ts"), read("components/admin/AdminAnalyticsPanel.tsx")]);
  const source = `${dashboard}\n${worklist}\n${viewModel}\n${panel}`;
  assert.match(source, /Donn.es insuffisantes|Donn.e insuffisante/);
  assert.match(source, /Non mesur/);
  assert.match(source, /aria-labelledby/);
  assert.match(source, /<title>|aria-label/);
  assert.match(source, /<desc>|description/i);
  for (const label of ["Tous", "Disponibles", "Indisponibles", "Prix manquant", "Description manquante", "Photo manquante", "3D\/AR"]) assert.match(worklist, new RegExp(label));
  assert.match(worklist, /type="search"/);
  assert.match(source, /aria-live=/);
  assert.match(source, /focus-visible/);
  assert.doesNotMatch(dashboard, /d="M5 75/);
  assert.match(worklist, /flex-wrap|grid-cols/);
});

test("analytics presentation exhaustively preserves real, insufficient and unavailable evidence", async () => {
  const { buildAnalyticsPresentation } = await import("../components/admin/adminDashboardViewModel.ts");
  const window = { range: "7d", startInclusive: "2026-07-03T12:00:00Z", endExclusive: "2026-07-10T12:00:00Z", comparisonStartInclusive: "2026-06-26T12:00:00Z", comparisonEndExclusive: "2026-07-03T12:00:00Z" };
  const realState = { kind: "real", completeness: "complete", observationWindow: window, lastUpdatedAt: "2026-07-10T12:00:00Z", freshness: "fresh", coverage: { menuOpened: true, dishOpened: true }, metrics: [{ id: "menu-opens", value: 23, changeRate: null }], activitySeries: [{ bucket: "2026-07-09", count: 8 }, { bucket: "2026-07-10", count: 15 }], categoryBreakdown: [], topDishes: [], searches: [], immersive: [], funnel: { kind: "unsupported" }, comparison: null };
  const real = buildAnalyticsPresentation(realState);
  assert.equal(real.kind, "real");
  assert.deepEqual(real.activity.map((point) => point.value), [8, 15]);
  assert.match(real.summary, /23/);
  const insufficient = buildAnalyticsPresentation({ kind: "insufficient", reason: "sample-too-small", completeness: "limited-sample", observationWindow: window, availableEvidence: [{ label: "Événements", value: 4 }], missingEvidence: ["20 sessions nécessaires"] });
  assert.deepEqual(insufficient, { kind: "insufficient", reason: "sample-too-small", completeness: "limited-sample", title: "Donnée insuffisante", availableEvidence: [{ label: "Événements", value: 4 }], missingEvidence: ["20 sessions nécessaires"] });
  const unavailable = buildAnalyticsPresentation({ kind: "unavailable", reason: "query", completeness: "truncated", title: "Lecture interrompue", explanation: "La lecture complète n’a pas abouti.", retryable: true });
  assert.equal(unavailable.explanation, "La lecture complète n’a pas abouti.");
  assert.equal(unavailable.retryable, true);
  const Panel = await loadAnalyticsPanel();
  const realDom = renderToStaticMarkup(React.createElement(Panel, { state: realState }));
  assert.match(realDom, /2026-07-03T12:00:00Z/);
  assert.match(realDom, /2026-07-10T12:00:00Z/);
  assert.match(realDom, /class="bar"[\s\S]*class="barFill"/);
  assert.match(realDom, /<table[\s\S]*2026-07-09[\s\S]*8/);
  const insufficientDom = renderToStaticMarkup(React.createElement(Panel, { state: { kind: "insufficient", reason: "sample-too-small", completeness: "limited-sample", observationWindow: window, availableEvidence: [{ label: "Événements", value: 4 }], missingEvidence: ["20 sessions nécessaires"] } }));
  const unavailableDom = renderToStaticMarkup(React.createElement(Panel, { state: { kind: "unavailable", reason: "query", completeness: "truncated", title: "Lecture interrompue", explanation: "La lecture complète n’a pas abouti.", retryable: true } }));
  assert.match(insufficientDom, /sample-too-small[\s\S]*20 sessions nécessaires/);
  assert.match(unavailableDom, /role="alert"[\s\S]*Lecture interrompue/);
});

test("analytics UI consumes only the canonical server union without fallback values", async () => {
  const [viewModel, panel] = await Promise.all([read("components/admin/adminDashboardViewModel.ts"), read("components/admin/AdminAnalyticsPanel.tsx")]);
  const source = `${viewModel}\n${panel}`;
  assert.match(viewModel, /import type \{ AdminAnalyticsState \}/);
  assert.match(viewModel, /Extract<AdminAnalyticsState/);
  assert.match(panel, /import type \{ AdminAnalyticsState \}/);
  assert.doesNotMatch(source, /TargetAnalyticsState|\?\?\s*0|\?\?\s*["']production["']|\bas\s+\{/);
});

test("activity bars have concrete responsive CSS", async () => {
  const [panel, css] = await Promise.all([read("components/admin/AdminAnalyticsPanel.tsx"), read("components/admin/AdminAnalytics.module.css")]);
  assert.match(panel, /analyticsStyles\.bars/);
  assert.match(css, /\.bars\s*\{[^}]*height:/s);
  assert.match(css, /align-items:\s*flex-end/);
  assert.match(css, /\.barFill\s*\{[^}]*display:\s*block/s);
  assert.doesNotMatch(css, /animation|transition/);
});

test("clipboard failures have a visible live alert", async () => {
  const actions = await read("components/admin/AdminMenuActions.tsx");
  assert.match(actions, /role="alert"/);
  assert.match(actions, /Impossible de copier/);
});

test("admin visual system is scoped, locally typeset and accessible", async () => {
  const [shell, nav, primitives, icons, css, layout, loading] = await Promise.all([
    read("components/admin/system/AdminShell.tsx"),
    read("components/admin/system/AdminNav.tsx"),
    read("components/admin/system/AdminPrimitives.tsx"),
    read("components/admin/system/AdminIcons.tsx"),
    read("components/admin/system/AdminSystem.module.css"),
    read("app/admin/layout.tsx"),
    read("app/admin/loading.tsx")
  ]);
  const source = `${shell}\n${nav}\n${primitives}\n${icons}\n${layout}\n${loading}`;

  assert.match(shell, /<main/);
  assert.match(nav, /<nav[^>]+aria-label=/);
  assert.match(nav, /Vue d.ensemble/);
  assert.match(nav, /Disponibilit.s/);
  assert.match(nav, /Analyses/);
  assert.match(nav, /D.connexion/);
  assert.doesNotMatch(source, /Param.tres|Assistant|\/owner|sidebar/i);

  assert.match(css, /\.adminRoot\s*\{/);
  for (const token of ["--admin-bg", "--admin-surface", "--admin-border", "--admin-accent", "--admin-text", "--admin-space-2"]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /@font-face[\s\S]*BT Suave[\s\S]*btsuave-regular\.otf/);
  assert.match(css, /@font-face[\s\S]*Neue Montreal[\s\S]*NeueMontreal-Regular\.otf/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  for (const primitive of ["AdminPanel", "AdminKpiCard", "AdminEvidenceState", "AdminStatusBadge", "AdminTabs", "AdminTooltip", "AdminToggle", "AdminToast", "AdminSkeleton"]) {
    assert.match(primitives, new RegExp(`export function ${primitive}`));
  }
  assert.match(primitives, /role="status"/);
  assert.match(primitives, /role="alert"/);
  assert.match(primitives, /aria-describedby/);
  assert.match(primitives, /aria-checked/);
  assert.match(loading, /aria-busy="true"/);
});

test("admin compact controls preserve 44px hit areas and direct tooltip semantics", async () => {
  const [primitives, css] = await Promise.all([
    read("components/admin/system/AdminPrimitives.tsx"),
    read("components/admin/system/AdminSystem.module.css")
  ]);

  assert.match(css, /\.tabs a::before\s*\{[^}]*inset:\s*-3px\s+0/s);
  assert.match(css, /\.toggle\s*\{[^}]*height:\s*44px/s);
  assert.match(css, /\.toggle::before\s*\{[^}]*height:\s*28px/s);
  assert.match(css, /\.mobileNav a\s*\{[^}]*font-size:\s*12px/s);

  assert.match(primitives, /useId\(\)/);
  assert.match(primitives, /cloneElement/);
  assert.match(primitives, /aria-describedby/);
  assert.doesNotMatch(primitives, /tooltipTrigger[^>]+tabIndex=/);
  assert.doesNotMatch(primitives, /label\.toLowerCase\(\)/);
});

test("overview composes honest evidence panels with accessible exact values", async () => {
  const [page, overview, activity, top, strip, css] = await Promise.all([
    read("app/admin/page.tsx"),
    read("components/admin/overview/AdminOverview.tsx"),
    read("components/admin/overview/AdminActivityChart.tsx"),
    read("components/admin/overview/AdminTopDishes.tsx"),
    read("components/admin/overview/AdminAvailabilityStrip.tsx"),
    read("components/admin/overview/AdminOverview.module.css")
  ]);
  const source = `${page}\n${overview}\n${activity}\n${top}\n${strip}`;
  assert.match(page, /<AdminOverview/);
  assert.match(source, /AdminShell/);
  assert.match(source, /href="\/admin\/insights"/);
  assert.match(source, /href="\/admin\/availability"/);
  assert.match(activity, /<svg[\s\S]*<title>[\s\S]*<desc>/);
  assert.match(activity, /<table/);
  assert.match(source, /AdminEvidenceState/);
  assert.doesNotMatch(source, /getDemo|Math\.random/);
  assert.match(css, /grid-template-areas/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /\.kpis[^}]*grid-template-columns:\s*repeat\(2/s);
  assert.match(css, /\.kpiImmersive[^}]*display:\s*none/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("insights renders nine truthful panels with non-hover exact alternatives", async () => {
  const [page, insights, heatmap, comparison, breakdowns, css] = await Promise.all([
    read("app/admin/insights/page.tsx"),
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/AdminHeatmap.tsx"),
    read("components/admin/insights/AdminComparisonChart.tsx"),
    read("components/admin/insights/AdminBreakdowns.tsx"),
    read("components/admin/insights/AdminInsights.module.css")
  ]);
  const source = `${page}\n${insights}\n${heatmap}\n${comparison}\n${breakdowns}`;
  assert.match(page, /requireAdminRestaurantAccess\("dashboard:read"\)/);
  assert.match(page, /loadAdminDashboardData\(access\.restaurantId, range\)/);
  assert.match(source, /AdminShell/);
  assert.match(source, /href="\/admin"/);
  assert.match(heatmap, /<table/);
  assert.match(comparison, /<svg[\s\S]*<title>[\s\S]*<desc>[\s\S]*<table/);
  assert.match(source, /AdminEvidenceState/);
  assert.doesNotMatch(source, /getDemo|Math\.random/);
  for (const area of ["activity", "comparison", "heatmap", "dishes", "searches", "categories", "service", "summary", "recommendations"]) {
    assert.match(css, new RegExp(`grid-area:\\s*${area}`));
  }
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("insights review fixes lock bottom proportions, heatmap orientation and evidence fidelity", async () => {
  const [overview, insights, heatmap, css, overviewE2e, insightsE2e] = await Promise.all([
    read("components/admin/overview/AdminOverview.tsx"),
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/AdminHeatmap.tsx"),
    read("components/admin/insights/AdminInsights.module.css"),
    read("e2e/admin-dashboard.spec.ts"),
    read("e2e/admin-insights.spec.ts")
  ]);
  assert.match(css, /\.bottomGrid\s*\{[^}]*grid-template-columns:\s*911fr\s+639fr/s);
  assert.match(css, /\.heatmap\s*\{[^}]*grid-template-columns:\s*repeat\(16,/s);
  assert.match(css, /\.heatmap\s*\{[^}]*grid-template-rows:\s*repeat\(7,/s);
  assert.match(heatmap, /hours\.map[\s\S]*days\.map/);
  assert.match(heatmap, /className=\{styles\.hourLabels\}/);
  assert.match(heatmap, /className=\{styles\.dayLabels\}/);
  assert.doesNotMatch(overview, /Données de (?:service|catégorie) insuffisantes/);
  assert.doesNotMatch(insights, /Pas assez de données/);
  for (const source of [overviewE2e, insightsE2e]) {
    assert.match(source, /390[\s\S]*430/);
    assert.match(source, /scrollWidth/);
    assert.match(source, /console/);
    assert.match(source, /\.glb\|usdz\|mp4/);
    assert.match(source, /reducedMotion/);
  }
});

test("heatmap renders one normalized 16 by 7 matrix for visual and exact values", async () => {
  let source = await read("components/admin/insights/AdminHeatmap.tsx");
  source = source
    .replace(/import type[^;]+;\s*/, "")
    .replace(/import \{ AdminEvidenceState \}[^;]+;\s*/, "")
    .replace(/import styles[^;]+;\s*/, "const styles = new Proxy({}, { get: (_, key) => String(key) });\n")
    .replace("export function AdminHeatmap", "function AdminHeatmap")
    .concat("\nexport { AdminHeatmap };");
  const javascript = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const require = createRequire(import.meta.url);
  const reactUrl = pathToFileURL(require.resolve("react")).href;
  const loadedHeatmap = await import(`data:text/javascript;base64,${Buffer.from(`import React from '${reactUrl}'; const AdminEvidenceState=({kind,reason})=>React.createElement('div',{'data-kind':kind},reason); ${javascript}`).toString("base64")}`);
  const supported = renderToStaticMarkup(React.createElement(loadedHeatmap.AdminHeatmap, { evidence: { kind: "supported", data: [{ weekdayUtc: 1, hourUtc: 9, count: 4 }] } }));
  assert.equal((supported.match(/<i /g) ?? []).length, 112);
  assert.equal((supported.match(/<tr>/g) ?? []).length, 113);
  assert.match(supported, /Lun[\s\S]*9:00[\s\S]*4/);
  for (const evidence of [{ kind: "insufficient", reason: "sample-too-small" }, { kind: "unavailable", reason: "source-incomplete" }]) {
    const dom = renderToStaticMarkup(React.createElement(loadedHeatmap.AdminHeatmap, { evidence }));
    assert.match(dom, new RegExp(`data-kind="${evidence.kind}"[\\s\\S]*${evidence.reason}`));
  }
});

test("admin E2E contracts fail closed and measure two-dimensional touch targets", async () => {
  const sources = await Promise.all([read("e2e/admin-dashboard.spec.ts"), read("e2e/admin-insights.spec.ts")]);
  for (const source of sources) {
    assert.match(source, /VISTAIRE_REQUIRE_ADMIN_E2E/);
    assert.match(source, /function requireAdminFixture/);
    assert.match(source, /throw new Error/);
    assert.match(source, /requestfailed/);
    assert.match(source, /box\.width\)\.toBeGreaterThanOrEqual\(44\)/);
    assert.match(source, /box\.height\)\.toBeGreaterThanOrEqual\(44\)/);
  }
});
