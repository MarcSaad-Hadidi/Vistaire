import { expect, test } from "@playwright/test";

test.describe("Landing scroll experience", () => {
  test("hero renders with canvas or video and responds to scroll", async ({
    page
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.locator("#experience")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    const experience = page.locator("#experience");
    const canvasCount = await experience.locator("canvas").count();
    const videoCount = await experience.locator("video").count();
    expect(canvasCount + videoCount).toBeGreaterThan(0);

    const scrollMax = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    expect(scrollMax).toBeGreaterThan(400);

    await page.evaluate((y) => window.scrollTo(0, y), scrollMax * 0.35);
    const y1 = await page.evaluate(() => window.scrollY);
    expect(y1).toBeGreaterThan(200);

    await page.evaluate((y) => window.scrollTo(0, y), scrollMax * 0.85);
    const y2 = await page.evaluate(() => window.scrollY);
    expect(y2).toBeGreaterThan(y1);
  });

  test("benefits section follows hero (non-regression layout)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#benefices")).toBeVisible();
  });
});

test.describe("Non-regression routes", () => {
  test("/demo loads", async ({ page }) => {
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-demo-root]").first()).toBeVisible();
  });

  test("dish pages load", async ({ page }) => {
    await page.goto("/demo/dishes/ravioles-romarin", {
      waitUntil: "domcontentloaded"
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/demo/dishes/homard-bisque", {
      waitUntil: "domcontentloaded"
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("/admin loads", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/admin", {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
