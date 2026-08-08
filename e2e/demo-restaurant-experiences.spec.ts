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

async function expectReadyPreview(
  page: import("@playwright/test").Page,
  experienceId: "maison-elyse" | "trouvable" | "sauge-noire"
) {
  await expect(
    page
      .getByTestId("demo-phone-viewport")
      .locator(
        `:scope > [data-preview-status="ready"][data-landing-menu-renderer="${experienceId}"]`
      )
  ).toHaveCount(1);
  await expect(
    page
      .getByTestId("demo-phone-viewport")
      .locator(`[data-public-menu-renderer="${experienceId}"]`)
  ).toHaveCount(1);
}

test.describe("restaurant demo experience selector", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("supports keyboard activation, touch, and the required responsive widths", async ({
    page
  }) => {
    await page.goto("/demo#carte", { waitUntil: "domcontentloaded" });
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expectReadyPreview(page, "maison-elyse");

    await tabs.nth(0).focus();
    await tabs.nth(0).press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expectReadyPreview(page, "trouvable");

    await tabs.nth(1).press("End");
    await expect(tabs.nth(2)).toBeFocused();
    await expectReadyPreview(page, "sauge-noire");
    await tabs.nth(2).press("Home");
    await expect(tabs.nth(0)).toBeFocused();
    await expectReadyPreview(page, "maison-elyse");

    await tabs.nth(1).focus();
    await tabs.nth(1).press("Enter");
    await expectReadyPreview(page, "trouvable");
    await tabs.nth(2).focus();
    await tabs.nth(2).press("Space");
    await expectReadyPreview(page, "sauge-noire");
    await tabs.nth(0).tap();
    await expectReadyPreview(page, "maison-elyse");

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 }
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
          )
        )
        .toBe(true);
      await expect(page.getByRole("tab")).toHaveCount(3);
      await expectSinglePreview(page);
    }
  });

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
    await expect(page).toHaveTitle("Menu client exemple | Vistaire");
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs).toHaveText(["Maison Élyse", "Trouvable", "Sauge Noire"]);
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expectSinglePreview(page);
    await expectReadyPreview(page, "maison-elyse");
    expect(new URL(page.url()).searchParams.get("experience")).toBeNull();
    expect(new URL(page.url()).hash).toBe("#carte");

    const phoneViewport = page.getByTestId("demo-phone-viewport");
    const phoneScroller = phoneViewport.locator(
      ':scope > [data-display-mode="phone-preview"]'
    );
    await expect(phoneScroller).toHaveAttribute(
      "data-phone-mockup-scroll",
      "true"
    );
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() => phoneScroller.evaluate((element) => element.scrollTop))
      .toBe(0);
    expect(new URL(page.url()).searchParams.get("experience")).toBe("trouvable");
    expect(new URL(page.url()).searchParams.get("utm_source")).toBe("qa");
    expect(new URL(page.url()).hash).toBe("#carte");
    await expectSinglePreview(page);
    await expectReadyPreview(page, "trouvable");

    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    expect(new URL(page.url()).searchParams.get("experience")).toBe("sauge-noire");
    await expectSinglePreview(page);
    const saugePages = phoneViewport.locator(
      '[data-sauge-comparison-pages="true"][data-display-mode="phone-preview"]'
    );
    await expect(saugePages).toHaveCount(1);
    await expectReadyPreview(page, "sauge-noire");
    await expect(phoneScroller.locator('[data-testid="sauge-noire-book"]')).toHaveCount(0);
    const initialSaugeScrollTop = await phoneScroller.evaluate(
      (element) => element.scrollTop
    );
    await expect
      .poll(() => phoneScroller.evaluate((element) => element.scrollHeight - element.clientHeight))
      .toBeGreaterThan(0);
    await phoneScroller.evaluate((element) => {
      element.scrollTop = Math.min(180, element.scrollHeight);
    });
    await expect
      .poll(() => phoneScroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(initialSaugeScrollTop);
    expect(modelRequests).toEqual([]);

    await page.goBack();
    await expect(page.getByRole("tab").nth(1)).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expectReadyPreview(page, "trouvable");
    await page.goForward();
    await expect(page.getByRole("tab").nth(2)).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expectReadyPreview(page, "sauge-noire");

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
    await expectReadyPreview(page, "trouvable");
    await page.goto("/demo?experience=sauge-noire", {
      waitUntil: "domcontentloaded"
    });
    await expectReadyPreview(page, "sauge-noire");
    await page.goBack();
    await expect(page.getByRole("tab").nth(1)).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expectReadyPreview(page, "trouvable");
    await page.goForward();
    await expect(page.getByRole("tab").nth(2)).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expectReadyPreview(page, "sauge-noire");
    expect(modelRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("keeps English route chrome independent from the selected menu locale", async ({
    page
  }) => {
    const modelRequests: string[] = [];
    const pageErrors: string[] = [];
    page.on("request", (request) => {
      if (MODEL_REQUEST.test(request.url())) modelRequests.push(request.url());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/en/vistaire-menu?experience=trouvable#carte", {
      waitUntil: "domcontentloaded"
    });
    await expect(page).toHaveTitle("Sample client menu | Vistaire");
    await expect(page.getByRole("tab", { name: "Trouvable" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("Vistaire experience")).toHaveCount(1);
    await expect(page.getByTestId("demo-phone-mockup")).toBeVisible();
    await expectReadyPreview(page, "trouvable");
    expect(modelRequests).toEqual([]);
    expect(pageErrors).toEqual([]);

    await page.goto(
      "/en/vistaire-menu?lang=fr&experience=trouvable#carte",
      { waitUntil: "domcontentloaded" }
    );
    await expect(
      page
        .getByTestId("demo-phone-viewport")
        .locator(':scope > [data-menu-active-locale="fr-CA"]')
    ).toHaveCount(1);
    await expect(
      page.getByRole("navigation", { name: "Main navigation" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Vistaire - home" })).toBeVisible();
    await page.getByRole("tab", { name: "Sauge Noire" }).click();
    await expectReadyPreview(page, "sauge-noire");
    expect(new URL(page.url()).searchParams.get("lang")).toBe("fr");
    expect(new URL(page.url()).hash).toBe("#carte");
    expect(modelRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("keeps Trouvable grid dish names readable in the phone preview", async ({
    page
  }) => {
    await page.goto("/demo?experience=trouvable#carte", {
      waitUntil: "domcontentloaded"
    });

    const phoneScroller = page.getByTestId("demo-phone-viewport").locator(
      ':scope > [data-display-mode="phone-preview"]'
    );
    const menu = phoneScroller.locator('[data-menu-ui="trouvable"]');
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "Afficher en grille" }).click();

    const metrics = await menu
      .locator("ul")
      .first()
      .locator("article")
      .first()
      .evaluate((article) => {
        const summary = article.querySelector('[class*="dishSummary"]');
        const visual = article.querySelector('[class*="dishVisual"]');
        const copy = article.querySelector('[class*="dishCopy"]');
        const title = article.querySelector("strong");
        if (!summary || !visual || !copy || !title) {
          throw new Error("Trouvable grid card structure is incomplete");
        }
        const summaryWidth = summary.getBoundingClientRect().width;
        const visualWidth = visual.getBoundingClientRect().width;
        const copyWidth = copy.getBoundingClientRect().width;
        const titleStyle = getComputedStyle(title);
        return {
          summaryWidth,
          visualWidth,
          copyWidth,
          titleLines: Math.round(
            title.getBoundingClientRect().height /
              parseFloat(titleStyle.lineHeight)
          )
        };
      });

    expect(metrics.visualWidth).toBeGreaterThan(metrics.summaryWidth * 0.8);
    expect(metrics.copyWidth).toBeGreaterThan(metrics.summaryWidth * 0.8);
    expect(metrics.titleLines).toBeLessThanOrEqual(3);
  });

  test("fails closed to one explicit fallback when a lazy preview request fails", async ({
    page
  }) => {
    await page.route(
      "**/api/public/landing-menu-preview/trouvable?**",
      (route) => route.fulfill({ status: 503, body: "unavailable" })
    );
    await page.goto("/demo?experience=trouvable#carte", {
      waitUntil: "domcontentloaded"
    });

    const viewport = page.getByTestId("demo-phone-viewport");
    await expect(
      viewport.locator(':scope > [data-preview-status="fallback"]')
    ).toHaveCount(1);
    await expect(viewport.locator("[data-public-menu-renderer]")).toHaveCount(0);
    await expect(viewport).toContainText("Cet aperçu de menu est indisponible.");
  });
});
