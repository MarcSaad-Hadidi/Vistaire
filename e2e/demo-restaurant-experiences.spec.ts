import { expect, test } from "@playwright/test";

const MODEL_REQUEST = /\.(?:glb|usdz)(?:$|[?#])|model-viewer/i;

async function expectSinglePreview(page: import("@playwright/test").Page) {
  const viewport = page.getByTestId("demo-phone-viewport");
  await expect(viewport).toBeVisible();
  await expect
    .poll(() => viewport.locator(":scope > [data-preview-status]").count())
    .toBe(1);
  await expect(viewport.locator(":scope > [data-preview-status]")).toHaveCount(1);
  return viewport;
}

test.describe("restaurant demo experience selector", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps one active preview across deep links, query changes, and browser history", async ({
    page
  }) => {
    const modelRequests: string[] = [];
    const pageErrors: string[] = [];
    page.on("request", (request) => {
      if (MODEL_REQUEST.test(request.url())) modelRequests.push(request.url());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/demo?utm_source=qa#carte", {
      waitUntil: "domcontentloaded"
    });
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs).toHaveText(["Maison Élyse", "Trouvable", "Sauge Noire"]);
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expectSinglePreview(page);
    expect(new URL(page.url()).searchParams.get("experience")).toBeNull();
    expect(new URL(page.url()).hash).toBe("#carte");

    const phoneViewport = page.getByTestId("demo-phone-viewport");
    await phoneViewport.evaluate((element) => {
      element.scrollTop = Math.min(180, element.scrollHeight);
    });
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() => phoneViewport.evaluate((element) => element.scrollTop))
      .toBe(0);
    expect(new URL(page.url()).searchParams.get("experience")).toBe("trouvable");
    expect(new URL(page.url()).searchParams.get("utm_source")).toBe("qa");
    expect(new URL(page.url()).hash).toBe("#carte");
    await expectSinglePreview(page);

    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    expect(new URL(page.url()).searchParams.get("experience")).toBe("sauge-noire");
    await expectSinglePreview(page);
    expect(modelRequests).toEqual([]);

    await page.goto("/demo?experience=invalid&utm_source=qa#carte", {
      waitUntil: "domcontentloaded"
    });
    await expect(page.getByRole("tab").nth(0)).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect
      .poll(() => new URL(page.url()).searchParams.get("experience"))
      .toBeNull();
    expect(new URL(page.url()).searchParams.get("utm_source")).toBe("qa");
    expect(new URL(page.url()).hash).toBe("#carte");

    await page.goto("/demo?experience=trouvable", {
      waitUntil: "domcontentloaded"
    });
    await page.goto("/demo?experience=sauge-noire", {
      waitUntil: "domcontentloaded"
    });
    await page.goBack();
    await expect(page.getByRole("tab").nth(1)).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.goForward();
    await expect(page.getByRole("tab").nth(2)).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.goto("/en/vistaire-menu?experience=trouvable#carte", {
      waitUntil: "domcontentloaded"
    });
    await expect(page.getByRole("tab", { name: "Trouvable" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("Vistaire experience")).toHaveCount(1);
    await expect(page.getByTestId("demo-phone-mockup")).toBeVisible();
    expect(modelRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
