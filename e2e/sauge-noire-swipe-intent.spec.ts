import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page
} from "@playwright/test";

const contextQuery = {
  lang: "fr-CA",
  currency: "CAD",
  table: "main",
  zone: "terrasse"
};

const menuPath = (view: string) =>
  `/menu/sauge-noire?${new URLSearchParams({ ...contextQuery, view })}`;

const dishPath = (slug: string, view: string) =>
  `/menu/sauge-noire/dishes/${slug}?${new URLSearchParams({
    ...contextQuery,
    view
  })}`;

type Point = Readonly<{ x: number; y: number }>;

type SwipeProbe = {
  engineStates: string[];
  flippingEntries: number;
  phases: string[];
  historyUrls: string[];
  trustedTouchEvents: number;
  clicks: Array<{
    detail: number;
    isTrusted: boolean;
    target: string;
  }>;
};

declare global {
  interface Window {
    __saugeSwipeProbe?: SwipeProbe;
  }
}

async function installSwipeProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: SwipeProbe = {
      engineStates: [],
      flippingEntries: 0,
      phases: [],
      historyUrls: [],
      trustedTouchEvents: 0,
      clicks: []
    };
    window.__saugeSwipeProbe = probe;

    const recordState = (state: string | null) => {
      if (!state || probe.engineStates.at(-1) === state) return;
      probe.engineStates.push(state);
      if (state === "flipping") probe.flippingEntries += 1;
    };

    const recordPhase = (phase: string | null) => {
      if (!phase || probe.phases.at(-1) === phase) return;
      probe.phases.push(phase);
    };

    const observe = () => {
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (!(record.target instanceof HTMLElement)) continue;
          if (record.attributeName === "data-page-flip-engine-state") {
            recordState(record.target.getAttribute(record.attributeName));
          }
          if (record.attributeName === "data-page-flip-single-jump-phase") {
            recordPhase(record.target.getAttribute(record.attributeName));
          }
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [
          "data-page-flip-engine-state",
          "data-page-flip-single-jump-phase"
        ],
        subtree: true
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", observe, { once: true });
    } else {
      observe();
    }

    for (const method of ["replaceState", "pushState"] as const) {
      const original = history[method].bind(history);
      history[method] = ((
        data: unknown,
        unused: string,
        url?: string | URL | null
      ) => {
        if (url !== undefined && url !== null) {
          probe.historyUrls.push(String(url));
        }
        return original(data, unused, url);
      }) as History[typeof method];
    }

    document.addEventListener(
      "touchstart",
      (event) => {
        if (event.isTrusted) probe.trustedTouchEvents += 1;
      },
      true
    );
    document.addEventListener(
      "click",
      (event) => {
        const target =
          event.target instanceof Element
            ? event.target.closest("a, button")?.tagName ?? event.target.tagName
            : "unknown";
        probe.clicks.push({
          detail: event.detail,
          isTrusted: event.isTrusted,
          target
        });
      },
      true
    );
  });
}

async function resetSwipeProbe(page: Page) {
  await page.evaluate(() => {
    const probe = window.__saugeSwipeProbe;
    if (!probe) throw new Error("Sauge swipe probe is missing");
    probe.engineStates = [];
    probe.flippingEntries = 0;
    probe.phases = [];
    probe.historyUrls = [];
    probe.trustedTouchEvents = 0;
    probe.clicks = [];
  });
}

async function readSwipeProbe(page: Page): Promise<SwipeProbe> {
  return page.evaluate(() => {
    const probe = window.__saugeSwipeProbe;
    if (!probe) throw new Error("Sauge swipe probe is missing");
    return structuredClone(probe);
  });
}

async function waitForReady(page: Page) {
  const viewport = page.locator(
    '[data-page-flip-state="ready"][data-page-flip-engine-state="read"]'
  );
  await expect(viewport).toHaveCount(1, { timeout: 15_000 });
  const owner = page.locator(
    '[data-sauge-reading-surface="true"]' +
      '[data-sauge-reading-visible="true"]' +
      '[data-sauge-scroll-owner="true"]'
  );
  await expect(owner).toHaveCount(1, { timeout: 15_000 });
  await expect(owner).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-page-flip-fallback="error"]')).toHaveCount(0);
  return { owner, viewport };
}

async function createTouchSession(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 2
  });
  return session;
}

async function centerOf(locator: Locator): Promise<Point> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, "the real swipe target must have a bounding box").not.toBeNull();
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2
  };
}

async function dispatchTouchPath(
  session: CDPSession,
  start: Point,
  offsets: readonly Point[],
  options: { id: number; delayMs?: number }
) {
  const delayMs = options.delayMs ?? 24;
  const send = async (
    type: "touchStart" | "touchMove" | "touchEnd",
    point?: Point
  ) => {
    await session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints:
        type === "touchEnd"
          ? []
          : [
              {
                id: options.id,
                x: point!.x,
                y: point!.y,
                radiusX: 4,
                radiusY: 4,
                force: 1
              }
            ]
    });
  };

  await send("touchStart", start);
  for (const offset of offsets) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await send("touchMove", {
      x: start.x + offset.x,
      y: start.y + offset.y
    });
  }
  await send("touchEnd");
}

async function expectOneFlipTo(page: Page, expectedPage: number) {
  await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
    "data-page-index",
    String(expectedPage),
    { timeout: 10_000 }
  );
  await expect(
    page.locator('[data-page-flip-engine-state="read"]')
  ).toHaveCount(1, { timeout: 10_000 });
  const probe = await readSwipeProbe(page);
  expect(probe.flippingEntries).toBe(1);
  expect(probe.trustedTouchEvents).toBeGreaterThan(0);
  return probe;
}

const naturalLeftSwipe = [
  { x: -7, y: -8 },
  { x: -24, y: -12 },
  { x: -80, y: -22 },
  { x: -180, y: -32 }
] as const;

const naturalRightSwipe = naturalLeftSwipe.map(({ x, y }) => ({
  x: -x,
  y
}));

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
    test.setTimeout(60_000);

    test.beforeEach(async ({ browserName, page }) => {
      expect(
        browserName,
        "The blocking swipe-intent proof requires Chromium CDP"
      ).toBe("chromium");
      await installSwipeProbe(page);
    });

    test("a natural diagonal swipe stays undecided until horizontal intent is clear", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const surface = owner.locator('[data-sauge-reading-content="true"]');
      const box = await surface.boundingBox();
      expect(box).not.toBeNull();
      const start = {
        x: box!.x + box!.width * 0.72,
        y: box!.y + Math.min(box!.height * 0.42, 360)
      };
      const initialScrollTop = await owner.evaluate((element) => element.scrollTop);
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, naturalLeftSwipe, { id: 11 });
        const probe = await expectOneFlipTo(page, 3);
        const finalScrollTop = await owner.evaluate((element) => element.scrollTop);
        expect(Math.abs(finalScrollTop - initialScrollTop)).toBeLessThanOrEqual(4);
        expect(probe.historyUrls.some((url) => url.includes("view=sauge-3"))).toBe(
          true
        );
      } finally {
        await session.detach();
      }
    });

    test("a swipe from the featured card flips without opening the dish", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const card = owner.locator('[data-sauge-featured-dish="true"]');
      const start = await centerOf(card);
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, naturalLeftSwipe, { id: 21 });
        await expectOneFlipTo(page, 3);
        await expect(page).toHaveURL(/\/menu\/sauge-noire\?/);
        await expect(
          page.locator('[data-sauge-route-transition="true"]')
        ).toHaveCount(0);
      } finally {
        await session.detach();
      }
    });

    test("a dish swipe can start on the simple menu link", async ({ page }) => {
      await page.goto(dishPath("betterave-sous-la-cendre", "sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const menuLink = owner.locator('[data-sauge-typography-role="back-control"]');
      const start = await centerOf(menuLink);
      const originalPathname = new URL(page.url()).pathname;
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, naturalRightSwipe, { id: 31 });
        await expect
          .poll(() => new URL(page.url()).pathname, { timeout: 10_000 })
          .not.toBe(originalPathname);
        expect(new URL(page.url()).pathname).toContain(
          "/menu/sauge-noire/dishes/"
        );
        expect((await readSwipeProbe(page)).flippingEntries).toBe(1);
      } finally {
        await session.detach();
      }
    });

    test("a far contents destination animates once and exposes only the final URL", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-1"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      await resetSwipeProbe(page);
      await owner
        .locator("nav button", { hasText: "Cocktails signatures" })
        .click();

      await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
        "data-page-index",
        "7",
        { timeout: 15_000 }
      );
      await expect(
        page.locator(
          '[data-page-flip-current-page="7"][data-page-flip-actual-page="7"]'
        )
      ).toHaveCount(1, { timeout: 15_000 });
      const probe = await readSwipeProbe(page);
      expect(probe.flippingEntries).toBe(1);
      expect(probe.phases).toContain("instant-jump-to-target");
      expect(
        probe.historyUrls.filter((url) =>
          /[?&]view=sauge-(?:2|3|4|5|6)(?:&|$)/.test(url)
        )
      ).toEqual([]);
      await expect(page).toHaveURL(/[?&]view=sauge-7(?:&|$)/);
    });
  });
}
