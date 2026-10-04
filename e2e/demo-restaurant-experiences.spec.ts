import { expect, test } from "@playwright/test";

const MODEL_REQUEST =
  /(?:\.(?:glb|usdz)(?:$|[?#])|\/model\/(?:glb|usdz)(?:\/|$|[?#])|model-viewer)/i;

const EXPERIENCES = [
  { id: "maison-elyse", name: "Maison Élyse", href: "/menu/maison-elyse?lang=fr-CA" },
  { id: "trouvable", name: "Trouvable", href: "/menu/trouvable?lang=fr-CA" },
  { id: "sauge-noire", name: "Sauge Noire", href: "/menu/sauge-noire?lang=fr-CA" }
] as const;

test.describe("French restaurant discovery", () => {
  test.setTimeout(90_000);
  test("presents three real experiences without previews, early models or mobile overflow", async ({ page }) => {
    const errors: string[] = [];
    const unexpectedRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || /hydration|did not match/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    page.on("request", (request) => {
      if (MODEL_REQUEST.test(request.url()) || /\/api\/public\/landing-menu-preview\//.test(request.url())) {
        unexpectedRequests.push(request.url());
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    page.on("requestfailed", (request) => {
      const errorText = request.failure()?.errorText;
      const cancelledMediaRange = request.resourceType() === "media" && errorText === "Load request cancelled";
      if (errorText !== "net::ERR_ABORTED" && !cancelledMediaRange) {
        errors.push(`${errorText} ${request.url()}`);
      }
    });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 1440, height: 900 }
    ]) {
      await page.setViewportSize(viewport);
      const response = await page.goto("/demo?experience=trouvable&utm_source=qa", { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle("Trois expériences de menu restaurant | Vistaire");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trois restaurants. Trois identités.");
      await expect(page.locator("[data-demo-experience]")).toHaveCount(3);
      for (const experience of EXPERIENCES) {
        const panel = page.locator(`[data-demo-experience="${experience.id}"]`);
        await panel.scrollIntoViewIfNeeded();
        await expect(panel.getByRole("heading", { level: 2, name: experience.name, exact: true })).toBeVisible();
        const link = panel.getByRole("link", { name: `Explorer ${experience.name}`, exact: true });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", experience.href);
        expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        const video = panel.locator("video[data-demo-video]");
        await video.scrollIntoViewIfNeeded();
        await expect(video).toHaveJSProperty("autoplay", true);
        await expect(video).toHaveJSProperty("loop", true);
        await expect(video).toHaveJSProperty("muted", true);
        await expect(video).toHaveJSProperty("playsInline", true);
        await expect(video).toHaveJSProperty("controls", false);
        await expect.poll(() => video.evaluate((element: HTMLVideoElement) =>
          element.readyState >= 2 && !element.paused && element.videoWidth > 0 && element.videoHeight > 0
        ), { timeout: 15_000 }).toBe(true);
        expect(await video.evaluate((element: HTMLVideoElement) =>
          element.videoWidth / element.videoHeight
        )).toBeCloseTo(780 / 1688, 2);
        const initialTime = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
        await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).not.toBe(initialTime);
        expect(await video.evaluate(async (element: HTMLVideoElement) => {
          const poster = new Image();
          poster.src = element.poster;
          await poster.decode();
          return poster.naturalWidth > 0;
        })).toBe(true);
      }
      await expect(page.getByTestId("demo-phone-mockup")).toHaveCount(0);
      await expect(page.locator("[data-demo-experience] button")).toHaveCount(0);
      await expect(page.getByText("Le menu en action · en boucle", { exact: true })).toHaveCount(0);
      await expect(page.locator("[data-phone-mockup-scroll], [data-public-menu-renderer], model-viewer, iframe")).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.locator("main").evaluate((element) => getComputedStyle(element).overflowY)).toBe("visible");
      await expect(page.getByRole("contentinfo")).toBeVisible();
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    const loopingVideo = page.locator("video[data-demo-video]").first();
    await loopingVideo.scrollIntoViewIfNeeded();
    await expect.poll(() => loopingVideo.evaluate((element: HTMLVideoElement) =>
      !element.paused && element.readyState >= 2
    )).toBe(true);
    await loopingVideo.evaluate((element: HTMLVideoElement) => { element.currentTime = element.duration - 0.1; });
    await expect.poll(() => loopingVideo.evaluate((element: HTMLVideoElement) =>
      element.currentTime < 1 && !element.paused
    )).toBe(true);
    const firstLink = page.getByRole("link", { name: "Explorer Maison Élyse", exact: true });
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
    expect(await firstLink.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
    expect(await firstLink.evaluate((element) =>
      Math.max(...getComputedStyle(element).transitionDuration.split(",").map(parseFloat))
    )).toBeLessThanOrEqual(0.001);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/demo$/);
    await expect(page.locator('link[rel="alternate"][hreflang="en-CA"]')).toHaveAttribute("href", /\/en\/vistaire-menu$/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Trois expériences de menu restaurant | Vistaire");
    expect(errors, errors.join("\n")).toEqual([]);
    expect(unexpectedRequests).toEqual([]);
  });

  test("opens each real menu and the verified Sauge 3D dish through accessible links", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const experience of EXPERIENCES) {
      await page.goto("/demo", { waitUntil: "load" });
      const link = page.getByRole("link", { name: `Explorer ${experience.name}`, exact: true });
      await expect(link).toHaveAttribute("href", experience.href);
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
      await link.focus();
      await expect(link).toBeFocused();
      await link.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/menu/${experience.id}\\?`), { timeout: 15_000 });
      if (experience.id === "sauge-noire") {
        await expect(page.getByTestId("sauge-noire-book")).toBeVisible();
      } else {
        await expect(page.locator(`[data-menu-ui="${experience.id}"]`)).toBeVisible();
      }
    }
    const modelRequests: string[] = [];
    page.on("request", (request) => {
      if (MODEL_REQUEST.test(request.url())) modelRequests.push(request.url());
    });
    await page.goto("/demo", { waitUntil: "load" });
    const dishLink = page.locator("[data-demo-3d-link]");
    await expect(dishLink).toHaveAttribute("href", "/menu/sauge-noire/dishes/truite-des-laurentides?lang=fr-CA&view=sauge-2");
    await dishLink.click();
    await expect(page).toHaveURL(/\/menu\/sauge-noire\/dishes\/truite-des-laurentides\?/, { timeout: 15_000 });
    await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
    await page.waitForLoadState("load");
    await expect(page.locator("model-viewer")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Voir en 3D/i })).toBeVisible();
    expect(modelRequests).toEqual([]);
    await page.getByRole("button", { name: /Voir en 3D/i }).click();
    const viewer = page.locator("model-viewer");
    await expect(viewer).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => modelRequests.some((url) => /\.glb(?:$|[?#])/i.test(url)), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => viewer.evaluate((element) =>
      Boolean((element as HTMLElement & { loaded?: boolean }).loaded)
    ), { timeout: 15_000 }).toBe(true);
  });
});

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
  ).toHaveCount(1, { timeout: 15_000 });
  await expect(
    page
      .getByTestId("demo-phone-viewport")
      .locator(`[data-public-menu-renderer="${experienceId}"]`)
  ).toHaveCount(1, { timeout: 15_000 });
}

test.describe("English restaurant phone preview regression", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("supports keyboard activation, touch, and the required responsive widths", async ({
    page
  }) => {
    test.setTimeout(60_000);
    await page.goto("/en/vistaire-menu?lang=fr#carte", { waitUntil: "domcontentloaded" });
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

  test("keeps Maison locale state isolated while switching experiences and history", async ({
    page
  }) => {
    const modelRequests: string[] = [];
    page.on("request", (request) => {
      if (MODEL_REQUEST.test(request.url())) modelRequests.push(request.url());
    });
    await page.goto("/en/vistaire-menu?lang=fr#carte", { waitUntil: "domcontentloaded" });
    const viewport = page.getByTestId("demo-phone-viewport");
    const maison = () => viewport.locator('[data-menu-ui="maison-elyse"]');
    await expectReadyPreview(page, "maison-elyse");
    await expect(maison()).toHaveAttribute("lang", "fr-CA");

    await maison()
      .getByRole("button", { name: /Choisir la langue du menu/i })
      .click();
    await maison()
      .getByRole("dialog", { name: "Langue du menu" })
      .getByRole("button", { name: /English/i })
      .click();
    await expect(maison()).toHaveAttribute("lang", "en-CA");
    await expect(maison().getByText("THE COLLECTION", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Trouvable" }).click();
    await expectReadyPreview(page, "trouvable");
    expect(new URL(page.url()).searchParams.get("experience")).toBe("trouvable");
    await page.getByRole("tab", { name: "Maison Élyse" }).click();
    await expectReadyPreview(page, "maison-elyse");
    await expect(maison()).toHaveAttribute("lang", "fr-CA");
    expect(new URL(page.url()).searchParams.get("experience")).toBeNull();

    await page.getByRole("tab", { name: "Sauge Noire" }).click();
    await expectReadyPreview(page, "sauge-noire");
    await page.getByRole("tab", { name: "Maison Élyse" }).click();
    await expectReadyPreview(page, "maison-elyse");
    await expect(viewport.locator("[data-public-menu-renderer]")).toHaveCount(1);
    await expect(maison()).toHaveAttribute("lang", "fr-CA");

    await page.goBack();
    await expectReadyPreview(page, "sauge-noire");
    await page.goForward();
    await expectReadyPreview(page, "maison-elyse");
    await expect(viewport.locator("[data-public-menu-renderer]")).toHaveCount(1);
    expect(modelRequests).toEqual([]);
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

    await page.goto("/en/vistaire-menu?lang=fr&utm_source=qa#carte", {
      waitUntil: "domcontentloaded"
    });
    await expect(page).toHaveTitle("Sample client menu | Vistaire");
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

    await page.goto("/en/vistaire-menu?lang=fr&experience=invalid&utm_source=qa#carte", {
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

    await page.goto("/en/vistaire-menu?lang=fr&experience=trouvable", {
      waitUntil: "domcontentloaded"
    });
    await expectReadyPreview(page, "trouvable");
    await page.goto("/en/vistaire-menu?lang=fr&experience=sauge-noire", {
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

  test("keeps English route chrome stable while Maison menu switches FR and EN", async ({
    page
  }) => {
    const modelRequests: string[] = [];
    page.on("request", (request) => {
      if (MODEL_REQUEST.test(request.url())) modelRequests.push(request.url());
    });
    await page.goto("/en/vistaire-menu?lang=fr#carte", {
      waitUntil: "domcontentloaded"
    });

    await expect(page).toHaveTitle("Sample client menu | Vistaire");
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.lang))
      .toBe("en-CA");
    const viewport = page.getByTestId("demo-phone-viewport");
    const maison = viewport.locator('[data-menu-ui="maison-elyse"]');
    await expectReadyPreview(page, "maison-elyse");
    await expect(maison).toHaveAttribute("lang", "fr-CA");
    await expect(maison.getByText("LA COLLECTION", { exact: true })).toBeVisible();

    await maison
      .getByRole("button", { name: /Choisir la langue du menu/i })
      .click();
    await maison
      .getByRole("dialog", { name: "Langue du menu" })
      .getByRole("button", { name: /English/i })
      .click();
    await expect(maison).toHaveAttribute("lang", "en-CA");
    await expect(maison.getByText("THE COLLECTION", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("lang")).toBe("fr");
    expect(new URL(page.url()).hash).toBe("#carte");
    expect(modelRequests).toEqual([]);
  });

  test("keeps Trouvable grid dish names readable in the phone preview", async ({
    page
  }) => {
    await page.goto("/en/vistaire-menu?lang=fr&experience=trouvable#carte", {
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

  test("localizes the lazy Maison dish-detail loading state in an English phone preview", async ({
    page
  }) => {
    const modelRequests: string[] = [];
    page.on("request", (request) => {
      if (MODEL_REQUEST.test(request.url())) modelRequests.push(request.url());
    });
    await page.goto("/en/vistaire-menu#carte", { waitUntil: "domcontentloaded" });
    await expectReadyPreview(page, "maison-elyse");

    const viewport = page.getByTestId("demo-phone-viewport");
    const menu = viewport.locator('[data-menu-ui="maison-elyse"]');
    await expect(menu).toHaveAttribute("lang", "en-CA");

    let releaseChunk = () => {};
    const chunkGate = new Promise<void>((resolve) => {
      releaseChunk = resolve;
    });
    let heldDetailChunk = false;
    await page.route(/\/_next\/static\/chunks\/.*\.js(?:\?|$)/, async (route) => {
      if (!heldDetailChunk) {
        heldDetailChunk = true;
        await chunkGate;
      }
      await route.continue();
    });

    try {
      await menu
        .getByRole("button", { name: /Fresh goat cheese ravioli/i })
        .click();
      await expect.poll(() => heldDetailChunk).toBe(true);
      await expect(viewport.getByRole("status")).toHaveText(
        "Loading dish details..."
      );
    } finally {
      releaseChunk();
    }

    await expect(
      viewport.getByRole("heading", {
        level: 1,
        name: "Fresh goat cheese ravioli & Monteregie honey"
      })
    ).toBeVisible();
    await expect(viewport.getByRole("button", { name: "Back to menu" })).toBeVisible();
    expect(modelRequests).toEqual([]);
  });

  test("fails closed to one explicit fallback when a lazy preview request fails", async ({
    page
  }) => {
    await page.route(
      "**/api/public/landing-menu-preview/trouvable?**",
      (route) => route.fulfill({ status: 503, body: "unavailable" })
    );
    await page.goto("/en/vistaire-menu?lang=fr&experience=trouvable#carte", {
      waitUntil: "domcontentloaded"
    });

    const viewport = page.getByTestId("demo-phone-viewport");
    await expect(
      viewport.locator(':scope > [data-preview-status="fallback"]')
    ).toHaveCount(1);
    await expect(viewport.locator("[data-public-menu-renderer]")).toHaveCount(0);
    await expect(viewport).toContainText("This menu preview is unavailable.");
  });
});
