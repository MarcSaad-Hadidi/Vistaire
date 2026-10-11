import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("the protected studio exposes the four approved destinations with no demo runtime", async () => {
  const source = await readFile(
    "components/admin/studio/AdminStudio.tsx",
    "utf8",
  );
  for (const value of [
    "Vue d’ensemble",
    "Analyses",
    "Les plats",
    "Planning",
    "StudioExportDialog",
  ])
    assert.ok(source.includes(value), value);
  assert.doesNotMatch(
    source,
    /Sauge Noire|localStorage.*(dish|rules)|iframe|Math\.random|2026-10-10/,
  );
  for (const route of [
    "app/(fr)/admin/page.tsx",
    "app/(fr)/admin/insights/page.tsx",
    "app/(fr)/admin/availability/page.tsx",
    "app/(fr)/admin/planning/page.tsx",
  ]) {
    const page = await readFile(route, "utf8");
    assert.match(page, /requireAdminRestaurantAccess\("dashboard:read"\)/);
    assert.match(page, /loadAdminDashboardData\(access\.restaurantId/);
  }
});
test("studio charts use KindUI and availability is semantic in both themes", async () => {
  const charts = await readFile(
    "components/admin/studio/StudioCharts.tsx",
    "utf8",
  );
  const css = await readFile(
    "components/admin/studio/Studio.module.css",
    "utf8",
  );
  assert.match(charts, /@kind-ui\/charts/);
  assert.match(css, /data-status="available"/);
  assert.match(css, /data-status="unavailable"/);
  assert.match(css, /data-theme="dark"/);
  assert.match(css, /prefers-reduced-motion/);
});
test("analysis retains approved category, distribution and relationship chart families", async () => {
  const charts = await readFile(
    "components/admin/studio/StudioAnalysisCharts.tsx",
    "utf8",
  );
  for (const family of [
    "PieChart",
    "ScatterChart",
    "RadarChart",
    "SankeyChart",
  ])
    assert.ok(charts.includes(family), family);
  assert.doesNotMatch(
    charts,
    /Math\.random|Sauge Noire|Array\.from\(\{length:6\}/,
  );
});

test("all private access, loading and failure surfaces use the Studio shell", async () => {
  for (const path of ["page.tsx", "availability/page.tsx", "insights/page.tsx", "planning/page.tsx", "loading.tsx", "error.tsx"]) {
    const source = await readFile(`app/(fr)/admin/${path}`, "utf8");
    assert.match(source, /StudioState/, path);
    assert.doesNotMatch(source, /AdminDashboard\.module|AdminSystem\.module|AdminSkeleton/, path);
  }
  const layout = await readFile("app/(fr)/admin/layout.tsx", "utf8");
  assert.match(layout, /studio\/Studio\.module/);
  const qr = await readFile("app/(fr)/q/invalid/page.tsx", "utf8");
  assert.match(qr, /StudioState kind="qr"/);
});
