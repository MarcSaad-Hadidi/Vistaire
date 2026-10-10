import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Isolate native document scrolling from GPU speed. The original GLB scene
// also receives separate real WebGL browser verification.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type.startsWith("webgl")
        ? null
        : Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
});

// Toolbar-height freezing is a touch/coarse-pointer contract, not a narrow
// desktop-window contract. Keep these inputs explicit in the relevant cases.
const touchTest = test.extend({ hasTouch: true });
const desktopTest = test.extend({ hasTouch: false, isMobile: false });

async function openJourney(page: Page, height = 820) {
  await page.setViewportSize({ width: 390, height });
  await page.goto("/#sustainability");
  await expect(page.locator(".world-fallback")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function geometry(page: Page) {
  return page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    world: document.querySelector<HTMLElement>(".world")!.clientHeight,
    macTitle: getComputedStyle(document.querySelector(".living-title")!)
      .fontSize,
    chapters: [...document.querySelectorAll<HTMLElement>("main > .chapter, footer.chapter")].map((el) => ({
      id: el.id,
      top: Math.round(el.getBoundingClientRect().top + scrollY),
      height: el.offsetHeight,
      stage: el.firstElementChild!.clientHeight,
    })),
  }));
}

test("light immersive controls keep readable nested actions, selection and AR help", async ({ page }) => {
  test.setTimeout(120_000);
  for (const scenario of [
    { path: "/", width: 390 },
    { path: "/en", width: 430 },
    { path: "/", width: 1440 },
  ]) {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await page.goto(scenario.path);
    await expect(page.locator(".world-fallback")).toBeVisible();
    const toggle = page.locator("[data-public-theme-toggle]").first();
    if (await toggle.getAttribute("aria-pressed") !== "true") await toggle.click();
    await expect(page.locator(".site-header")).toHaveCSS("color", "rgb(40, 37, 31)");
    const ar = page.locator(".grip-actions .ar-action");
    await page.locator("#grip").evaluate((element) => {
      const travel = (element as HTMLElement).offsetHeight - element.firstElementChild!.clientHeight;
      scrollTo({ top: element.getBoundingClientRect().top + scrollY + travel * 0.45, behavior: "instant" });
    });
    await expect(ar).toBeVisible();
    await expect(ar).toHaveCSS("color", "rgb(40, 37, 31)");
    await expect(ar).toHaveCSS("background-color", "rgb(238, 231, 217)");
    await ar.hover();
    await expect(ar).toHaveCSS("color", "rgb(255, 250, 240)");
    await expect(ar).toHaveCSS("background-color", "rgb(128, 96, 13)");
    await ar.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCSS("color", "rgb(40, 37, 31)");
    await expect(page.locator(".close-modal")).toHaveCSS("background-color", "rgb(255, 252, 245)");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator('.menu-demo-picker button[aria-pressed="true"]')).toHaveCSS("border-top-color", "rgb(128, 96, 13)");
    await expect(page.locator(".dish-zoom button").first()).toHaveCSS("border-top-color", "rgb(112, 103, 89)");
    expect(await page.locator(".rotation-range").evaluate((element) => getComputedStyle(element, "::before").borderTopColor)).toBe("rgb(112, 103, 89)");
    await expect(page.locator(".pricing-heading em")).toHaveCSS("color", "rgb(128, 96, 13)");
    await expect(page.locator(".pricing-faq [data-seo-faq-question]").first()).toHaveCSS("color", "rgb(40, 37, 31)");
    await expect(page.locator(".support-controls")).toHaveCSS("background-color", "rgb(255, 252, 245)");
    await expect(page.locator(".support-controls button")).toHaveCSS("color", "rgb(40, 37, 31)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    await toggle.click();
    await page.mouse.move(0, 0);
    await expect(ar).toHaveCSS("color", "rgb(248, 243, 232)");
    await expect(ar).toHaveCSS("background-color", "rgba(17, 17, 16, 0.91)");
    await expect(page.locator(".support-controls")).toHaveCSS("background-color", "rgb(17, 17, 16)");
    await expect(page.locator(".support-controls button")).toHaveCSS("color", "rgb(248, 243, 232)");
  }
});

for (const initialHeight of [820, 730]) {
  touchTest(`les barres mobiles ne déplacent aucun chapitre (${initialHeight}px)`, async ({
    page,
  }) => {
    await openJourney(page, initialHeight);
    expect(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches)).toBe(true);
    const before = await geometry(page);
    for (const height of [730, 820, 730, 820]) {
      await page.setViewportSize({ width: 390, height });
      await page.waitForTimeout(100);
      expect(await geometry(page)).toEqual(before);
    }
    if (initialHeight === 820) {
      for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await expect(page.locator(".opening-stage")).toHaveCSS("height", `${viewport.height}px`);
        await expect(page.locator(".world")).toHaveCSS("height", `${viewport.height}px`);
      }
    }
  });
}

desktopTest("rotation réelle et redimensionnement desktop restent responsive", async ({
  page,
}) => {
  await openJourney(page);
  expect(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches)).toBe(false);
  const portrait = await geometry(page);
  await page.setViewportSize({ width: 820, height: 390 });
  await expect(page.locator(".opening-stage")).toHaveCSS("height", "390px");
  await page.setViewportSize({ width: 390, height: 820 });
  await expect(page.locator(".opening-stage")).toHaveCSS("height", "820px");
  expect(await geometry(page)).toEqual(portrait);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".opening-stage")).toHaveCSS("height", "900px");
  await page.setViewportSize({ width: 1440, height: 720 });
  await expect(page.locator(".opening-stage")).toHaveCSS("height", "720px");
  // Reproduce the browser's separate width and height notifications, then a
  // height-only resize at the same narrow desktop width.
  for (const viewport of [
    { width: 390, height: 844 }, { width: 430, height: 844 },
    { width: 430, height: 932 }, { width: 430, height: 780 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".opening-stage")).toHaveCSS("height", `${viewport.height}px`);
    await expect(page.locator(".world")).toHaveCSS("height", `${viewport.height}px`);
  }
});

touchTest("contact maintenu : inversions et changements de hauteur du Mac au footer", async ({
  page,
}) => {
  await openJourney(page);
  expect(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches)).toBe(true);
  const before = await geometry(page);
  const cdp = await page.context().newCDPSession(page);
  const cases = [
    ["sustainability", ".living .scene-focus"],
    ["testimonies", ".experience-list a"],
    ["social-content", ".walkthrough-frame"],
    ["product", ".support-gesture"],
    ["open-weight", ".pricing-collection-image"],
    ["open-weight", '.pricing-faq [data-seo-faq-question][data-hydrated="true"]'],
    ["footer", ".footer-main h2"],
    ["footer", ".footer-scene"],
  ];
  for (const [id, selector] of cases) {
    await page.setViewportSize({ width: 390, height: 820 });
    await page.locator(`#${id}`).evaluate((el) => {
      const travel = (el as HTMLElement).offsetHeight - el.firstElementChild!.clientHeight;
      scrollTo({
        top: el.getBoundingClientRect().top + scrollY + travel * 0.45,
        behavior: "instant",
      });
    });
    if (id === "open-weight")
      await page
        .locator(selector)
        .first()
        .evaluate((el) => {
          scrollTo({
            top: el.getBoundingClientRect().top + scrollY - 300,
            behavior: "instant",
          });
        });
    await page.waitForTimeout(100);
    const box = await page.locator(selector).first().boundingBox();
    const x = Math.min(360, Math.max(30, box!.x + box!.width / 2));
    let y = Math.min(620, Math.max(190, box!.y + box!.height / 2));
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x, y }],
    });
    await page.waitForTimeout(650);
    for (const [stroke, destination] of [150, 620, 150, 620].entries()) {
      await page.setViewportSize({
        width: 390,
        height: stroke % 2 ? 820 : 730,
      });
      const start = y;
      const samples = [];
      for (let i = 1; i <= 6; i++) {
        y = start + ((destination - start) * i) / 6;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ id: 1, x: x + (i % 2), y }],
        });
        await page.waitForTimeout(35);
        samples.push(await page.evaluate(() => scrollY));
      }
      if (stroke > 0) {
        const expected = stroke % 2 ? -1 : 1;
        expect(
          (samples.at(-1)! - samples[0]) * expected,
          `${id}/${selector}, inversion ${stroke}`,
        ).toBeGreaterThan(200);
      }
      expect(await geometry(page)).toEqual(before);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(
      await page
        .locator("main *, footer.chapter *")
        .evaluateAll((els) =>
          els.filter((el) => el.scrollTop !== 0).map((el) => el.className),
        ),
    ).toEqual([]);
    await expect(page.locator(".menu-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});


test("le téléphone reste lisible sur 1,5 écran de défilement supplémentaire", async ({ page }) => {
  await openJourney(page);
  const opening = await page.locator(".opening-journey").evaluate((el) => {
    const stage = el.firstElementChild!.clientHeight;
    const distance = (name: string) => Number((el as HTMLElement).style.getPropertyValue(name)) * stage / 100;
    return {
      stage, height: (el as HTMLElement).offsetHeight,
      motion: distance("--opening-motion-vh"),
      hold: distance("--opening-phone-hold-vh"),
      release: distance("--opening-release-vh"),
    };
  });
  // Two 3.2-screen motion legs precede the unchanged phone reading hold.
  // The release allowance belongs to the following join, not to that motion.
  expect(opening.motion / opening.stage).toBeCloseTo(6.4, 2);
  expect(opening.release / opening.stage).toBeCloseTo(1.1, 2);
  expect(Math.abs(opening.height - opening.stage - opening.motion - opening.hold - opening.release)).toBeLessThanOrEqual(1);
  expect(opening.hold / opening.stage).toBeGreaterThanOrEqual(1.5);
  for (const holdProgress of [0.05, 0.5, 0.95]) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), opening.motion + opening.hold * holdProgress);
    await expect(page.locator("html")).toHaveAttribute("data-chapter", "wearable");
    await expect(page.locator("#wearable")).toHaveCSS("opacity", "1");
    await expect(page.locator("#wearable")).toHaveAttribute("aria-hidden", "false");
    expect(await page.locator(".opening-stage").evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
    expect(await page.locator("#features").evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(opening.stage);
  }
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), opening.height);
  await expect(page.locator("html")).toHaveAttribute("data-chapter", "features");
});


test("la scène contact est le seul footer et termine exactement la page FR/EN", async ({ page }) => {
  for (const locale of ["fr", "en"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(locale === "fr" ? "/" : "/en");
    await expect(page.locator(".world-fallback")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    const footer = page.getByRole("contentinfo");
    await expect(footer).toHaveCount(1);
    await expect(footer).toHaveAttribute("id", "footer");
    await expect(page.locator("main footer, .public-footer-wrap")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-chapter", "footer");
    await footer.locator("#footer-title").scrollIntoViewIfNeeded();
    await expect(footer.locator("#footer-title")).toBeInViewport();
    await expect(footer.locator(`.footer-main a[href="${locale === "fr" ? "/prendre-rendez-vous" : "/en/book-a-call"}"]`)).toBeVisible();
    for (const link of await footer.locator("[data-footer-navigation] a").all()) {
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport();
      expect(await link.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    }
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect(footer.locator('a[href="mailto:contact@vistaire.ca"]')).toBeInViewport();
    await expect(footer.locator(".footer-bottom a").last()).toBeInViewport();
    const end = await footer.evaluate(el => ({
      bottom: el.getBoundingClientRect().bottom + scrollY,
      documentHeight: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(Math.abs(end.bottom - end.documentHeight)).toBeLessThanOrEqual(1);
    expect(end.overflow).toBeLessThanOrEqual(1);
  }
});

test("le premier chargement mobile utilise le film portrait et garde les commandes accessibles", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(page.locator(".fallback-film")).toHaveAttribute("src", /cinematic-portrait/);
  const header = page.locator(".site-header");
  for (const language of ["FR", "EN"]) {
    await expect(header.locator("[data-public-controls] a").filter({ hasText: new RegExp(`^${language}$`) })).toBeVisible();
  }
  await header.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.locator(".menu-toggle")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".menu-toggle")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu-toggle")).toHaveAttribute("aria-expanded", "false");
  const boxes = await header.locator("a, button").evaluateAll(elements => elements
    .filter(el => el.getBoundingClientRect().width > 0)
    .map(el => ({ left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, height: el.getBoundingClientRect().height })));
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(320);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});


test("les séquences allongées gardent des pauses lisibles et un rail réversible", async ({ page }) => {
  await openJourney(page);
  for (const [id, expectedTravel] of [["features", 6.2], ["encryption", 6.2], ["grip", 6.2], ["sustainability", 6.2], ["testimonies", 6.2], ["social-content", 6.2], ["product", 6.2]] as const) {
    const ratio = await page.locator(`#${id}`).evaluate(el => {
      const stage = el.firstElementChild!.clientHeight;
      return ((el as HTMLElement).offsetHeight - stage) / stage;
    });
    expect(ratio).toBeCloseTo(expectedTravel, 2);
  }
  const social = page.locator("#social-content");
  const rail = page.locator(".social-rail");
  const at = async (progress: number) => {
    await social.evaluate((el, progress) => scrollTo({
      top: el.getBoundingClientRect().top + scrollY + ((el as HTMLElement).offsetHeight - el.firstElementChild!.clientHeight) * progress,
      behavior: "instant",
    }), progress);
  };
  const railProgress = () => rail.evaluate(el => Number(getComputedStyle(el).getPropertyValue("--rail-progress")));
  for (const [progress, expected] of [[0.1, 0], [0.24, 0], [0.3735483871, 0.5], [0.5, 1], [0.6264516129, 1.5], [0.9, 2], [1, 2], [0.6264516129, 1.5], [0.5, 1], [0.3735483871, 0.5], [0.1, 0]]) {
    await at(progress);
    await expect.poll(railProgress).toBeCloseTo(expected, 2);
  }
  for (let index = 0; index < 3; index++) {
    await page.locator(".social-pager button").nth(index).click();
    await expect.poll(railProgress).toBe(index);
    await expect(page.locator(".social-pager button").nth(index)).toHaveAttribute("aria-current", "true");
    const videos = page.locator("video[data-demo]");
    await expect(videos.nth(index)).toHaveJSProperty("playbackRate", 1);
    for (let other = 0; other < 3; other++) {
      if (other !== index) await expect(videos.nth(other)).toHaveJSProperty("paused", true);
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const video of await page.locator("video[data-demo]").all()) {
    await expect(video).toHaveJSProperty("paused", true);
  }
  await at(0.4);
  await expect.poll(railProgress).toBe(1);
});

test("un seul guide accueille le visiteur puis laisse explorer sans se répéter", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, message] of [["/", "Faites défiler pour découvrir"], ["/en", "Scroll to discover"]]) {
    await page.goto(path);
    await expect(page.locator(".world-fallback")).toBeVisible();
    const guide = page.locator("[data-scroll-guide]");
    await expect(guide).toHaveCount(1);
    await expect(page.locator(".chapter .scroll-hint")).toHaveCount(0);
    await expect(guide).toHaveAttribute("aria-hidden", "false");
    await expect(guide).toContainText(message);
    await expect(guide).toHaveCSS("pointer-events", "none");
    await page.evaluate(() => scrollTo({ top: 12, behavior: "instant" }));
    await expect(guide).toHaveAttribute("aria-hidden", "false");
    await page.evaluate(() => scrollTo({ top: 200, behavior: "instant" }));
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    // Observe a genuine idle interval: discovering native scrolling never
    // schedules a reminder or resets the guide when the visitor returns.
    await page.waitForTimeout(1200);
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.locator("[data-public-theme-toggle]").click();
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect(page.locator("html")).toHaveAttribute("data-chapter", "footer");
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.goto(path);
    await expect(guide).toHaveAttribute("aria-hidden", "false");
    await page.locator(".menu-toggle").click();
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.keyboard.press("Escape");
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.goto(path);
    await expect(guide).toHaveAttribute("aria-hidden", "false");
    await page.locator('.skip-link[href="#ai"]').focus();
    await page.keyboard.press("Tab"); // First header control, independent of document autofocus
    await expect(page.locator(".brand")).toBeFocused();
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.goto(path);
    await expect(guide).toHaveAttribute("aria-hidden", "false");
    await page.locator("#hero .text-link").click();
    await expect(page).toHaveURL(path === "/" ? /\/demo$/ : /\/en\/vistaire-menu$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto(`${path}#product`);
    await expect(page.locator("html")).toHaveAttribute("data-chapter", "product");
    await expect(guide).toHaveCount(1);
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(guide).toHaveCSS("transition-duration", "0s");
  }
});

for (const [path, discovery, pricing, booking, language] of [
  ["/", "/demo", "/tarifs-menu-digital-restaurant", "/prendre-rendez-vous", "fr-CA"],
  ["/en", "/en/vistaire-menu", "/en/pricing-digital-restaurant-menu", "/en/book-a-call", "en-CA"],
] as const) {
  test(`${path} links marketing CTAs to real experiences instead of generic dialogs`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("#hero .text-link")).toHaveAttribute("href", discovery);
    await expect(page.locator("#ai .side-copy .action")).toHaveAttribute("href", discovery);
    for (const [index, restaurant] of ["maison-elyse", "trouvable", "sauge-noire"].entries()) {
      const expectedMenu = `/menu/${restaurant}?lang=${language}`;
      await expect(page.locator("#testimonies .experience-list a").nth(index)).toHaveAttribute("href", expectedMenu);
      await expect(page.locator("#social-content .social-bottom .action").nth(index)).toHaveAttribute("href", expectedMenu);
    }
    await expect(page.locator("#product .collection-details .action")).toHaveAttribute("href", pricing);
    await expect(page.locator("#open-weight .pricing-summary-action .pricing-cta")).toHaveAttribute("href", booking);
    await expect(page.locator("#open-weight .pricing-closing .pricing-cta")).toHaveAttribute("href", booking);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

// The fallback uses the same measured director as WebGL. These assertions
// cover page geometry, copy and native input, not rendered 3D smoothness.
for (const viewport of [
  { width: 1280, height: 800 }, { width: 1440, height: 900 },
  { width: 1920, height: 1080 }, { width: 2560, height: 1440 },
  { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 },
]) {
  test(`all chapter boundaries use measured continuous windows at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    for (const path of ['/', '/en']) {
      await page.goto(path);
      await expect(page.locator('.world-fallback')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const chapters = page.locator('.chapter');
      await expect(chapters).toHaveCount(12);
      await expect(page.locator('#wearable')).toHaveAttribute('data-exit-start', /\d/);
      const windows = await chapters.evaluateAll(elements => elements
        .filter(el => (el as HTMLElement).dataset.exitStart)
        .map(el => ({
          from: el.id,
          to: (el as HTMLElement).dataset.exitTo!,
          start: Number((el as HTMLElement).dataset.exitStart),
          end: Number((el as HTMLElement).dataset.exitEnd),
          stage: document.querySelector('.opening-stage')!.clientHeight,
        })));
      expect(windows).toHaveLength(9);
      const distances = await page.locator('.chapter').evaluateAll(elements => elements.slice(3, 10).map(el => {
        const stage = el.firstElementChild!.clientHeight;
        return ((el as HTMLElement).offsetHeight - stage) / stage;
      }));
      for (const distance of distances) expect(distance).toBeCloseTo(6.2, 2);
      const openingDistance = await page.locator('.opening-journey').evaluate(el => ({
        top: el.getBoundingClientRect().top + scrollY,
        motion: Number((el as HTMLElement).style.getPropertyValue('--opening-motion-vh')) * el.firstElementChild!.clientHeight / 100,
      }));
      expect((windows[0].start - openingDistance.top - openingDistance.motion) / windows[0].stage).toBeCloseTo(1.5, 2);

      for (const window of windows) {
        expect((window.end - window.start) / window.stage).toBeCloseTo(window.to === 'footer' ? Math.min(3.2, (window.end - windows.at(-2)!.end) / window.stage) : 3.2, 6);
        const sample = async (fraction: number) => page.evaluate(async ({ window, fraction }) => {
          scrollTo({ top: window.start + (window.end - window.start) * fraction, behavior: 'instant' });
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          const world = document.querySelector<HTMLElement>('.world')!;
          return {
            transition: world.dataset.transition,
            progress: Number(world.dataset.transitionProgress),
            opacity: Number(getComputedStyle(document.getElementById(window.to)!).getPropertyValue('--copy-opacity') || 1),
          };
        }, { window, fraction });
        const forward = [];
        for (const fraction of [0.05, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 0.95]) {
          const state = await sample(fraction);
          expect(state.transition).toBe(`${window.from}:${window.to}`);
          expect(state.progress).toBeCloseTo(fraction, 2);
          expect(state.opacity).toBeGreaterThanOrEqual(0);
          expect(state.opacity).toBeLessThanOrEqual(1);
          forward.push(state);
        }
        const reverse = [];
        for (const fraction of [0.95, 0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125, 0.05]) reverse.push(await sample(fraction));
        expect(reverse.reverse()).toEqual(forward);
      }
      // Measure actual text coordinates around sticky pin/release, not just
      // configuration values. Pricing/footer deliberately keep native flow.
      for (const id of ['features', 'encryption', 'grip', 'sustainability', 'testimonies', 'social-content', 'product']) {
        const chapter = page.locator(`#${id}`);
        const bounds = await chapter.evaluate(el => ({ top: el.getBoundingClientRect().top + scrollY, travel: (el as HTMLElement).offsetHeight - el.firstElementChild!.clientHeight }));
        for (const seam of [bounds.top, bounds.top + bounds.travel]) {
          const positions = [];
          for (const delta of [-2, 0, 2]) positions.push(await chapter.evaluate(async (el, y) => {
            scrollTo({ top: y, behavior: 'instant' });
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            return { stage: el.firstElementChild!.getBoundingClientRect().top, text: el.querySelector('h2,h3,p')!.getBoundingClientRect().top };
          }, seam + delta));
          for (const position of positions) expect(Math.abs(position.stage), `${id}: sticky compensation`).toBeLessThan(1.1);
          const before = (positions[1].text - positions[0].text) / 2;
          const after = (positions[2].text - positions[1].text) / 2;
          expect(Math.abs(after - before), `${id}: text velocity at pin/release`).toBeLessThan(0.04);
        }
      }
      // Wheel deltas remain native, including coarse mouse-wheel jumps.
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, viewport.height * 4);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(viewport.height * 3);
      await page.mouse.wheel(0, -viewport.height * 4);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(viewport.height);
      const footer = page.locator('#footer');
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await expect(page.locator('html')).toHaveAttribute('data-chapter', 'footer');
      expect(await footer.evaluate(el => Math.abs(el.getBoundingClientRect().bottom + scrollY - document.documentElement.scrollHeight))).toBeLessThanOrEqual(1);
      await page.goto(`${path}#product`);
      await expect(page.locator('.world-fallback')).toBeVisible();
      await expect(page.locator('#product')).toHaveJSProperty('inert', false);
      await expect.poll(() => page.locator('#product').evaluate(el => Number(getComputedStyle(el).getPropertyValue('--copy-opacity')))).toBeCloseTo(1, 3);
    }
  });
}

test('short landscape and zoom-sized viewports reserve a real food frame and reachable controls', async ({ page }, testInfo) => {
  for (const viewport of [{ width: 844, height: 390 }, { width: 1337, height: 591 }]) {
    // These are independent deep-link layouts; avoid same-URL fragment reuse.
    // Live viewport resizing is covered by the real-WebGL zoom regression.
    await page.goto('about:blank');
    await page.setViewportSize(viewport);
    const response = await page.goto('/#grip');
    try {
      await expect(page.locator('.world-fallback')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // Wait for App's semantic arrival after font/layout updates before
      // reading geometry; a native hash jump alone does not establish it.
      await expect(page.locator('html')).toHaveAttribute('data-chapter', 'grip');
      await expect(page.locator('#grip')).toHaveJSProperty('inert', false);
      await expect.poll(() => page.locator('#grip').evaluate(el => Number(getComputedStyle(el).getPropertyValue('--copy-opacity')))).toBeCloseTo(1, 3);
      const geometry = await page.locator('#grip').evaluate(el => {
        const focus = el.querySelector('.scene-focus')!.getBoundingClientRect();
        return { focus: { width: focus.width, height: focus.height, top: focus.top, bottom: focus.bottom }, controls: [...el.querySelectorAll('.rotation-control,.grip-actions,.dish-switch')].map(control => { const r = control.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, right: r.right }; }) };
      });
      expect(geometry.focus.height).toBeGreaterThanOrEqual(160);
      expect(geometry.focus.width).toBeGreaterThanOrEqual(220);
      expect(geometry.focus.top).toBeGreaterThanOrEqual(60);
      expect(geometry.focus.bottom).toBeLessThanOrEqual(viewport.height + 1);
      for (const control of geometry.controls) {
        expect(control.top).toBeGreaterThanOrEqual(60);
        expect(control.bottom).toBeLessThanOrEqual(viewport.height + 1);
        expect(control.right).toBeLessThanOrEqual(viewport.width);
      }
    } catch (error) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let snapshot = null;
      try {
        snapshot = await Promise.race([
          page.evaluate(() => {
            const grip = document.querySelector<HTMLElement>('#grip');
            const rect = (element: Element | null | undefined) => element?.getBoundingClientRect().toJSON() ?? null;
            return { hash: location.hash, scrollY, viewport: { width: innerWidth, height: innerHeight }, chapter: document.documentElement.dataset.chapter,
              section: rect(grip), stage: rect(grip?.firstElementChild), focus: rect(grip?.querySelector('.scene-focus')),
              copyOpacity: grip ? getComputedStyle(grip).getPropertyValue('--copy-opacity') : null, inert: grip?.inert };
          }),
          new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 2_000); }),
        ]);
      } catch { /* Keep the original failure if the document is unavailable. */ }
      finally { clearTimeout(timer); }
      try {
        const artifact = testInfo.outputPath('rendered-landscape-telemetry.json');
        await Promise.race([
          (async () => {
            await writeFile(artifact, JSON.stringify({ requestedViewport: viewport, navigationStatus: response?.status() ?? null, snapshot }, null, 2));
            await testInfo.attach('landscape-failure-geometry', { path: artifact, contentType: 'application/json' });
          })(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('landscape diagnostic persistence exceeded 2s')), 2_000); }),
        ]);
      } catch (diagnosticError) { console.warn('Could not preserve landscape failure diagnostics:', diagnosticError); }
      finally { clearTimeout(timer); }
      throw error;
    }
  }
});
