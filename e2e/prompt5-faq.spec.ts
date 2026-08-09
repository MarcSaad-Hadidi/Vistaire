import {
  expect,
  test,
  type ConsoleMessage,
  type Page,
  type Response
} from "@playwright/test";

const ROUTES = [
  { path: "/menu-pdf-vs-menu-digital", count: 6 },
  { path: "/en/pdf-vs-digital-menu", count: 6 },
  { path: "/menu-digital-restaurant", count: 8 },
  { path: "/en/digital-restaurant-menu", count: 8 }
] as const;

const STACK_REGRESSION_ROUTE = {
  path: "/menu-qr-code-restaurant",
  count: 6
} as const;

type FaqEntity = {
  "@type": "FAQPage";
  mainEntity: Array<{
    name: string;
    acceptedAnswer: { text: string };
  }>;
};

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

function collectFaqPages(value: unknown): FaqEntity[] {
  if (Array.isArray(value)) return value.flatMap(collectFaqPages);
  if (!value || typeof value !== "object") return [];

  const node = value as Record<string, unknown>;
  return [
    ...(node["@type"] === "FAQPage" ? [node as FaqEntity] : []),
    ...collectFaqPages(node["@graph"])
  ];
}

async function renderedFaqPage(page: Page) {
  const payloads = await page.locator('script[type="application/ld+json"]').allTextContents();
  const faqPages = payloads.flatMap((payload) => collectFaqPages(JSON.parse(payload)));
  expect(faqPages).toHaveLength(1);
  return faqPages[0];
}

async function expectRenderedParity(
  page: Page,
  expectedCount: number,
  options: { expandAnswers?: boolean } = {}
) {
  const faqPage = await renderedFaqPage(page);
  const faq = page.locator("[data-seo-faq]");
  const questions = faq.locator("[data-seo-faq-question]");
  const answers = faq.locator("[data-seo-faq-answer]");

  await expect(questions).toHaveCount(expectedCount);
  await expect(answers).toHaveCount(expectedCount);
  expect(faqPage.mainEntity).toHaveLength(expectedCount);

  if (options.expandAnswers) {
    for (let index = 0; index < expectedCount; index += 1) {
      const question = questions.nth(index);
      if ((await question.getAttribute("aria-expanded")) === "false") {
        await question.click();
      }
      await expect(question).toHaveAttribute("aria-expanded", "true");
      await expect(answers.nth(index)).toBeVisible();
    }
  }

  expect((await questions.allTextContents()).map(normalize)).toEqual(
    faqPage.mainEntity.map((item) => normalize(item.name))
  );
  expect((await answers.allTextContents()).map(normalize)).toEqual(
    faqPage.mainEntity.map((item) => normalize(item.acceptedAnswer.text))
  );
}

for (const route of ROUTES) {
  test(`${route.path} renders one exact visible FAQPage inventory`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expectRenderedParity(page, route.count, { expandAnswers: true });
  });

  test(`${route.path} exposes native keyboard disclosure behavior without trapping focus`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    const questions = page.locator("[data-seo-faq-question]");
    const second = questions.nth(1);
    const third = questions.nth(2);
    const panelId = await second.getAttribute("aria-controls");

    expect(panelId).toBeTruthy();
    await expect(second).toHaveAttribute("aria-expanded", "false");
    await second.focus();
    await expect(second).toBeFocused();
    expect(await second.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    expect(
      await second.evaluate((element) => getComputedStyle(element).boxShadow)
    ).not.toBe("none");

    await page.keyboard.press("Enter");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator(`[id=${JSON.stringify(panelId)}]`);
    await expect(panel).toBeVisible();

    await page.keyboard.press("Space");
    await expect(second).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();

    await page.keyboard.press("Tab");
    await expect(third).toBeFocused();
  });
}

test("FAQ answers remain in server-rendered HTML without JavaScript", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required for FAQ SSR verification.");
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();

  try {
    for (const route of ROUTES) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expectRenderedParity(page, route.count);
    }
  } finally {
    await context.close();
  }
});

test("FAQ accordion respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(ROUTES[0].path, { waitUntil: "domcontentloaded" });
  const chevron = page.locator("[data-seo-faq-chevron]").first();

  await expect(chevron).toBeVisible();
  expect(await chevron.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
});

test("a shared stack-layout FAQ consumer keeps disclosure and schema parity", async ({ page }) => {
  await page.goto(STACK_REGRESSION_ROUTE.path, { waitUntil: "domcontentloaded" });
  const faq = page.locator("[data-seo-faq]");
  const questions = faq.locator("[data-seo-faq-question]");
  const answers = faq.locator("[data-seo-faq-answer]");

  await expect(questions).toHaveCount(STACK_REGRESSION_ROUTE.count);
  await expect(answers).toHaveCount(STACK_REGRESSION_ROUTE.count);
  await expect(questions.first()).toHaveAttribute("aria-expanded", "true");
  await expect(answers.first()).toBeVisible();
  await expect(questions.nth(1)).toHaveAttribute("aria-expanded", "false");
  await expect(answers.nth(1)).toBeHidden();

  await questions.nth(1).click();
  await expect(questions.nth(1)).toHaveAttribute("aria-expanded", "true");
  await expect(answers.nth(1)).toBeVisible();
  await expectRenderedParity(page, STACK_REGRESSION_ROUTE.count, {
    expandAnswers: true
  });
});

for (const width of [390, 430]) {
  test(`FAQ routes have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });

    for (const route of ROUTES) {
      const runtimeErrors: string[] = [];
      const failedResponses: string[] = [];
      const onPageError = (error: Error) => runtimeErrors.push(error.message);
      const onConsole = (message: ConsoleMessage) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      };
      const onResponse = (response: Response) => {
        if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
      };
      page.on("pageerror", onPageError);
      page.on("console", onConsole);
      page.on("response", onResponse);

      await page.goto(route.path, { waitUntil: "load" });
      await expect(page.locator("[data-seo-faq]")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
      ).toBe(true);
      expect(runtimeErrors).toEqual([]);
      expect(failedResponses).toEqual([]);

      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("response", onResponse);
    }
  });
}
