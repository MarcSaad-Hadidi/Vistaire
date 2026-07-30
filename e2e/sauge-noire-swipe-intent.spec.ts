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
  handoffSnapshots: Array<{
    phase: string | null;
    engineVisible: string | null;
    logicalPage: string | null;
    actualPage: string | null;
  }>;
  touchEvents: Array<{
    type: string;
    timeStamp: number;
    x: number | null;
    y: number | null;
    defaultPrevented: boolean;
  }>;
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

const browserIssuesByPage = new WeakMap<Page, string[]>();

function installBrowserIssueProbe(page: Page) {
  const issues: string[] = [];
  browserIssuesByPage.set(page, issues);
  page.on("console", (message) => {
    const text = message.text();
    if (
      message.type() === "error" ||
      /passive event listener|hydration|uncaught/i.test(text)
    ) {
      issues.push(`console:${message.type()}:${text}`);
    }
  });
  page.on("pageerror", (error) => {
    issues.push(`pageerror:${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      issues.push(`http:${response.status()}:${response.url()}`);
    }
  });
}

async function installSwipeProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: SwipeProbe = {
      engineStates: [],
      flippingEntries: 0,
      phases: [],
      historyUrls: [],
      trustedTouchEvents: 0,
      handoffSnapshots: [],
      touchEvents: [],
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
      const recordHandoff = () => {
        const viewport = document.querySelector<HTMLElement>(
          "[data-page-flip-single-jump-phase]"
        );
        const engine = viewport?.querySelector<HTMLElement>(
          "[data-page-flip-engine-visible]"
        );
        if (!viewport || !engine) return;
        const snapshot = {
          phase: viewport.getAttribute("data-page-flip-single-jump-phase"),
          engineVisible: engine.getAttribute("data-page-flip-engine-visible"),
          logicalPage: viewport.getAttribute("data-page-flip-current-page"),
          actualPage: viewport.getAttribute("data-page-flip-actual-page")
        };
        const previous = probe.handoffSnapshots.at(-1);
        if (
          previous &&
          JSON.stringify(previous) === JSON.stringify(snapshot)
        ) {
          return;
        }
        probe.handoffSnapshots.push(snapshot);
      };
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
        recordHandoff();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [
          "data-page-flip-engine-state",
          "data-page-flip-single-jump-phase",
          "data-page-flip-engine-visible",
          "data-page-flip-current-page",
          "data-page-flip-actual-page"
        ],
        subtree: true
      });
      recordHandoff();
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
    for (const type of ["touchstart", "touchmove", "touchend"] as const) {
      document.addEventListener(type, (event) => {
        if (!event.isTrusted) return;
        const touch = event.changedTouches[0] ?? event.touches[0];
        probe.touchEvents.push({
          type,
          timeStamp: event.timeStamp,
          x: touch?.clientX ?? null,
          y: touch?.clientY ?? null,
          defaultPrevented: event.defaultPrevented
        });
      });
    }
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
    probe.handoffSnapshots = [];
    probe.touchEvents = [];
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
  options: { id: number; delayMs?: number; endDelayMs?: number }
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
  if (options.endDelayMs) {
    await new Promise((resolve) => setTimeout(resolve, options.endDelayMs));
  }
  await send("touchEnd");
}

async function dispatchGroupedSyntheticTouchSequence(page: Page, point: Point) {
  await page.locator('[data-page-flip-state="ready"]').evaluate(
    (target, start) => {
      const first = new Touch({
        identifier: 91,
        target,
        clientX: start.x,
        clientY: start.y
      });
      const second = new Touch({
        identifier: 92,
        target,
        clientX: start.x,
        clientY: start.y + 36
      });
      target.dispatchEvent(
        new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: [first, second],
          targetTouches: [first, second],
          changedTouches: [first, second]
        })
      );
      target.dispatchEvent(
        new TouchEvent("touchend", {
          bubbles: true,
          cancelable: true,
          touches: [],
          targetTouches: [],
          changedTouches: [first, second]
        })
      );
    },
    point
  );
}

async function dispatchTwoFingerGesture(
  session: CDPSession,
  first: Point,
  second: Point
) {
  const points = (offsetX: number, offsetY: number) => [
    {
      id: 81,
      x: first.x + offsetX,
      y: first.y + offsetY,
      radiusX: 4,
      radiusY: 4,
      force: 1
    },
    {
      id: 82,
      x: second.x + offsetX,
      y: second.y + offsetY,
      radiusX: 4,
      radiusY: 4,
      force: 1
    }
  ];
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points(0, 0)
  });
  await new Promise((resolve) => setTimeout(resolve, 24));
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: points(-140, -20)
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: []
  });
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

const shortFlickLeft = [
  { x: -10, y: -2 },
  { x: -30, y: -4 }
] as const;

const reversedShortFlickLeft = [
  { x: -38, y: -3 },
  { x: -24, y: -3 }
] as const;

const rejectedShortDrag = [
  { x: -12, y: -1 },
  { x: -24, y: -3 }
] as const;

const tinyTapJitter = [{ x: 3, y: 2 }] as const;

const verticalScrollUp = [
  { x: -1, y: -12 },
  { x: -3, y: -80 },
  { x: -5, y: -180 }
] as const;

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
      installBrowserIssueProbe(page);
    });

    test.afterEach(async ({ page }) => {
      expect(browserIssuesByPage.get(page) ?? []).toEqual([]);
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
        expect(
          probe.touchEvents.some(
            (event) =>
              event.type === "touchmove" && event.defaultPrevented
          )
        ).toBe(true);
        expect(probe.historyUrls.some((url) => url.includes("view=sauge-3"))).toBe(
          true
        );
        const metrics = await page.evaluate(() => {
          const scrollOwner = document.querySelector<HTMLElement>(
            '[data-sauge-scroll-owner="true"]'
          );
          return {
            documentOverflow:
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
            ownerOverflow: scrollOwner
              ? scrollOwner.scrollWidth - scrollOwner.clientWidth
              : 0,
            eagerModels: performance
              .getEntriesByType("resource")
              .map((entry) => entry.name)
              .filter((url) => /\.(?:glb|usdz)(?:[?#]|$)/i.test(url))
          };
        });
        expect(metrics.documentOverflow).toBeLessThanOrEqual(1);
        expect(metrics.ownerOverflow).toBeLessThanOrEqual(1);
        expect(metrics.eagerModels).toEqual([]);
      } finally {
        await session.detach();
      }
    });

    test("a swipe from the visible page background flips exactly once", async ({
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
        x: box!.x + box!.width * 0.92,
        y: box!.y + box!.height * 0.32
      };
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, naturalLeftSwipe, { id: 12 });
        await expectOneFlipTo(page, 3);
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

    test("swipes from the featured photo, name, and price all flip", async ({
      page
    }) => {
      const session = await createTouchSession(page);
      const targets = [
        '[data-sauge-featured-dish="true"] [data-photo-slot]',
        '[data-sauge-featured-dish="true"] h2',
        '[data-sauge-featured-dish="true"] [data-sauge-typography-role="price"]'
      ];

      try {
        for (const [index, selector] of targets.entries()) {
          await page.goto(menuPath("sauge-2"), {
            waitUntil: "domcontentloaded"
          });
          const { owner } = await waitForReady(page);
          const start = await centerOf(owner.locator(selector));
          await resetSwipeProbe(page);
          await dispatchTouchPath(session, start, naturalLeftSwipe, {
            id: 60 + index
          });
          await expectOneFlipTo(page, 3);
          await expect(page).toHaveURL(/\/menu\/sauge-noire\?/);
        }
      } finally {
        await session.detach();
      }
    });

    test("a short fast flick from a real card flips exactly once", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const start = await centerOf(
        owner.locator('[data-sauge-featured-dish="true"]')
      );
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, shortFlickLeft, {
          id: 22,
          delayMs: 0
        });
        await expectOneFlipTo(page, 3);
        await expect(page).toHaveURL(/[?&]view=sauge-3(?:&|$)/);
      } finally {
        await session.detach();
      }
    });

    test("a slow short drag is neither a flip nor a dish tap", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const start = await centerOf(
        owner.locator('[data-sauge-featured-dish="true"]')
      );
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, rejectedShortDrag, {
          id: 27,
          delayMs: 160
        });
        await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
          "data-page-index",
          "2"
        );
        await expect(page).toHaveURL(/\/menu\/sauge-noire\?/);
        const probe = await readSwipeProbe(page);
        expect(probe.flippingEntries).toBe(0);
        expect(probe.clicks.filter((click) => click.isTrusted)).toEqual([]);
      } finally {
        await session.detach();
      }
    });

    test("a quick short nudge held in place is no longer a fresh flick", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const start = await centerOf(
        owner.locator('[data-sauge-featured-dish="true"]')
      );
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, shortFlickLeft, {
          id: 33,
          delayMs: 0,
          endDelayMs: 600
        });
        await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
          "data-page-index",
          "2"
        );
        const probe = await readSwipeProbe(page);
        expect(probe.flippingEntries).toBe(0);
        expect(probe.clicks.filter((click) => click.isTrusted)).toEqual([]);
      } finally {
        await session.detach();
      }
    });

    test("a short drag whose final velocity reverses is not a flick", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const start = await centerOf(
        owner.locator('[data-sauge-featured-dish="true"]')
      );
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, reversedShortFlickLeft, {
          id: 34,
          delayMs: 0
        });
        await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
          "data-page-index",
          "2"
        );
        const probe = await readSwipeProbe(page);
        expect(probe.flippingEntries).toBe(0);
        expect(probe.clicks.filter((click) => click.isTrusted)).toEqual([]);
      } finally {
        await session.detach();
      }
    });

    test("a swipe from a dish row flips without route navigation", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const start = await centerOf(
        owner.locator('[data-sauge-dish-row="true"]').first()
      );
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, naturalLeftSwipe, { id: 23 });
        await expectOneFlipTo(page, 3);
        await expect(page).toHaveURL(/\/menu\/sauge-noire\?/);
        await expect(
          page.locator('[data-sauge-route-transition="true"]')
        ).toHaveCount(0);
      } finally {
        await session.detach();
      }
    });

    test("a tiny-jitter tap on the featured card opens one dish", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const card = owner.locator('[data-sauge-featured-dish="true"]');
      const href = await card.getAttribute("href");
      expect(href).not.toBeNull();
      const expectedPath = new URL(href!, page.url()).pathname;
      const start = await centerOf(card);
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, tinyTapJitter, {
          id: 28,
          delayMs: 18
        });
        await expect
          .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
          .toBe(expectedPath);
        const trustedClicks = (await readSwipeProbe(page)).clicks.filter(
          (click) => click.isTrusted
        );
        expect(trustedClicks).toHaveLength(1);
      } finally {
        await session.detach();
      }
    });

    test("a real tap on a dish row opens one dish", async ({ page }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const row = owner.locator('[data-sauge-dish-row="true"]').first();
      const href = await row.getAttribute("href");
      expect(href).not.toBeNull();
      const expectedPath = new URL(href!, page.url()).pathname;
      const start = await centerOf(row);
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, [], {
          id: 29
        });
        await expect
          .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
          .toBe(expectedPath);
        const trustedClicks = (await readSwipeProbe(page)).clicks.filter(
          (click) => click.isTrusted
        );
        expect(trustedClicks).toHaveLength(1);
      } finally {
        await session.detach();
      }
    });

    test("a vertical gesture on a featured card scrolls without flip or route", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const start = await centerOf(
        owner.locator('[data-sauge-featured-dish="true"]')
      );
      const initialScrollTop = await owner.evaluate((element) => element.scrollTop);
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, verticalScrollUp, { id: 24 });
        await expect
          .poll(() => owner.evaluate((element) => element.scrollTop))
          .toBeGreaterThan(initialScrollTop);
        await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
          "data-page-index",
          "2"
        );
        expect((await readSwipeProbe(page)).flippingEntries).toBe(0);
        await expect(page).toHaveURL(/\/menu\/sauge-noire\?/);
      } finally {
        await session.detach();
      }
    });

    test("a vertical gesture on a dish row scrolls without flip or route", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const start = await centerOf(
        owner.locator('[data-sauge-dish-row="true"]').first()
      );
      const initialScrollTop = await owner.evaluate((element) => element.scrollTop);
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, verticalScrollUp, { id: 30 });
        await expect
          .poll(() => owner.evaluate((element) => element.scrollTop))
          .toBeGreaterThan(initialScrollTop);
        await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
          "data-page-index",
          "2"
        );
        expect((await readSwipeProbe(page)).flippingEntries).toBe(0);
        await expect(page).toHaveURL(/\/menu\/sauge-noire\?/);
      } finally {
        await session.detach();
      }
    });

    test("the first real tap after a consumed swipe opens one dish", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      let { owner } = await waitForReady(page);
      const firstStart = await centerOf(
        owner.locator('[data-sauge-featured-dish="true"]')
      );
      const session = await createTouchSession(page);

      try {
        await dispatchTouchPath(session, firstStart, naturalLeftSwipe, { id: 25 });
        await expectOneFlipTo(page, 3);
        ({ owner } = await waitForReady(page));
        const tapStart = await centerOf(
          owner.locator('[data-sauge-featured-dish="true"]')
        );
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, tapStart, [{ x: 3, y: 2 }], {
          id: 26,
          delayMs: 18
        });
        await expect
          .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
          .toContain("/menu/sauge-noire/dishes/");
        expect((await readSwipeProbe(page)).flippingEntries).toBe(1);
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

    test("a dish swipe can start on ordinary title content", async ({ page }) => {
      await page.goto(dishPath("betterave-sous-la-cendre", "sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const title = owner.locator('[data-sauge-typography-role="title"]');
      const start = await centerOf(title);
      const originalPathname = new URL(page.url()).pathname;
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, naturalLeftSwipe, { id: 32 });
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
        probe.handoffSnapshots.filter(
          ({ phase, engineVisible, logicalPage, actualPage }) =>
            (phase === "read-after-single-flip" ||
              phase === "instant-jump-to-target") &&
            logicalPage !== actualPage &&
            engineVisible !== "true"
        )
      ).toEqual([]);
      expect(
        probe.historyUrls.filter((url) =>
          /[?&]view=sauge-(?:2|3|4|5|6)(?:&|$)/.test(url)
        )
      ).toEqual([]);
      await expect(page).toHaveURL(/[?&]view=sauge-7(?:&|$)/);
    });

    test("a manual swipe from a contents entry remains an adjacent flip", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-1"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const start = await centerOf(
        owner.locator("nav button", { hasText: "Cocktails signatures" })
      );
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, naturalLeftSwipe, { id: 41 });
        await expectOneFlipTo(page, 2);
        await expect(page).toHaveURL(/[?&]view=sauge-2(?:&|$)/);
        await expect(
          page.locator('[data-sauge-route-transition="true"]')
        ).toHaveCount(0);
      } finally {
        await session.detach();
      }
    });

    test("protected preference controls do not flip and keep their tap action", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const language = owner.getByRole("button", { name: /^Langue:/ });
      const start = await centerOf(language);
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, naturalLeftSwipe, { id: 42 });
        await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
          "data-page-index",
          "2"
        );
        expect((await readSwipeProbe(page)).flippingEntries).toBe(0);
        await language.click();
        await expect(language).toHaveAttribute("aria-expanded", "true");
        await page.getByRole("menuitemradio", { name: "EN" }).click();
        await expect(page).toHaveURL(/[?&]lang=en-CA(?:&|$)/);
        const currency = owner.getByRole("button", { name: /^Devise:/ });
        await currency.click();
        await page.getByRole("menuitemradio", { name: "USD" }).click();
        await expect(page).toHaveURL(/[?&]currency=USD(?:&|$)/);
      } finally {
        await session.detach();
      }
    });

    test("modified, programmatic, and keyboard clicks remain available", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const language = owner.getByRole("button", { name: /^Langue:/ });

      await language.click({ modifiers: ["Control"] });
      await expect(language).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(language).toHaveAttribute("aria-expanded", "false");

      await language.evaluate((element) => (element as HTMLElement).click());
      await expect(language).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(language).toHaveAttribute("aria-expanded", "false");

      await resetSwipeProbe(page);
      const card = owner.locator('[data-sauge-featured-dish="true"]');
      const href = await card.getAttribute("href");
      expect(href).not.toBeNull();
      await card.focus();
      await card.press("Enter");
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
        .toBe(new URL(href!, page.url()).pathname);
      expect(
        (await readSwipeProbe(page)).clicks.some(
          (click) => click.isTrusted && click.detail === 0
        )
      ).toBe(true);
    });

    test("the protected 3D control never flips and still opens on tap", async ({
      page
    }) => {
      await page.goto(dishPath("truite-des-laurentides", "sauge-3"), {
        waitUntil: "domcontentloaded"
      });
      const { owner } = await waitForReady(page);
      const modelButton = owner.getByRole("button", { name: /3D/ });
      const start = await centerOf(modelButton);
      const originalPathname = new URL(page.url()).pathname;
      const viewport = page.locator('[data-page-flip-state="ready"]');
      const initialPage = await viewport.getAttribute(
        "data-page-flip-current-page"
      );
      expect(initialPage).not.toBeNull();
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, start, naturalLeftSwipe, { id: 43 });
        await expect(viewport).toHaveAttribute(
          "data-page-flip-current-page",
          initialPage!
        );
        expect(new URL(page.url()).pathname).toBe(originalPathname);
        expect((await readSwipeProbe(page)).flippingEntries).toBe(0);
        await modelButton.click();
        await expect(modelButton).toHaveAttribute("aria-expanded", "true");
      } finally {
        await session.detach();
      }
    });

    test("repeated one-finger swipes produce one animation per gesture", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      let { owner } = await waitForReady(page);
      const viewport = page.locator('[data-page-flip-state="ready"]');
      const initialInitCount = await viewport.getAttribute(
        "data-page-flip-init-count"
      );
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        let start = await centerOf(
          owner.locator('[data-sauge-featured-dish="true"]')
        );
        await dispatchTouchPath(session, start, naturalLeftSwipe, { id: 51 });
        await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
          "data-page-index",
          "3",
          { timeout: 10_000 }
        );
        ({ owner } = await waitForReady(page));
        start = await centerOf(
          owner.locator('[data-sauge-featured-dish="true"]')
        );
        await dispatchTouchPath(session, start, naturalLeftSwipe, { id: 52 });
        await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
          "data-page-index",
          "4",
          { timeout: 10_000 }
        );
        const probe = await readSwipeProbe(page);
        expect(probe.flippingEntries).toBe(2);
        await expect(viewport).toHaveAttribute(
          "data-page-flip-init-count",
          initialInitCount!
        );
        await expect(page).toHaveURL(/[?&]view=sauge-4(?:&|$)/);
      } finally {
        await session.detach();
      }
    });

    test("grouped and trusted multi-touch cancel cleanly before the next swipe", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      let { owner } = await waitForReady(page);
      const first = await centerOf(
        owner.locator('[data-sauge-featured-dish="true"]')
      );
      const second = { x: first.x, y: first.y + 48 };
      const session = await createTouchSession(page);

      try {
        await resetSwipeProbe(page);
        await dispatchGroupedSyntheticTouchSequence(page, first);
        await dispatchTwoFingerGesture(session, first, second);
        await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
          "data-page-index",
          "2"
        );
        expect((await readSwipeProbe(page)).flippingEntries).toBe(0);

        ({ owner } = await waitForReady(page));
        const nextStart = await centerOf(
          owner.locator('[data-sauge-featured-dish="true"]')
        );
        await resetSwipeProbe(page);
        await dispatchTouchPath(session, nextStart, naturalLeftSwipe, { id: 83 });
        await expectOneFlipTo(page, 3);
      } finally {
        await session.detach();
      }
    });
  });
}
