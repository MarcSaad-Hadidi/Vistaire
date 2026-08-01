import { expect, test, type Page } from "@playwright/test";

type Split = 0 | 50 | 100;

async function openSaugeComparison(page: Page, locale: "fr" | "en") {
  await page.goto(locale === "en" ? "/en" : "/", {
    waitUntil: "domcontentloaded"
  });
  const comparison = page.getByTestId("landing-comparison");
  await comparison.scrollIntoViewIfNeeded();
  await expect(comparison.locator("[data-public-menu-renderer]")).toHaveCount(1, {
    timeout: 15_000
  });
  const tabs = comparison.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  const saugeTab = tabs.nth(2);
  await saugeTab.click();
  await expect(saugeTab).toHaveAttribute("aria-selected", "true");
  const renderer = comparison.locator(
    '[data-landing-menu-renderer="sauge-noire"]'
  );
  await expect(renderer.locator("[data-sauge-comparison-pages]")).toHaveCount(1, {
    timeout: 15_000
  });
  await expect(renderer.locator("[data-sauge-static-page]")).not.toHaveCount(0);
  return { comparison, renderer, slider: comparison.getByRole("slider") };
}

async function setSplit(slider: ReturnType<Page["getByRole"]>, split: Split) {
  await slider.focus();
  if (split === 0) {
    await slider.press("Home");
  } else if (split === 100) {
    await slider.press("End");
  } else {
    await slider.press("Home");
    for (let index = 0; index < 5; index += 1) {
      await slider.press("Shift+ArrowRight");
    }
  }
  await expect(slider).toHaveAttribute("aria-valuenow", String(split));
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        clientWidth: (element as HTMLElement).clientWidth,
        scrollWidth: (element as HTMLElement).scrollWidth,
        clientHeight: (element as HTMLElement).clientHeight,
        scrollHeight: (element as HTMLElement).scrollHeight
      };
    };
    const pages = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-landing-menu-renderer="sauge-noire"] [data-sauge-static-page], [data-landing-menu-renderer="sauge-noire"] [data-sauge-comparison-pages] > section'
      )
    ).map((pageElement) => ({
      label: pageElement.getAttribute("aria-label"),
      page: box(pageElement),
      titles: Array.from(
        pageElement.querySelectorAll<HTMLElement>(
          "h1, h2, [data-sauge-typography-role=title]"
        )
      ).map((title) => ({
        text: title.textContent?.trim() ?? "",
        ...box(title)
      })),
      overflowingChildren: Array.from(pageElement.querySelectorAll<HTMLElement>("*"))
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => {
          const pageRect = pageElement.getBoundingClientRect();
          return rect.left < pageRect.left - 1 || rect.right > pageRect.right + 1;
        })
        .slice(0, 12)
        .map(({ element, rect }) => ({
          tag: element.tagName,
          className: element.className,
          text: element.textContent?.trim().slice(0, 80) ?? "",
          left: rect.left,
          right: rect.right,
          width: rect.width
        }))
    }));
    const renderer = document.querySelector<HTMLElement>(
      '[data-landing-menu-renderer="sauge-noire"]'
    );
    return {
      viewport: {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      },
      renderer: renderer ? box(renderer) : null,
      pages
    };
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 }
]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });
    test.setTimeout(120_000);

    for (const locale of ["fr", "en"] as const) {
      test(`${locale} comparison pages contain titles at all splits`, async ({
        page
      }) => {
        const { slider } = await openSaugeComparison(page, locale);
        for (const split of [0, 50, 100] as const) {
          await setSplit(slider, split);
          const metrics = await measure(page);

          expect(metrics.viewport.scrollWidth).toBeLessThanOrEqual(
            metrics.viewport.clientWidth + 1
          );
          expect(metrics.renderer?.scrollWidth ?? 0).toBeLessThanOrEqual(
            (metrics.renderer?.clientWidth ?? 0) + 1
          );
          for (const { label, page: pageMetrics, titles } of metrics.pages) {
            expect(pageMetrics.scrollWidth, `${label} page overflow`).toBeLessThanOrEqual(
              pageMetrics.clientWidth + 1
            );
            for (const title of titles) {
              expect(
                title.right,
                `${label} title ${title.text} exceeds page right edge`
              ).toBeLessThanOrEqual(pageMetrics.right + 1);
              expect(
                title.left,
                `${label} title ${title.text} exceeds page left edge`
              ).toBeGreaterThanOrEqual(pageMetrics.left - 1);
            }
          }
        }
      });
    }
  });
}
