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

test("presentation primitives stay prop-driven without private navigation, data or server dependencies", async () => {
  const presentation = await read("components/admin/system/AdminPresentationPrimitives.tsx").catch(() => "");
  const expected = ["AdminPanel", "AdminKpiCard", "AdminEvidenceState", "AdminStatusBadge", "AdminTooltip", "AdminToggle", "AdminToast", "AdminSkeleton"];
  const imports = [...presentation.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

  for (const primitive of expected) assert.match(presentation, new RegExp(`export function ${primitive}\\b`));
  assert.deepEqual([...new Set(imports)].sort(), ["./AdminIcons", "./AdminSystem.module.css", "@/lib/adminPresentationCopy", "react"].sort());
  assert.doesNotMatch(presentation, /next\/link|<Link\b|\bAdminTabs\b|["'`]\/admin(?:\/|["'`])/);
  assert.doesNotMatch(presentation, /(?:@\/lib\/admin\/|server-only|next\/headers|cookies\s*\(|headers\s*\(|fetch\s*\(|router\.|supabase)/i);
});

test("legacy primitives entrypoint re-exports every presentation primitive while keeping AdminTabs unchanged", async () => {
  const legacy = await read("components/admin/system/AdminPrimitives.tsx");
  const expected = ["AdminPanel", "AdminKpiCard", "AdminEvidenceState", "AdminStatusBadge", "AdminTooltip", "AdminToggle", "AdminToast", "AdminSkeleton"];
  const reExport = legacy.match(/export\s*\{([\s\S]*?)\}\s*from\s*["']\.\/AdminPresentationPrimitives["']/)?.[1] ?? "";

  for (const primitive of expected) assert.match(reExport, new RegExp(`\\b${primitive}\\b`));
  assert.match(legacy, /import Link from ["']next\/link["']/);
  assert.match(legacy, /export function AdminTabs\b/);
  assert.match(legacy, /active: "overview" \| "availability" \| "insights"; className\?: string/);
  assert.match(legacy, /className=\{classes\(styles\.tabs, className\)\}/);
  assert.match(legacy, /aria-label="Sections principales"/);
  assert.match(legacy, /href="\/admin" aria-current=\{active === "overview" \? "page" : undefined\}/);
  assert.match(legacy, /href="\/admin\/availability" aria-current=\{active === "availability" \? "page" : undefined\}/);
  assert.match(legacy, /href="\/admin\/insights" aria-current=\{active === "insights" \? "page" : undefined\}/);
  assert.match(legacy, /Vue d.ensemble/);
  assert.match(legacy, /Disponibilit.s/);
  assert.match(legacy, /Analyses/);
  for (const primitive of expected) assert.doesNotMatch(legacy, new RegExp(`export function ${primitive}\\b`));
});

test("admin visual system is scoped, locally typeset and accessible", async () => {
  const [shell, nav, primitivesEntry, presentationPrimitives, icons, css, layout, loading] = await Promise.all([
    read("components/admin/system/AdminShell.tsx"),
    read("components/admin/system/AdminNav.tsx"),
    read("components/admin/system/AdminPrimitives.tsx"),
    read("components/admin/system/AdminPresentationPrimitives.tsx"),
    read("components/admin/system/AdminIcons.tsx"),
    read("components/admin/system/AdminSystem.module.css"),
    read("app/admin/layout.tsx"),
    read("app/admin/loading.tsx")
  ]);
  const primitives = `${primitivesEntry}\n${presentationPrimitives}`;
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
    read("components/admin/system/AdminPresentationPrimitives.tsx"),
    read("components/admin/system/AdminSystem.module.css")
  ]);

  assert.match(css, /\.tabs a::before\s*\{[^}]*inset:\s*-3px\s+0/s);
  assert.match(css, /\.toggle\s*\{[^}]*height:\s*44px/s);
  assert.match(css, /\.toggle::before\s*\{[^}]*height:\s*28px/s);
  assert.match(css, /\.mobileNav a\s*\{[^}]*font-size:\s*12px/s);
  assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.tabs\s*\{[^}]*display:\s*none/s);

  assert.match(primitives, /useId\(\)/);
  assert.match(primitives, /cloneElement/);
  assert.match(primitives, /aria-describedby/);
  assert.doesNotMatch(primitives, /tooltipTrigger[^>]+tabIndex=/);
  assert.doesNotMatch(primitives, /label\.toLowerCase\(\)/);
});

test("shared admin shell exposes the approved menu actions on every route", async () => {
  const shell = await readFile("components/admin/system/AdminShell.tsx", "utf8");
  const menuActions = await readFile("components/admin/AdminMenuActions.tsx", "utf8");
  for (const label of ["Ouvrir le menu client", "Copier le lien du menu", "Déconnexion"]) {
    assert.match(menuActions, new RegExp(label));
  }
  assert.match(shell, /<AdminMenuActions menuPath=\{menuPath\}/);
  assert.match(shell, /<AdminTabs active=\{active\}/);
  assert.doesNotMatch(shell, /actions\?:\s*ReactNode/);
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
  assert.match(activity, /InteractiveLineChart/);
  assert.match(activity, /title="Activit.+ du menu"/);
  assert.match(source, /AdminEvidenceState/);
  assert.doesNotMatch(source, /getDemo|Math\.random/);
  assert.match(css, /grid-template-areas/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /\.kpis[^}]*grid-template-columns:\s*repeat\(2/s);
  assert.doesNotMatch(css, /@media\(max-width:700px\)[\s\S]*\.kpiImmersive\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /data-mobile-secondary|data-narrow-secondary/);
  assert.match(overview, /data-overview-kpis/);
  assert.match(top, /data-overview-ranking/);
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
  assert.match(heatmap, /InteractiveHeatmap/);
  assert.match(comparison, /ComparisonLineChart/);
  assert.match(source, /AdminEvidenceState/);
  assert.match(insights, /Top plats consultés/);
  assert.doesNotMatch(insights, /Plats favoris/);
  assert.doesNotMatch(source, /getDemo|Math\.random/);
  assert.equal((insights.match(/data-insights-panel/g) ?? []).length, 9);
  assert.match(css, /\.primaryGrid[^}]*grid-template-columns:[^}]*722fr[^}]*416fr[^}]*402fr/s);
  assert.match(css, /\.secondaryGrid[^}]*grid-template-columns:[^}]*392fr[^}]*319fr[^}]*369fr[^}]*450fr/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("insights review fixes lock bottom proportions, complete heatmap orientation and evidence fidelity", async () => {
  const [overview, insights, heatmap, css, overviewE2e, insightsE2e] = await Promise.all([
    read("components/admin/overview/AdminOverview.tsx"),
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/AdminHeatmap.tsx"),
    read("components/admin/insights/AdminInsights.module.css"),
    read("e2e/admin-dashboard.spec.ts"),
    read("e2e/admin-insights.spec.ts")
  ]);
  assert.match(css, /\.bottomGrid\s*\{[^}]*grid-template-columns:\s*minmax\(0,911fr\)\s+minmax\(0,639fr\)/s);
  assert.match(heatmap, /Array\.from\(\{ length: 24 \}/);
  assert.match(heatmap, /const days = \["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"\]/);
  assert.match(heatmap, /days\.flatMap[\s\S]*hours\.map/);
  assert.match(heatmap, /rowLabels=\{days\}/);
  assert.match(heatmap, /columnLabels=\{hours\.map/);
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

test("heatmap delegates one normalized Monday-first 24 by 7 matrix to the interactive exact-value primitive", async () => {
  const [heatmap, primitive] = await Promise.all([
    read("components/admin/insights/AdminHeatmap.tsx"),
    read("components/admin/charts/InteractiveHeatmap.tsx")
  ]);
  assert.match(heatmap, /Array\.from\(\{ length: 24 \}/);
  assert.match(heatmap, /\[1,\s*2,\s*3,\s*4,\s*5,\s*6,\s*0\]/);
  assert.match(heatmap, /days\.flatMap[\s\S]*hours\.map/);
  assert.match(heatmap, /lookup\.get\(`\$\{weekdayOrder\[row\]\}:\$\{hour\}`\) \?\? 0/);
  assert.match(primitive, /role="grid"/);
  assert.match(primitive, /exactValues=\{cells\.map/);
  assert.match(primitive, /role="gridcell"/);
});

test("overview reference layout keeps every desktop panel self-contained", async () => {
  const [overview, top, strip, css] = await Promise.all([
    read("components/admin/overview/AdminOverview.tsx"),
    read("components/admin/overview/AdminTopDishes.tsx"),
    read("components/admin/overview/AdminAvailabilityStrip.tsx"),
    read("components/admin/overview/AdminOverview.module.css")
  ]);
  assert.match(overview, /headerStatus=/);
  assert.match(overview, /buildServicePreview\(services\.data\.windows\)/);
  assert.match(top, /evidence\.data\.slice\(0,\s*5\)/);
  assert.match(strip, /dishes\.slice\(0,\s*5\)/);
  assert.doesNotMatch(css, /margin[^:]*:\s*-|max-height|overflow-[xy]:\s*(?:auto|scroll)|grid-auto-flow:\s*column/);
  assert.match(css, /\.overviewGrid\s*\{[^}]*grid-template-areas:[^}]*activity top moment[^}]*activity top category[^}]*availability availability availability/s);
  assert.match(css, /\.moment\s+:global\(\[data-chart-frame\]>header\)/);
});

test("overview service preview preserves every service-window count exactly once", async () => {
  const { buildServicePreview } = await import("../components/admin/overview/servicePreview.ts");
  const windows = [
    { id: "breakfast", count: 11 },
    { id: "lunch", count: 23 },
    { id: "afternoon", count: 17 },
    { id: "dinner", count: 29 },
    { id: "overnight", count: 5 },
  ];
  const preview = buildServicePreview(windows);
  assert.deepEqual(preview, [
    { label: "Déjeuner", value: 34 },
    { label: "Après-midi", value: 17 },
    { label: "Dîner", value: 34 },
  ]);
  assert.equal(preview.reduce((sum, item) => sum + item.value, 0), windows.reduce((sum, item) => sum + item.count, 0));
});

test("PR150 insights fidelity uses normal flow, premium copy, controlled top-five views and detailed charts", async () => {
  const [page, heatmap, breakdowns, rows, css, primitives, sparkline, chartCss] = await Promise.all([
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/AdminHeatmap.tsx"),
    read("components/admin/insights/AdminBreakdowns.tsx"),
    read("components/admin/insights/InsightsRows.tsx"),
    read("components/admin/insights/AdminInsights.module.css"),
    read("components/admin/system/AdminPresentationPrimitives.tsx"),
    read("components/admin/charts/Sparkline.tsx"),
    read("components/admin/charts/Charts.module.css")
  ]);
  assert.doesNotMatch(css, /(?:^|[;{])height:\s*0(?:[;}])|margin-(?:top|left):\s*-|transform:\s*translate/);
  assert.doesNotMatch(css, /position:\s*absolute[^}]*top:\s*91px/s);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*722fr\)\s+minmax\(0,\s*416fr\)\s+minmax\(0,\s*402fr\)/);
  assert.match(page, /adminFreshnessCopy/);
  assert.match(primitives, /adminEvidenceReasonCopy/);
  assert.match(page, /metricSeries/);
  assert.match(page, /changeRate/);
  assert.match(breakdowns, /slice\(0,\s*5\)/);
  assert.match(rows, /AdminDishThumbnail/);
  assert.match(breakdowns, /InteractiveDonut/);
  assert.match(rows, /Sparkline/);
  assert.match(page, /Heures affich(?:Ã©|é)es en UTC/);
  assert.doesNotMatch(heatmap, /Heures affich(?:Ã©|é)es en UTC/);
  assert.doesNotMatch(`${page}\n${heatmap}`, /(?:PÃ©riode sÃ©lectionnÃ©e|Période sélectionnée)\s*[Â··]\s*UTC/);
  assert.match(page, /data-insights-kpi/);
  assert.match(page, /data-insights-summary/);
  assert.match(page, /data-insights-key-insights/);
  assert.match(page, /analytics\.kind === "real" \? <div className=\{styles\.summaryMetrics\}/);
  assert.match(page, /insights\.length >= 2/);
  assert.match(primitives, /evidence\?: \{ kind: "insufficient" \| "unavailable"; reason: string \}/);
  assert.match(sparkline, /interactive/);
  assert.match(sparkline, /role="tooltip"/);
  assert.match(chartCss, /@keyframes sparklineReveal/);
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

test("PR150 pages expose complete premium analytics with controlled visible rankings and exact alternatives", async () => {
  const [overview, overviewCss, insights, insightsCss, activity, comparison, breakdowns, availability, icons] = await Promise.all([
    read("components/admin/overview/AdminOverview.tsx"),
    read("components/admin/overview/AdminOverview.module.css"),
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/AdminInsights.module.css"),
    read("components/admin/insights/InsightsActivityChart.tsx"),
    read("components/admin/insights/AdminComparisonChart.tsx"),
    read("components/admin/insights/AdminBreakdowns.tsx"),
    read("components/admin/availability/AdminAvailabilityList.tsx"),
    read("components/admin/system/AdminIcons.tsx")
  ]);
  assert.match(overview, /Voir les statistiques détaillées/);
  assert.match(overview, /metricSeries/);
  assert.match(overview, /MenuOpenIcon/);
  assert.match(overview, /DishViewsIcon/);
  assert.match(overview, /label="Ouvertures du menu"[\s\S]*?icon=\{<MenuOpenIcon\/>\}/);
  assert.match(overview, /label="Consultations de plats"[\s\S]*?icon=\{<DishViewsIcon\/>\}/);
  assert.match(insights, /kpi\("menu-opens", "Ouvertures du menu", <MenuOpenIcon\/>/);
  assert.match(insights, /kpi\("dish-opens", "Consultations de plats", <DishViewsIcon\/>/);
  assert.match(overview, /SearchIcon/);
  assert.match(overview, /ImmersiveIcon/);
  assert.match(overview, /AvailableDishIcon/);
  assert.doesNotMatch(`${overview}\n${overviewCss}\n${insightsCss}`, /nth-child\([^)]*n\s*\+/);
  assert.match(breakdowns, /slice\(0,\s*5\)/);
  assert.match(breakdowns, /ExactTable rows=\{rows\}/);
  assert.doesNotMatch(`${overview}\n${insights}`, /readiness\.counts\.withImmersive/);
  assert.doesNotMatch(insights, /(?:Ã‰|É)v.nements observ.s|label="P.riode"/);
  const insightsSurface = `${insights}\n${activity}\n${comparison}\n${breakdowns}`;
  for (const title of ["Activité du menu sur la période", "Comparaison des périodes", "Moments d’activité", "Top plats consultés", "Top recherches", "Répartition par catégorie", "Répartition par moment de service", "Résumé de la période", "Insights clés"]) assert.match(insightsSurface, new RegExp(title));
  assert.match(availability, /AdminDishThumbnail/);
  assert.match(availability, /dish\.priceLabel/);
  assert.match(availability, /data-admin-menu-dish/);
  assert.match(icons, /export function MenuOpenIcon/);
});

test("full-menu parity exposes the same stable identity fields on admin and public dishes", async () => {
  const [admin, publicMenu, e2e] = await Promise.all([
    read("components/admin/availability/AdminAvailabilityList.tsx"),
    read("components/menu/PublicMenuRenderer.tsx"),
    read("e2e/admin-chart-interactions.spec.ts"),
  ]);
  for (const attribute of ["data-dish-id", "data-category-id", "data-available"]) {
    assert.match(admin, new RegExp(attribute));
    assert.match(publicMenu, new RegExp(attribute));
  }
  assert.match(e2e, /expect\(publicDishes\)\.toEqual\(adminDishes\)/);
});

test("insights summary excludes availability and centralized evidence copy never leaks internal reasons", async () => {
  const [insights, primitives, presentationCopy, neutralPresentationCopy, thumbnailCss] = await Promise.all([
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/system/AdminPresentationPrimitives.tsx"),
    read("lib/admin/analyticsPresentationCopy.ts"),
    read("lib/adminPresentationCopy.ts").catch(() => ""),
    read("components/admin/AdminDishThumbnail.module.css")
  ]);
  assert.match(insights, /eventIds/);
  assert.doesNotMatch(insights, /metrics\.reduce/);
  assert.match(primitives, /adminEvidenceReasonCopy\(reason\)/);
  for (const reason of ["incompatible-scope", "configuration", "database", "query", "no-relevant-events", "sample-too-small", "instrumentation-unproven", "incompatible-or-empty-period", "source-incomplete"]) assert.match(`${presentationCopy}\n${neutralPresentationCopy}`, new RegExp(`(?:"${reason}"|${reason})\\s*:`));
  assert.match(thumbnailCss, /\.compact\{[^}]*width:64px[^}]*flex-basis:64px/s);
  assert.match(thumbnailCss, /@media\(max-width:700px\)\{\.frame:not\(\.compact\)/);
});

test("admin presentation copy keeps a neutral public-safe dependency boundary with an admin compatibility export", async () => {
  const [neutral, compatibility, primitives] = await Promise.all([
    read("lib/adminPresentationCopy.ts").catch(() => ""),
    read("lib/admin/analyticsPresentationCopy.ts"),
    read("components/admin/system/AdminPresentationPrimitives.tsx"),
  ]);

  assert.match(neutral, /export type AdminAnalyticsFreshness/);
  assert.match(neutral, /export function adminFreshnessCopy/);
  assert.match(neutral, /export function adminEvidenceReasonCopy/);
  assert.doesNotMatch(neutral, /(?:from\s+["'][^"']*(?:\/admin\/|\/auth\/|supabase)|server-only|next\/headers|cookies\s*\(|headers\s*\()/i);

  assert.match(compatibility, /export\s*\{[^}]*adminFreshnessCopy[^}]*adminEvidenceReasonCopy[^}]*\}\s*from\s*["']\.\.\/adminPresentationCopy\.ts["']/s);
  assert.match(compatibility, /export\s+type\s*\{\s*AdminAnalyticsFreshness\s*\}\s*from\s*["']\.\.\/adminPresentationCopy\.ts["']/);
  assert.doesNotMatch(compatibility, /const\s+(?:freshnessCopy|evidenceReasonCopy)/);

  assert.match(primitives, /from\s+["']@\/lib\/adminPresentationCopy["']/);
  assert.doesNotMatch(primitives, /@\/lib\/admin\/analyticsPresentationCopy/);
});

test("insights comparison preserves both calendar dates behind every aligned day", async () => {
  const comparison = await read("components/admin/insights/AdminComparisonChart.tsx");
  assert.match(comparison, /label:\s*`J\$\{index \+ 1\}`/);
  assert.match(comparison, /detail:\s*`Jour \$\{index \+ 1\} · actuelle \$\{current \? shortDay\(current\.day\)[\s\S]*pr.c.dente \$\{previous \? shortDay\(previous\.day\)/);
  assert.equal((comparison.match(/label:\s*alignedPoints\[index\]\.label,\s*detail:\s*alignedPoints\[index\]\.detail/g) ?? []).length, 2);
});

test("insights never exposes internal menu identifiers as presentation labels", async () => {
  const [page, breakdowns] = await Promise.all([
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/AdminBreakdowns.tsx")
  ]);
  assert.match(page, /Plat du menu/);
  assert.match(breakdowns, /Plat du menu/);
  assert.match(breakdowns, /Cat.gorie du menu/);
  assert.doesNotMatch(page, /\?\?\s*bestDish\.slug/);
  assert.doesNotMatch(breakdowns, /\?\?\s*row\.slug/);
});

test("search expansion is conditional and reveals additional visible rows", async () => {
  const [breakdowns, rows] = await Promise.all([
    read("components/admin/insights/AdminBreakdowns.tsx"),
    read("components/admin/insights/InsightsRows.tsx")
  ]);
  assert.match(breakdowns, /evidence\.data\.length\s*>\s*5/);
  assert.match(breakdowns, /InsightsSearchRows rows=\{evidence\.data\.slice\(5\)\}/);
  assert.doesNotMatch(breakdowns, /liste compl.te est disponible dans le tableau accessible/);
  assert.match(rows, /className=\{styles\.searchChange\}/);
  assert.match(rows, /Sparkline values=\{row\.daily\}[\s\S]*interactive/);
  assert.doesNotMatch(rows, /className=\{styles\.srOnly\}>\{change\(row\.changeRate\)\}/);
});

test("unavailable evidence is assertive while insufficient evidence stays polite", async () => {
  const primitives = await read("components/admin/system/AdminPresentationPrimitives.tsx");
  assert.match(primitives, /role=\{evidence\.kind === "unavailable" \? "alert" : "status"\}/);
  assert.match(primitives, /role=\{unavailable \? "alert" : "status"\}/);
});

test("insights summary presents a real comparison value when aligned evidence exists", async () => {
  const insights = await read("components/admin/insights/AdminInsightsPage.tsx");
  assert.match(insights, /comparisonSummary/);
  assert.match(insights, /% ouvertures/);
  assert.doesNotMatch(insights, /Comparaison<strong>\{panels\?\.dailyComparison\.kind === "supported" \? "Disponible"/);
});

test("UTC disclosure has one visible owner and is not repeated by the heatmap description", async () => {
  const [page, heatmap] = await Promise.all([
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/AdminHeatmap.tsx")
  ]);
  assert.match(page, /Heures affich.es en UTC/);
  assert.doesNotMatch(heatmap, /Heures affich.es en UTC/);
});

test("interactive analytics expose unique names and explicit selection semantics", async () => {
  const [page, line, comparison, donut, heatmap] = await Promise.all([
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/charts/InteractiveLineChart.tsx"),
    read("components/admin/charts/ComparisonLineChart.tsx"),
    read("components/admin/charts/InteractiveDonut.tsx"),
    read("components/admin/charts/InteractiveHeatmap.tsx")
  ]);
  assert.match(page, /label=\{`Tendance quotidienne de \$\{label\}`\}/);
  for (const source of [line, comparison, donut]) {
    assert.match(source, /role="button"/);
    assert.match(source, /aria-pressed=/);
  }
  assert.match(heatmap, /aria-selected=/);
});

test("overview groups overflow categories and keeps the exact source available", async () => {
  const [overview, css] = await Promise.all([
    read("components/admin/overview/AdminOverview.tsx"),
    read("components/admin/overview/AdminOverview.module.css")
  ]);
  assert.match(overview, /categoryPreview/);
  assert.match(overview, /label: "Autres"/);
  assert.match(overview, /Détail exact de l’activité par catégorie/);
  assert.match(css, /\.exactTable/);
});

test("detailed donut legends include the visible unit", async () => {
  const donut = await read("components/admin/charts/InteractiveDonut.tsx");
  assert.match(donut, /<strong>\{visibleText\(item\.value\)\}/);
  assert.match(donut, /visibleText = .*text\(value\)\.replace\(\/\\u00a0\/g, " "\)/);
  assert.doesNotMatch(donut, /<strong>\{formatChartValue\(item\.value\)\}/);
});
