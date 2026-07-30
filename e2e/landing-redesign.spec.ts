import { expect, test, type Page } from "@playwright/test";

const MODEL_REQUEST_RE =
  /\.(?:glb|usdz)(?:$|\?)|model-viewer|raw\.githubusercontent\.com/i;

function collectRuntimeFailures(page: Page) {
  const modelRequests: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];

  page.on("request", (request) => {
    if (MODEL_REQUEST_RE.test(request.url())) modelRequests.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      response.url().startsWith("http://127.0.0.1:3000")
    ) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  return { modelRequests, consoleErrors, failedResponses, pageErrors };
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(2);
}

async function scrollThroughLanding(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 520) {
      window.scrollTo(0, y);
      await new Promise((resolve) => window.setTimeout(resolve, 35));
    }
    window.scrollTo(0, 0);
  });
}

test.describe("Vistaire landing redesign", () => {
  test("keeps the existing top bar and promoted hero video", async ({ page }) => {
    const runtime = collectRuntimeFailures(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: "Navigation preview" });
    await expect(nav).toBeVisible();
    await expect(nav.getByText("Vistaire", { exact: true })).toBeVisible();
    await expect(nav.getByText("Carte digitale premium")).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(8);
    await expect(
      nav.getByRole("link").allTextContents()
    ).resolves.toEqual([
      "VistaireCarte digitale premium",
      "Accueil",
      "Carte",
      "À propos",
      "Contact",
      "FR",
      "EN",
      "Prendre rendez-vousRendez-vous"
    ]);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Donnez envie avant la première bouchée."
      })
    ).toBeVisible();

    const video = page.locator('[data-hero-media="video"] video');
    await expect(video).toBeVisible();
    await expect
      .poll(() =>
        video.evaluate((element) => {
          const media = element as HTMLVideoElement;
          return {
            autoplay: media.autoplay,
            loop: media.loop,
            muted: media.muted,
            playsInline: media.playsInline,
            poster: media.poster,
            src: media.currentSrc || media.querySelector("source")?.src || ""
          };
        })
      )
      .toEqual(
        expect.objectContaining({
          autoplay: true,
          loop: true,
          muted: true,
          playsInline: true
        })
      );
    await expect(video).toHaveAttribute(
      "poster",
      "/frames/menualive/frame_0200.webp"
    );
    await expect
      .poll(() => video.evaluate((node) => (node as HTMLVideoElement).currentSrc))
      .toContain("/videos/Vistaire2.mp4");

    await scrollThroughLanding(page);
    await expectNoHorizontalOverflow(page);
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(runtime.modelRequests).toEqual([]);
    expect(runtime.consoleErrors).toEqual([]);
    expect(runtime.failedResponses).toEqual([]);
    expect(runtime.pageErrors).toEqual([]);
  });

  test("switches one accessible comparison preview at a time", async ({ page }) => {
    const runtime = collectRuntimeFailures(page);
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const comparison = page.getByTestId("landing-comparison");
    await comparison.scrollIntoViewIfNeeded();
    const tabs = comparison.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(comparison.locator('[data-active-preview="maison-elyse"]')).toHaveCount(
      1
    );

    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(comparison.locator('[data-active-preview="trouvable"]')).toHaveCount(1);
    await expect(comparison.locator("[data-preview-interaction]")).toHaveCount(1);

    await tabs.nth(1).press("ArrowRight");
    await expect(tabs.nth(2)).toBeFocused();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(comparison.locator('[data-active-preview="sauge-noire"]')).toHaveCount(1);

    await tabs.nth(2).press("Home");
    await expect(tabs.nth(0)).toBeFocused();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

    const reveal = comparison.locator('[data-preview-reveal-frame="true"]');
    const revealBox = await reveal.boundingBox();
    expect(revealBox).not.toBeNull();
    if (!revealBox) throw new Error("Comparison reveal frame is not measurable");

    await reveal.dispatchEvent("pointerdown", {
      clientX: revealBox.x + revealBox.width * 0.35,
      clientY: revealBox.y + revealBox.height * 0.45,
      isPrimary: true,
      pointerId: 7,
      pointerType: "touch"
    });
    await expect(reveal).toHaveAttribute("data-touching", "true");
    await reveal.dispatchEvent("pointermove", {
      clientX: revealBox.x + revealBox.width * 0.7,
      clientY: revealBox.y + revealBox.height * 0.55,
      isPrimary: true,
      pointerId: 7,
      pointerType: "touch"
    });
    await expect
      .poll(() =>
        reveal.evaluate((element) =>
          Number.parseFloat(element.style.getPropertyValue("--reveal-x"))
        )
      )
      .toBeCloseTo(70, 2);
    await reveal.dispatchEvent("pointerup", {
      clientX: revealBox.x + revealBox.width * 0.7,
      clientY: revealBox.y + revealBox.height * 0.55,
      isPrimary: true,
      pointerId: 7,
      pointerType: "touch"
    });
    await expect(reveal).toHaveAttribute("data-touching", "false");

    await reveal.focus();
    await reveal.press("Enter");
    await expect(reveal).toHaveAttribute("aria-pressed", "true");

    await expectNoHorizontalOverflow(page);
    expect(runtime.modelRequests).toEqual([]);
    expect(runtime.consoleErrors).toEqual([]);
    expect(runtime.failedResponses).toEqual([]);
    expect(runtime.pageErrors).toEqual([]);
  });

  test("keeps the restaurant links real and bilingual", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const experiences = page.getByTestId("landing-experiences");
    await expect(
      experiences.getByRole("link", { name: /Maison Élyse/ })
    ).toHaveAttribute("href", "/demo");
    await expect(
      experiences.getByRole("link", { name: /Trouvable/ })
    ).toHaveAttribute("href", "/menu/trouvable?lang=fr-CA");
    await expect(
      experiences.getByRole("link", { name: /Sauge Noire/ })
    ).toHaveAttribute("href", "/menu/sauge-noire?lang=fr-CA");
    await expect(
      page.getByRole("link", { name: "Prendre rendez-vous" }).first()
    ).toHaveAttribute("href", "/prendre-rendez-vous");

    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Make every dish tempting before the first bite."
      })
    ).toBeVisible();
    const englishExperiences = page.getByTestId("landing-experiences");
    await expect(
      englishExperiences.getByRole("link", { name: /Maison Élyse/ })
    ).toHaveAttribute("href", "/en/vistaire-menu");
    await expect(
      englishExperiences.getByRole("link", { name: /Trouvable/ })
    ).toHaveAttribute("href", "/menu/trouvable?lang=en-CA");
    await expect(
      englishExperiences.getByRole("link", { name: /Sauge Noire/ })
    ).toHaveAttribute("href", "/menu/sauge-noire?lang=en-CA");
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
    { width: 1440, height: 900 }
  ]) {
    test(`has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await scrollThroughLanding(page);
      await expectNoHorizontalOverflow(page);
      await expect(page.getByTestId("landing-comparison-phone")).toBeVisible();
    });
  }

  test("uses the poster instead of autoplay for Save-Data", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true }
      });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-hero-media="poster"]')).toBeVisible();
    await expect(page.locator('[data-hero-media="video"]')).toHaveCount(0);
  });

  test("simplifies motion when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-hero-media="poster"]')).toBeVisible();
    const transitionDuration = await page
      .getByTestId("landing-comparison")
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.001);
  });
});
