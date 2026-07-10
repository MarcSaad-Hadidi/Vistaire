import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("admin has a private dedicated shell without marketing or heavy media", async () => {
  const [layout, page, dashboard, css] = await Promise.all([
    read("app/admin/layout.tsx"), read("app/admin/page.tsx"),
    read("components/admin/AdminRestaurantDashboard.tsx"),
    read("components/admin/AdminDashboard.module.css")
  ]);
  const source = `${layout}\n${page}\n${dashboard}`;
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /follow:\s*false/);
  assert.match(layout, /noarchive:\s*true/);
  assert.match(source, /AdminDashboard\.module\.css/);
  assert.doesNotMatch(source, /VistaireRestaurateurDashboardPreview|next\/image|PhotoResto|AdminAssistant|\/api\/owner|model-viewer|\.glb|\.usdz|<canvas/i);
  assert.doesNotMatch(css, /background-image|url\(/i);
});

test("page strictly allowlists server ranges and discloses UTC timezone", async () => {
  const [page, dashboard] = await Promise.all([read("app/admin/page.tsx"), read("components/admin/AdminRestaurantDashboard.tsx")]);
  assert.match(page, /today-utc[\s\S]*7d[\s\S]*30d/);
  assert.match(page, /searchParams/);
  assert.match(page, /loadAdminDashboardData/);
  assert.match(dashboard, /Aujourd.hui[^\n]*UTC|Fen.tre glissante[^\n]*UTC/);
  assert.match(dashboard, /fuseau horaire[^\n]*pas configur/i);
});

test("dashboard exposes evidence semantics, chart alternatives and worklist controls", async () => {
  const [dashboard, worklist, viewModel] = await Promise.all([read("components/admin/AdminRestaurantDashboard.tsx"), read("components/admin/AdminDishWorklist.tsx"), read("components/admin/adminDashboardViewModel.ts")]);
  const source = `${dashboard}\n${worklist}\n${viewModel}`;
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
  const { buildAnalyticsPresentation, renderAnalyticsDom } = await import("../components/admin/adminDashboardViewModel.ts");
  const window = { label: "7 jours — UTC", startedAt: "2026-07-03", endedAt: "2026-07-10" };
  const real = buildAnalyticsPresentation({ kind: "real", completeness: "complete", observationWindow: window, lastUpdatedAt: "2026-07-10T12:00:00Z", freshness: "fresh", coverage: { provenance: "production" }, metrics: [{ id: "opens", label: "Ouvertures", value: 23, unit: "consultations" }], activitySeries: [{ label: "9 juil.", value: 8 }, { label: "10 juil.", value: 15 }], categoryBreakdown: [], topDishes: [], searches: [], immersive: [], funnel: { kind: "unsupported" }, comparison: null });
  assert.equal(real.kind, "real");
  assert.deepEqual(real.activity.map((point) => point.value), [8, 15]);
  assert.match(real.summary, /23/);
  assert.match(real.provenance, /production/i);
  const insufficient = buildAnalyticsPresentation({ kind: "insufficient", reason: "sample-too-small", completeness: "limited-sample", observationWindow: window, availableEvidence: [{ label: "Événements", value: 4 }], missingEvidence: ["20 sessions nécessaires"] });
  assert.deepEqual(insufficient, { kind: "insufficient", reason: "sample-too-small", completeness: "limited-sample", title: "Donnée insuffisante", availableEvidence: [{ label: "Événements", value: 4 }], missingEvidence: ["20 sessions nécessaires"] });
  const unavailable = buildAnalyticsPresentation({ kind: "unavailable", reason: "query", completeness: "truncated", title: "Lecture interrompue", explanation: "La lecture complète n’a pas abouti.", retryable: true });
  assert.equal(unavailable.explanation, "La lecture complète n’a pas abouti.");
  assert.equal(unavailable.retryable, true);
  const realDom = renderAnalyticsDom(real);
  assert.match(realDom, /7 jours — UTC/);
  assert.match(realDom, /2026-07-10T12:00:00Z/);
  assert.match(realDom, /data-bar-value="8"/);
  assert.match(realDom, /<table[\s\S]*9 juil\.[\s\S]*8/);
  assert.match(renderAnalyticsDom(insufficient), /sample-too-small[\s\S]*20 sessions nécessaires/);
  assert.match(renderAnalyticsDom(unavailable), /role="alert"[\s\S]*Lecture interrompue/);
});

test("activity bars have concrete responsive CSS", async () => {
  const [dashboard, css] = await Promise.all([read("components/admin/AdminRestaurantDashboard.tsx"), read("components/admin/AdminAnalytics.module.css")]);
  assert.match(dashboard, /analyticsStyles\.bars/);
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
