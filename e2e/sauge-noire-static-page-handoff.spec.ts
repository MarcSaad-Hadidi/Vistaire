import { expect, test, type Locator, type Page } from "@playwright/test";

const contextQuery = {
  lang: "fr-CA",
  currency: "CAD",
  table: "main",
  zone: "terrasse"
};

type StaticPageKind = "cover" | "contents" | "ending";

type ElementMetric = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type StaticPageMetrics = {
  frame: ElementMetric & {
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
  };
  container: ElementMetric & {
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
  };
  content: (ElementMetric & {
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
  }) | null;
  frameStyle: Record<string, string>;
  titleStyle: Record<string, string>;
  bodyStyle: Record<string, string>;
  elements: Record<string, ElementMetric>;
  fontsStatus: FontFaceSetLoadStatus;
  titleFontLoaded: boolean;
  horizontalOverflow: number;
};

const menuPath = (view: string) =>
  `/menu/sauge-noire?${new URLSearchParams({ ...contextQuery, view })}`;

const readingSurface = (page: Page) =>
  page.locator(
    '[data-sauge-reading-surface="true"][data-sauge-reading-kind="menu"][data-sauge-reading-visible="true"][data-sauge-scroll-owner="true"]'
  );

const staticFrame = (page: Page, kind: StaticPageKind) =>
  readingSurface(page).locator(
    `:scope > [data-sauge-reading-content="true"] > [data-sauge-static-frame="${kind}"]`
  );

async function nextFrames(page: Page, count = 2) {
  await page.evaluate(
    (frameCount) =>
      new Promise<void>((resolve) => {
        const tick = (remaining: number) => {
          if (remaining <= 0) {
            resolve();
            return;
          }
          requestAnimationFrame(() => tick(remaining - 1));
        };
        tick(frameCount);
      }),
    count
  );
}

async function waitForRead(page: Page, kind: StaticPageKind) {
  const stableState = async () =>
    page.evaluate(() => {
      const book = document.querySelector<HTMLElement>(
        '[data-testid="sauge-noire-book"]'
      );
      const viewport = document.querySelector<HTMLElement>(
        "[data-page-flip-state]"
      );
      const bookIndex = book?.getAttribute("data-page-index") ?? null;
      const currentPage =
        viewport?.getAttribute("data-page-flip-current-page") ?? null;
      const actualPage =
        viewport?.getAttribute("data-page-flip-actual-page") ?? null;
      return {
        kind: book?.getAttribute("data-page-kind") ?? null,
        engineState:
          viewport?.getAttribute("data-page-flip-engine-state") ?? null,
        indicesAligned:
          bookIndex !== null &&
          bookIndex === currentPage &&
          currentPage === actualPage
      };
    });
  await expect.poll(stableState, { timeout: 30_000 }).toEqual({
    kind,
    engineState: "read",
    indicesAligned: true
  });
  await nextFrames(page, 4);
  expect(await stableState()).toEqual({
    kind,
    engineState: "read",
    indicesAligned: true
  });
  await expect(staticFrame(page, kind)).toHaveCount(1);
}

async function openDeepLink(
  page: Page,
  kind: Extract<StaticPageKind, "cover" | "contents">
) {
  await page.goto(menuPath(kind === "cover" ? "sauge-0" : "sauge-1"), {
    waitUntil: "domcontentloaded"
  });
  await waitForRead(page, kind);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await nextFrames(page);
}

async function measureFrame(
  frameLocator: Locator,
  containerSelector: string,
  contentSelector?: string
): Promise<StaticPageMetrics> {
  return frameLocator.evaluate(
    (frame, selectors) => {
      if (!(frame instanceof HTMLElement)) {
        throw new Error("Static page frame must be an HTMLElement");
      }
      const container = frame.closest<HTMLElement>(selectors.container);
      if (!container) throw new Error(`Missing container ${selectors.container}`);
      const content = selectors.content
        ? frame.closest<HTMLElement>(selectors.content)
        : null;

      const elementBox = (element: Element): ElementMetric => {
        const frameRect = frame.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const scaleX =
          frame.clientWidth > 0 ? frameRect.width / frame.clientWidth : 1;
        const scaleY =
          frame.clientHeight > 0 ? frameRect.height / frame.clientHeight : 1;
        return {
          left: (elementRect.left - frameRect.left) / scaleX,
          top: (elementRect.top - frameRect.top) / scaleY,
          width: elementRect.width / scaleX,
          height: elementRect.height / scaleY
        };
      };

      const boxWithScroll = (element: HTMLElement) => ({
        ...elementBox(element),
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight
      });

      const pickedStyles = (element: Element | null): Record<string, string> => {
        if (!element) return {};
        const style = getComputedStyle(element);
        return {
          display: style.display,
          position: style.position,
          height: style.height,
          minHeight: style.minHeight,
          maxHeight: style.maxHeight,
          overflow: style.overflow,
          flex: style.flex,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          textSizeAdjust: style.getPropertyValue("text-size-adjust"),
          webkitTextSizeAdjust: style.getPropertyValue("-webkit-text-size-adjust")
        };
      };

      const title = frame.querySelector<HTMLElement>(
        "h1, [data-sauge-static-element='wordmark']"
      );
      const body = frame.querySelector<HTMLElement>(
        "p, [data-sauge-static-element='open']"
      );
      const titleStyle = pickedStyles(title);
      const elementSelectors: Record<string, string> = {
        brand: "[data-sauge-static-element='brand']",
        title: "h1, [data-sauge-static-element='wordmark']",
        botanical: "[data-sauge-static-page] svg",
        locale: "button[aria-label^='Langue']",
        currency: "button[aria-label^='Devise']",
        footer: "[data-sauge-static-element='footer'], [data-sauge-static-element='message']"
      };
      const elements: Record<string, ElementMetric> = {};
      for (const [name, selector] of Object.entries(elementSelectors)) {
        const element = frame.querySelector(selector);
        if (element) elements[name] = elementBox(element);
      }

      return {
        frame: boxWithScroll(frame),
        container: boxWithScroll(container),
        content: content ? boxWithScroll(content) : null,
        frameStyle: pickedStyles(frame),
        titleStyle,
        bodyStyle: pickedStyles(body),
        elements,
        fontsStatus: document.fonts.status,
        titleFontLoaded: title
          ? document.fonts.check(
              `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`
            )
          : false,
        horizontalOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      };
    },
    { container: containerSelector, content: contentSelector }
  );
}

async function captureFlipHandoff(
  page: Page,
  kind: StaticPageKind,
  action: () => Promise<unknown>
) {
  await action();
  const viewport = page.locator("[data-page-flip-state]");
  await expect(viewport).toHaveAttribute("data-page-flip-engine-state", "flipping", {
    timeout: 10_000
  });
  await expect(
    viewport.locator('[data-page-flip-engine-visible="true"]')
  ).toHaveCount(1);
  const physicalFrame = viewport
    .locator(
      `[data-page-flip-engine-visible] [data-sauge-page-origin="react-original"] > [data-sauge-static-frame="${kind}"]`
    )
    .first();
  await expect(physicalFrame).toHaveCount(1);
  await expect
    .poll(() => physicalFrame.evaluate((frame) => frame.clientHeight), {
      timeout: 30_000
    })
    .toBeGreaterThan(0);
  const physicalDuringFlip = await measureFrame(
    physicalFrame,
    "[data-sauge-page-origin='react-original']"
  );

  await waitForRead(page, kind);
  await nextFrames(page);
  const physical = await measureFrame(
    physicalFrame,
    "[data-sauge-page-origin='react-original']"
  );
  const canonicalFrame = staticFrame(page, kind);
  const canonical = await measureFrame(
    canonicalFrame,
    "[data-sauge-reading-surface='true']",
    "[data-sauge-reading-content='true']"
  );
  await nextFrames(page);
  const stabilized = await measureFrame(
    canonicalFrame,
    "[data-sauge-reading-surface='true']",
    "[data-sauge-reading-content='true']"
  );

  return { physicalDuringFlip, physical, canonical, stabilized };
}

function expectStaticParity(
  kind: StaticPageKind,
  metrics: Awaited<ReturnType<typeof captureFlipHandoff>>
) {
  const { physicalDuringFlip, physical, canonical, stabilized } = metrics;
  expect.soft(
    Math.abs(canonical.frame.clientHeight - canonical.container.clientHeight),
    `${kind}: the canonical static frame must fill the reading surface`
  ).toBeLessThanOrEqual(1);
  expect.soft(
    Math.abs(
      (canonical.content?.clientHeight ?? 0) - canonical.container.clientHeight
    ),
    `${kind}: the intermediate content wrapper must fill the reading surface`
  ).toBeLessThanOrEqual(1);
  expect.soft(
    canonical.container.scrollHeight,
    `${kind}: a static page must not create a vertical scrollbar`
  ).toBeLessThanOrEqual(canonical.container.clientHeight + 1);
  expect.soft(
    canonical.frame.scrollHeight,
    `${kind}: static page content stays inside its frame`
  ).toBeLessThanOrEqual(canonical.frame.clientHeight + 1);
  expect.soft(canonical.horizontalOverflow, `${kind}: horizontal overflow`).toBeLessThanOrEqual(1);
  expect.soft(canonical.fontsStatus, `${kind}: fonts status`).toBe("loaded");
  expect.soft(canonical.titleFontLoaded, `${kind}: title font loaded`).toBe(true);

  expect.soft(
    canonical.titleStyle.fontFamily,
    `${kind}: computed title fontFamily`
  ).toBe(physical.titleStyle.fontFamily);
  expect.soft(
    canonical.bodyStyle.fontFamily,
    `${kind}: computed body fontFamily`
  ).toBe(physical.bodyStyle.fontFamily);
  for (const field of ["textSizeAdjust", "webkitTextSizeAdjust"]) {
    expect.soft(
      canonical.frameStyle[field],
      `${kind}: computed frame ${field}`
    ).toBe(physical.frameStyle[field]);
  }
  for (const field of ["fontSize", "lineHeight", "letterSpacing"]) {
    for (const role of ["titleStyle", "bodyStyle"] as const) {
      const canonicalValue = Number.parseFloat(canonical[role][field]);
      const physicalValue = Number.parseFloat(physical[role][field]);
      if (Number.isFinite(canonicalValue) && Number.isFinite(physicalValue)) {
        expect.soft(
          Math.abs(canonicalValue - physicalValue),
          `${kind}: computed ${role} ${field}`
        ).toBeLessThanOrEqual(0.1);
      } else {
        expect.soft(
          canonical[role][field],
          `${kind}: computed ${role} ${field}`
        ).toBe(physical[role][field]);
      }
    }
  }

  expect.soft(
    Math.abs(canonical.frame.clientHeight - physical.frame.clientHeight),
    `${kind}: physical and canonical frame heights`
  ).toBeLessThanOrEqual(1);
  expect.soft(
    physicalDuringFlip.frame.clientHeight,
    `${kind}: target physical frame is measurable during the handoff`
  ).toBeGreaterThan(0);

  for (const [name, physicalBox] of Object.entries(physical.elements)) {
    const canonicalBox = canonical.elements[name];
    if (!canonicalBox) continue;
    expect.soft(
      Math.abs(canonicalBox.top - physicalBox.top),
      `${kind}: ${name} vertical position`
    ).toBeLessThanOrEqual(1);
    expect.soft(
      Math.abs(canonicalBox.height - physicalBox.height),
      `${kind}: ${name} height`
    ).toBeLessThanOrEqual(1);
  }

  expect.soft(
    Math.abs(stabilized.frame.clientHeight - canonical.frame.clientHeight),
    `${kind}: no delayed frame-height change`
  ).toBeLessThanOrEqual(1);
  for (const [name, firstBox] of Object.entries(canonical.elements)) {
    const settledBox = stabilized.elements[name];
    if (!settledBox) continue;
    expect.soft(
      Math.abs(settledBox.top - firstBox.top),
      `${kind}: no delayed ${name} drift`
    ).toBeLessThanOrEqual(1);
  }
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 }
]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({
      viewport,
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1
    });
    test.setTimeout(120_000);

    test("cover, contents and ending keep physical/canonical parity", async ({
      page
    }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      const serverErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("response", (response) => {
        if (response.status() >= 400) {
          serverErrors.push(`${response.status()} ${response.url()}`);
        }
      });

      await openDeepLink(page, "cover");
      await page.keyboard.press("ArrowRight");
      await waitForRead(page, "contents");
      const cover = await captureFlipHandoff(page, "cover", () =>
        page.keyboard.press("ArrowLeft")
      );
      expectStaticParity("cover", cover);

      await openDeepLink(page, "contents");
      await page.keyboard.press("ArrowLeft");
      await waitForRead(page, "cover");
      const contents = await captureFlipHandoff(page, "contents", () =>
        page.keyboard.press("ArrowRight")
      );
      expectStaticParity("contents", contents);

      await openDeepLink(page, "contents");
      const ending = await captureFlipHandoff(page, "ending", () =>
        staticFrame(page, "contents").locator("nav button").last().click()
      );
      expectStaticParity("ending", ending);

      const contentsReturn = await captureFlipHandoff(page, "contents", () =>
        staticFrame(page, "ending")
          .locator("header button[aria-label^='Retour']")
          .click()
      );
      expectStaticParity("contents", contentsReturn);
      expect.soft(pageErrors, "no uncaught browser errors").toEqual([]);
      expect.soft(consoleErrors, "no browser console errors").toEqual([]);
      expect.soft(serverErrors, "no HTTP 404/500 responses").toEqual([]);
    });
  });
}
