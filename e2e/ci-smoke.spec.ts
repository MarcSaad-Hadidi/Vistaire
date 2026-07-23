import { expect, test, type Page } from "@playwright/test";

async function expectHealthy(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response?.status(), `${path} should not fail`).toBeLessThan(400);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    )
    .toBe(true);
}

test("CI smoke loads the public landing at Vistaire mobile widths", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    await page.setViewportSize(viewport);
    await expectHealthy(page, "/");
    await expect(page.getByRole("link", { name: "Prendre rendez-vous" }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("CI smoke loads the hermetic demo menu without early 3D requests", async ({ page }) => {
  const modelRequests: string[] = [];
  page.on("request", (request) => {
    if (/\.(?:glb|usdz)(?:$|\?)/i.test(request.url())) modelRequests.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectHealthy(page, "/demo");
  await expect(page.getByTestId("demo-phone-viewport")).toBeVisible();
  await expect(page.getByText("LA COLLECTION")).toBeVisible();
  await expect(page.getByRole("heading", { name: "LA CARTE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Voir toute la carte" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(modelRequests).toEqual([]);
});

test("CI smoke keeps admin gated and metadata routes healthy", async ({ page }) => {
  await expectHealthy(page, "/admin");
  await expect(page.getByText(/Accès dashboard restaurant requis/i)).toBeVisible();
  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    await expectHealthy(page, path);
  }
});
