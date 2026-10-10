import {
  expect,
  test,
  type ConsoleMessage,
  type Locator,
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

async function openHydratedFaqItem(question: Locator) {
  await expect(question).toHaveAttribute("data-hydrated", "true");
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
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
  if (options.expandAnswers) await expect(questions.first()).toHaveAttribute("data-hydrated", "true");
  expect(
    await answers.evaluateAll((nodes) =>
      nodes.some((node) => node.getAttribute("role") === "region")
    )
  ).toBe(false);
  expect(faqPage.mainEntity).toHaveLength(expectedCount);

  const visibleAnswers: string[] = [];
  if (options.expandAnswers) {
    for (let index = 0; index < expectedCount; index += 1) {
      const question = questions.nth(index);
      if ((await question.getAttribute("aria-expanded")) === "false") {
        await openHydratedFaqItem(question);
      }
      await expect(question).toHaveAttribute("aria-expanded", "true");
      const panelId = await question.getAttribute("aria-controls");
      const panel = page.locator(`[id=${JSON.stringify(panelId)}]`);
      await expect(panel).toBeVisible();
      visibleAnswers.push(normalize(await panel.innerText()));
    }
  }

  expect((await questions.allTextContents()).map(normalize)).toEqual(
    faqPage.mainEntity.map((item) => normalize(item.name))
  );
  expect(options.expandAnswers ? visibleAnswers : (await answers.allTextContents()).map(normalize)).toEqual(
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
    await expect(second).toHaveAttribute("data-hydrated", "true");
    const panelId = await second.getAttribute("aria-controls");

    expect(panelId).toBeTruthy();
    await expect(second).toHaveAttribute("aria-expanded", "false");
    await second.focus();
    await expect(second).toBeFocused();
    expect(await second.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    expect(
      await second.evaluate((element) => getComputedStyle(element).boxShadow)
    ).not.toBe("none");

    await openHydratedFaqItem(second);
    await second.click();
    await expect(second).toHaveAttribute("aria-expanded", "false");
    await second.focus();

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
      const second = page.locator("[data-faq-native] details").nth(1);
      await expect(second).not.toHaveAttribute("open");
      await second.locator("summary").click();
      await expect(second).toHaveAttribute("open", "");
      await expect(second.locator("[data-seo-faq-answer]")).toBeVisible();
    }
  } finally {
    await context.close();
  }
});

test("FAQ accordion respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(ROUTES[0].path, { waitUntil: "domcontentloaded" });
  const chevron = page.locator("[data-seo-faq-chevron]").first();

  await expect(page.locator('[data-reui="c-accordion-10"]')).toHaveCount(1);
  await expect(chevron).toBeVisible();
  expect(await chevron.evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))).toEqual({ width: 16, height: 16 });
  expect(await chevron.evaluate((element) => getComputedStyle(element).rotate)).toBe("90deg");
  await expect(page.locator('[data-slot="accordion-trigger-icon"]:visible')).toHaveCount(0);
  expect(await chevron.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
});

test("a shared stack-layout FAQ consumer keeps disclosure and schema parity", async ({ page }) => {
  await page.goto(STACK_REGRESSION_ROUTE.path, { waitUntil: "domcontentloaded" });
  const faq = page.locator("[data-seo-faq]");
  const questions = faq.locator("[data-seo-faq-question]");
  const answers = faq.locator("[data-seo-faq-answer]");

  await expect(questions).toHaveCount(STACK_REGRESSION_ROUTE.count);
  await expect(questions.first()).toHaveAttribute("aria-expanded", "true");
  await expect(answers.first()).toBeVisible();
  await expect(questions.nth(1)).toHaveAttribute("aria-expanded", "false");
  const secondPanelId = await questions.nth(1).getAttribute("aria-controls");
  const secondPanel = page.locator(`[id=${JSON.stringify(secondPanelId)}]`);
  await expect(secondPanel).toBeHidden();

  await openHydratedFaqItem(questions.nth(1));
  await expect(questions.nth(1)).toHaveAttribute("aria-expanded", "true");
  await expect(secondPanel).toBeVisible();
  await expect(questions.first()).toHaveAttribute("aria-expanded", "false");
  await expectRenderedParity(page, STACK_REGRESSION_ROUTE.count, {
    expandAnswers: true
  });
});

test("free FAQ question keeps one active answer and ignores stale responses", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const asked: string[] = [];
  await page.route("**/api/public/faq", async (route) => {
    const { question } = route.request().postDataJSON() as { question: string };
    asked.push(question);
    if (asked.length === 1) await new Promise((resolve) => setTimeout(resolve, 1_200));
    await route.fulfill({
      json: {
        status: "answered",
        answer: `Réponse pour ${question}`,
        sources: [{ title: "Tarifs Vistaire", href: "/tarifs-menu-digital-restaurant" }]
      }
    });
  });

  await page.goto(ROUTES[2].path, { waitUntil: "domcontentloaded" });
  await openHydratedFaqItem(page.locator("[data-seo-faq-question]").nth(1));
  const input = page.locator("[data-faq-ask-input]");
  const result = page.locator("[data-faq-ask-result]");

  expect(asked).toEqual([]);
  await expect(page.locator("[data-faq-ask]")).toHaveCount(1);
  await input.fill("Combien coûte Vistaire ?");
  await input.press("Enter");
  await expect(result).toHaveAttribute("aria-busy", "true");
  await input.fill("Faut-il une application ?");
  await page.locator("[data-faq-ask-submit]").click();

  await expect(result.locator("[data-faq-ask-status='answered']")).toHaveText(/Réponse pour Faut-il une application \?/);
  await expect(result.getByRole("link", { name: "Tarifs Vistaire" })).toHaveAttribute("href", "/tarifs-menu-digital-restaurant");
  await page.waitForTimeout(1_400);
  await expect(result).not.toContainText("Combien coûte");
  expect(asked).toEqual(["Combien coûte Vistaire ?", "Faut-il une application ?"]);

  await input.fill("Faut-il une application ? Et le Wi-Fi ?");
  await expect(result.locator("[data-faq-ask-status]")).toHaveCount(0);
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


test("free FAQ handles service errors and allows another question in English", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/public/faq", async (route) => {
    requests += 1;
    if (requests === 1) await route.fulfill({ status: 503, body: "temporarily unavailable" });
    else await route.fulfill({ json: { status: "answered", answer: "You can update your menu.", sources: [] } });
  });
  await page.goto("/en/digital-restaurant-menu", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-reui="c-accordion-10"]')).toHaveCount(1);
  const input = page.locator("[data-faq-ask-input]");
  await input.fill("Can I update my menu?");
  await input.press("Enter");
  await expect(page.locator('[data-faq-ask-status="unavailable"]')).toContainText("temporarily unavailable");
  await input.fill("How can I update my menu?");
  await input.press("Enter");
  await expect(page.locator('[data-faq-ask-status="answered"]')).toHaveText("You can update your menu.");
  expect(requests).toBe(2);
});
