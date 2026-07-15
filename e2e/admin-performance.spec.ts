import { expect, test } from "@playwright/test";
import { createHmac } from "node:crypto";

declare global {
  interface Window {
    __adminPerformance?: { cls: number; longTasks: number[] };
  }
}

test("admin insights keeps a bounded production performance profile", async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    window.__adminPerformance = { cls: 0, longTasks: [] };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__adminPerformance!.longTasks.push(entry.duration);
    }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
        if (!entry.hadRecentInput) window.__adminPerformance!.cls += entry.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  const heavyRequests: string[] = [];
  page.on("request", (request) => {
    if (/\.(?:glb|usdz|mp4)(?:\?|$)/i.test(request.url())) heavyRequests.push(request.url());
  });
  const sessionSecret = process.env.VISTAIRE_ADMIN_PERFORMANCE_SESSION_SECRET;
  if (sessionSecret) {
    const body = Buffer.from(JSON.stringify({
      v: 1,
      qrId: "15000000-0000-0000-0000-000000000150",
      restaurantId: "11111111-1111-1111-1111-111111111111",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url");
    const signature = createHmac("sha256", sessionSecret).update(body).digest("base64url");
    await context.addCookies([{ name: "vistaire_admin_access", value: `${body}.${signature}`, url: `${new URL(process.env.PLAYWRIGHT_BASE_URL!).origin}/admin`, httpOnly: true, sameSite: "Lax" }]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin", { waitUntil: "networkidle" });
  const preview = page.getByRole("button", { name: "Ouvrir la prévisualisation locale" });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
  }
  await expect(page.getByRole("heading", { name: "Maison Élysée", exact: true })).toBeVisible();
  await page.goto("/admin/insights", { waitUntil: "networkidle" });
  await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });

  const client = await context.newCDPSession(page);
  await client.send("Performance.enable");
  const before = await client.send("Performance.getMetrics");
  await page.evaluate(() => { window.__adminPerformance = { cls: 0, longTasks: [] }; });
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__adminPerformance = { cls: 0, longTasks: [] }; });

  const marks = page.locator('[data-chart-frame] svg [tabindex]');
  expect(await marks.count()).toBeGreaterThan(20);
  for (let index = 0; index < Math.min(12, await marks.count()); index += 1) await marks.nth(index).hover();
  for (const sparkline of await page.locator('[data-kpi-trend] svg[role="button"]').all()) {
    await sparkline.focus();
    await sparkline.press("Enter");
    await sparkline.press("Escape");
  }
  await page.mouse.move(1, 1);

  const frameIntervals = await page.evaluate(async () => {
    const values: number[] = [];
    let previous = performance.now();
    for (let index = 0; index < 45; index += 1) await new Promise<void>((resolve) => requestAnimationFrame((now) => { values.push(now - previous); previous = now; resolve(); }));
    return values.slice(2).sort((left, right) => left - right);
  });
  const after = await client.send("Performance.getMetrics");
  const metric = (metrics: typeof before, name: string) => metrics.metrics.find((item) => item.name === name)?.value ?? 0;
  const layoutDelta = metric(after, "LayoutCount") - metric(before, "LayoutCount");
  const styleDelta = metric(after, "RecalcStyleCount") - metric(before, "RecalcStyleCount");
  const heapMb = metric(after, "JSHeapUsedSize") / 1024 / 1024;
  const p95Frame = frameIntervals[Math.floor(frameIntervals.length * 0.95)] ?? Infinity;
  const runtime = await page.evaluate(() => window.__adminPerformance!);
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => {
    const resource = entry as PerformanceResourceTiming;
    return { name: resource.name, transferSize: resource.transferSize, decodedBodySize: resource.decodedBodySize };
  }));
  const scripts = resources.filter((resource) => /\.(?:js|mjs)(?:\?|$)/.test(resource.name));
  const jsBytes = scripts.reduce((sum, resource) => sum + resource.decodedBodySize, 0);

  test.info().annotations.push({
    type: "performance",
    description: JSON.stringify({ cls: runtime.cls, longTasks: runtime.longTasks.length, layoutDelta, styleDelta, heapMb: Number(heapMb.toFixed(2)), p95Frame: Number(p95Frame.toFixed(2)), scriptCount: scripts.length, jsBytes })
  });

  expect(heavyRequests).toEqual([]);
  expect(runtime.cls).toBeLessThanOrEqual(0.1);
  expect(runtime.longTasks.filter((duration) => duration >= 50)).toEqual([]);
  expect(layoutDelta).toBeLessThanOrEqual(80);
  expect(styleDelta).toBeLessThanOrEqual(180);
  expect(heapMb).toBeLessThan(160);
  expect(p95Frame).toBeLessThanOrEqual(35);
  expect(scripts.length).toBeLessThanOrEqual(45);
  expect(jsBytes).toBeLessThan(8 * 1024 * 1024);
});
