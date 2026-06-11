import { expect, type BrowserContext, type Page, test } from "@playwright/test";

const OWNER_E2E_TOKEN =
  process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
  "vistaire-owner-e2e-local-token";

async function enableOwnerBypass(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    {
      name: "__vistaire_owner_e2e",
      value: OWNER_E2E_TOKEN,
      url: baseURL
    }
  ]);
}

function trackMediaRequests(page: Page) {
  const mediaRequests: string[] = [];

  page.on("request", (request) => {
    const url = request.url();
    if (/\.(?:glb|usdz)(?:$|[?#])/i.test(url)) mediaRequests.push(url);
  });

  return mediaRequests;
}

test("owner builder immersive-state preview keeps status-only 3D/AR detail chips", async ({
  context,
  page
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  await enableOwnerBypass(context, baseURL);
  const mediaRequests = trackMediaRequests(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/owner/menu-builder", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "3D/AR available" }).click();
  const preview = page.locator('[data-preview-mode="immersive-state"]');
  await expect(preview).toBeVisible();

  const immersiveDishButton = preview.locator("li button").filter({ hasText: "3D" });
  await expect(immersiveDishButton.first()).toBeVisible();
  await immersiveDishButton.first().click();

  await expect(preview.getByText("Preview statut seulement dans le builder.")).toBeVisible();
  await expect(preview.getByText("3D disponible")).toBeVisible();
  await expect(preview.getByText("AR disponible")).toBeVisible();
  await expect(preview.locator("model-viewer")).toHaveCount(0);
  expect(mediaRequests, mediaRequests.join("\n")).toEqual([]);
});
