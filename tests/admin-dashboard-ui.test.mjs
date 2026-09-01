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
    read("app/(fr)/admin/layout.tsx"), read("app/(fr)/admin/page.tsx"),
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

test("page strictly allowlists server ranges and derives its observation timezone server-side", async () => {
  const [page, parser, loader] = await Promise.all([read("app/(fr)/admin/page.tsx"), read("lib/admin/pageSearchParams.ts"), read("lib/admin/data/loadAdminData.ts")]);
  assert.match(page, /const params = await searchParams/);
  assert.match(page, /parseAdminPageSearchParams\(params[\s\S]*\)/);
  assert.match(page, /loadAdminDataBundle\(access, range\)/);
  assert.match(parser, /Pick<[^>]+["']range["']/);
  assert.doesNotMatch(parser, /restaurantId|restaurant_id|slug/);
  assert.doesNotMatch(page, /searchParams\?\.|searchParams\[|as\s+RangeLoader/);
  assert.match(loader, /resolveAdminTimeZone\(menuRead\.menu\.settingsJson\)/);
  assert.match(loader, /resolveAdminObservationWindow\(\{ range: input\.range, observedAt, timezone: scope\.timezone \}\)/);
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
    read("app/(fr)/admin/layout.tsx"),
    read("app/(fr)/admin/loading.tsx")
  ]);
  const primitives = `${primitivesEntry}\n${presentationPrimitives}`;
  const source = `${shell}\n${nav}\n${primitives}\n${icons}\n${layout}\n${loading}`;

  assert.match(shell, /<main/);
  assert.match(nav, /<nav[^>]+aria-label=/);
  assert.match(shell, /active \? <div hidden><AdminTabs active=\{active\} \/><\/div> : null/);
  assert.match(nav, /D.connexion/);
  assert.doesNotMatch(source, /Param.tres|Assistant|\/owner/i);
  assert.match(shell, /styles\.sidebar/);

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
  assert.match(loading, /<AdminShellState kind="loading"/);
  const shellState = await read("components/admin/system/AdminShellState.tsx");
  assert.match(shellState, /aria-busy=\{kind === "loading" \? true : undefined\}/);
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

test("shared admin shell exposes approved default actions and supports route-specific header actions", async () => {
  const shell = await readFile("components/admin/system/AdminShell.tsx", "utf8");
  const menuActions = await readFile("components/admin/AdminMenuActions.tsx", "utf8");
  for (const label of ["Voir la carte", "View menu", "Rafraîchir", "Refresh", "Copier le lien du menu", "Copy menu link"]) {
    assert.match(menuActions, new RegExp(label));
  }
  assert.match(shell, /<AdminMenuActions locale=\{preferences\.locale\} menuPath=\{menuPath\}/);
  assert.match(shell, /headerActions\?:\s*ReactNode/);
  assert.match(shell, /headerActions \?\? <AdminMenuActions/);
  assert.match(shell, /<AdminLogoutButton locale=\{preferences\.locale\}/);
  assert.match(shell, /<AdminTabs active=\{active\}/);
});

test("Today composes honest evidence panels with accessible exact values", async () => {
  const [page, today, activity, pulse, quickActions, css] = await Promise.all([
    read("app/(fr)/admin/page.tsx"),
    read("components/admin/today/AdminTodayPage.tsx"),
    read("components/admin/today/TodayActivity.tsx"),
    read("components/admin/today/TodayPulse.tsx"),
    read("components/admin/today/TodayQuickActions.tsx"),
    read("components/admin/today/AdminToday.module.css")
  ]);
  const source = `${page}\n${today}\n${activity}\n${pulse}\n${quickActions}`;
  assert.match(page, /<AdminTodayPage/);
  assert.match(source, /AdminShell/);
  assert.match(quickActions, /\["\/admin\/insights"/);
  assert.match(quickActions, /\["\/admin\/availability"/);
  assert.match(activity, /InteractiveLineChart/);
  assert.match(activity, /Valeurs exactes issues du registre/);
  assert.match(source, /TodayPanelState/);
  assert.match(source, /data-evidence-id/);
  assert.doesNotMatch(source, /getDemo|Math\.random/);
  assert.match(css, /@media\s*\(min-width:\s*701px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1180px\)/);
  assert.match(pulse, /data-today-region="pulse"/);
  assert.match(quickActions, /data-today-region="quick-actions"/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("Intelligence renders only canonical evidence with equivalent text alternatives", async () => {
  const [page, insights, attentionMap, conversion, recommendations, css] = await Promise.all([
    read("app/(fr)/admin/insights/page.tsx"),
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/InsightsAttentionMap.tsx"),
    read("components/admin/insights/InsightsConversionState.tsx"),
    read("components/admin/insights/InsightsRecommendations.tsx"),
    read("components/admin/insights/AdminInsights.module.css")
  ]);
  const source = `${page}\n${insights}\n${attentionMap}\n${conversion}\n${recommendations}`;
  assert.match(page, /requireAdminRestaurantAccess\("dashboard:read"\)/);
  assert.match(page, /loadAdminDataBundle\(access, range\)/);
  assert.match(source, /AdminShell/);
  assert.match(insights, /activeRoute="intelligence"/);
  assert.match(attentionMap, /<figcaption>/);
  assert.match(conversion, /data-evidence-state="unmeasured"/);
  assert.match(recommendations, /block\.evidenceIds\.join/);
  assert.match(insights, /Aucun classement de recherches k-anonyme/);
  assert.doesNotMatch(source, /getDemo|Math\.random/);
  assert.match(css, /\.intelligenceGrid/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("vNext browser proofs preserve responsive evidence fidelity and reject heavy assets", async () => {
  const [today, insights, attentionMap, css, todayE2e, insightsE2e] = await Promise.all([
    read("components/admin/today/AdminTodayPage.tsx"),
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/InsightsAttentionMap.tsx"),
    read("components/admin/insights/AdminInsights.module.css"),
    read("e2e/admin-vnext-today.spec.ts"),
    read("e2e/admin-insights.spec.ts")
  ]);
  assert.match(css, /\.bottomIntelligenceGrid/);
  assert.match(attentionMap, /consultations de plats observées/);
  assert.match(today, /<TodayPulse model=\{model\}/);
  assert.match(insights, /metricState/);
  for (const source of [todayE2e, insightsE2e]) {
    assert.match(source, /390[\s\S]*430/);
    assert.match(source, /scrollWidth/);
    assert.match(source, /console/);
    assert.match(source, /reducedMotion/);
  }
  assert.match(insightsE2e, /requestfailed/);
  assert.match(insightsE2e, /glb\|usdz\|mp4/);
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

test("vNext Intelligence uses normal flow, premium copy and explicit evidence states", async () => {
  const [page, attentionMap, conversion, recommendations, css, drawer] = await Promise.all([
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/InsightsAttentionMap.tsx"),
    read("components/admin/insights/InsightsConversionState.tsx"),
    read("components/admin/insights/InsightsRecommendations.tsx"),
    read("components/admin/insights/AdminInsights.module.css"),
    read("components/admin/insights/AdminAssistantDrawer.tsx")
  ]);
  assert.doesNotMatch(css, /(?:^|[;{])height:\s*0(?:[;}])|margin-(?:top|left):\s*-|transform:\s*translate/);
  assert.doesNotMatch(css, /position:\s*absolute[^}]*top:\s*91px/s);
  assert.match(css, /\.essentialGrid/);
  assert.match(css, /\.intelligenceGrid/);
  assert.match(page, /observed-menu-opens/);
  assert.match(page, /catalog-dishes/);
  assert.match(page, /metricState/);
  assert.match(attentionMap, /<figcaption>/);
  assert.match(conversion, /Funnel non mesuré/);
  assert.match(recommendations, /block\.evidenceIds/);
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /aria-modal="true"/);
});

test("Intelligence E2E fails closed and measures two-dimensional touch targets", async () => {
  const source = await read("e2e/admin-insights.spec.ts");
  assert.match(source, /VISTAIRE_ADMIN_VISUAL_FIXTURE/);
  assert.match(source, /toBe\("1"\)/);
  assert.match(source, /throw new Error/);
  assert.match(source, /requestfailed/);
  assert.match(source, /response\.status\(\) === 404 \|\| response\.status\(\) >= 500/);
  assert.match(source, /box\?\.width \?\? 0\)\.toBeGreaterThanOrEqual\(44\)/);
  assert.match(source, /box\?\.height \?\? 0\)\.toBeGreaterThanOrEqual\(44\)/);
  assert.match(source, /glb\|usdz\|mp4/);
});

test("vNext pages expose premium evidence without unsupported commercial analytics", async () => {
  const [today, todayCss, insights, insightsCss, attentionMap, conversion, recommendations, availability] = await Promise.all([
    read("components/admin/today/AdminTodayPage.tsx"),
    read("components/admin/today/AdminToday.module.css"),
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/AdminInsights.module.css"),
    read("components/admin/insights/InsightsAttentionMap.tsx"),
    read("components/admin/insights/InsightsConversionState.tsx"),
    read("components/admin/insights/InsightsRecommendations.tsx"),
    read("components/admin/availability/AdminAvailabilityList.tsx")
  ]);
  assert.match(today, /TodayPulse/);
  assert.match(today, /TodayMenuHealth/);
  assert.match(insights, /Ce que les preuves permettent d.affirmer/);
  assert.match(insights, /Aucun classement de recherches k-anonyme/);
  assert.match(attentionMap, /Aucun score de conversion n.est inféré/);
  assert.match(conversion, /ne déduit ni ajout au panier/);
  assert.match(recommendations, /Aucune recommandation sans preuve exploitable/);
  assert.doesNotMatch(`${today}\n${insights}`, /chiffre d.affaires|clients uniques|\brevenus?\b|\brevenue\b|unique customers/i);
  assert.doesNotMatch(`${todayCss}\n${insightsCss}`, /nth-child\([^)]*n\s*\+/);
  assert.match(availability, /AdminDishThumbnail/);
  assert.match(availability, /canWrite/);
  assert.match(availability, /data-admin-menu-dish/);
});

test("full-menu parity exposes stable identity while keeping unavailable dishes private", async () => {
  const [admin, publicMenu, e2e] = await Promise.all([
    read("components/admin/availability/AdminAvailabilityList.tsx"),
    read("components/menu/PublicMenuRenderer.tsx"),
    read("e2e/admin-chart-interactions.spec.ts"),
  ]);
  for (const attribute of ["data-dish-id", "data-category-id", "data-available"]) {
    assert.match(admin, new RegExp(attribute));
    assert.match(publicMenu, new RegExp(attribute));
  }
  assert.match(e2e, /adminDishes\.filter\(\(\{ available \}\) => available === "true"\)/);
  assert.match(e2e, /expect\(publicDishes\)\.toEqual\(availableAdminDishes\)/);
});

test("insights summary excludes availability and centralized evidence copy never leaks internal reasons", async () => {
  const [insights, recommendations, renderer, drawer, thumbnailCss] = await Promise.all([
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/InsightsRecommendations.tsx"),
    read("lib/admin/assistant/renderClaims.ts"),
    read("components/admin/insights/AdminAssistantDrawer.tsx"),
    read("components/admin/AdminDishThumbnail.module.css")
  ]);
  assert.match(insights, /renderAssistantClaims/);
  assert.match(recommendations, /block\.evidenceIds\.join/);
  assert.match(renderer, /requireEvidenceReferences/);
  assert.match(renderer, /ASSISTANT_CLAIM_REQUIREMENTS\[claim\.claimType\]/);
  assert.doesNotMatch(insights, /availability|metrics\.reduce/i);
  assert.match(renderer, /Donn.e insuffisante/);
  assert.match(drawer, /Assistant momentanément indisponible/);
  assert.doesNotMatch(`${recommendations}\n${drawer}`, /privacy-threshold|instrumentation-unverified|schema-not-deployed|scope-integrity/);
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
  const [page, attentionMap, recommendations] = await Promise.all([
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/InsightsAttentionMap.tsx"),
    read("components/admin/insights/InsightsRecommendations.tsx")
  ]);
  assert.doesNotMatch(`${page}\n${attentionMap}\n${recommendations}`, /bundle\.scope\.(?:restaurantId|menuId)|presentation\.(?:restaurantId|menuId)|session_id/);
  assert.match(page, /record\.state\.value/);
  assert.match(recommendations, /block\.evidenceIds/);
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

test("insights summary presents a real count delta only when both observed periods exist", async () => {
  const insights = await read("components/admin/insights/AdminInsightsPage.tsx");
  assert.match(insights, /currentCount !== null && previousCount !== null \? currentCount - previousCount : null/);
  assert.match(insights, /delta === null \? "—"/);
  assert.doesNotMatch(insights, /% ouvertures|changeRate|comparisonSummary/);
});

test("Intelligence does not falsely label restaurant-local evidence as UTC", async () => {
  const [page, attentionMap, loader] = await Promise.all([
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/InsightsAttentionMap.tsx"),
    read("lib/admin/data/loadAdminData.ts")
  ]);
  assert.doesNotMatch(`${page}\n${attentionMap}`, /\bUTC\b/);
  assert.match(loader, /timezone: scope\.timezone/);
});

test("vNext Intelligence exposes named navigation, equivalent figure text and dialog semantics", async () => {
  const [page, attentionMap, drawer] = await Promise.all([
    read("components/admin/insights/AdminInsightsPage.tsx"),
    read("components/admin/insights/InsightsAttentionMap.tsx"),
    read("components/admin/insights/AdminAssistantDrawer.tsx")
  ]);
  assert.match(page, /aria-label=\{fr \? "Période analysée" : "Analysis period"\}/);
  assert.match(page, /aria-current=\{bundle\.window\.range === range \? "page"/);
  assert.match(attentionMap, /<figure/);
  assert.match(attentionMap, /<figcaption>/);
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /aria-modal="true"/);
  assert.match(drawer, /event\.key === "Escape"/);
  assert.match(drawer, /event\.key !== "Tab"/);
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
