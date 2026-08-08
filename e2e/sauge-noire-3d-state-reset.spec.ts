import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { label: "390x844", viewport: { width: 390, height: 844 } },
  { label: "430x932", viewport: { width: 430, height: 932 } }
];
const context = {
  lang: "fr-CA",
  currency: "CAD",
  table: "main",
  zone: "terrasse"
};

function dishPath(slug: string, view: string) {
  return `/menu/sauge-noire/dishes/${slug}?${new URLSearchParams({
    ...context,
    view
  })}`;
}

function canonicalSurface(page: Page) {
  return page.locator(
    '[data-sauge-route-renderer-pending-handoff="false"]'
  ).locator(
    '[data-sauge-reading-surface="true"]' +
      '[data-sauge-scroll-owner="true"]' +
      '[data-sauge-reading-visible="true"]'
  );
}

async function expectSettledSurface(page: Page, requireInteractive = false) {
  await expect(page.locator('[data-page-flip-fallback="error"]')).toHaveCount(0);
  await expect(
    page.locator(
      '[data-sauge-route-renderer-pending-handoff="false"] ' +
        '[data-page-flip-state="ready"]'
    )
  ).toHaveCount(1, { timeout: 15_000 });
  const surface = canonicalSurface(page);
  await expect(surface).toHaveCount(1, { timeout: 15_000 });
  await expect(surface).toBeVisible({ timeout: 15_000 });
  if (requireInteractive) {
    await expect(
      page.locator(
        '[data-sauge-route-renderer-pending-handoff="false"] ' +
          '[data-page-flip-state="ready"][data-page-flip-engine-state="read"]'
      )
    ).toHaveCount(1, { timeout: 15_000 });
    await expect(
      surface.locator('[data-sauge-reading-content="true"]:not([inert])')
    ).toHaveCount(1, { timeout: 15_000 });
  }
  return surface;
}

async function expectClosedViewer(page: Page) {
  await expect(page.locator("[data-viewer-copy-locale]")).toHaveCount(0);
  await expect(page.locator("[data-viewer-copy-key]")).toHaveCount(0);
  await expect(page.locator("model-viewer")).toHaveCount(0);
  await expect(
    page.locator('[data-viewer-copy-locale] [role="status"][aria-busy="true"]')
  ).toHaveCount(0);
}

async function expectDishSurface(
  page: Page,
  slug: string,
  heading: RegExp,
  requireInteractive = true
) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(
    `/menu/sauge-noire/dishes/${slug}`
  );
  const surface = await expectSettledSurface(page, requireInteractive);
  await expect(surface.getByRole("heading", { level: 1 })).toHaveText(heading);
  return surface;
}

for (const { label, viewport } of viewports) {
  test.describe(label, () => {
    test.use({ viewport });

    test("resets the viewer across A-B-C with a stale load pending, history, and previous navigation", async ({ page }) => {
      const modelRequests: string[] = [];
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      let releaseStaleGlb: () => void = () => undefined;
      let holdFirstGlb = true;
      let resolveStaleGlbRoute: (() => void) | null = null;
      const staleGlbRoute = new Promise<void>((resolve) => {
        resolveStaleGlbRoute = resolve;
      });

      page.on("request", (request) => {
        if (/\.(?:glb|usdz)(?:$|\?)/i.test(request.url())) {
          modelRequests.push(request.url());
        }
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });

      const staleGate = new Promise<void>((resolve) => {
        releaseStaleGlb = resolve;
      });
      await page.route(/\.glb(?:$|\?)/i, async (route) => {
        try {
          if (holdFirstGlb) {
            holdFirstGlb = false;
            await staleGate;
          }
          await route.continue();
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !/already handled|target page|request.*(aborted|canceled)/i.test(error.message)
          ) {
            throw error;
          }
        } finally {
          resolveStaleGlbRoute?.();
          resolveStaleGlbRoute = null;
        }
      });

      await page.goto(dishPath("truite-des-laurentides", "sauge-3"), {
        waitUntil: "domcontentloaded"
      });

      let surface = await expectDishSurface(
        page,
        "truite-des-laurentides",
        /TRUITE DES LAURENTIDES/i
      );
      await expectClosedViewer(page);
      expect(modelRequests).toEqual([]);

      const viewerButton = surface.getByRole("button", { name: "VOIR EN 3D" });
      await viewerButton.click();
      await expect(
        surface.getByRole("button", { name: "MASQUER LA 3D" })
      ).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator("[data-viewer-copy-locale]")).toHaveCount(1);
      await expect.poll(() => modelRequests.length, { timeout: 15_000 }).toBeGreaterThan(0);
      await expect(page.locator("model-viewer")).toHaveCount(1, { timeout: 15_000 });
      const openedRequestCount = modelRequests.length;

      // A → B → C: leave A's GLB pending while each valid PageFlip handoff settles.
      await surface.getByRole("link", { name: /prochain plat/i }).click();
      surface = await expectDishSurface(
        page,
        "hamachi-a-la-verveine",
        /HAMACHI.*VERVEINE/i
      );
      await expectClosedViewer(page);
      expect(modelRequests).toHaveLength(openedRequestCount);

      await surface.getByRole("link", { name: /prochain plat/i }).click();
      surface = await expectDishSurface(
        page,
        "boeuf-cru-au-couteau",
        /B(?:Œ|OE)UF CRU AU COUTEAU/i
      );
      await expectClosedViewer(page);
      expect(modelRequests).toHaveLength(openedRequestCount);
      expect(await page.locator("model-viewer").count()).toBeLessThanOrEqual(1);

      // Exercise the real previous control while the canonical surface is
      // interactive; no forced click may bypass PageFlip hit testing.
      await surface.getByRole("link", { name: /plat pr/i }).click();
      surface = await expectDishSurface(
        page,
        "hamachi-a-la-verveine",
        /HAMACHI.*VERVEINE/i
      );
      await expectClosedViewer(page);
      expect(modelRequests).toHaveLength(openedRequestCount);

      releaseStaleGlb();
      await page.unroute(/\.glb(?:$|\?)/i);
      await staleGlbRoute;
      await expectClosedViewer(page);
      expect(modelRequests).toHaveLength(openedRequestCount);
      expect(modelRequests.some((url) => /\.usdz(?:$|\?)/i.test(url))).toBe(false);

      // Browser back/forward must start closed too, even after the previous
      // control has returned from C to B.
      await page.goBack();
      surface = await expectDishSurface(
        page,
        "boeuf-cru-au-couteau",
        /B(?:Œ|OE)UF CRU AU COUTEAU/i,
        false
      );
      await expectClosedViewer(page);

      await page.goForward();
      surface = await expectDishSurface(
        page,
        "hamachi-a-la-verveine",
        /HAMACHI.*VERVEINE/i,
        false
      );
      await expectClosedViewer(page);
      expect(await page.locator("model-viewer").count()).toBeLessThanOrEqual(1);
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });
}
