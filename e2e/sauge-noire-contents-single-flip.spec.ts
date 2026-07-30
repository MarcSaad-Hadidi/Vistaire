import { expect, test, type Page } from "@playwright/test";

const contextQuery = {
  lang: "fr-CA",
  currency: "CAD",
  table: "main",
  zone: "terrasse"
};

const menuPath = (view: string) =>
  `/menu/sauge-noire?${new URLSearchParams({ ...contextQuery, view })}`;

type ContentsProbe = {
  engineStates: string[];
  phases: string[];
  historyUrls: string[];
  handoffSnapshots: Array<{
    phase: string | null;
    engineVisible: string | null;
    logicalPage: string | null;
    actualPage: string | null;
  }>;
};

declare global {
  interface Window {
    __saugeContentsProbe?: ContentsProbe;
  }
}

async function installContentsProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: ContentsProbe = {
      engineStates: [],
      phases: [],
      historyUrls: [],
      handoffSnapshots: []
    };
    window.__saugeContentsProbe = probe;

    const recordSnapshot = () => {
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
      if (!previous || JSON.stringify(previous) !== JSON.stringify(snapshot)) {
        probe.handoffSnapshots.push(snapshot);
      }
    };

    const observe = () => {
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (!(record.target instanceof HTMLElement)) continue;
          if (record.attributeName === "data-page-flip-engine-state") {
            const state = record.target.getAttribute(record.attributeName);
            if (state && probe.engineStates.at(-1) !== state) {
              probe.engineStates.push(state);
            }
          }
          if (record.attributeName === "data-page-flip-single-jump-phase") {
            const phase = record.target.getAttribute(record.attributeName);
            if (phase && probe.phases.at(-1) !== phase) {
              probe.phases.push(phase);
            }
          }
        }
        recordSnapshot();
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
      recordSnapshot();
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
  await expect(owner).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-page-flip-fallback="error"]')).toHaveCount(0);
  return owner;
}

async function resetProbe(page: Page) {
  await page.evaluate(() => {
    const probe = window.__saugeContentsProbe;
    if (!probe) throw new Error("Sauge contents probe is missing");
    probe.engineStates = [];
    probe.phases = [];
    probe.historyUrls = [];
    probe.handoffSnapshots = [];
  });
}

async function readProbe(page: Page): Promise<ContentsProbe> {
  return page.evaluate(() => {
    const probe = window.__saugeContentsProbe;
    if (!probe) throw new Error("Sauge contents probe is missing");
    return structuredClone(probe);
  });
}

async function expectSettledDestination(page: Page, finalPage: number) {
  await expect(page.locator('[data-testid="sauge-noire-book"]')).toHaveAttribute(
    "data-page-index",
    String(finalPage),
    { timeout: 15_000 }
  );
  await expect(
    page.locator(
      `[data-page-flip-current-page="${finalPage}"]` +
        `[data-page-flip-actual-page="${finalPage}"]` +
        '[data-page-flip-engine-state="read"]'
    )
  ).toHaveCount(1, { timeout: 15_000 });
  await expect(page).toHaveURL(
    new RegExp(`[?&]view=sauge-${finalPage}(?:&|$)`)
  );
  const url = new URL(page.url());
  for (const [key, value] of Object.entries(contextQuery)) {
    expect(url.searchParams.get(key)).toBe(value);
  }
  await expect(page.locator('[data-page-flip-fallback="error"]')).toHaveCount(0);
}

function expectExactlyOneAnimatedCycle(probe: ContentsProbe) {
  expect(probe.engineStates.filter((state) => state === "flipping")).toHaveLength(
    1
  );
  expect(probe.engineStates.at(-1)).toBe("read");
  expect(
    probe.handoffSnapshots.filter(
      ({ phase, engineVisible, logicalPage, actualPage }) =>
        (phase === "read-after-single-flip" ||
          phase === "instant-jump-to-target") &&
        logicalPage !== actualPage &&
        engineVisible !== "true"
    )
  ).toEqual([]);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 }
]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test.setTimeout(60_000);

    test.beforeEach(async ({ page }) => {
      await installContentsProbe(page);
    });

    test("the first section is exactly one normal forward animation", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-1"), {
        waitUntil: "domcontentloaded"
      });
      const owner = await waitForReady(page);
      await resetProbe(page);
      await owner
        .locator("nav button", { hasText: "Premiers gestes" })
        .click();

      await expectSettledDestination(page, 2);
      const probe = await readProbe(page);
      expectExactlyOneAnimatedCycle(probe);
      expect(probe.phases).not.toContain("instant-jump-to-target");
    });

    test("a far section animates once then jumps directly to its target", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-1"), {
        waitUntil: "domcontentloaded"
      });
      const owner = await waitForReady(page);
      await resetProbe(page);
      await owner
        .locator("nav button", { hasText: "Cocktails signatures" })
        .click();

      await expectSettledDestination(page, 7);
      const probe = await readProbe(page);
      expectExactlyOneAnimatedCycle(probe);
      expect(probe.phases).toContain("instant-jump-to-target");
      expect(
        probe.historyUrls.filter((url) =>
          /[?&]view=sauge-(?:2|3|4|5|6)(?:&|$)/.test(url)
        )
      ).toEqual([]);
    });

    test("the ending animates once then jumps directly to the final page", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-1"), {
        waitUntil: "domcontentloaded"
      });
      const owner = await waitForReady(page);
      await resetProbe(page);
      await owner
        .locator("nav button", { hasText: "Merci et à bientôt" })
        .click();

      await expectSettledDestination(page, 9);
      const probe = await readProbe(page);
      expectExactlyOneAnimatedCycle(probe);
      expect(probe.phases).toContain("instant-jump-to-target");
      expect(
        probe.historyUrls.filter((url) =>
          /[?&]view=sauge-(?:2|3|4|5|6|7|8)(?:&|$)/.test(url)
        )
      ).toEqual([]);
    });

    test("returning from a far section animates once then jumps to contents", async ({
      page
    }) => {
      await page.goto(menuPath("sauge-7"), {
        waitUntil: "domcontentloaded"
      });
      const owner = await waitForReady(page);
      await resetProbe(page);
      await owner
        .locator('[data-sauge-typography-role="contents-control"]')
        .click();

      await expectSettledDestination(page, 1);
      const probe = await readProbe(page);
      expectExactlyOneAnimatedCycle(probe);
      expect(probe.phases).toContain("instant-jump-to-target");
      expect(
        probe.historyUrls.filter((url) =>
          /[?&]view=sauge-(?:2|3|4|5|6)(?:&|$)/.test(url)
        )
      ).toEqual([]);
    });
  });
}
