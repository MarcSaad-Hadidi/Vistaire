import { test, expect, type Page } from "@playwright/test";

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

for (const initialHeight of [820, 730]) {
  test(`les barres mobiles ne déplacent aucun chapitre (${initialHeight}px)`, async ({
    page,
  }) => {
    await openJourney(page, initialHeight);
    const before = await geometry(page);
    for (const height of [730, 820, 730, 820]) {
      await page.setViewportSize({ width: 390, height });
      await page.waitForTimeout(100);
      expect(await geometry(page)).toEqual(before);
    }
  });
}

test("rotation réelle et redimensionnement desktop restent responsive", async ({
  page,
}) => {
  await openJourney(page);
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
});

test("contact maintenu : inversions et changements de hauteur du Mac au footer", async ({
  page,
}) => {
  await openJourney(page);
  const before = await geometry(page);
  const cdp = await page.context().newCDPSession(page);
  const cases = [
    ["sustainability", ".living .scene-focus"],
    ["testimonies", ".experience-list button"],
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
    const hold = Number((el as HTMLElement).style.getPropertyValue("--opening-phone-hold-vh")) * stage / 100;
    return { stage, height: (el as HTMLElement).offsetHeight, motion: (el as HTMLElement).offsetHeight - stage - hold, hold };
  });
  expect(opening.motion / opening.stage).toBeCloseTo(4.8, 2);
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
    await expect(footer.locator("h2")).toBeInViewport();
    await expect(footer.locator(`a[href="${locale === "fr" ? "/prendre-rendez-vous" : "/en/book-a-call"}"]`)).toBeInViewport();
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
  for (const [id, expectedTravel] of [["testimonies", 3], ["social-content", 5.4], ["product", 3.2]] as const) {
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
  for (const [progress, expected] of [[0.1, 0], [0.25, 0], [0.32, 0.5], [0.5, 1], [0.68, 1.5], [0.9, 2], [1, 2], [0.68, 1.5], [0.5, 1], [0.32, 0.5], [0.1, 0]]) {
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
  await at(0.33);
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
    await page.keyboard.press("Tab"); // Skip link
    await page.keyboard.press("Tab"); // First header control
    await expect(page.locator(".brand")).toBeFocused();
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.goto(path);
    await expect(guide).toHaveAttribute("aria-hidden", "false");
    await page.locator("#hero .text-link").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.goto(`${path}#product`);
    await expect(page.locator("html")).toHaveAttribute("data-chapter", "product");
    await expect(guide).toHaveCount(1);
    await expect(guide).toHaveAttribute("aria-hidden", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(guide).toHaveCSS("transition-duration", "0s");
  }
});
