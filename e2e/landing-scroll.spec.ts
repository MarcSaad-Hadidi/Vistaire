import { test as base, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// User navigation and guide flows exercise the healthy real renderer.
const test = base.extend({
  launchOptions: async ({ browserName }, provideOptions) => {
    await provideOptions(browserName === 'chromium'
      ? { args: ['--use-angle=swiftshader', '--use-gl=angle'] }
      : {});
  },
});

// Isolate DOM geometry/ARIA/native scrolling from GPU speed. Only these tests
// dismiss the verified failure dialog through the test-only DOM API; they make
// no claim that the failed renderer is a usable production experience.
const domTest = base.extend({
  page: async ({ page }, providePage) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        return type.startsWith("webgl") ? null : Reflect.apply(getContext, this, [type, ...args]);
      } as typeof getContext;
    });
    await providePage(page);
  },
});
async function exposeDomLayout(page: Page) {
  const failure = page.getByRole('alertdialog');
  await expect(failure).toBeVisible();
  await failure.evaluate((dialog: HTMLDialogElement) => dialog.close());
  await expect(failure).toBeHidden();
}
async function waitForScene(page: Page) {
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
  await expect(page.locator('.preloader, [role="alertdialog"]')).toHaveCount(0);
}

// Toolbar-height freezing is a touch/coarse-pointer contract, not a narrow
// desktop-window contract. Keep these inputs explicit in the relevant cases.
const touchTest = domTest.extend({ hasTouch: true });
const desktopTest = domTest.extend({ hasTouch: false, isMobile: false });

for (const route of ['/', '/en']) for (const width of [390, 430]) {
  touchTest(`isolated DOM: Features keeps a stable natural reading frame across three cards at ${width}px ${route}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await exposeDomLayout(page);
    await page.evaluate(() => document.fonts.ready);
    const samples: Array<{ index: number; title: string; focus: number[]; cardHeight: number; contentFits: boolean; cardFitsStage: boolean }> = [];
    try {
      for (const [index, fraction] of [0.125, 0.5, 0.875].entries()) {
        await page.locator('#features').evaluate((chapter, fraction) => {
          const stage = chapter.querySelector<HTMLElement>('.stage')!;
          const top = chapter.getBoundingClientRect().top + scrollY;
          scrollTo({ top: top + stage.clientHeight * (1.1 + 8 * fraction), behavior: 'instant' });
        }, fraction);
        await expect(page.locator('#features .feature-number')).toHaveText(`0${index + 1}`);
        const heading = page.locator('#features .feature-card').getByRole('heading', { level: 3 });
        await expect(heading).toHaveCount(1);
        const title = await heading.innerText();
        const geometry = await page.locator('#features').evaluate(chapter => {
          const stage = chapter.querySelector('.stage')!.getBoundingClientRect();
          const focus = chapter.querySelector('.scene-focus')!.getBoundingClientRect();
          const card = chapter.querySelector<HTMLElement>('.feature-card')!;
          const bounds = card.getBoundingClientRect();
          const content = [...card.querySelectorAll<HTMLElement>('h3, p, a, button')]
            .filter(element => !element.closest('[aria-hidden="true"]') && getComputedStyle(element).visibility !== 'hidden');
          return { focus: [focus.left - stage.left, focus.top - stage.top, focus.width, focus.height],
            cardHeight: bounds.height,
            cardFitsStage: bounds.left >= stage.left - 0.5 && bounds.right <= stage.right + 0.5
              && bounds.top >= stage.top - 0.5 && bounds.bottom <= stage.bottom + 0.5,
            contentFits: content.length > 0 && content.every(element => {
              const box = element.getBoundingClientRect();
              return box.left >= bounds.left - 0.5 && box.right <= bounds.right + 0.5
                && box.top >= bounds.top - 0.5 && box.bottom <= bounds.bottom + 0.5;
            }),
          };
        });
        samples.push({ index, title, ...geometry });
      }
      expect(new Set(samples.map(sample => sample.title)).size).toBe(3);
      for (const sample of samples) {
        expect(sample.contentFits, `card ${sample.index}: natural copy remains inside card`).toBe(true);
        expect(sample.cardFitsStage, `card ${sample.index}: card remains inside unclipped stage`).toBe(true);
        expect(sample.focus[2], `card ${sample.index}: positive focus width`).toBeGreaterThan(0);
        expect(sample.focus[3], `card ${sample.index}: positive focus height`).toBeGreaterThan(0);
      }
      for (const axis of [0, 1, 2, 3]) {
        const values = samples.map(sample => sample.focus[axis]);
        expect(Math.max(...values) - Math.min(...values), `focus axis ${axis}: text replacement must not move the camera frame`).toBeLessThanOrEqual(0.5);
      }
      const heights = samples.map(sample => sample.cardHeight);
      expect(Math.max(...heights) - Math.min(...heights), 'card keeps the natural maximum copy envelope').toBeLessThanOrEqual(0.5);
    } finally {
      const evidence = testInfo.outputPath('features-reading-frame.json');
      await writeFile(evidence, JSON.stringify({ route, width, samples }, null, 2));
      await testInfo.attach('features-reading-frame', { path: evidence, contentType: 'application/json' });
    }
  });
}

async function openJourney(page: Page, height = 820) {
  await page.setViewportSize({ width: 390, height });
  await page.goto("/#sustainability");
  await exposeDomLayout(page);
  await page.evaluate(() => document.fonts.ready);
}

async function geometry(page: Page) {
  return page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    journeyVH: document.documentElement.style.getPropertyValue("--vistaire-journey-vh"),
    sceneVH: document.documentElement.style.getPropertyValue("--vistaire-scene-vh"),
    macTitle: getComputedStyle(document.querySelector(".living-title")!)
      .fontSize,
    chapters: [...document.querySelectorAll<HTMLElement>("main > .chapter, footer.chapter")].map((el) => ({
      id: el.id,
      top: Math.round(el.getBoundingClientRect().top + scrollY),
      height: el.offsetHeight,
      stage: Number.parseFloat(document.documentElement.style.getPropertyValue('--vistaire-journey-vh')) * 100,
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
    await waitForScene(page);
    await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
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
    await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
    await expect(toggle).toBeVisible();
    await expect(page.locator('.menu-demo-picker button[aria-pressed="true"]')).toHaveCSS("border-top-color", "rgb(128, 96, 13)");
    await expect(page.locator(".dish-zoom button").first()).toHaveCSS("border-top-color", "rgb(112, 103, 89)");
    expect(await page.locator(".rotation-range").evaluate((element) => getComputedStyle(element, "::before").borderTopColor)).toBe("rgb(112, 103, 89)");
    // The new on-photo heading uses the published darker light-theme emphasis.
    await expect(page.locator("#pricing-stage-title em")).toHaveCSS("color", "rgb(109, 80, 8)");
    await expect(page.locator(".landing-faq [data-seo-faq-question]").first()).toHaveCSS("color", "rgb(40, 37, 31)");
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

touchTest("isolated DOM: native vertical panning is locked in scenes but restored for pricing", async ({ page }) => {
  await openJourney(page);
  const main = page.locator("main#content");
  await expect(main).toHaveClass(/cinematic-touch-lock/);
  await expect(main).toHaveCSS("touch-action", "pinch-zoom");
  const heightBefore = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.locator("#open-weight").evaluate(el => {
    // The opening part of pricing is still a cinematic phone handoff.
    // Its middle is the native offer reading area.
    scrollTo({ top: el.getBoundingClientRect().top + scrollY + el.getBoundingClientRect().height * 0.5, behavior: "instant" });
  });
  await expect(main).not.toHaveClass(/cinematic-touch-lock/);
  await expect(main).toHaveCSS("touch-action", "auto");
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(main).toHaveClass(/cinematic-touch-lock/);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(heightBefore);
});

for (const initialHeight of [820, 730]) {
  touchTest(`isolated DOM: les barres mobiles ne déplacent aucun chapitre (${initialHeight}px)`, async ({
    page,
  }) => {
    await openJourney(page, initialHeight);
    expect(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches)).toBe(true);
    const before = await geometry(page);
    for (const height of [730, 820, 730, 820]) {
      await page.setViewportSize({ width: 390, height });
      await page.waitForTimeout(100);
      expect(await geometry(page)).toEqual(before);
      // Toolbar growth must fill the newly visible viewport without moving
      // the frozen chapter/stage geometry above.
      const coverage = await page.locator(".world").evaluate(el => ({
        top: el.getBoundingClientRect().top,
        bottom: el.getBoundingClientRect().bottom,
        viewport: innerHeight,
      }));
      expect(coverage.top).toBeLessThanOrEqual(0);
      expect(coverage.bottom).toBeGreaterThanOrEqual(coverage.viewport);
      const stages = await page.evaluate(() => ({
        visible: innerHeight,
        opening: document.querySelector('.opening-stage')!.getBoundingClientRect().height,
        chapter: document.querySelector('#sustainability > .stage')!.getBoundingClientRect().height,
      }));
      const frozen = Number.parseFloat(before.journeyVH) * 100;
      expect(stages.opening).toBeCloseTo(frozen, 0);
      expect(stages.chapter).toBeCloseTo(frozen, 0);
      // Growing sticky DOM boxes to 100dvh would change the real scroll
      // distances while browser bars collapse, even if the backing room fills.
    }
    if (initialHeight === 820) {
      for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await expect.poll(async () => page.evaluate(() => {
          const size = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().height;
          return Math.max(Math.abs(size(".opening-stage") - innerHeight), Math.abs(size(".world") - innerHeight));
        })).toBeLessThanOrEqual(1);
      }
    }
  });
}

desktopTest("isolated DOM: rotation réelle et redimensionnement desktop restent responsive", async ({
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

touchTest("isolated DOM: contact maintenu : inversions et changements de hauteur du Mac au footer", async ({
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
    ["open-weight", ".pricing-phone-viewport"],
    ["open-weight", '.landing-faq [data-seo-faq-question][data-hydrated="true"]'],
    ["footer", "[data-footer-navigation] h3"],
    ["footer", ".footer-bottom"],
  ];
  for (const [id, selector] of cases) {
    const target = page.locator(selector).first();
    const phoneReader = selector === ".pricing-phone-viewport";
    const nativeClosing = id === "footer" || selector.startsWith(".landing-faq");
    await page.setViewportSize({ width: 390, height: 820 });
    await page.locator(`#${id}`).evaluate((el) => {
      const travel = (el as HTMLElement).offsetHeight - el.firstElementChild!.clientHeight;
      scrollTo({
        top: el.getBoundingClientRect().top + scrollY + travel * 0.45,
        behavior: "instant",
      });
    });
    if (phoneReader) {
      // The fixed phone portal mirrors document scroll. Use its keyboard
      // endpoints to enter the middle of the real reading range.
      await expect(target).toBeVisible();
      await expect(target).toHaveCSS("overflow-y", "hidden");
      await page.locator(".pricing-offer-card").last().focus();
      await target.focus();
      await page.keyboard.press("Home");
      await expect.poll(() => target.evaluate(el => el.scrollTop)).toBeLessThan(1);
      const start = await page.evaluate(() => scrollY);
      await page.keyboard.press("End");
      await expect.poll(() => target.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThanOrEqual(1);
      const end = await page.evaluate(() => scrollY);
      expect(end).toBeGreaterThan(start);
      await page.evaluate(y => scrollTo({ top: y, behavior: "instant" }), (start + end) / 2);
    } else if (nativeClosing) {
      await target.evaluate((el) => {
        scrollTo({
          top: el.getBoundingClientRect().top + scrollY - 300,
          behavior: "instant",
        });
      });
    }
    await page.waitForTimeout(100);
    await expect(target).toBeInViewport();
    const box = await target.boundingBox();
    const x = Math.min(360, Math.max(30, box!.x + box!.width / 2));
    let y = Math.min(790, Math.max(190, box!.y + box!.height / 2));
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
        samples.push(await target.evaluate(el => ({
          pageY: scrollY,
          readerY: el.scrollTop,
          top: el.getBoundingClientRect().top,
        })));
      }
      if (stroke > 0) {
        const expected = stroke % 2 ? -1 : 1;
        expect(
          (samples.at(-1)!.pageY - samples[0].pageY) * expected,
          `${id}/${selector}, inversion ${stroke}`,
        ).toBeGreaterThan(200);
        if (phoneReader) {
          expect(
            (samples.at(-1)!.readerY - samples[0].readerY) * expected,
            `phone reading follows document inversion ${stroke}`,
          ).toBeGreaterThan(0);
        }
        if (nativeClosing) {
          expect(Math.abs(
            samples.at(-1)!.top - samples[0].top
              + samples.at(-1)!.pageY - samples[0].pageY,
          ), `${selector} stays in native document flow`).toBeLessThanOrEqual(1);
        }
      }
      expect(await geometry(page)).toEqual(before);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    if (phoneReader) {
      await target.focus();
      await page.keyboard.press("End");
      await expect.poll(() => target.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThanOrEqual(1);
      const beforeExit = await page.evaluate(() => scrollY);
      await page.keyboard.press("PageDown");
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(beforeExit + 1);
      await expect(page.locator(".landing-faq")).toBeInViewport();
      expect(await geometry(page)).toEqual(before);
    }
    expect(
      await page
        .locator("main *, footer.chapter *, #pricing-screen-host *")
        .evaluateAll((els) =>
          // This one clipped viewport is deliberately driven by the page.
          els.filter((el) => el.scrollTop !== 0 && !el.matches(".pricing-phone-viewport")).map((el) => el.className),
        ),
    ).toEqual([]);
    await expect(page.locator(".menu-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});


domTest("isolated DOM: les pauses de lecture gardent AI, téléphone et trois cartes pleinement lisibles", async ({ page }) => {
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
  // Two unchanged 3.2-screen legs surround the new two-screen AI hold.
  // The release allowance belongs to the following join, not to that motion.
  expect(opening.motion / opening.stage).toBeCloseTo(8.4, 2);
  const aiHoldStart = opening.motion / 2 - opening.stage;
  for (const fraction of [0.05, 0.5, 0.95, 0.5, 0.05]) {
    await page.evaluate(y => scrollTo({ top: y, behavior: "instant" }), aiHoldStart + 2 * opening.stage * fraction);
    await expect(page.locator("html")).toHaveAttribute("data-chapter", "ai");
    await expect(page.locator("#ai")).toHaveCSS("opacity", "1");
    await expect(page.locator("#ai")).toHaveJSProperty("inert", false);
    await expect(page.locator("#hero")).toHaveCSS("opacity", "0");
    await expect(page.locator("#wearable")).toHaveCSS("opacity", "0");
  }
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
  // Three two-stage reading holds, separated by one-stage transitions, are
  // checked in both directions. Selection is stable throughout each hold.
  for (const id of ['features', 'social-content']) {
    const chapter = page.locator(`#${id}`);
    const bounds = await chapter.evaluate(el => ({ top: el.getBoundingClientRect().top + scrollY, stage: el.firstElementChild!.clientHeight }));
    for (const index of [0, 1, 2, 1, 0]) for (const fraction of [0.05, 0.5, 0.95]) {
      await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), bounds.top + bounds.stage * (1.1 + index * 3 + 2 * fraction));
      await expect(page.locator('html')).toHaveAttribute('data-chapter', id);
      if (id === 'features') {
        await expect(chapter.locator('.feature-number')).toHaveText(`0${index + 1}`);
        await expect.poll(() => chapter.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--detail-opacity')))).toBe(1);
      } else {
        await expect(chapter.locator('.social-rail article').nth(index)).toHaveAttribute('aria-hidden', 'false');
        await expect(chapter.locator('.social-pager button').nth(index)).toHaveAttribute('aria-current', 'true');
        await expect.poll(() => chapter.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--rail-progress')))).toBe(index);
      }
    }
  }
});


domTest("isolated DOM: la scène contact est le seul footer et termine exactement la page FR/EN", async ({ page }) => {
  for (const locale of ["fr", "en"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(locale === "fr" ? "/" : "/en");
    await exposeDomLayout(page);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    const footer = page.getByRole("contentinfo");
    await expect(footer).toHaveCount(1);
    await expect(footer).toHaveAttribute("id", "footer");
    await expect(page.locator("main footer, .public-footer-wrap")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-chapter", "footer");
    await expect(footer).toHaveAccessibleName("Contact");
    await expect(footer.getByRole("heading", { level: 2, name: "Contact", exact: true })).toHaveCount(1);
    const navigation = footer.locator("[data-footer-navigation]");
    await expect(navigation).toBeVisible();
    await expect(navigation.locator(`a[href="${locale === "fr" ? "/prendre-rendez-vous" : "/en/book-a-call"}"]`)).toBeVisible();
    for (const link of await footer.locator("a").all()) {
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
    // The complete directory stays over the same scene in both theme rules,
    // including the narrow layouts that previously became an opaque panel.
    await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
    for (const width of [390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const light of [false, true]) {
        const toggle = page.locator('[data-public-theme-toggle]').first();
        if (await toggle.getAttribute('aria-pressed') !== String(light)) await toggle.click();
        await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
        await expect(footer.locator('.footer-bottom')).toBeInViewport();
        for (const selector of ['.stage', '[data-footer-navigation]'])
          await expect(footer.locator(selector)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(footer.locator('[data-footer-navigation]')).toHaveCSS('background-image', 'none');
        const stageBackground = await footer.locator('.stage').evaluate(el => getComputedStyle(el).backgroundImage);
        const opaqueStops = (stageBackground.match(/rgba?\([^)]+\)/g) ?? []).filter(color =>
          !color.startsWith('rgba(') || Number(color.slice(5, -1).split(',')[3]) >= 1);
        expect(opaqueStops, `${locale}/${width}/${light ? 'light' : 'dark'}: scene remains visible through footer`).toEqual([]);
        expect(await footer.locator('a').evaluateAll(elements =>
          elements.every(el => el.getBoundingClientRect().height >= 44))).toBe(true);
        const gap = await footer.evaluate(el => document.documentElement.scrollHeight - el.getBoundingClientRect().bottom - scrollY);
        expect(Math.abs(gap)).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("le premier chargement mobile garde la scène complète et les commandes accessibles", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await waitForScene(page);
  await expect(page.locator(".fallback-film, .world-fallback")).toHaveCount(0);
  await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
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


domTest("isolated DOM: les séquences allongées gardent des pauses lisibles et un rail réversible", async ({ page }) => {
  await openJourney(page);
  for (const [id, expectedTravel] of [["features", 10.2], ["encryption", 6.2], ["grip", 6.2], ["sustainability", 6.2], ["testimonies", 6.2], ["social-content", 10.2], ["product", 6.2]] as const) {
    const ratio = await page.locator(`#${id}`).evaluate(el => {
      const stage = el.firstElementChild!.clientHeight;
      return { id: el.id, travel: ((el as HTMLElement).offsetHeight - stage) / stage };
    });
    expect(ratio.travel).toBeCloseTo(expectedTravel, 2);
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
  for (const [progress, expected] of [[0.1, 0], [0.24, 0], [(1.1 + 2.5) / 10.2, 0.5], [0.5, 1], [(1.1 + 5.5) / 10.2, 1.5], [0.9, 2], [1, 2], [(1.1 + 5.5) / 10.2, 1.5], [0.5, 1], [(1.1 + 2.5) / 10.2, 0.5], [0.1, 0]]) {
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
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, message] of [["/", "Faites défiler pour découvrir"], ["/en", "Scroll to discover"]]) {
    await page.goto(path);
    await waitForScene(page);
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
    await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
    await page.locator("[data-public-theme-toggle]").click();
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect(page.locator("html")).toHaveAttribute("data-chapter", "footer");
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.goto(path);
    await waitForScene(page);
    await expect(guide).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
    await page.locator(".menu-toggle").click();
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.keyboard.press("Escape");
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.goto(path);
    await waitForScene(page);
    await expect(guide).toHaveAttribute("aria-hidden", "false");
    await page.locator('.skip-link[href="#ai"]').focus();
    await page.keyboard.press("Tab"); // Side tab, independent of document autofocus
    await page.keyboard.press("Enter"); // Open the header and focus its first control
    await expect(page.locator(".brand")).toBeFocused();
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.goto(path);
    await waitForScene(page);
    await expect(guide).toHaveAttribute("aria-hidden", "false");
    await page.locator("#hero .text-link").click();
    await expect(page).toHaveURL(path === "/" ? /\/demo$/ : /\/en\/vistaire-menu$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto(`${path}#product`);
    await waitForScene(page);
    await expect(page.locator("html")).toHaveAttribute("data-chapter", "product");
    await expect(guide).toHaveCount(1);
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(guide).toHaveCSS("transition-duration", "0s");
  }
});

for (const [path, discovery, pricing, booking, studio, language] of [
  ["/", "/demo", "/tarifs-menu-digital-restaurant", "/prendre-rendez-vous", "/apercu-restaurateur", "fr-CA"],
  ["/en", "/en/vistaire-menu", "/en/pricing-digital-restaurant-menu", "/en/book-a-call", "/en/restaurant-preview", "en-CA"],
] as const) {
  test(`${path} links marketing CTAs to real experiences instead of generic dialogs`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(path);
    await waitForScene(page);
    await expect(page.locator("#hero .text-link")).toHaveAttribute("href", discovery);
    await expect(page.locator("#ai .side-copy .action")).toHaveAttribute("href", discovery);
    for (const [index, restaurant] of ["maison-elyse", "trouvable", "sauge-noire"].entries()) {
      const expectedMenu = `/menu/${restaurant}?lang=${language}`;
      await expect(page.locator("#testimonies .experience-list a").nth(index)).toHaveAttribute("href", expectedMenu);
      await expect(page.locator("#social-content .social-bottom .action").nth(index)).toHaveAttribute("href", expectedMenu);
    }
    await expect(page.locator("#product .collection-details .action")).toHaveAttribute("href", pricing);
    // Pricing actions are fixed portals beside the scene, outside #open-weight.
    await expect(page.locator(".pricing-aside-links .pricing-cta:not(.pricing-details-link)")).toHaveAttribute("href", booking);
    await expect(page.locator(".pricing-details-link")).toHaveAttribute("href", pricing);
    await expect(page.locator(".pricing-studio-link")).toHaveAttribute("href", studio);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

// This isolated DOM fixture uses the production measured director. These
// assertions cover geometry/copy/native input, not a healthy 3D experience.
for (const viewport of [
  { width: 1280, height: 800 }, { width: 1440, height: 900 },
  { width: 1920, height: 1080 }, { width: 2560, height: 1440 },
  { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 },
]) {
  (viewport.width === 390 ? touchTest : domTest)(`isolated DOM: all chapter boundaries use measured continuous windows at ${viewport.width}×${viewport.height}`, async ({ page, browserName }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    for (const path of ['/', '/en']) {
      await page.goto(path);
      await exposeDomLayout(page);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('.pace-preview')).toHaveCount(0);
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
        return { id: el.id, travel: ((el as HTMLElement).offsetHeight - stage) / stage };
      }));
      for (const distance of distances) expect(distance.travel).toBeCloseTo(['features', 'social-content'].includes(distance.id) ? 10.2 : 6.2, 2);
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
      await exposeDomLayout(page);
      await expect(page.locator('#product')).toHaveJSProperty('inert', false);
      await expect.poll(() => page.locator('#product').evaluate(el => Number(getComputedStyle(el).getPropertyValue('--copy-opacity')))).toBeCloseTo(1, 3);

      // One existing mobile case exercises the opt-in preview in both locales;
      // every default window/pose above remains unchanged. This is native DOM
      // geometry/input proof, not a WebGL or normal-motion performance sample.
      if (viewport.width === 390) {
        const english = path === '/en';
        const anchor = english ? 'wearable' : 'social-content';
        await page.emulateMedia({ reducedMotion: english ? 'reduce' : 'no-preference' });
        await page.goto(`${path}?keep=preview&scrollPace=${english ? '1.25' : '1'}#${anchor}`);
        await exposeDomLayout(page);
        await page.evaluate(() => document.fonts.ready);
        const range = page.getByRole('slider', { name: english ? 'Pace' : 'Rythme', exact: true });
        await expect(range).toBeVisible();
        await expect(range).toHaveValue(english ? '1.25' : '1');
        await expect(page.locator('html')).toHaveAttribute('data-chapter', anchor);
        const reset = page.getByRole('button', { name: english ? 'Reset' : 'Réinitialiser', exact: true });
        if (english) {
          await reset.click();
          await expect(range).toHaveValue('1');
          await expect(page.locator('html')).toHaveAttribute('data-chapter', anchor);
        }
        const slower = page.getByRole('button', { name: english ? 'Slow down scrolling' : 'Ralentir le défilement', exact: true });
        const faster = page.getByRole('button', { name: english ? 'Speed up scrolling' : 'Accélérer le défilement', exact: true });
        for (const button of [slower, faster]) {
          const box = (await button.boundingBox())!;
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
        await slower.tap();
        await expect(range).toHaveValue('0.95');
        await faster.tap();
        await expect(range).toHaveValue('1');
        // Trusted emulated touchscreen input exercises the native range while
        // contact is held. It is not physical iOS/address-bar verification.
        expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
        if (browserName === 'chromium') {
        const cdp = await page.context().newCDPSession(page);
        const track = (await range.boundingBox())!;
        const touch = (fraction: number) => ({ x: track.x + track.width * fraction, y: track.y + track.height / 2, id: 1 });
        try {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(0.2)] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(0.75)] });
          await expect.poll(() => range.inputValue().then(Number)).toBeGreaterThan(2);
          await expect.poll(() => range.inputValue().then(Number)).toBeLessThan(4);
        } finally {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await cdp.detach();
        }
        }
        await reset.tap();
        await expect(range).toHaveValue('1');
        const geometryAtDefault = await geometry(page);
        const naturalAtDefault = geometryAtDefault.chapters.filter(chapter => ['open-weight', 'footer'].includes(chapter.id));
        const social = page.locator('#social-content');
        await social.evaluate(el => {
          const height = Number.parseFloat(getComputedStyle(el.firstElementChild!).height);
          scrollTo({ top: el.getBoundingClientRect().top + scrollY + (el.getBoundingClientRect().height - height) * 0.45, behavior: 'instant' });
        });
        await expect(page.locator('html')).toHaveAttribute('data-chapter', 'social-content');
        const semantic = () => social.evaluate(el => {
          const stage = Number.parseFloat(getComputedStyle(el.firstElementChild!).height);
          return -el.getBoundingClientRect().top / (el.getBoundingClientRect().height - stage);
        });
        for (const [key, pace] of [['End', 4], ['Home', 0.25]] as const) {
          await range.press(key);
          await expect(range).toHaveValue(String(pace));
          await expect.poll(semantic).toBeCloseTo(0.45, 3);
          const actual = await geometry(page);
          expect(actual.journeyVH).toBe(geometryAtDefault.journeyVH);
          expect(actual.sceneVH).toBe(geometryAtDefault.sceneVH);
          expect(actual.macTitle).toBe(geometryAtDefault.macTitle);
          expect(actual.chapters.map(chapter => chapter.stage)).toEqual(geometryAtDefault.chapters.map(chapter => chapter.stage));
          expect(actual.chapters.filter(chapter => ['open-weight', 'footer'].includes(chapter.id)).map(chapter => chapter.height)).toEqual(naturalAtDefault.map(chapter => chapter.height));
          const travel = await social.evaluate(el => (el.getBoundingClientRect().height - el.firstElementChild!.clientHeight) / el.firstElementChild!.clientHeight);
          expect(travel).toBeCloseTo(10.2 / pace, 2);
          const current = new URL(page.url());
          expect(current.searchParams.get('keep')).toBe('preview');
          expect(current.searchParams.get('scrollPace')).toBe(pace.toFixed(2));
          expect(current.hash).toBe(`#${anchor}`);
          // Repeating a native boundary key must not move the current content.
          const y = await page.evaluate(() => scrollY);
          await range.press(key);
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          expect(await page.evaluate(() => scrollY)).toBe(y);
        }
        await reset.click();
        await expect(range).toHaveValue('1');
        await expect.poll(semantic).toBeCloseTo(0.45, 3);
        await expect(page.locator('.pace-preview output')).toHaveText('1.00×');
        // Pricing remains natural flow: preserve the visible pixel offset,
        // rather than a normalized cinematic fraction, across a pace change.
        const pricing = page.locator('#open-weight');
        await pricing.evaluate(el => scrollTo({ top: el.getBoundingClientRect().top + scrollY + 120, behavior: 'instant' }));
        await expect(page.locator('html')).toHaveAttribute('data-chapter', 'open-weight');
        const pricingTop = () => pricing.evaluate(el => el.getBoundingClientRect().top);
        // scrollTo rounds actual CSS coordinates; preserve the observed initial
        // offset rather than comparing two rounded layouts to an ideal−120.
        const initialPricingTop = await pricingTop();
        await range.press('End');
        await expect(range).toHaveValue('4');
        await expect.poll(pricingTop).toBeCloseTo(initialPricingTop, 0);
        await reset.click();
        await expect(range).toHaveValue('1');
        await expect.poll(pricingTop).toBeCloseTo(initialPricingTop, 0);
        const summary = page.locator('.pace-preview summary');
        const url = page.url();
        await summary.press('Enter');
        await expect(range).toBeHidden();
        expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(page.url()).toBe(url);
        expect(await pricingTop()).toBeCloseTo(initialPricingTop, 0);
        await summary.press('Enter');
        await expect(range).toBeVisible();
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      }
    }
  });
}

domTest('isolated DOM: short landscape and zoom-sized viewports reserve a real food frame and reachable controls', async ({ page }, testInfo) => {
  for (const viewport of [{ width: 844, height: 390 }, { width: 1337, height: 591 }]) {
    // These are independent deep-link layouts; avoid same-URL fragment reuse.
    // Live viewport resizing is covered by the real-WebGL zoom regression.
    await page.goto('about:blank');
    await page.setViewportSize(viewport);
    const response = await page.goto('/#grip');
    try {
      await exposeDomLayout(page);
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
