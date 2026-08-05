import { expect, test, type Page } from "@playwright/test";

const viewport = { width: 390, height: 844 };
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

async function expectSettledSurface(page: Page) {
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
  return surface;
}

test.use({ viewport });

test("keeps the 3D viewer closed after next and previous dish navigation", async ({ page }) => {
  const glbRequests: string[] = [];
  page.on("request", (request) => {
    if (/\.glb(?:$|\?)/i.test(request.url())) glbRequests.push(request.url());
  });

  await page.goto(dishPath("truite-des-laurentides", "sauge-3"), {
    waitUntil: "domcontentloaded"
  });

  let surface = await expectSettledSurface(page);
  await expect(page.locator("model-viewer")).toHaveCount(0);
  expect(glbRequests).toEqual([]);

  await surface.getByRole("button", { name: "VOIR EN 3D" }).click();
  await expect(
    surface.getByRole("button", { name: "MASQUER LA 3D" })
  ).toHaveAttribute("aria-expanded", "true");
  // The stage is the loading boundary: model-viewer/GLB availability can vary
  // with the fixture's media response, but the open state must be observable.
  await expect(page.locator("[data-viewer-copy-locale]")).toHaveCount(1);
  const openedRequestCount = glbRequests.length;

  await surface.getByRole("link", { name: /prochain plat/i }).click();
  surface = await expectSettledSurface(page);
  await expect(page.locator("[data-viewer-copy-locale]")).toHaveCount(0);
  await expect(page.locator("model-viewer")).toHaveCount(0);
  expect(glbRequests).toHaveLength(openedRequestCount);

  await page.goBack();
  surface = await expectSettledSurface(page);
  await expect(
    surface.getByRole("heading", { name: "TRUITE DES LAURENTIDES" })
  ).toBeVisible();
  await expect(page.locator("[data-viewer-copy-locale]")).toHaveCount(0);
  await expect(page.locator("model-viewer")).toHaveCount(0);
  await expect(
    surface.getByRole("button", { name: "VOIR EN 3D" })
  ).toHaveAttribute("aria-expanded", "false");
  expect(glbRequests).toHaveLength(openedRequestCount);
});
