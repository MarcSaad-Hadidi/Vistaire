import { expect, test, type Locator, type Page } from "@playwright/test";
import { privacyRejectedStorageState } from "./support/privacy-consent";

const MODEL_REQUEST_RE =
  /\.(?:glb|usdz)(?:$|[?#])|\/model\/(?:glb|usdz)(?:$|[/?#])|model-viewer|babylon|three(?:\.module)?(?:\.min)?\.js|raw\.githubusercontent\.com|\/api\/.*(?:convert|conversion)/i;
const MENU_ANALYTICS_REQUEST_RE = /\/api\/public\/menu-events(?:$|[/?#])/i;
const LAZY_PREVIEW_TIMEOUT_MS = 15_000;
const DESKTOP_HERO_VIDEO = "/videos/Vistaire2.mp4";
const MOBILE_HERO_VIDEO =
  "/videos/optimized/upscaled-video-mobile-scrub.mp4";
const HERO_POSTER = "/frames/menualive/frame_0200.webp";

function collectRuntimeFailures(page: Page) {
  const modelRequests: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];
  const failedRequests: string[] = [];
  const menuAnalyticsRequests: string[] = [];
  const previewPayloadRequests: string[] = [];
  const heroVideoRequests: string[] = [];

  page.on("request", (request) => {
    if (MODEL_REQUEST_RE.test(request.url())) modelRequests.push(request.url());
    if (MENU_ANALYTICS_REQUEST_RE.test(request.url())) {
      menuAnalyticsRequests.push(request.url());
    }
    if (/\/api\/public\/landing-menu-preview\//.test(request.url())) {
      previewPayloadRequests.push(request.url());
    }
    try {
      const pathname = new URL(request.url()).pathname;
      if (pathname === DESKTOP_HERO_VIDEO || pathname === MOBILE_HERO_VIDEO) {
        heroVideoRequests.push(pathname);
      }
    } catch {
      // Ignore non-URL browser internals.
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText;
    if (
      failure === "net::ERR_ABORTED" &&
      /\/videos\/Vistaire2\.mp4(?:$|[?#])/i.test(request.url())
    ) {
      return;
    }
    failedRequests.push(
      `${failure ?? "request failed"} ${request.url()}`
    );
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    let isSameOrigin = false;
    try {
      isSameOrigin =
        new URL(response.url()).origin === new URL(page.url()).origin;
    } catch {
      // Ignore non-HTTP pages such as about:blank during browser startup.
    }
    if (response.status() >= 400 && isSameOrigin) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  return {
    modelRequests,
    consoleErrors,
    failedRequests,
    failedResponses,
    menuAnalyticsRequests,
    previewPayloadRequests,
    heroVideoRequests,
    pageErrors
  };
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

async function expectPromotedHeroUsableAcrossScroll(page: Page, video: Locator) {
  const before = await video.evaluate((element) => {
    const media = element as HTMLVideoElement;
    return { currentTime: media.currentTime, state: media.dataset.heroVideoState };
  });
  await page.locator("#fonctionnalites").scrollIntoViewIfNeeded();
  await expect
    .poll(
      () =>
        video.evaluate((element, previousTime) => {
          const media = element as HTMLVideoElement;
          const state = media.dataset.heroVideoState;
          return (
            state === "poster" ||
            (state === "playing" &&
              media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
              Math.abs(media.currentTime - previousTime) > 0.02)
          );
        }, before.currentTime),
      {
        message:
          "the promoted loop should remain usable or cleanly fall back to its poster after scrolling"
      }
    )
    .toBe(true);
  expect(["playing", "poster"]).toContain(
    await video.getAttribute("data-hero-video-state")
  );
}

async function expectLoadedImages(images: Locator, minimum = 1) {
  await expect
    .poll(
      async () =>
        images.evaluateAll((elements) =>
          elements.filter((element) => {
            const image = element as HTMLImageElement;
            const rect = image.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              image.complete &&
              image.naturalWidth > 0 &&
              image.naturalHeight > 0
            );
          }).length
        ),
      { message: "visible menu images should finish loading with real dimensions" }
    )
    .toBeGreaterThanOrEqual(minimum);
}

async function expectAccessibleNewTabLink(
  link: Locator,
  label: string,
  unexpectedLabel: string
) {
  const hiddenLabel = link.locator('span[class*="srOnly"]');
  await expect(hiddenLabel).toHaveCount(1);
  await expect(hiddenLabel).toHaveText(label);
  await expect(hiddenLabel).not.toHaveAttribute("aria-hidden", "true");
  await expect(link).toHaveAccessibleName(new RegExp(label.replace(".", "\\.")));
  await expect(link).not.toHaveAccessibleName(
    new RegExp(unexpectedLabel.replace(".", "\\."))
  );

  const hiddenLabelStyles = await hiddenLabel.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clip: style.clip,
      height: style.height,
      overflow: style.overflow,
      position: style.position,
      whiteSpace: style.whiteSpace,
      width: style.width
    };
  });
  expect(hiddenLabelStyles).toEqual(
    expect.objectContaining({
      height: "1px",
      overflow: "hidden",
      position: "absolute",
      whiteSpace: "nowrap",
      width: "1px"
    })
  );
  expect(hiddenLabelStyles.clip).toContain("0px");
}

async function expectIndependentComparisonScrollRoots(comparison: Locator) {
  const roots = comparison.locator("[data-comparison-scroll-root]");
  await expect(roots).toHaveCount(2);
  await expect
    .poll(
      () =>
      roots.evaluateAll((elements) =>
          elements.map(
            (element) => element.scrollHeight - element.clientHeight > 24
          )
        ),
      { timeout: LAZY_PREVIEW_TIMEOUT_MS }
    )
    .toEqual([true, true]);
}

async function performTouchGesture(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }]
    });
    for (let step = 1; step <= 4; step += 1) {
      const progress = step / 4;
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            id: 1,
            x: start.x + (end.x - start.x) * progress,
            y: start.y + (end.y - start.y) * progress
          }
        ]
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: []
    });
  } finally {
    await session.detach();
  }
}

function landingUrl(path = "/") {
  const protectedPreview = process.env.VISTAIRE_PROTECTED_PREVIEW_URL;
  if (!protectedPreview) return path;
  const url = new URL(protectedPreview);
  url.pathname = path;
  return url.toString();
}

type LandingExperienceId = "maison-elyse" | "trouvable" | "sauge-noire";

const LANDING_EXPERIENCES: readonly {
  id: LandingExperienceId;
  name: RegExp;
}[] = [
  { id: "maison-elyse", name: /Maison Élyse|Maison Elyse/ },
  { id: "trouvable", name: /Trouvable/ },
  { id: "sauge-noire", name: /Sauge Noire/ }
];

async function expectSecureLandingMenuLinks(page: Page) {
  const links = page.locator('a[href^="/menu/"]');
  await expect(links).toHaveCount(9);
  const attributes = await links.evaluateAll((elements) =>
    elements.map((element) => ({
      href: element.getAttribute("href"),
      rel: element.getAttribute("rel")?.split(/\s+/).filter(Boolean) ?? [],
      target: element.getAttribute("target")
    }))
  );

  for (const attributesForLink of attributes) {
    expect(attributesForLink.href).toMatch(/^\/menu\//);
    expect(attributesForLink.target).toBe("_blank");
    expect(attributesForLink.rel).toContain("noopener");
    expect(attributesForLink.rel).toContain("noreferrer");
  }
}

async function openRealPopup(page: Page, link: Locator) {
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    link.click()
  ]);
  await popup.waitForLoadState("domcontentloaded");
  return popup;
}

async function expectPopupRoute(
  popup: Page,
  pathname: RegExp,
  locale: "fr-CA" | "en-CA"
) {
  await expect.poll(() => new URL(popup.url()).pathname).toMatch(pathname);
  expect(new URL(popup.url()).searchParams.get("lang")).toBe(locale);
}

test.describe("Vistaire landing redesign", () => {
  test("keeps the existing top bar and promoted hero video", async ({ page }) => {
    const runtime = collectRuntimeFailures(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: "Navigation preview" });
    await expect(nav).toBeVisible();
    await expect(nav.getByText("Vistaire", { exact: true })).toBeVisible();
    await expect(nav.getByText("Carte digitale premium")).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(9);
    for (const label of [
      "Accueil",
      "Carte",
      "Tarifs",
      "\u00c0 propos",
      "Contact"
    ]) {
      await expect(
        nav.getByRole("link", { name: label, exact: true })
      ).toBeVisible();
    }
    await expect(
      nav.getByRole("link", { name: "Tarifs", exact: true })
    ).toHaveAttribute("href", "/tarifs-menu-digital-restaurant");
    for (const label of ["FR", "EN"]) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
    }
    const appointmentCta = nav.getByRole("link", {
      name: /Prendre rendez-vous/
    });
    await expect(appointmentCta).toBeVisible();
    await expect(appointmentCta).toHaveAttribute(
      "href",
      "/prendre-rendez-vous"
    );
    await expect(appointmentCta).toHaveAccessibleName(
      "Prendre rendez-vous"
    );
    const decorativeArrow = appointmentCta.locator('[aria-hidden="true"]');
    await expect(decorativeArrow).toHaveCount(1);
    await expect(decorativeArrow).toHaveText("↗");
    await expect(decorativeArrow).toHaveAttribute("aria-hidden", "true");

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
      HERO_POSTER
    );
    await expect
      .poll(() =>
        video.evaluate((node) => new URL((node as HTMLVideoElement).currentSrc).pathname)
      )
      .toBe(DESKTOP_HERO_VIDEO);
    await expect(page.locator("[data-hero-media]")).toHaveAttribute(
      "data-hero-media",
      "video"
    );
    await expect(video).toHaveAttribute("data-hero-video-state", "playing");
    await expect
      .poll(() => video.evaluate((node) => (node as HTMLVideoElement).currentTime))
      .toBeGreaterThan(0.05);
    expect(runtime.heroVideoRequests).toContain(DESKTOP_HERO_VIDEO);
    expect(runtime.heroVideoRequests).not.toContain(MOBILE_HERO_VIDEO);

    await expectPromotedHeroUsableAcrossScroll(page, video);
    await scrollThroughLanding(page);
    await expectNoHorizontalOverflow(page);
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(runtime.modelRequests).toEqual([]);
    expect(runtime.menuAnalyticsRequests).toEqual([]);
    expect(runtime.consoleErrors).toEqual([]);
    expect(runtime.failedRequests).toEqual([]);
    expect(runtime.failedResponses).toEqual([]);
    expect(runtime.pageErrors).toEqual([]);
  });

  test("switches one accessible comparison preview at a time", async ({ page }) => {
    const runtime = collectRuntimeFailures(page);
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });

    const comparison = page.getByTestId("landing-comparison");
    await comparison.scrollIntoViewIfNeeded();
    const tabs = comparison.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs).toHaveText(["Maison \u00c9lyse", "Trouvable", "Sauge Noire"]);
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(comparison.locator('[data-active-preview="maison-elyse"]')).toHaveCount(
      1
    );
    await expect(
      comparison.locator('[data-preview-comparison="pdf-vs-digital"]')
    ).toHaveCount(1);
    await expect(
      comparison.locator('[data-public-menu-renderer="maison-elyse"]')
    ).toHaveCount(1);
    await expect(
      comparison.locator(
        '[data-landing-menu-renderer="maison-elyse"][data-menu-ui="maison-elyse"]'
      )
    ).toHaveCount(1);
    await expect(
      comparison.locator('[data-public-menu-renderer="trouvable"]')
    ).toHaveCount(0);
    await expect(
      comparison.locator('[data-public-menu-renderer="sauge-noire"]')
    ).toHaveCount(0);
    await expect(comparison.locator("[data-comparison-preview]")).toHaveCount(0);
    await expect(comparison.locator("iframe")).toHaveCount(0);
    await expect(
      comparison.locator(".stf__parent, [data-page-flip-fallback]")
    ).toHaveCount(0);
    await expectLoadedImages(
      comparison.locator('[data-public-menu-renderer="maison-elyse"] img')
    );
    const initialPayloadRequestCount = runtime.previewPayloadRequests.length;
    expect(initialPayloadRequestCount).toBeLessThanOrEqual(1);
    if (initialPayloadRequestCount === 1) {
      expect(runtime.previewPayloadRequests[0]).toContain(
        "/api/public/landing-menu-preview/maison-elyse?locale=fr"
      );
    }
    const initialSlider = comparison.getByRole("slider");
    await expect(initialSlider).toHaveAttribute("aria-valuenow", "50");

    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(comparison.locator('[data-active-preview="trouvable"]')).toHaveCount(1);
    await expect(
      comparison.locator('[data-public-menu-renderer="trouvable"]')
    ).toHaveCount(1, { timeout: LAZY_PREVIEW_TIMEOUT_MS });
    await expect(
      comparison.locator(
        '[data-landing-menu-renderer="trouvable"][data-menu-ui="trouvable"]'
      )
    ).toHaveCount(1);
    await expect(
      comparison.locator('[data-public-menu-renderer="maison-elyse"]')
    ).toHaveCount(0);
    await expect(
      comparison.locator('[data-public-menu-renderer="sauge-noire"]')
    ).toHaveCount(0);
    await expectLoadedImages(
      comparison.locator('[data-public-menu-renderer="trouvable"] img')
    );
    expect(runtime.previewPayloadRequests).toHaveLength(
      initialPayloadRequestCount + 1
    );
    expect(runtime.previewPayloadRequests.at(-1)).toContain(
      "/api/public/landing-menu-preview/trouvable?locale=fr"
    );
    await expect(
      comparison.locator('[data-preview-comparison="pdf-vs-digital"]')
    ).toHaveCount(1);
    await expect(comparison.getByRole("slider")).toHaveAttribute(
      "aria-valuenow",
      "50"
    );

    const landingLocationBeforeSauge = page.url();
    await tabs.nth(1).press("ArrowRight");
    await expect(tabs.nth(2)).toBeFocused();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(comparison.locator('[data-active-preview="sauge-noire"]')).toHaveCount(1);
    await expect(
      comparison.locator('[data-public-menu-renderer="sauge-noire"]')
    ).toHaveCount(1, { timeout: LAZY_PREVIEW_TIMEOUT_MS });
    await expect(
      comparison.locator(
        '[data-landing-menu-renderer="sauge-noire"][data-menu-ui="sauge-noire"]'
      )
    ).toHaveCount(1);
    await expect(
      comparison.locator('[data-public-menu-renderer="maison-elyse"]')
    ).toHaveCount(0);
    await expect(
      comparison.locator('[data-public-menu-renderer="trouvable"]')
    ).toHaveCount(0);
    await expect(
      comparison.locator('[data-public-menu-renderer="sauge-noire"]')
    ).toHaveAttribute("data-display-mode", "comparison-preview");
    await expectLoadedImages(
      comparison.locator('[data-public-menu-renderer="sauge-noire"] img')
    );
    await expectIndependentComparisonScrollRoots(comparison);
    expect(runtime.previewPayloadRequests).toHaveLength(
      initialPayloadRequestCount + 2
    );
    expect(runtime.previewPayloadRequests.at(-1)).toContain(
      "/api/public/landing-menu-preview/sauge-noire?locale=fr"
    );
    await expect(comparison.getByTestId("google-review-cta")).toHaveCount(0);
    expect(page.url()).toBe(landingLocationBeforeSauge);

    await tabs.nth(2).press("Home");
    await expect(tabs.nth(0)).toBeFocused();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

    const slider = comparison.getByRole("slider");
    await slider.focus();
    await slider.press("Home");
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    await slider.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "4");
    await slider.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
    await slider.press("Home");
    await slider.press("Shift+ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "10");
    await slider.press("Shift+ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "20");
    await slider.press("Shift+ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "30");
    await slider.press("Shift+ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "40");
    await slider.press("Shift+ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "50");
    const sliderBox = await slider.boundingBox();
    const comparisonBox = await comparison
      .locator('[data-preview-comparison="pdf-vs-digital"]')
      .boundingBox();
    expect(sliderBox).not.toBeNull();
    expect(comparisonBox).not.toBeNull();
    if (sliderBox && comparisonBox) {
      await page.mouse.move(
        sliderBox.x + sliderBox.width / 2,
        sliderBox.y + sliderBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        comparisonBox.x + comparisonBox.width * 0.25,
        sliderBox.y + sliderBox.height / 2
      );
      await page.mouse.up();
      await expect
        .poll(async () => Number(await slider.getAttribute("aria-valuenow")))
        .toBeLessThan(40);
    }

    await expectNoHorizontalOverflow(page);
    expect(runtime.modelRequests).toEqual([]);
    expect(runtime.menuAnalyticsRequests).toEqual([]);
    expect(runtime.consoleErrors).toEqual([]);
    expect(runtime.failedRequests).toEqual([]);
    expect(runtime.failedResponses).toEqual([]);
    expect(runtime.pageErrors).toEqual([]);
  });

  test("keeps the restaurant links real and bilingual", async ({ page }) => {
    await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });
    await expectSecureLandingMenuLinks(page);
    const experiences = page.getByTestId("landing-experiences");
    const frenchExperienceLinks = experiences.getByRole("link");
    await expect(frenchExperienceLinks).toHaveCount(3);
    for (const link of await frenchExperienceLinks.all()) {
      await expectAccessibleNewTabLink(
        link,
        "S\u2019ouvre dans un nouvel onglet.",
        "Opens in a new tab."
      );
    }
    await expect(
      experiences.getByRole("link", { name: /Maison Élyse/ })
    ).toHaveAttribute("href", "/menu/maison-elyse?lang=fr-CA");
    await expect(
      experiences.getByRole("link", { name: /Maison Élyse/ })
    ).toHaveAttribute("target", "_blank");
    await expect(
      experiences.getByRole("link", { name: /Maison Élyse/ })
    ).toHaveAttribute("rel", /noopener/);
    await expect(
      experiences.getByRole("link", { name: /Trouvable/ })
    ).toHaveAttribute("href", "/menu/trouvable?lang=fr-CA");
    await expect(
      experiences.getByRole("link", { name: /Trouvable/ })
    ).toHaveAttribute("target", "_blank");
    await expect(
      experiences.getByRole("link", { name: /Sauge Noire/ })
    ).toHaveAttribute("href", "/menu/sauge-noire?lang=fr-CA");
    await expect(
      experiences.getByRole("link", { name: /Sauge Noire/ })
    ).toHaveAttribute("target", "_blank");
    await expect(
      page.getByRole("link", { name: "Prendre rendez-vous" }).first()
    ).toHaveAttribute("href", "/prendre-rendez-vous");

    await page.goto(landingUrl("/en"), { waitUntil: "domcontentloaded" });
    await expectSecureLandingMenuLinks(page);
    const englishNavigation = page.getByRole("navigation", {
      name: "Main navigation"
    });
    await expect(
      englishNavigation.getByRole("link", { name: "Pricing", exact: true })
    ).toHaveAttribute("href", "/en/pricing-digital-restaurant-menu");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Make every dish tempting before the first bite."
      })
    ).toBeVisible();
    const englishExperiences = page.getByTestId("landing-experiences");
    const englishExperienceLinks = englishExperiences.getByRole("link");
    await expect(englishExperienceLinks).toHaveCount(3);
    for (const link of await englishExperienceLinks.all()) {
      await expectAccessibleNewTabLink(
        link,
        "Opens in a new tab.",
        "S\u2019ouvre dans un nouvel onglet."
      );
    }
    await expect(
      englishExperiences.getByRole("link", { name: /Maison Élyse/ })
    ).toHaveAttribute("href", "/menu/maison-elyse?lang=en-CA");
    await expect(
      englishExperiences.getByRole("link", { name: /Trouvable/ })
    ).toHaveAttribute("href", "/menu/trouvable?lang=en-CA");
    await expect(
      englishExperiences.getByRole("link", { name: /Sauge Noire/ })
    ).toHaveAttribute("href", "/menu/sauge-noire?lang=en-CA");
  });

  test("matches public menu markers with every active comparison renderer through real popups", async ({
    page
  }) => {
    const runtime = collectRuntimeFailures(page);
    await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });
    const comparison = page.getByTestId("landing-comparison");
    await comparison.scrollIntoViewIfNeeded();
    const tabs = comparison.getByRole("tab");
    const landingLocation = page.url();

    for (const [index, experience] of LANDING_EXPERIENCES.entries()) {
      await tabs.nth(index).click();
      await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
      await expect(
        comparison.locator(
          `[data-landing-menu-renderer="${experience.id}"][data-menu-ui="${experience.id}"]`
        )
      ).toHaveCount(1, { timeout: LAZY_PREVIEW_TIMEOUT_MS });
      await expect(
        comparison.locator("[data-public-menu-renderer]")
      ).toHaveCount(1);
      await expect(comparison.locator("[data-comparison-preview]")).toHaveCount(
        0
      );

      const link = comparison.getByRole("link", {
        name: /Ouvrir l’expérience complète/
      });
      const popup = await openRealPopup(page, link);
      try {
        await expectPopupRoute(
          popup,
          new RegExp(`^/menu/${experience.id}$`),
          "fr-CA"
        );
        await expect(
          popup.locator(
            `[data-menu-ui="${experience.id}"][data-public-menu-renderer="${experience.id}"]`
          )
        ).toBeVisible();
      } finally {
        await popup.close();
      }
      expect(page.url()).toBe(landingLocation);
      await expect(page.getByTestId("landing-comparison")).toBeVisible();
      await expect(
        comparison.locator(`[data-active-preview="${experience.id}"]`)
      ).toHaveCount(1);
    }

    expect(runtime.modelRequests).toEqual([]);
    expect(runtime.menuAnalyticsRequests).toEqual([]);
  });

  test("opens all three featured dishes in real renderer popups", async ({
    page
  }) => {
    await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });
    const landingDishes = page.getByTestId("landing-dishes");
    const cards = landingDishes.locator("[data-menu-slug]");
    await expect(cards).toHaveCount(3);

    for (const [index, experience] of LANDING_EXPERIENCES.entries()) {
      const card = cards.nth(index);
      await expect(card).toHaveAttribute("data-menu-slug", experience.id);
      const link = card.getByRole("link");
      const expectedName = (await card.locator("h3").textContent())?.trim() ?? "";
      const expectedDescription =
        (await card.locator("h3 + span").textContent())?.trim() ?? "";
      const expectedDishId = await card.getAttribute("data-dish-id");
      const popup = await openRealPopup(page, link);

      try {
        await expectPopupRoute(
          popup,
          new RegExp(`^/menu/${experience.id}/dishes/[^/]+$`),
          "fr-CA"
        );
        await expect(
          popup.locator(
            `[data-public-dish-renderer="${experience.id}"]`
          )
        ).toBeVisible();

        if (experience.id === "trouvable") {
          await expect(
            popup.locator('[data-public-dish-renderer="trouvable"]')
          ).toHaveAttribute("data-palette-source", "reference");
          await expect(popup.getByText(expectedName, { exact: true })).toBeVisible();
          await expect(
            popup.getByText(expectedDescription, { exact: true })
          ).toHaveCount(0);
          const detailsButton = popup.getByRole("button", {
            name: "Voir détails"
          });
          await expect
            .poll(async () => {
              await detailsButton.click();
              return detailsButton.getAttribute("aria-expanded");
            })
            .toBe("true");
          const detailSheet = popup.locator(
            '[role="dialog"][data-sheet-state="open"]'
          );
          await expect(detailSheet).toBeVisible();
          await expect(
            detailSheet.getByText(
              "Burrata, pesto vert et herbes fraiches.",
              { exact: true }
            )
          ).toHaveCount(1);
          expect(expectedDishId).toBeTruthy();
          await expect(
            popup.locator(
              '[data-public-dish-renderer="trouvable"] img[src*="/api/public/menu-dishes/"][src*="/photo"]'
            )
          ).toBeVisible();
          await expect(
            popup.locator('a[href^="/menu/trouvable"]').first()
          ).toHaveAttribute("href", "/menu/trouvable?lang=fr-CA");
          await expect(
            popup.locator(
              'main[data-theme][data-blueprint]:not([data-public-dish-renderer="trouvable"])'
            )
          ).toHaveCount(0);
          await expect(
            popup.locator(
              '[data-public-dish-renderer="maison-elyse"], [data-public-dish-renderer="sauge-noire"]'
            )
          ).toHaveCount(0);
        }
      } finally {
        await popup.close();
      }
      await expect(page.getByTestId("landing-dishes")).toBeVisible();
    }
  });

  test("renders English menu copy while localizing Maison dish names", async ({
    page
  }) => {
    await page.goto(landingUrl("/en"), { waitUntil: "domcontentloaded" });
    await expectSecureLandingMenuLinks(page);

    const comparison = page.getByTestId("landing-comparison");
    await comparison.scrollIntoViewIfNeeded();
    const tabs = comparison.getByRole("tab");
    const expectedEnglish = [
      {
        category: "Starters",
        categoryDescription: "Maison Elyse's current menu.",
        dish: "Fresh goat cheese ravioli & Monteregie honey",
        dishDescription:
          "Brown butter, preserved lemon, and garden herbs."
      },
      {
        category: "Mains",
        categoryDescription: "Trouvable's current menu.",
        dish: "Pesto Burrata Verde",
        dishDescription: "Burrata, green pesto, and fresh herbs."
      },
      {
        category: "First bites",
        categoryDescription:
          "Small plates, bites, and opening seasonal flavors to share.",
        dish: "Betterave sous la cendre",
        dishDescription:
          "Ash-roasted beetroot with smoked labneh, blackcurrant, pistachio, and raspberry vinegar."
      }
    ];

    for (const [index, experience] of LANDING_EXPERIENCES.entries()) {
      await tabs.nth(index).click();
      await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
      const active = comparison.locator(
        `[data-landing-menu-renderer="${experience.id}"][data-menu-ui="${experience.id}"][lang="en-CA"]`
      );
      await expect(active).toBeVisible({ timeout: LAZY_PREVIEW_TIMEOUT_MS });
      await expect(active).toHaveAttribute("data-menu-slug", experience.id);
      await expect(active).toHaveAttribute("data-preview-locale", "en-CA");
      await expect(active).toHaveAttribute("data-preview-status", "ready");
      await expect(active).toHaveAttribute("data-menu-active-locale", "en-CA");
      await expect(active).toHaveAttribute("data-translation-status", "up_to_date");
      await expect(comparison.getByText("Menu", { exact: true }).first()).toBeVisible();
      await expect(
        comparison.locator('[data-comparison-scroll-root="pdf"]')
      ).toHaveAttribute(
        "aria-label",
        new RegExp(`^Full PDF menu for (?:${experience.name.source})$`)
      );
      await expect(active.getByText(expectedEnglish[index].category).first()).toBeVisible({
        timeout: LAZY_PREVIEW_TIMEOUT_MS
      });
      await expect(active.getByText(expectedEnglish[index].dish).first()).toBeVisible({
        timeout: LAZY_PREVIEW_TIMEOUT_MS
      });

      const payloadResponse = await page.request.get(
        new URL(
          `/api/public/landing-menu-preview/${experience.id}?locale=en`,
          page.url()
        ).toString()
      );
      expect(payloadResponse.ok()).toBe(true);
      const payload = (await payloadResponse.json()) as {
        payload?: {
          locale?: string;
          menuSlug?: string;
          comparison?: {
            pdfSections?: unknown[];
            categoryTabs?: unknown[];
            categoryCards?: unknown[];
          };
          menuUi?: {
            menu?: {
              activeLocale?: string;
              translationStatus?: { status?: string };
              dishes?: Array<{
                category: string;
                categoryDescription?: string;
                categorySlug?: string;
                description: string;
                name: string;
              }>;
            };
          };
        };
      };
      expect(payload.payload?.locale).toBe("en");
      expect(payload.payload?.menuSlug).toBe(experience.id);
      expect(payload.payload?.menuUi?.menu?.activeLocale).toBe("en-CA");
      expect(payload.payload?.menuUi?.menu?.translationStatus?.status).toBe(
        "up_to_date"
      );
      expect(payload.payload?.comparison?.pdfSections?.length ?? 0).toBeGreaterThan(0);
      expect(payload.payload?.comparison?.categoryTabs?.length ?? 0).toBeGreaterThan(1);
      expect(payload.payload?.comparison?.categoryCards?.length ?? 0).toBeGreaterThan(0);
      expect(payload.payload?.menuUi?.menu?.dishes?.length ?? 0).toBeGreaterThan(0);
      expect(
        payload.payload?.menuUi?.menu?.dishes?.some(
          (dish) =>
            dish.category === "Current selection" ||
            dish.categoryDescription === "A real dish from the public menu" ||
            dish.categorySlug === "current"
        )
      ).toBe(false);
      const expectedDish = payload.payload?.menuUi?.menu?.dishes?.find(
        (dish) => dish.name === expectedEnglish[index].dish
      );
      expect(expectedDish).toEqual(
        expect.objectContaining({
          category: expectedEnglish[index].category,
          categoryDescription: expectedEnglish[index].categoryDescription,
          description: expectedEnglish[index].dishDescription
        })
      );
    }

    const dishes = page.getByTestId("landing-dishes");
    await expect(dishes.locator("[data-menu-slug]")).toHaveCount(3);
    const expectedEnglishFeaturedDescriptions = [
      [
        "Brown butter, preserved lemon, and garden herbs.",
        "Delicate, tender ravioli balanced by the sweetness of honey and the woodland notes of burnt rosemary."
      ],
      [
        "Burrata, green pesto, and fresh herbs.",
        "Basil pesto pasta, creamy burrata, Parmesan, and a drizzle of olive oil."
      ],
      [
        "Ash-roasted beetroot with smoked labneh, blackcurrant, pistachio, and raspberry vinegar."
      ]
    ];
    for (const [index, card] of (
      await dishes.locator("[data-menu-slug]").all()
    ).entries()) {
      await expect(card).toHaveAttribute("lang", "en-CA");
      await expect(card.locator("img")).toHaveAttribute(
        "alt",
        / from (Maison Élyse|Trouvable|Sauge Noire)$/
      );
      expect(expectedEnglishFeaturedDescriptions[index]).toContain(
        (await card.locator("h3 + span").textContent())?.trim()
      );
    }
    await expect(dishes).toContainText(
      "Fresh goat cheese ravioli & Monteregie honey"
    );
    await expect(dishes).toContainText("Pesto Burrata Verde");
    await expect(dishes).toContainText("Betterave sous la cendre");
    await expect(page.getByText("Open the full experience").first()).toBeVisible();

    const englishPageText = await page.locator("body").innerText();
    for (const forbiddenFrench of [
      "La carte du moment",
      "Herbier de la carte",
      "Menu PDF complet de",
      "Photo du plat",
      "Ouvrez la fiche actuelle",
      "dans la carte"
    ]) {
      expect(englishPageText).not.toContain(forbiddenFrench);
    }
  });

  test("links one current dish from each experience to its real detail page", async ({
    page
  }) => {
    await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });
    const dishes = page.getByTestId("landing-dishes");
    const dishLinks = dishes.getByRole("link");
    await expect(dishLinks).toHaveCount(3);
    await expect(dishLinks.nth(0)).toHaveAttribute(
      "href",
      /^\/menu\/maison-elyse\/dishes\/[^?]+\?lang=fr-CA$/
    );
    await expect(dishLinks.nth(1)).toHaveAttribute(
      "href",
      /^\/menu\/trouvable\/dishes\/[^?]+\?lang=fr-CA$/
    );
    const saugeHref = await dishLinks.nth(2).getAttribute("href");
    expect(saugeHref).not.toBeNull();
    const saugeUrl = new URL(saugeHref ?? "", "https://vistaire.test");
    expect(saugeUrl.pathname).toMatch(
      /^\/menu\/sauge-noire\/dishes\/[^/]+$/
    );
    expect(saugeUrl.searchParams.get("lang")).toBe("fr-CA");
    expect(saugeUrl.searchParams.get("view")).toBe("sauge-2");
  });

  test("loads all three featured dish photos without broken image dimensions", async ({
    page
  }) => {
    const runtime = collectRuntimeFailures(page);
    await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });
    const dishes = page.getByTestId("landing-dishes");
    await dishes.scrollIntoViewIfNeeded();
    const images = dishes.locator("img");
    await expect(images).toHaveCount(3);
    await expectLoadedImages(images, 3);
    expect(runtime.failedRequests).toEqual([]);
    expect(runtime.failedResponses).toEqual([]);
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
      await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });
      await scrollThroughLanding(page);
      await expectNoHorizontalOverflow(page);
      await expect(page.getByTestId("landing-comparison-phone")).toBeVisible();
    });
  }

  test("keeps the hero video looping when Save-Data is enabled", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true }
      });
    });
    await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });
    const video = page.locator("#landing-hero-video");
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute("preload", "metadata");
    await expect(video).toHaveAttribute("autoplay", "");
    await expect(video).toHaveAttribute("loop", "");
    await expect(video.locator("xpath=..").getByRole("button")).toHaveCount(0);
  });

  test("keeps the hero video loop configured with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });
    const video = page.locator("#landing-hero-video");
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute("autoplay", "");
    await expect(video).toHaveAttribute("loop", "");
    await expect(video.locator("xpath=..").getByRole("button")).toHaveCount(0);
    const transitionDuration = await page
      .getByTestId("landing-comparison")
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.001);
  });

  test("keeps the loop contract without a manual playback control", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("Autoplay refused", "NotAllowedError"));
    });
    await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });

    const video = page.locator("#landing-hero-video");
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute("autoplay", "");
    await expect(video).toHaveAttribute("loop", "");
    await expect(video.locator("xpath=..").getByRole("button")).toHaveCount(0);
    await expect(video).toHaveAttribute("poster", "/frames/menualive/frame_0200.webp");

    await page.goto(landingUrl("/en"), { waitUntil: "domcontentloaded" });
    await expect(video.locator("xpath=..").getByRole("button")).toHaveCount(0);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    test(`autoplays only the optimized mobile hero video at ${viewport.width}px`, async ({
      page
    }) => {
      const runtime = collectRuntimeFailures(page);
      await page.setViewportSize(viewport);
      await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });

      const video = page.locator("#landing-hero-video");
      await expect(video.locator("xpath=..").getByRole("button")).toHaveCount(0);
      await expect(video).toHaveAttribute("autoplay", "");
      await expect(video).toHaveAttribute("loop", "");
      await expect(video).toHaveAttribute("muted", "");
      await expect(video).toHaveAttribute("playsinline", "");
      await expect(video).toHaveAttribute("poster", HERO_POSTER);
      await expect
        .poll(() =>
          video.evaluate((node) => new URL((node as HTMLVideoElement).currentSrc).pathname)
        )
        .toBe(MOBILE_HERO_VIDEO);
      await expect(page.locator("[data-hero-media]")).toHaveAttribute(
        "data-hero-media",
        "video"
      );
      await expect(video).toHaveAttribute("data-hero-video-state", "playing");
      await expect
        .poll(() => video.evaluate((node) => (node as HTMLVideoElement).currentTime))
        .toBeGreaterThan(0.05);
      expect(runtime.heroVideoRequests).toContain(MOBILE_HERO_VIDEO);
      expect(runtime.heroVideoRequests).not.toContain(DESKTOP_HERO_VIDEO);

      await expectPromotedHeroUsableAcrossScroll(page, video);
      await expectNoHorizontalOverflow(page);
      await expect(page.locator("model-viewer")).toHaveCount(0);
      expect(runtime.modelRequests).toEqual([]);
      expect(runtime.consoleErrors).toEqual([]);
      expect(runtime.failedRequests).toEqual([]);
      expect(runtime.failedResponses).toEqual([]);
      expect(runtime.pageErrors).toEqual([]);
    });
  }

  test("keeps the slider usable in a real touch-enabled mobile context", async ({
    browser
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      locale: "fr-CA",
      storageState: privacyRejectedStorageState(
        process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
      ),
      viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();
    try {
      const runtime = collectRuntimeFailures(page);
      await page.goto(landingUrl(), { waitUntil: "domcontentloaded" });
      const comparison = page.getByTestId("landing-comparison");
      await comparison.scrollIntoViewIfNeeded();
      await expect(
        comparison.locator('[data-public-menu-renderer="maison-elyse"]')
      ).toHaveCount(1);
      const tabs = comparison.getByRole("tab");
      await expect
        .poll(async () => {
          await tabs.nth(2).click();
          return tabs.nth(2).getAttribute("aria-selected");
        })
        .toBe("true");
      await expect(
        comparison.locator('[data-public-menu-renderer="sauge-noire"]')
      ).toHaveCount(1, { timeout: LAZY_PREVIEW_TIMEOUT_MS });
      await expectIndependentComparisonScrollRoots(comparison);

      const slider = comparison.getByRole("slider");
      const handleBox = await slider.boundingBox();
      const frameBox = await comparison
        .locator('[data-preview-comparison="pdf-vs-digital"]')
        .boundingBox();
      expect(handleBox).not.toBeNull();
      expect(frameBox).not.toBeNull();
      if (handleBox && frameBox) {
        await performTouchGesture(
          page,
          {
            x: handleBox.x + handleBox.width / 2,
            y: handleBox.y + handleBox.height / 2
          },
          {
            x: frameBox.x + frameBox.width * 0.2,
            y: handleBox.y + handleBox.height / 2
          }
        );
        await expect
          .poll(async () => Number(await slider.getAttribute("aria-valuenow")))
          .toBeLessThan(35);

        await slider.press("Home");
        await slider.press("Shift+ArrowRight");
        await expect(slider).toHaveAttribute("aria-valuenow", "10");
        await slider.press("Shift+ArrowRight");
        await expect(slider).toHaveAttribute("aria-valuenow", "20");
        await slider.press("Shift+ArrowRight");
        await expect(slider).toHaveAttribute("aria-valuenow", "30");
        await slider.press("Shift+ArrowRight");
        await expect(slider).toHaveAttribute("aria-valuenow", "40");
        await slider.press("Shift+ArrowRight");
        await expect(slider).toHaveAttribute("aria-valuenow", "50");

        const pdfRoot = comparison.locator(
          '[data-comparison-scroll-root="pdf"]'
        );
        const digitalRoot = comparison.locator(
          '[data-comparison-scroll-root="digital"]'
        );
        const windowScrollBefore = await page.evaluate(() => window.scrollY);
        const pdfScrollBefore = await pdfRoot.evaluate(
          (element) => element.scrollTop
        );
        const digitalScrollBefore = await digitalRoot.evaluate(
          (element) => element.scrollTop
        );
        await performTouchGesture(
          page,
          {
            x: frameBox.x + frameBox.width * 0.25,
            y: frameBox.y + frameBox.height * 0.72
          },
          {
            x: frameBox.x + frameBox.width * 0.25,
            y: frameBox.y + frameBox.height * 0.3
          }
        );
        await expect
          .poll(() => pdfRoot.evaluate((element) => element.scrollTop))
          .toBeGreaterThan(pdfScrollBefore);

        await performTouchGesture(
          page,
          {
            x: frameBox.x + frameBox.width * 0.75,
            y: frameBox.y + frameBox.height * 0.72
          },
          {
            x: frameBox.x + frameBox.width * 0.75,
            y: frameBox.y + frameBox.height * 0.3
          }
        );
        await expect
          .poll(() => digitalRoot.evaluate((element) => element.scrollTop))
          .toBeGreaterThan(digitalScrollBefore);
        await expect
          .poll(() => page.evaluate(() => window.scrollY))
          .toBe(windowScrollBefore);
      }
      await expectNoHorizontalOverflow(page);
      expect(runtime.modelRequests).toEqual([]);
      expect(runtime.menuAnalyticsRequests).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
