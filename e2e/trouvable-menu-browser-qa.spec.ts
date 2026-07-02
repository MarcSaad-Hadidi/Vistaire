import { expect, test, type Page } from "@playwright/test";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;
const VIEWPORTS = [
  { name: "390px", size: { width: 390, height: 844 } },
  { name: "430px", size: { width: 430, height: 932 } }
];

async function collectBrowserQaSignals(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];
  const modelRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("request", (request) => {
    if (MODEL_ASSET_RE.test(request.url())) modelRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  return { consoleErrors, failedResponses, modelRequests, pageErrors };
}

test.describe("Trouvable menu browser QA", () => {
  for (const viewport of VIEWPORTS) {
    test(`loads cleanly at ${viewport.name} without overflow or eager model assets`, async ({
      page
    }) => {
      await page.setViewportSize(viewport.size);
      const signals = await collectBrowserQaSignals(page);

      await page.goto("/menu/trouvable", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("region", { name: /Carte Trouvable|Trouvable menu/i })
      ).toBeVisible();

      const viewportFit = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));

      expect(viewportFit.scrollWidth).toBeLessThanOrEqual(viewportFit.clientWidth);
      expect(signals.consoleErrors).toEqual([]);
      expect(signals.pageErrors).toEqual([]);
      expect(signals.failedResponses).toEqual([]);
      expect(signals.modelRequests).toEqual([]);
    });
  }
});
