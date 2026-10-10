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
    chapters: [...document.querySelectorAll<HTMLElement>("main > .chapter")].map((el) => ({
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
    ["open-weight", ".pricing-faq summary"],
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
        .locator("main *")
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
  const stage = await page.locator(".opening-stage").evaluate((el) => el.clientHeight);
  for (const screens of [3.05, 3.7, 4.45]) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), stage * screens);
    await expect(page.locator("html")).toHaveAttribute("data-chapter", "wearable");
    await expect(page.locator("#wearable")).toHaveCSS("opacity", "1");
    await expect(page.locator("#wearable")).toHaveAttribute("aria-hidden", "false");
    expect(await page.locator(".opening-stage").evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
    expect(await page.locator("#features").evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(stage);
  }
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), stage * 5.5);
  await expect(page.locator("html")).toHaveAttribute("data-chapter", "features");
});
