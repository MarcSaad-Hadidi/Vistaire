import {
  expect,
  test,
  type CDPSession,
  type Page,
  type Route
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

type OwnerSnapshot = {
  id: number;
  kind: string | null;
  pageIndex: string | null;
  visible: string | null;
  connected: boolean;
  inert: boolean;
  ancestorInert: boolean;
  ariaHidden: string | null;
  overflowY: string;
  visibility: string;
  pointerEvents: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  markerTop: number | null;
  contentInert: boolean | null;
};

type GestureSnapshot = {
  owners: OwnerSnapshot[];
  phase: string | null;
  engineState: string | null;
  overlay: boolean;
  routePending: string | null;
  windowScrollY: number;
  documentScrollTop: number;
  horizontalOverflow: number;
  lastRoutePreviewScrollTop: number;
};

type GestureEvent = GestureSnapshot & {
  type: string;
  isTrusted: boolean;
  touchId: number | null;
  targetId: number;
  targetConnected: boolean;
};

async function installGestureProbe(page: Page) {
  await page.addInitScript(() => {
    const ids = new WeakMap<object, number>();
    let nextId = 1;
    let lastRoutePreviewScrollTop = 0;
    const idFor = (value: object | null) => {
      if (!value) return 0;
      const existing = ids.get(value);
      if (existing) return existing;
      const id = nextId++;
      ids.set(value, id);
      return id;
    };

    const snapshot = () => {
      const surfaces = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-sauge-reading-surface="true"]'
        )
      ];
      const owners = surfaces
        .filter(
          (surface) =>
            surface.getAttribute("data-sauge-scroll-owner") === "true"
        )
        .map((surface) => {
          const style = getComputedStyle(surface);
          const marker = surface.querySelector<HTMLElement>(
            "h1, h2, [data-sauge-featured-dish='true']"
          );
          const content = surface.querySelector<HTMLElement>(
            '[data-sauge-reading-content="true"]'
          );
          return {
            id: idFor(surface),
            kind: surface.getAttribute("data-sauge-reading-kind"),
            pageIndex: surface.getAttribute("data-sauge-reading-page-index"),
            visible: surface.getAttribute("data-sauge-reading-visible"),
            connected: surface.isConnected,
            inert: surface.inert,
            ancestorInert: Boolean(
              surface.parentElement?.closest("[inert]")
            ),
            ariaHidden: surface.getAttribute("aria-hidden"),
            overflowY: style.overflowY,
            visibility: style.visibility,
            pointerEvents: style.pointerEvents,
            scrollTop: surface.scrollTop,
            scrollHeight: surface.scrollHeight,
            clientHeight: surface.clientHeight,
            markerTop: marker?.getBoundingClientRect().top ?? null,
            contentInert: content?.inert ?? null
          };
        });

      return {
        owners,
        phase:
          document
            .querySelector("[data-sauge-route-transition-phase]")
            ?.getAttribute("data-sauge-route-transition-phase") ?? null,
        engineState:
          document
            .querySelector("[data-page-flip-engine-state]")
            ?.getAttribute("data-page-flip-engine-state") ?? null,
        overlay: Boolean(
          document.querySelector('[data-sauge-route-transition="true"]')
        ),
        routePending:
          document
            .querySelector("[data-sauge-route-renderer-pending-handoff]")
            ?.getAttribute("data-sauge-route-renderer-pending-handoff") ??
          null,
        windowScrollY: window.scrollY,
        documentScrollTop: document.documentElement.scrollTop,
        lastRoutePreviewScrollTop,
        horizontalOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      };
    };

    document.addEventListener(
      "scroll",
      (event) => {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          target.getAttribute("data-sauge-reading-kind") === "route-preview"
        ) {
          lastRoutePreviewScrollTop = target.scrollTop;
        }
      },
      { capture: true, passive: true }
    );

    const events: Array<
      ReturnType<typeof snapshot> & {
        type: string;
        isTrusted: boolean;
        touchId: number | null;
        targetId: number;
        targetConnected: boolean;
      }
    > = [];

    for (const type of [
      "touchstart",
      "touchmove",
      "touchend",
      "touchcancel"
    ]) {
      document.addEventListener(
        type,
        (event) => {
          const touchEvent = event as TouchEvent;
          const target =
            touchEvent.target instanceof Node ? touchEvent.target : null;
          events.push({
            type,
            isTrusted: event.isTrusted,
            touchId: touchEvent.changedTouches[0]?.identifier ?? null,
            targetId: idFor(target),
            targetConnected: target?.isConnected ?? false,
            ...snapshot()
          });
        },
        { capture: true, passive: true }
      );
    }

    (
      window as typeof window & {
        __saugeGestureProbe?: {
          events: typeof events;
          reset: () => void;
          snapshot: typeof snapshot;
        };
      }
    ).__saugeGestureProbe = {
      events,
      reset: () => {
        events.length = 0;
        lastRoutePreviewScrollTop = 0;
      },
      snapshot
    };
  });
}

async function probeSnapshot(page: Page): Promise<GestureSnapshot> {
  return page.evaluate(() => {
    const probe = (
      window as typeof window & {
        __saugeGestureProbe?: { snapshot: () => GestureSnapshot };
      }
    ).__saugeGestureProbe;
    if (!probe) throw new Error("Sauge Noire gesture probe is unavailable");
    return probe.snapshot();
  });
}

async function probeEvents(page: Page): Promise<GestureEvent[]> {
  return page.evaluate(() => {
    const probe = (
      window as typeof window & {
        __saugeGestureProbe?: { events: GestureEvent[] };
      }
    ).__saugeGestureProbe;
    if (!probe) throw new Error("Sauge Noire gesture probe is unavailable");
    return probe.events;
  });
}

async function resetProbe(page: Page) {
  await page.evaluate(() => {
    const probe = (
      window as typeof window & {
        __saugeGestureProbe?: { reset: () => void };
      }
    ).__saugeGestureProbe;
    if (!probe) throw new Error("Sauge Noire gesture probe is unavailable");
    probe.reset();
  });
}

async function expectSettledSurface(page: Page) {
  await expect(page.locator('[data-page-flip-fallback="error"]')).toHaveCount(
    0
  );
  await expect(
    page.locator(
      '[data-sauge-route-renderer-pending-handoff="false"] ' +
        '[data-page-flip-state="ready"][data-page-flip-engine-state="read"]'
    )
  ).toHaveCount(1, { timeout: 15_000 });
  const owner = page.locator(
    '[data-sauge-route-renderer-pending-handoff="false"] ' +
      '[data-sauge-reading-surface="true"]' +
      '[data-sauge-scroll-owner="true"]'
  );
  await expect(owner).toHaveCount(1, { timeout: 15_000 });
  await expect(owner).toBeVisible({ timeout: 15_000 });
  return owner;
}

function expectUsableSingleOwner(
  snapshot: GestureSnapshot,
  expectedKind?: "menu" | "dish" | "route-preview"
) {
  expect(snapshot.owners).toHaveLength(1);
  const owner = snapshot.owners[0];
  expect(owner.connected).toBe(true);
  expect(owner.inert).toBe(false);
  expect(owner.ancestorInert).toBe(false);
  expect(owner.visible).toBe("true");
  expect(owner.visibility).toBe("visible");
  expect(owner.pointerEvents).toBe("auto");
  expect(["auto", "scroll"]).toContain(owner.overflowY);
  expect(owner.scrollHeight).toBeGreaterThan(owner.clientHeight);
  if (expectedKind) expect(owner.kind).toBe(expectedKind);
  expect(snapshot.windowScrollY).toBe(0);
  expect(snapshot.documentScrollTop).toBe(0);
  expect(snapshot.horizontalOverflow).toBeLessThanOrEqual(1);
  return owner;
}

async function createTouchSession(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1
  });
  return session;
}

async function dispatchTouch(
  session: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  id: number,
  x: number,
  y: number
) {
  await session.send("Input.dispatchTouchEvent", {
    type,
    touchPoints:
      type === "touchEnd"
        ? []
        : [{ id, x, y, radiusX: 3, radiusY: 3, force: 1 }]
  });
}

async function nextAnimationFrame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      })
  );
}

async function horizontalSwipe(
  page: Page,
  session: CDPSession,
  direction: "next" | "previous",
  id: number
) {
  const startX = direction === "next" ? 320 : 90;
  const endX = direction === "next" ? 90 : 320;
  await dispatchTouch(session, "touchStart", id, startX, 520);
  await nextAnimationFrame(page);
  await dispatchTouch(
    session,
    "touchMove",
    id,
    (startX + endX) / 2,
    520
  );
  await nextAnimationFrame(page);
  await dispatchTouch(session, "touchMove", id, endX, 520);
  await dispatchTouch(session, "touchEnd", id, endX, 520);
}

async function startVerticalGesture(
  page: Page,
  session: CDPSession,
  id: number
) {
  await dispatchTouch(session, "touchStart", id, 260, 720);
  await nextAnimationFrame(page);
  await dispatchTouch(session, "touchMove", id, 260, 650);
}

async function continueVerticalGesture(
  page: Page,
  session: CDPSession,
  id: number
) {
  for (const y of [570, 490, 410, 330, 250, 180]) {
    await nextAnimationFrame(page);
    await dispatchTouch(session, "touchMove", id, 260, y);
  }
}

async function endVerticalGesture(session: CDPSession, id: number) {
  await dispatchTouch(session, "touchEnd", id, 260, 180);
}

async function holdActiveTouch(
  page: Page,
  session: CDPSession,
  id: number,
  frameCount = 8
) {
  for (let frame = 0; frame < frameCount; frame += 1) {
    await nextAnimationFrame(page);
    await dispatchTouch(session, "touchMove", id, 260, 180);
  }
}

async function reverseVerticalGesture(
  page: Page,
  session: CDPSession,
  id: number
) {
  await dispatchTouch(session, "touchStart", id, 260, 180);
  for (const y of [250, 330, 410, 490, 570, 650, 720]) {
    await nextAnimationFrame(page);
    await dispatchTouch(session, "touchMove", id, 260, y);
  }
  await dispatchTouch(session, "touchEnd", id, 260, 720);
}

function assertTrustedSingleTouch(events: GestureEvent[]) {
  const touchEvents = events.filter((event) =>
    ["touchstart", "touchmove", "touchend"].includes(event.type)
  );
  expect(touchEvents.length).toBeGreaterThanOrEqual(3);
  expect(touchEvents.every((event) => event.isTrusted)).toBe(true);
  const touchIds = new Set(
    touchEvents
      .map((event) => event.touchId)
      .filter((id): id is number => id !== null)
  );
  expect(touchIds.size).toBe(1);
}

async function expectUrlContext(
  page: Page,
  expectedPathname: string,
  expectedView: string
) {
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
    .toBe(expectedPathname);
  await expect
    .poll(() => {
      const params = new URL(page.url()).searchParams;
      return {
        lang: params.get("lang"),
        currency: params.get("currency"),
        table: params.get("table"),
        zone: params.get("zone"),
        view: params.get("view")
      };
    }, { timeout: 15_000 })
    .toEqual({ ...contextQuery, view: expectedView });
}

async function installRscGate(page: Page, pathname: string) {
  let releaseGate = () => undefined;
  let released = false;
  let heldRequests = 0;
  const gate = new Promise<void>((resolve) => {
    releaseGate = () => {
      released = true;
      resolve();
    };
  });
  const handler = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = request.headers();
    const isDestinationRsc =
      url.pathname === pathname &&
      (url.searchParams.has("_rsc") ||
        headers.rsc === "1" ||
        headers["next-router-prefetch"] === "1");
    if (!isDestinationRsc || released) {
      await route.continue();
      return;
    }
    heldRequests += 1;
    await gate;
    await route.continue();
  };
  await page.route("**/*", handler);
  return {
    release: releaseGate,
    heldRequests: () => heldRequests,
    dispose: () => page.unroute("**/*", handler)
  };
}

async function completeRouteGesture({
  page,
  session,
  touchId,
  expectedPathname,
  expectedView,
  gate
}: {
  page: Page;
  session: CDPSession;
  touchId: number;
  expectedPathname: string;
  expectedView: string;
  gate: Awaited<ReturnType<typeof installRscGate>>;
}) {
  await page
    .locator('[data-sauge-route-transition-phase="animating"]')
    .waitFor({ timeout: 5_000 });
  await resetProbe(page);
  await startVerticalGesture(page, session, touchId);
  const start = await probeSnapshot(page);
  const startingOwner = expectUsableSingleOwner(start, "route-preview");

  await page
    .locator('[data-sauge-route-transition-phase="awaiting-destination"]')
    .waitFor({ timeout: 5_000 });
  const awaiting = await probeSnapshot(page);
  const awaitingOwner = expectUsableSingleOwner(awaiting, "route-preview");
  expect(awaitingOwner.id).toBe(startingOwner.id);
  expect(gate.heldRequests()).toBeGreaterThan(0);

  gate.release();
  await expectUrlContext(page, expectedPathname, expectedView);
  await expect(
    page.locator(
      '[data-sauge-route-renderer-pending-handoff="true"] ' +
        '[data-page-flip-state="ready"]'
    )
  ).toHaveCount(1, { timeout: 15_000 });
  await expect(
    page.locator('[data-sauge-route-transition="true"]')
  ).toHaveCount(1);

  await continueVerticalGesture(page, session, touchId);
  const beforeEnd = await probeSnapshot(page);
  const activeOwner = expectUsableSingleOwner(beforeEnd, "route-preview");
  expect(activeOwner.id).toBe(startingOwner.id);
  expect(activeOwner.scrollTop).toBeGreaterThan(0);

  await endVerticalGesture(session, touchId);
  await expect(
    page.locator('[data-sauge-route-transition="true"]')
  ).toHaveCount(0, { timeout: 5_000 });
  const finalSurface = await expectSettledSurface(page);
  await expect(finalSurface).toBeVisible();
  const final = await probeSnapshot(page);
  const finalOwner = expectUsableSingleOwner(final);
  expect(finalOwner.id).not.toBe(startingOwner.id);
  expect(final.lastRoutePreviewScrollTop).toBeGreaterThan(0);
  const expectedScrollTop = Math.min(
    final.lastRoutePreviewScrollTop,
    finalOwner.scrollHeight - finalOwner.clientHeight
  );
  expect(Math.abs(finalOwner.scrollTop - expectedScrollTop)).toBeLessThanOrEqual(1);
  assertTrustedSingleTouch(await probeEvents(page));
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
    test.setTimeout(45_000);

    test.beforeEach(async ({ browserName, page }) => {
      expect(
        browserName,
        "The blocking first-gesture proof requires Chromium CDP"
      ).toBe("chromium");
      await installGestureProbe(page);
    });

    test("menu page flip keeps the first vertical gesture on one owner", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      await expectSettledSurface(page);
      const session = await createTouchSession(page);

      await horizontalSwipe(page, session, "next", 11);
      await page
        .locator('[data-page-flip-engine-state="flipping"]')
        .waitFor({ timeout: 3_000 });
      await resetProbe(page);
      const beforeGesture = await probeSnapshot(page);
      const baselineOwner = expectUsableSingleOwner(beforeGesture, "menu");
      await startVerticalGesture(page, session, 12);
      const duringFlip = await probeSnapshot(page);
      const startingOwner = expectUsableSingleOwner(duringFlip, "menu");
      const beforeRead = await probeSnapshot(page);
      const scrolledOwner = expectUsableSingleOwner(beforeRead, "menu");
      expect(scrolledOwner.id).toBe(startingOwner.id);

      await page
        .locator('[data-page-flip-engine-state="read"]')
        .waitFor({ timeout: 5_000 });
      await expectUrlContext(page, "/menu/sauge-noire", "sauge-3");
      const afterRead = await probeSnapshot(page);
      const afterReadOwner = expectUsableSingleOwner(afterRead, "menu");
      expect(afterReadOwner.id).toBe(startingOwner.id);
      await continueVerticalGesture(page, session, 12);
      await holdActiveTouch(page, session, 12);
      await endVerticalGesture(session, 12);
      const finalSurface = await expectSettledSurface(page);
      const final = await probeSnapshot(page);
      const finalOwner = expectUsableSingleOwner(final, "menu");
      expect(finalOwner.id).toBe(startingOwner.id);
      expect(finalOwner.scrollTop).toBeGreaterThan(baselineOwner.scrollTop);
      expect(finalOwner.scrollTop).toBeGreaterThan(afterReadOwner.scrollTop);
      const preparedScrollTop = Number(
        await finalSurface.getAttribute("data-page-flip-prepared-scroll-top")
      );
      expect(preparedScrollTop).toBeGreaterThan(0);
      expect(finalOwner.scrollTop).toBeGreaterThanOrEqual(preparedScrollTop - 1);
      expect(finalOwner.scrollTop).toBeLessThanOrEqual(
        finalOwner.scrollHeight - finalOwner.clientHeight
      );
      assertTrustedSingleTouch(await probeEvents(page));
    });

    test("menu to dish defers route handoff until the active touch ends", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      const surface = await expectSettledSurface(page);
      const destination = "/menu/sauge-noire/dishes/betterave-sous-la-cendre";
      const gate = await installRscGate(page, destination);
      const session = await createTouchSession(page);
      try {
        await surface
          .locator('[data-sauge-featured-dish="true"]')
          .click({ noWaitAfter: true });
        await completeRouteGesture({
          page,
          session,
          touchId: 21,
          expectedPathname: destination,
          expectedView: "sauge-2",
          gate
        });
      } finally {
        gate.release();
        await gate.dispose();
      }
    });

    test("dish to menu defers route handoff until the active touch ends", async ({
      page
    }) => {
      await page.goto(
        dishPath("betterave-sous-la-cendre", "sauge-2"),
        { waitUntil: "domcontentloaded" }
      );
      const surface = await expectSettledSurface(page);
      const destination = "/menu/sauge-noire";
      const gate = await installRscGate(page, destination);
      const session = await createTouchSession(page);
      try {
        await surface
          .locator('[data-sauge-typography-role="back-control"]')
          .click({ noWaitAfter: true });
        await completeRouteGesture({
          page,
          session,
          touchId: 31,
          expectedPathname: destination,
          expectedView: "sauge-2",
          gate
        });
      } finally {
        gate.release();
        await gate.dispose();
      }
    });

    test("next and previous dish flips keep the first gesture usable", async ({
      page
    }) => {
      const initialPath =
        "/menu/sauge-noire/dishes/betterave-sous-la-cendre";
      await page.goto(dishPath("betterave-sous-la-cendre", "sauge-2"), {
        waitUntil: "domcontentloaded"
      });
      await expectSettledSurface(page);
      const session = await createTouchSession(page);

      for (const [direction, horizontalId, verticalId] of [
        ["next", 41, 42],
        ["previous", 43, 44]
      ] as const) {
        const sourcePathname = new URL(page.url()).pathname;
        const sourceSurface = await expectSettledSurface(page);
        const seededScrollTop = await sourceSurface.evaluate((element) => {
          const maxScroll = element.scrollHeight - element.clientHeight;
          element.scrollTop = Math.min(120, Math.max(0, maxScroll / 3));
          return element.scrollTop;
        });
        await horizontalSwipe(page, session, direction, horizontalId);
        await page
          .locator('[data-page-flip-engine-state="flipping"]')
          .waitFor({ timeout: 3_000 });
        const capturedSourceScrollTop = Number(
          await page
            .locator("[data-page-flip-source-scroll-top]")
            .getAttribute("data-page-flip-source-scroll-top")
        );
        expect(Math.abs(capturedSourceScrollTop - seededScrollTop)).toBeLessThanOrEqual(1);
        await resetProbe(page);
        const beforeGesture = await probeSnapshot(page);
        const baselineOwner = expectUsableSingleOwner(beforeGesture, "dish");
        expect(Math.abs(baselineOwner.scrollTop - seededScrollTop)).toBeLessThanOrEqual(1);
        await startVerticalGesture(page, session, verticalId);
        const duringFlip = await probeSnapshot(page);
        const startingOwner = expectUsableSingleOwner(duringFlip, "dish");
        await continueVerticalGesture(page, session, verticalId);
        await holdActiveTouch(page, session, verticalId);
        await endVerticalGesture(session, verticalId);
        const beforeRead = await probeSnapshot(page);
        const scrolledOwner = expectUsableSingleOwner(beforeRead, "dish");
        expect(scrolledOwner.id).toBe(startingOwner.id);
        expect(scrolledOwner.scrollTop).toBeGreaterThan(baselineOwner.scrollTop);

        await page
          .locator('[data-page-flip-engine-state="read"]')
          .waitFor({ timeout: 5_000 });
        await expect
          .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
          .not.toBe(sourcePathname);
        await expectSettledSurface(page);
        const final = await probeSnapshot(page);
        const finalOwner = expectUsableSingleOwner(final, "dish");
        expect(finalOwner.id).toBe(startingOwner.id);
        const preparedScrollTop = Number(
          await sourceSurface.getAttribute("data-page-flip-prepared-scroll-top")
        );
        const gestureDelta = Number(
          await sourceSurface.getAttribute("data-page-flip-gesture-delta")
        );
        const maxTargetScroll =
          finalOwner.scrollHeight - finalOwner.clientHeight;
        expect(preparedScrollTop).toBe(
          Math.min(maxTargetScroll, Math.max(0, gestureDelta))
        );
        expect(preparedScrollTop).not.toBe(
          Math.min(
            maxTargetScroll,
            Math.max(0, gestureDelta + capturedSourceScrollTop)
          )
        );
        expect(preparedScrollTop).toBeGreaterThan(0);
        expect(finalOwner.scrollTop).toBeGreaterThanOrEqual(preparedScrollTop - 1);
        expect(finalOwner.scrollTop).toBeLessThanOrEqual(
          finalOwner.scrollHeight - finalOwner.clientHeight
        );
        assertTrustedSingleTouch(await probeEvents(page));
        await expectSettledSurface(page);
      }

      await expectUrlContext(page, initialPath, "sauge-2");
    });

    test("3D open and close preserve scroll and the next touch scrolls", async ({
      page
    }) => {
      const glbRequests: string[] = [];
      page.on("request", (request) => {
        if (/\.glb(?:$|\?)/i.test(request.url())) {
          glbRequests.push(request.url());
        }
      });
      await page.goto(dishPath("truite-des-laurentides", "sauge-3"), {
        waitUntil: "domcontentloaded"
      });
      const surface = await expectSettledSurface(page);
      const session = await createTouchSession(page);
      expect(glbRequests).toEqual([]);

      await resetProbe(page);
      await startVerticalGesture(page, session, 51);
      await continueVerticalGesture(page, session, 51);
      await endVerticalGesture(session, 51);
      await expect
        .poll(() => surface.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);

      const viewerButton = surface.getByRole("button", {
        name: "VOIR EN 3D"
      });
      await expect(viewerButton).toBeInViewport();
      const beforeOpen = await surface.evaluate((element) => element.scrollTop);
      await viewerButton.click();
      await expect(page.locator('[data-viewer-copy-locale="fr"]')).toBeVisible();
      await expect.poll(() => glbRequests.length).toBeGreaterThan(0);
      const afterOpen = await surface.evaluate((element) => element.scrollTop);
      expect(Math.abs(afterOpen - beforeOpen)).toBeLessThanOrEqual(2);

      await surface
        .getByRole("button", { name: "MASQUER LA 3D" })
        .click();
      await expect(page.locator('[data-viewer-copy-locale="fr"]')).toHaveCount(
        0
      );
      const afterClose = await surface.evaluate(
        (element) => element.scrollTop
      );
      expect(Math.abs(afterClose - beforeOpen)).toBeLessThanOrEqual(2);

      await resetProbe(page);
      const maxScroll = await surface.evaluate(
        (element) => element.scrollHeight - element.clientHeight
      );
      if (afterClose < maxScroll - 2) {
        await startVerticalGesture(page, session, 52);
        await continueVerticalGesture(page, session, 52);
        await endVerticalGesture(session, 52);
        await expect
          .poll(() => surface.evaluate((element) => element.scrollTop))
          .toBeGreaterThan(afterClose);
      } else {
        await reverseVerticalGesture(page, session, 52);
        await expect
          .poll(() => surface.evaluate((element) => element.scrollTop))
          .toBeLessThan(afterClose);
      }
      expectUsableSingleOwner(await probeSnapshot(page), "dish");
      assertTrustedSingleTouch(await probeEvents(page));
    });
  });
}
