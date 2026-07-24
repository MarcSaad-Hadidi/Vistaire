import { expect, test } from "@playwright/test";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 900 }
];

test.describe("Trouvable settings fallback", () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps the historical dark palette at ${viewport.width}px`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const networkIssues: string[] = [];
      const modelRequests: string[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => consoleErrors.push(error.message));
      page.on("response", (response) => {
        if (response.status() === 404 || response.status() >= 500) {
          networkIssues.push(`${response.status()} ${response.url()}`);
        }
      });
      page.on("requestfailed", (request) => {
        const failure = request.failure()?.errorText ?? "request failed";
        if (failure !== "net::ERR_ABORTED") networkIssues.push(`${failure} ${request.url()}`);
      });
      page.on("request", (request) => {
        if (MODEL_ASSET_RE.test(new URL(request.url()).pathname)) {
          modelRequests.push(request.url());
        }
      });

      await page.setViewportSize(viewport);
      await page.goto("/menu/trouvable", { waitUntil: "domcontentloaded" });

      await expect(
        page.getByRole("region", { name: "Trouvable", exact: true })
      ).toBeVisible();
      await expect(page.locator("[data-user-theme]")).toHaveAttribute(
        "data-user-theme",
        "dark"
      );

      const rendered = await page.locator("main").evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth
        };
      });

      expect(rendered.backgroundColor).toContain("0.147137");
      expect(rendered.color).toContain("255, 247, 234");
      expect(rendered.scrollWidth).toBeLessThanOrEqual(rendered.clientWidth + 2);
      expect(modelRequests).toEqual([]);

      const darkToggle = page.getByRole("button", { name: "Activer le mode clair" });
      await expect(darkToggle).toHaveCount(1);
      await darkToggle.click();
      await expect(page.locator("[data-user-theme]")).toHaveAttribute(
        "data-user-theme",
        "light"
      );

      const lightToggle = page.getByRole("button", { name: "Activer le mode sombre" });
      await expect(lightToggle).toHaveCount(1);
      await lightToggle.click();
      await expect(page.locator("[data-user-theme]")).toHaveAttribute(
        "data-user-theme",
        "dark"
      );

      const dishButtons = page.locator(
        "#trouvable-dish-results button[aria-haspopup='dialog']"
      );
      const dishCount = await dishButtons.count();
      expect(dishCount).toBeGreaterThan(0);
      await dishButtons.nth(0).click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('[role="dialog"] [data-user-theme]')).toHaveCount(0);

      expect(consoleErrors).toEqual([]);
      expect(networkIssues).toEqual([]);
    });
  }
});
