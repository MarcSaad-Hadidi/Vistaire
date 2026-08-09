import { expect, test, type Locator, type Page } from "@playwright/test";

const MODEL_REQUEST_RE =
  /\.(?:glb|usdz)(?:$|[?#])|\/model\/(?:glb|usdz)(?:$|[/?#])|model-viewer|babylon|three(?:\.module)?(?:\.min)?\.js|raw\.githubusercontent\.com|\/api\/.*(?:convert|conversion)/i;

const VIEWPORTS = [
  {
    viewport: { width: 390, height: 844 },
    baselinePhoneWidth: 231.61,
    minGrowth: 1.3,
    phoneCardRatio: [0.84, 0.96]
  },
  {
    viewport: { width: 430, height: 932 },
    baselinePhoneWidth: 231.61,
    minGrowth: 1.3,
    phoneCardRatio: [0.78, 0.94]
  },
  {
    viewport: { width: 768, height: 1024 },
    baselinePhoneWidth: 312,
    minGrowth: 1.25,
    phoneCardRatio: [0.74, 0.92]
  },
  {
    viewport: { width: 1280, height: 800 },
    baselinePhoneWidth: 329.3,
    minGrowth: 1.25,
    maxGrowth: 1.36,
    phoneCardRatio: [0.72, 0.86]
  },
  {
    viewport: { width: 1440, height: 900 },
    baselinePhoneWidth: 404.5,
    minGrowth: 1.25,
    maxGrowth: 1.36,
    phoneCardRatio: [0.78, 0.9]
  }
] as const;

function collectRuntimeFailures(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const failedResponses: string[] = [];
  const modelRequests: string[] = [];
  const pageErrors: string[] = [];

  page.on("request", (request) => {
    if (MODEL_REQUEST_RE.test(request.url())) modelRequests.push(request.url());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.failure()?.errorText ?? "request failed"} ${request.url()}`
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  return {
    consoleErrors,
    failedRequests,
    failedResponses,
    modelRequests,
    pageErrors
  };
}

async function openPdfComparison(page: Page, path = "/menu-pdf-vs-menu-digital") {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(400);

  const comparison = page.getByTestId("landing-comparison");
  await expect(comparison).toHaveAttribute("data-preview-status", "ready");
  await expect(comparison).toHaveAttribute("data-tabs-interactive", "true", {
    timeout: 15_000
  });
  await expect(
    comparison.locator('[data-public-menu-renderer="maison-elyse"]')
  ).toBeVisible({ timeout: 15_000 });
  await comparison.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  return comparison;
}

async function comparisonBoxes(comparison: Locator) {
  const phone = comparison.getByTestId("landing-comparison-phone");
  const figure = comparison.locator('[data-preview-comparison="pdf-vs-digital"]');
  const screen = comparison.getByRole("slider").locator("..");
  const card = comparison.locator("xpath=ancestor::article[1]");
  const [phoneBox, figureBox, screenBox, cardBox, transforms] =
    await Promise.all([
      phone.boundingBox(),
      figure.boundingBox(),
      screen.boundingBox(),
      card.boundingBox(),
      phone.evaluate((element) => ({
        figure: getComputedStyle(
          element.querySelector('[data-preview-comparison="pdf-vs-digital"]')!
        ).transform,
        phone: getComputedStyle(element).transform
      }))
    ]);

  expect(phoneBox).not.toBeNull();
  expect(figureBox).not.toBeNull();
  expect(screenBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  return {
    cardBox: cardBox!,
    figureBox: figureBox!,
    phoneBox: figureBox!,
    screenBox: screenBox!,
    transforms
  };
}

async function expectNoRuntimeFailures(
  page: Page,
  runtime: ReturnType<typeof collectRuntimeFailures>
) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(2);
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.failedResponses).toEqual([]);
  expect(runtime.modelRequests).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
}

async function expectSplitGeometry(comparison: Locator, expectedSplit: number) {
  const slider = comparison.getByRole("slider");
  const screen = slider.locator("..");
  const [sliderBox, screenBox, layerGeometry] = await Promise.all([
    slider.boundingBox(),
    screen.boundingBox(),
    slider.evaluate((handle) => {
      const [pdfId, vistaireId] = handle.getAttribute("aria-controls")!.split(" ");
      const pdf = document.getElementById(pdfId)!;
      const vistaire = document.getElementById(vistaireId)!;
      const rect = (element: Element) => {
        const box = element.getBoundingClientRect();
        return { height: box.height, width: box.width, x: box.x, y: box.y };
      };
      return {
        pdfClip: getComputedStyle(pdf).clipPath,
        pdfRect: rect(pdf),
        vistaireClip: getComputedStyle(vistaire).clipPath,
        vistaireRect: rect(vistaire)
      };
    })
  ]);
  expect(sliderBox).not.toBeNull();
  expect(screenBox).not.toBeNull();

  const expectedHandleX = screenBox!.x + screenBox!.width * (expectedSplit / 100);
  expect(Math.abs(sliderBox!.x + sliderBox!.width / 2 - expectedHandleX)).toBeLessThanOrEqual(1.5);
  for (const layerRect of [layerGeometry.pdfRect, layerGeometry.vistaireRect]) {
    expect(Math.abs(layerRect.x - screenBox!.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(layerRect.y - screenBox!.y)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(layerRect.width - screenBox!.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(layerRect.height - screenBox!.height)).toBeLessThanOrEqual(0.5);
  }
  expect(layerGeometry.pdfClip).toContain(`${100 - expectedSplit}%`);
  expect(layerGeometry.vistaireClip).toContain(`${expectedSplit}%`);
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

for (const scenario of VIEWPORTS) {
  const { viewport } = scenario;
  test(`emphasizes the PDF phone with real 9:16 geometry at ${viewport.width}x${viewport.height}`, async ({
    page
  }) => {
    const runtime = collectRuntimeFailures(page);
    await page.setViewportSize(viewport);
    const comparison = await openPdfComparison(page);
    const boxes = await comparisonBoxes(comparison);

    const growth = boxes.phoneBox.width / scenario.baselinePhoneWidth;
    const phoneCardRatio = boxes.phoneBox.width / boxes.cardBox.width;
    expect(growth).toBeGreaterThanOrEqual(scenario.minGrowth);
    if ("maxGrowth" in scenario) {
      expect(growth).toBeLessThanOrEqual(scenario.maxGrowth);
    }
    await expect(comparison).toHaveAttribute("data-device-emphasis", "true");
    expect(phoneCardRatio).toBeGreaterThanOrEqual(scenario.phoneCardRatio[0]);
    expect(phoneCardRatio).toBeLessThanOrEqual(scenario.phoneCardRatio[1]);
    expect(boxes.screenBox.width / boxes.screenBox.height).toBeCloseTo(9 / 16, 2);
    expect(boxes.transforms).toEqual({ figure: "none", phone: "none" });
    expect(boxes.figureBox.x).toBeGreaterThanOrEqual(boxes.cardBox.x);
    expect(boxes.figureBox.x + boxes.figureBox.width).toBeLessThanOrEqual(
      boxes.cardBox.x + boxes.cardBox.width
    );

    await expectNoRuntimeFailures(page, runtime);
  });
}

test("keeps keyboard, clip, handle, and pointer geometry exact", async ({ page }) => {
  const runtime = collectRuntimeFailures(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const comparison = await openPdfComparison(page);
  const slider = comparison.getByRole("slider");
  await slider.focus();
  await slider.press("Home");
  await slider.press("Shift+ArrowRight");
  await slider.press("Shift+ArrowRight");
  await slider.press("Shift+ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "30");
  await expectSplitGeometry(comparison, 30);

  const [handleBox, screenBox] = await Promise.all([
    slider.boundingBox(),
    slider.locator("..").boundingBox()
  ]);
  expect(handleBox).not.toBeNull();
  expect(screenBox).not.toBeNull();
  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2,
    handleBox!.y + handleBox!.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    screenBox!.x + screenBox!.width * 0.72,
    screenBox!.y + screenBox!.height / 2
  );
  await page.mouse.up();
  await expect(slider).toHaveAttribute("aria-valuenow", "72");
  await expectSplitGeometry(comparison, 72);
  await expectNoRuntimeFailures(page, runtime);
});

test("keeps touch drag geometry exact on the emphasized mobile phone", async ({
  browser
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    locale: "fr-CA",
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  try {
    const runtime = collectRuntimeFailures(page);
    const comparison = await openPdfComparison(page);
    const slider = comparison.getByRole("slider");
    const [handleBox, screenBox] = await Promise.all([
      slider.boundingBox(),
      slider.locator("..").boundingBox()
    ]);
    expect(handleBox).not.toBeNull();
    expect(screenBox).not.toBeNull();
    await performTouchGesture(
      page,
      {
        x: handleBox!.x + handleBox!.width / 2,
        y: handleBox!.y + handleBox!.height / 2
      },
      {
        x: screenBox!.x + screenBox!.width * 0.22,
        y: screenBox!.y + screenBox!.height / 2
      }
    );
    await expect(slider).toHaveAttribute("aria-valuenow", "22");
    await expectSplitGeometry(comparison, 22);
    await expectNoRuntimeFailures(page, runtime);
  } finally {
    await context.close();
  }
});

test("keeps the emphasis localized to both PDF routes", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 430, height: 932 });
  await openPdfComparison(page, "/en/pdf-vs-digital-menu");

  for (const path of ["/", "/menu-digital-restaurant"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const comparison = page.getByTestId("landing-comparison");
    await expect(comparison).toHaveAttribute("data-device-emphasis", "false");
  }
});

test("keeps one sample-menu destination in each final conversion block", async ({
  page
}) => {
  for (const scenario of [
    { path: "/menu-pdf-vs-menu-digital", menuHref: "/demo" },
    { path: "/en/pdf-vs-digital-menu", menuHref: "/en/vistaire-menu" }
  ]) {
    await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
    const finalConversion = page.locator(
      'section[aria-labelledby="final-cta-title"]'
    );
    await expect(finalConversion).toHaveCount(1);
    await expect(
      finalConversion.locator(`a[href="${scenario.menuHref}"]`)
    ).toHaveCount(1);
  }
});
