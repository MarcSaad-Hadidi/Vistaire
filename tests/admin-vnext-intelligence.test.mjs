import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(path, "utf8");

test("Intelligence route derives scope from live access and loads the v2 evidence bundle", async () => {
  const [route, page] = await Promise.all([
    source("app/(fr)/admin/insights/page.tsx"),
    source("components/admin/insights/AdminInsightsPage.tsx")
  ]);
  assert.match(route, /requireAdminRestaurantAccess\("dashboard:read"\)/);
  assert.match(route, /loadAdminDataBundle\(access, range\)/);
  assert.match(route, /presentation=\{result\.presentation\}/);
  assert.match(page, /activeRoute="intelligence"/);
  assert.doesNotMatch(route, /loadAdminDashboardData|getRestaurantInsights|restaurantId.*searchParams/);
});

test("Intelligence UI renders only canonical evidence and explicit absence states", async () => {
  const [page, funnel] = await Promise.all([
    source("components/admin/insights/AdminInsightsPage.tsx"),
    source("components/admin/insights/InsightsConversionState.tsx")
  ]);
  assert.match(page, /AdminEvidenceBundle/);
  assert.match(page, /observed-menu-opens/);
  assert.match(page, /catalog-dishes/);
  assert.match(page, /Non mesuré|Unmeasured/);
  assert.match(page, /Aucun classement de recherches k-anonyme/);
  assert.match(funnel, /ne déduit ni ajout au panier|does not infer cart additions/);
  assert.doesNotMatch(page, /loadAdminDashboardData|DemoAdminInsights|Math\.random/);
});

test("attention visualization has equivalent text and no unsupported conversion value", async () => {
  const [page, map, funnel] = await Promise.all([
    source("components/admin/insights/AdminInsightsPage.tsx"),
    source("components/admin/insights/InsightsAttentionMap.tsx"),
    source("components/admin/insights/InsightsConversionState.tsx")
  ]);
  assert.match(page, /<InsightsAttentionMap ranking=\{dishRanking\}/);
  assert.match(map, /figcaption/);
  assert.match(map, /consultations de plats observées/);
  assert.match(funnel, /data-evidence-state="unmeasured"/);
  assert.doesNotMatch(`${map}\n${funnel}`, /9[,.]0\s*%|18[,.]6\s*%|12\s*458/);
});

test("assistant drawer mounts only after intent and restores trapped focus", async () => {
  const [trigger, drawer, page] = await Promise.all([
    source("components/admin/AdminAssistant.tsx"),
    source("components/admin/insights/AdminAssistantDrawer.tsx"),
    source("components/admin/insights/AdminInsightsPage.tsx")
  ]);
  assert.match(trigger, /open \? <AdminAssistantDrawer/);
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /aria-modal="true"/);
  assert.match(drawer, /event\.key === "Escape"/);
  assert.match(drawer, /event\.key !== "Tab"/);
  assert.match(drawer, /querySelector<HTMLInputElement>\("#assistant-question"\)\?\.focus\(\)/);
  assert.match(drawer, /previous\?\.focus\(\)/);
  assert.doesNotMatch(drawer, /localStorage|sessionStorage/);
  assert.match(page, /assistantEnabled \? <AdminAssistant/);
});

test("assistant request carries locale and never a restaurant or menu identifier", async () => {
  const drawer = await source("components/admin/insights/AdminAssistantDrawer.tsx");
  assert.match(drawer, /mode: "question", locale, range, question: clean/);
  assert.doesNotMatch(drawer, /restaurantId|menuId|session_id/);
  assert.match(drawer, /block\.ranking\s*\?/);
  assert.match(drawer, /block\.ranking\.map/);
  assert.match(drawer, /assistantRanking/);
});

test("all Intelligence E2E specs are hermetic, token-free and cannot silently skip", async () => {
  const specs = await Promise.all([
    source("e2e/admin-insights.spec.ts"),
    source("e2e/admin-insights-fidelity.spec.ts"),
    source("e2e/admin-vnext-assistant.spec.ts")
  ]);
  for (const spec of specs) {
    assert.doesNotMatch(spec, /test\.(?:skip|fixme)/);
    assert.doesNotMatch(spec, /VISTAIRE_ADMIN_E2E_QR_TOKEN/);
    assert.match(spec, /routeWebSocket/);
    assert.match(spec, /LOOPBACK|appOrigin/);
    if (/appOrigin/.test(spec)) {
      assert.match(spec, /fixtureOrigin/);
      assert.match(spec, /allowedOrigins/);
    }
  }
});

test("assistant fixture activation cannot enable the runtime in production", async () => {
  const runtime = await source("lib/admin/assistant.ts");
  assert.match(runtime, /environment\.NODE_ENV\s*!==\s*["']production["'][\s\S]*VISTAIRE_ADMIN_VISUAL_FIXTURE/);
});
