import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const focusDiagnosticScenario = /landing-style public Menu|public Menu keeps every link|navigation stays parked|landing Menu shares/;

test.beforeEach(async ({ page }, info) => {
  if (!focusDiagnosticScenario.test(info.title)) return;
  await page.addInitScript(() => {
    const scope = '[data-public-navigation-toggle], [data-public-navigation-open], [data-public-menu], .mobile-menu';
    const events: unknown[] = [];
    const describe = (node: EventTarget | null) => {
      if (!(node instanceof Element)) return null;
      return {
        tag: node.tagName,
        id: node.id,
        role: node.getAttribute('role'),
        label: node.getAttribute('aria-label'),
        href: node.getAttribute('href')?.split(/[?#]/)[0],
        tabIndex: node instanceof HTMLElement ? node.tabIndex : null,
      };
    };
    const ancestors = (node: Element, withStyles: boolean) => {
      const result = [];
      for (let current: Element | null = node; current && result.length < 8; current = current.parentElement) {
        const style = withStyles ? getComputedStyle(current) : null;
        result.push({
          ...describe(current),
          inert: current.hasAttribute('inert'),
          inertProperty: current instanceof HTMLElement ? current.inert : null,
          hidden: current.hasAttribute('hidden'),
          ariaHidden: current.getAttribute('aria-hidden'),
          expanded: current.getAttribute('aria-expanded'),
          navigationOpen: current.getAttribute('data-public-navigation-open'),
          className: current.getAttribute('class'),
          style: style && {
            display: style.display, visibility: style.visibility, opacity: style.opacity,
            pointerEvents: style.pointerEvents, contentVisibility: style.contentVisibility,
            transform: style.transform, transitionProperty: style.transitionProperty,
          },
        });
      }
      return result;
    };
    const record = (entry: object) => {
      if (events.length < 160) events.push({ at: performance.now(), ...entry });
    };
    const nativeFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, ...args: Parameters<HTMLElement['focus']>) {
      if (!(this instanceof HTMLElement) || !this.closest(scope)) return Reflect.apply(nativeFocus, this, args);
      // No style/layout read before the original call: do not repair the failure while observing it.
      try {
        record({ kind: 'focus-call-before', target: describe(this), active: describe(document.activeElement),
          hasFocus: document.hasFocus(), argumentCount: args.length, ancestors: ancestors(this, false),
          stack: new Error().stack?.split('\n').slice(1, 7) });
      } catch { /* Telemetry must not prevent the original call. */ }
      try {
        return Reflect.apply(nativeFocus, this, args);
      } finally {
        try {
          const active = describe(document.activeElement);
          const hasFocus = document.hasFocus();
          record({ kind: 'focus-call-after', target: describe(this), active, hasFocus,
            ancestors: ancestors(this, true) });
        } catch { /* Preserve the native return value or exception. */ }
      }
    };
    for (const type of ['focusin', 'focusout']) {
      document.addEventListener(type, (event) => {
        record({ kind: type, target: describe(event.target), active: describe(document.activeElement), hasFocus: document.hasFocus() });
      }, true);
    }
    for (const type of ['focus', 'blur']) {
      window.addEventListener(type, () => record({ kind: `window-${type}`, active: describe(document.activeElement), hasFocus: document.hasFocus() }));
    }
    Object.assign(window, { __vistaireNavigationFocus: {
      events,
      snapshot: () => ({
        hasFocus: document.hasFocus(), visibilityState: document.visibilityState,
        active: describe(document.activeElement), bodyOverflow: getComputedStyle(document.body).overflow,
        candidates: [...document.querySelectorAll(`${scope}, [data-public-navigation-open] a[href], [data-public-menu] nav:first-child a[href], .mobile-menu nav:first-child button`)]
          .slice(0, 28).map((node) => ({ element: describe(node), ancestors: ancestors(node, true) })),
      }),
    } });
  });
});

test.afterEach(async ({ page }, info) => {
  if (!focusDiagnosticScenario.test(info.title)) return;
  const evidence = await page.evaluate(() => {
    const diagnostics = (window as Window & {
      __vistaireNavigationFocus?: { events: unknown[]; snapshot: () => unknown };
    }).__vistaireNavigationFocus;
    return diagnostics ? { events: diagnostics.events, final: diagnostics.snapshot() } : { unavailable: 'diagnostics missing from document' };
  }).catch((error: Error) => ({ unavailable: error.message.slice(0, 300) }));
  // This filename matches the existing core artifact's *native-scroll*.json retention glob.
  const path = info.outputPath('navigation-focus-native-scroll.json');
  await writeFile(path, JSON.stringify({ title: info.title, status: info.status, evidence }, null, 2));
  await info.attach('navigation-focus-native-scroll.json', { path, contentType: 'application/json' });
});

type HomeScenario = {
  label: "Accueil" | "Home";
  path: string;
  expectedPath: "/" | "/en";
};

type LocaleSwitchScenario = {
  sourcePath: string;
  sourceLocale: "fr-CA" | "en-CA";
  sourceControl: "Langue" | "Language";
  sourceLinkName: "Voir cette page en français" | "View this page in English";
  destinationPath: string;
  destinationLocale: "fr-CA" | "en-CA";
  destinationControl: "Langue" | "Language";
  destinationLinkName:
    | "Voir cette page en français"
    | "View this page in English";
};

const localeSwitchScenarios: readonly LocaleSwitchScenario[] = [
  {
    sourcePath: "/",
    sourceLocale: "fr-CA",
    sourceControl: "Langue",
    sourceLinkName: "Voir cette page en français",
    destinationPath: "/en",
    destinationLocale: "en-CA",
    destinationControl: "Language",
    destinationLinkName: "View this page in English"
  },
  {
    sourcePath: "/en",
    sourceLocale: "en-CA",
    sourceControl: "Language",
    sourceLinkName: "View this page in English",
    destinationPath: "/",
    destinationLocale: "fr-CA",
    destinationControl: "Langue",
    destinationLinkName: "Voir cette page en français"
  },
  {
    sourcePath: "/a-propos",
    sourceLocale: "fr-CA",
    sourceControl: "Langue",
    sourceLinkName: "Voir cette page en français",
    destinationPath: "/en/about",
    destinationLocale: "en-CA",
    destinationControl: "Language",
    destinationLinkName: "View this page in English"
  },
  {
    sourcePath: "/en/about",
    sourceLocale: "en-CA",
    sourceControl: "Language",
    sourceLinkName: "View this page in English",
    destinationPath: "/a-propos",
    destinationLocale: "fr-CA",
    destinationControl: "Langue",
    destinationLinkName: "Voir cette page en français"
  }
];

const frenchSecondaryHomeScenarios: HomeScenario[] = [
  { label: "Accueil", path: "/menu-qr-code-restaurant", expectedPath: "/" },
  { label: "Accueil", path: "/menu-pdf-vs-menu-digital", expectedPath: "/" },
  { label: "Accueil", path: "/menu-digital-restaurant", expectedPath: "/" },
  { label: "Accueil", path: "/menu-3d-ar-restaurant", expectedPath: "/" },
  { label: "Accueil", path: "/apercu-restaurateur", expectedPath: "/" },
  { label: "Accueil", path: "/tarifs-menu-digital-restaurant", expectedPath: "/" }
];

const englishSecondaryHomeScenarios: HomeScenario[] = [
  {
    label: "Home",
    path: "/en/qr-code-restaurant-menu",
    expectedPath: "/en"
  },
  {
    label: "Home",
    path: "/en/pdf-vs-digital-menu",
    expectedPath: "/en"
  },
  {
    label: "Home",
    path: "/en/digital-restaurant-menu",
    expectedPath: "/en"
  },
  {
    label: "Home",
    path: "/en/3d-ar-restaurant-menu",
    expectedPath: "/en"
  },
  {
    label: "Home",
    path: "/en/restaurant-preview",
    expectedPath: "/en"
  },
  {
    label: "Home",
    path: "/en/pricing-digital-restaurant-menu",
    expectedPath: "/en"
  }
];

async function showPublicNavigation(page: Page) {
  const tab = page.locator('[data-public-navigation-toggle]');
  if (await page.locator('.preloader').count()) {
    await expect(page.locator('.preloader')).toHaveCount(0, { timeout: 120_000 });
  }
  await expect(tab).toBeVisible();
  if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
  await expect(tab).toHaveAttribute('aria-expanded', 'true');
}

function topNavigation(page: Page) {
  return page.locator(
    'nav[aria-label="Navigation principale"], nav[aria-label="Main navigation"]'
  ).first();
}

async function expectNoCurrent(
  nav: ReturnType<typeof topNavigation>,
  labels: readonly string[]
) {
  for (const label of labels) {
    await expect(nav.getByRole("link", { name: label, exact: true })).not.toHaveAttribute(
      "aria-current"
    );
  }
}

async function expectPricingNavigation(
  nav: ReturnType<typeof topNavigation>,
  locale: "fr" | "en",
  active = false
) {
  const label = locale === "en" ? "Pricing" : "Tarifs";
  const href = active
    ? "#pricing-title"
    : locale === "en"
      ? "/en/pricing-digital-restaurant-menu"
      : "/tarifs-menu-digital-restaurant";
  const link = nav.getByRole("link", { name: label, exact: true });

  await expect(link).toHaveCount(1);
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", href);
  if (active) {
    await expect(link).toHaveAttribute("aria-current", "page");
  } else {
    await expect(link).not.toHaveAttribute("aria-current");
  }
}

async function expectHomeNavigation(
  page: Page,
  scenario: HomeScenario
) {
  await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
  await showPublicNavigation(page);
  const nav = topNavigation(page);
  const home = nav.getByRole("link", { name: scenario.label, exact: true });

  await expect(home).toHaveAttribute("href", scenario.expectedPath);
  await expect(home).not.toHaveAttribute("aria-current");
  await expectNoCurrent(nav, [
    scenario.label === "Accueil" ? "Carte" : "Menu",
    scenario.label === "Accueil" ? "À propos" : "About",
    "Contact"
  ]);
  await expectPricingNavigation(
    nav,
    scenario.label === "Accueil" ? "fr" : "en",
    scenario.path === "/tarifs-menu-digital-restaurant" ||
      scenario.path === "/en/pricing-digital-restaurant-menu"
  );

  await home.click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(scenario.expectedPath);
  expect(new URL(page.url()).hash).toBe("");
}

function rawDocumentLanguage(html: string) {
  const openingTags = html.match(/<html\b[^>]*>/gi) ?? [];
  expect(openingTags).toHaveLength(1);
  const openingTag = openingTags[0];
  if (!openingTag) throw new Error("Initial response is missing its opening html tag.");
  const language = openingTag.match(/\blang\s*=\s*["']([^"']+)["']/i);
  return language?.[1] ?? null;
}

async function expectFullDocumentLocaleSwitch(
  page: Page,
  scenario: LocaleSwitchScenario
) {
  const sourceResponse = await page.goto(scenario.sourcePath, {
    waitUntil: "domcontentloaded"
  });
  await showPublicNavigation(page);
  expect(sourceResponse, `${scenario.sourcePath}: source response`).not.toBeNull();
  expect(sourceResponse?.status()).toBeLessThan(400);
  expect(rawDocumentLanguage(await sourceResponse!.text())).toBe(
    scenario.sourceLocale
  );
  await expect(page.locator("html")).toHaveAttribute("lang", scenario.sourceLocale);
  if (scenario.sourcePath === "/" || scenario.sourcePath === "/en") {
    // Cold software-rendered scene startup is separate from navigation
    // correctness. Keep this bounded; it is not a site performance allowance.
    await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 120_000 });
  }

  const sourceLanguageControl = page
    .locator(`[data-public-controls] div[aria-label="${scenario.sourceControl}"]`)
    .first();
  await expect(sourceLanguageControl).toBeVisible();
  await expect(
    sourceLanguageControl.getByRole("link", {
      name: scenario.sourceLinkName,
      exact: true
    })
  ).toHaveAttribute("aria-current", "true");

  const destinationLink = sourceLanguageControl.getByRole("link", {
    name:
      scenario.destinationLocale === "en-CA"
        ? "View this page in English"
        : "Voir cette page en français",
    exact: true
  });
  await expect(destinationLink).toHaveAttribute("href", scenario.destinationPath);
  await page.evaluate(() => {
    (window as Window & { __vistaireRootNavigationSentinel?: string })
      .__vistaireRootNavigationSentinel = "must-not-survive";
  });

  const navigationResponsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame() &&
      new URL(response.url()).pathname === scenario.destinationPath
    );
  });
  await destinationLink.click();
  const navigationResponse = await navigationResponsePromise;
  await page.waitForLoadState("domcontentloaded");
  if (scenario.destinationPath === "/" || scenario.destinationPath === "/en") {
    await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 120_000 });
  }
  expect(
    navigationResponse,
    `${scenario.sourcePath} -> ${scenario.destinationPath}: main-document response`
  ).not.toBeNull();
  expect(navigationResponse?.status()).toBeLessThan(400);
  expect(new URL(navigationResponse!.url()).pathname).toBe(
    scenario.destinationPath
  );
  expect(rawDocumentLanguage(await navigationResponse!.text())).toBe(
    scenario.destinationLocale
  );
  expect(new URL(page.url()).pathname).toBe(scenario.destinationPath);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __vistaireRootNavigationSentinel?: string })
          .__vistaireRootNavigationSentinel
    )
  ).toBeUndefined();
  await expect(page.locator("html")).toHaveAttribute(
    "lang",
    scenario.destinationLocale
  );

  const navigationEntries = await page.evaluate(() =>
    performance.getEntriesByType("navigation").map((entry) => ({
      name: entry.name,
      type: (entry as PerformanceNavigationTiming).type
    }))
  );
  expect(navigationEntries.length).toBeGreaterThan(0);
  expect(navigationEntries.at(-1)?.type).toBe("navigate");
  expect(new URL(navigationEntries.at(-1)?.name ?? BASE_URL).pathname).toBe(
    scenario.destinationPath
  );

  await showPublicNavigation(page);
  const destinationLanguageControl = page
    .locator(`[data-public-controls] div[aria-label="${scenario.destinationControl}"]`)
    .first();
  await expect(destinationLanguageControl).toBeVisible();
  await expect(
    destinationLanguageControl.getByRole("link", {
      name: scenario.destinationLinkName,
      exact: true
    })
  ).toHaveAttribute("aria-current", "true");
  await expect(
    destinationLanguageControl.getByRole("link", {
      name: scenario.sourceLinkName,
      exact: true
    })
  ).not.toHaveAttribute("aria-current");
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(new URL(canonical ?? "", BASE_URL).pathname).toBe(
    scenario.destinationPath
  );
}

test.describe("Vistaire public navigation", () => {
  for (const scenario of localeSwitchScenarios) {
    test(`uses a full document navigation from ${scenario.sourcePath} to ${scenario.destinationPath}`, async ({
      page
    }) => {
      if (scenario.sourcePath === "/" || scenario.sourcePath === "/en") {
        test.setTimeout(240_000);
      }
      await expectFullDocumentLocaleSwitch(page, scenario);
    });
  }

  for (const scenario of frenchSecondaryHomeScenarios) {
    test(`returns Accueil to / from ${scenario.path}`, async ({ page }) => {
      await expectHomeNavigation(page, scenario);
    });
  }

  for (const scenario of englishSecondaryHomeScenarios) {
    test(`returns Home to /en from ${scenario.path}`, async ({ page }) => {
      await expectHomeNavigation(page, scenario);
    });
  }

  test("uses the same public top bar on pricing in both languages", async ({ page }) => {
    for (const scenario of [
      {
        path: "/tarifs-menu-digital-restaurant",
        brand: "Vistaire - accueil",
        home: "/",
        links: ["Accueil", "Carte", "À propos", "Contact"],
        cta: "Prendre rendez vous",
        compactCta: "Rendez vous"
      },
      {
        path: "/en/pricing-digital-restaurant-menu",
        brand: "Vistaire - home",
        home: "/en",
        links: ["Home", "Menu", "About", "Contact"],
        cta: "Book a call",
        compactCta: "Book"
      }
    ] as const) {
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      await showPublicNavigation(page);
      const nav = topNavigation(page);

      await expect(
        nav.getByRole("link", { name: scenario.brand, exact: true })
      ).toHaveAttribute("href", scenario.home);
      for (const label of scenario.links) {
        await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
      }
      await expectNoCurrent(nav, scenario.links);
      await expect(page.locator("#pricing-title")).toBeVisible();
      await expectPricingNavigation(
        nav,
        scenario.path.startsWith("/en/") ? "en" : "fr",
        true
      );
      const compactNavigation = (page.viewportSize()?.width ?? 0) <= 1100;
      await expect(
        nav.getByRole("link", {
          name: compactNavigation ? scenario.compactCta : scenario.cta,
          exact: true
        })
      ).toBeVisible();
    }
  });

  test("keeps immersive chapter navigation valid in both locales", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    for (const locale of ["fr", "en"] as const) {
      await page.goto(locale === "en" ? "/en" : "/", { waitUntil: "domcontentloaded" });
      await showPublicNavigation(page);
      // SSR-visible controls precede scene initialization and final font metrics.
      // Exercise a ready journey, while retaining the actual smooth-scroll check.
      await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 120_000 });
      await page.evaluate(() => document.fonts.ready);
      const nav = topNavigation(page);
      const chapters = [
        ["Intro", "hero"],
        [locale === "en" ? "The experience" : "L’expérience", "features"],
        ["Collections", "product"],
        [locale === "en" ? "Pricing" : "Tarifs", "open-weight"],
        ["Contact", "footer"],
      ];
      for (const [label, id] of chapters) {
        await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
        await expect(page.locator(`#${id}`)).toHaveCount(1);
      }
      for (const [label, id, tolerance] of [
        ["Contact", "footer", 120],
        ["Intro", "hero", 10],
      ] as const) {
        const beforeClick = await page.locator(`#${id}`).evaluate((element) => ({
          scrollY,
          targetTop: element.getBoundingClientRect().top + scrollY,
        }));
        const clickStarted = Date.now();
        await nav.getByRole("button", { name: label, exact: true }).click();
        const clickReturned = Date.now();
        const samples: Array<Record<string, unknown> & { elapsedMs: number; distance: number }> = [];
        let arrived = false;
        try {
          // Keep native smooth scrolling and the exact destination contract.
          // The bounded diagnostic budget measures correctness under software
          // WebGL; an arrival beyond 5s remains a reported performance concern.
          await expect.poll(async () => {
            const state = await page.locator(`#${id}`).evaluate((element, targetId) => {
              const rect = element.getBoundingClientRect();
              const canvas = document.querySelector<HTMLCanvasElement>(".scene-canvas");
              return {
                distance: targetId === "hero" ? Math.abs(scrollY) : Math.abs(rect.top),
                scrollY,
                targetTop: rect.top + scrollY,
                targetViewportTop: rect.top,
                maxScroll: document.documentElement.scrollHeight - innerHeight,
                hash: location.hash,
                chapter: document.documentElement.dataset.chapter,
                bodyOverflow: getComputedStyle(document.body).overflow,
                renderer: canvas ? {
                  ready: canvas.dataset.ready,
                  settled: canvas.dataset.settled,
                  suspended: canvas.dataset.suspended,
                  section: canvas.dataset.section,
                  progress: canvas.dataset.progress,
                  frames: canvas.dataset.frames,
                  renderCPUms: canvas.dataset.renderCPUms,
                } : null,
              };
            }, id);
            samples.push({ elapsedMs: Date.now() - clickReturned, ...state });
            return state.distance;
          }, { timeout: 30_000, intervals: [100, 250], message: `${locale}: ${label} reaches its native scroll destination` })
            .toBeLessThan(tolerance);
          arrived = true;
        } finally {
          const last = samples.at(-1);
          const diagnosticPath = testInfo.outputPath(`${locale}-${id}-native-scroll.json`);
          await writeFile(diagnosticPath, JSON.stringify({
            locale, target: id, tolerance, arrived, beforeClick,
            clickDurationMs: clickReturned - clickStarted,
            arrivalElapsedMs: arrived ? last?.elapsedMs : null,
            performanceWarning: !arrived || (last?.elapsedMs ?? 0) > 5_000,
            lastSampleWithinFiveSeconds: samples.filter((sample) => sample.elapsedMs <= 5_000).at(-1) ?? null,
            firstSampleAfterFiveSeconds: samples.find((sample) => sample.elapsedMs >= 5_000) ?? null,
            runtimeErrors,
            samples,
          }, null, 2));
          await testInfo.attach(`${locale}-${id}-native-scroll.json`, {
            contentType: "application/json",
            path: diagnosticPath,
          });
        }
        expect(runtimeErrors, `${locale}: native navigation runtime errors`).toEqual([]);
      }
    }
  });

  test("keeps the canonical menu route and local Carte anchor", async ({ page }) => {
    for (const scenario of [
      { path: "/demo", label: "Carte", expectedPath: "/" },
      { path: "/en/vistaire-menu", label: "Menu", expectedPath: "/en" }
    ] as const) {
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      await showPublicNavigation(page);
      const nav = topNavigation(page);
      const menu = nav.getByRole("link", { name: scenario.label, exact: true });
      const homeLabel = scenario.path === "/demo" ? "Accueil" : "Home";
      const home = nav.getByRole("link", { name: homeLabel, exact: true });

      await expect(menu).toHaveAttribute("href", "#carte");
      await expect(page.locator("#carte")).toHaveCount(1);
      await expect(menu).toHaveAttribute("aria-current", "page");
      await expect(home).toHaveAttribute("href", scenario.expectedPath);
      await expectNoCurrent(nav, [
        homeLabel,
        scenario.label === "Carte" ? "À propos" : "About",
        "Contact"
      ]);
      await expectPricingNavigation(
        nav,
        scenario.path.startsWith("/en/") ? "en" : "fr"
      );
    }
  });

  test("keeps About and Contact local anchors only on their canonical routes", async ({
    page
  }) => {
    for (const scenario of [
      {
        path: "/a-propos",
        label: "À propos",
        href: "#a-propos",
        anchor: "#a-propos"
      },
      {
        path: "/en/about",
        label: "About",
        href: "#a-propos",
        anchor: "#a-propos"
      },
      {
        path: "/contact",
        label: "Contact",
        href: "#contact-preview",
        anchor: "#contact-preview"
      },
      {
        path: "/en/contact",
        label: "Contact",
        href: "#contact-preview",
        anchor: "#contact-preview"
      }
    ] as const) {
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      await showPublicNavigation(page);
      const nav = topNavigation(page);
      const link = nav.getByRole("link", { name: scenario.label, exact: true });

      await expect(link).toHaveAttribute("href", scenario.href);
      await expect(page.locator(scenario.anchor)).toHaveCount(1);
      await expect(link).toHaveAttribute("aria-current", "page");
      const labels = scenario.path.startsWith("/en")
        ? ["Home", "Menu", "About", "Contact"]
        : ["Accueil", "Carte", "À propos", "Contact"];
      await expectNoCurrent(nav, labels.filter((label) => label !== scenario.label));
      await expectPricingNavigation(
        nav,
        scenario.path.startsWith("/en/") ? "en" : "fr"
      );
    }
  });

  test("uses canonical Carte and About destinations from secondary pages", async ({
    page
  }) => {
    for (const scenario of [
      {
        path: "/menu-digital-restaurant",
        menuLabel: "Carte",
        menuPath: "/demo",
        aboutLabel: "À propos",
        aboutPath: "/a-propos"
      },
      {
        path: "/en/digital-restaurant-menu",
        menuLabel: "Menu",
        menuPath: "/en/vistaire-menu",
        aboutLabel: "About",
        aboutPath: "/en/about"
      }
    ] as const) {
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      await showPublicNavigation(page);
      const nav = topNavigation(page);

      await expect(
        nav.getByRole("link", { name: scenario.menuLabel, exact: true })
      ).toHaveAttribute("href", scenario.menuPath);
      await expect(
        nav.getByRole("link", { name: scenario.aboutLabel, exact: true })
      ).toHaveAttribute("href", scenario.aboutPath);
      await expectNoCurrent(nav, [
        scenario.path.startsWith("/en") ? "Home" : "Accueil",
        scenario.menuLabel,
        scenario.aboutLabel,
        "Contact"
      ]);
      await expectPricingNavigation(
        nav,
        scenario.path.startsWith("/en/") ? "en" : "fr"
      );
    }
  });

  test("uses canonical Contact from appointment pages and from a GEO page", async ({
    page
  }) => {
    for (const scenario of [
      { path: "/prendre-rendez-vous", expectedContact: "/contact", home: "/" },
      { path: "/en/book-a-call", expectedContact: "/en/contact", home: "/en" },
      { path: "/menu-qr-sans-pdf", expectedContact: "/contact", home: "/" },
      {
        path: "/en/qr-menu-without-pdf",
        expectedContact: "/en/contact",
        home: "/en"
      }
    ] as const) {
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      await showPublicNavigation(page);
      const nav = topNavigation(page);
      const contact = nav.getByRole("link", { name: "Contact", exact: true });
      const home = nav.getByRole("link", {
        name: scenario.home === "/" ? "Accueil" : "Home",
        exact: true
      });

      await expect(contact).toHaveAttribute("href", scenario.expectedContact);
      await expect(home).toHaveAttribute("href", scenario.home);
      await expectNoCurrent(nav, [
        scenario.home === "/" ? "Accueil" : "Home",
        scenario.home === "/" ? "Carte" : "Menu",
        scenario.home === "/" ? "À propos" : "About",
        "Contact"
      ]);
      await expectPricingNavigation(
        nav,
        scenario.home === "/" ? "fr" : "en"
      );
    }
  });

  test("preserves accessible navigation names and keyboard focus", async ({
    browser,
    browserName
  }) => {
    const context = await browser.newContext({
      hasTouch: false,
      isMobile: false,
      viewport: { width: 1280, height: 900 }
    });
    const page = await context.newPage();
    try {
      await page.goto("/menu-qr-code-restaurant", {
        waitUntil: "domcontentloaded"
      });
      await showPublicNavigation(page);
      const nav = topNavigation(page);

      await expect(nav.getByRole("link", { name: "Accueil", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Carte", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "À propos", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Contact", exact: true })).toBeVisible();
      await expectPricingNavigation(nav, "fr");

      const home = nav.getByRole("link", { name: "Accueil", exact: true });
      expect(await home.evaluate((element) => (element as HTMLElement).tabIndex)).toBe(0);
      let reachedHomeWithKeyboard = false;
      const keyboardFocusTrail: string[] = [];
      if (browserName === "webkit") {
        // Playwright WebKit follows Safari's platform preference that Tab
        // traverses form controls, not links. Seed keyboard modality, then
        // prove the semantic link accepts visible focus and keyboard activation.
        await page.keyboard.press("Tab");
        await home.focus();
        reachedHomeWithKeyboard = await home.evaluate(
          (element) => element === document.activeElement
        );
      } else {
        for (let tabIndex = 0; tabIndex < 12; tabIndex += 1) {
          await page.keyboard.press("Tab");
          keyboardFocusTrail.push(
            await page.evaluate(() => {
              const active = document.activeElement;
              if (!(active instanceof HTMLElement)) return "none";
              return [
                active.tagName.toLowerCase(),
                active.getAttribute("href") ?? "",
                active.getAttribute("aria-label") ?? "",
                active.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? ""
              ].join("|");
            })
          );
          if (await home.evaluate((element) => element === document.activeElement)) {
            reachedHomeWithKeyboard = true;
            break;
          }
        }
      }
      expect(
        reachedHomeWithKeyboard,
        `the primary home link must accept keyboard-modality focus; focus trail: ${keyboardFocusTrail.join(" -> ")}`
      ).toBe(true);
      await expect(home).toBeFocused();
      expect(
        await home.evaluate((element) => element.matches(":focus-visible"))
      ).toBe(true);
      await expect(page.locator("a:focus-visible")).toHaveCount(1);
      const focusIndicator = await home.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth)
        };
      });
      expect(focusIndicator.outlineStyle).not.toBe("none");
      expect(focusIndicator.outlineWidth).toBeGreaterThanOrEqual(2);

      await Promise.all([
        page.waitForURL((url) => url.pathname === "/"),
        page.keyboard.press("Enter")
      ]);
    } finally {
      await context.close();
    }
  });
});

test("public theme and mobile controls persist across locale navigation and reload", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/a-propos?utm_source=theme-test");
  await showPublicNavigation(page);
  const nav = topNavigation(page);
  const controls = nav.locator("[data-public-controls]");
  await expect(page.locator("html")).toHaveAttribute("data-vistaire-theme", "dark");
  for (const control of await controls.locator("a, button").all()) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    const layout = await control.evaluate(element => ({
      width: (element as HTMLElement).offsetWidth, height: (element as HTMLElement).offsetHeight,
    }));
    expect(layout.width).toBeGreaterThanOrEqual(44);
    expect(layout.height).toBeGreaterThanOrEqual(44);
    // A translated 44px target can report 43.999999px while the bar animates.
    // Retain the actual 44px layout requirement and normalize only subpixel noise.
    expect(Math.round(box!.width * 1000) / 1000).toBeGreaterThanOrEqual(44);
    expect(Math.round(box!.height * 1000) / 1000).toBeGreaterThanOrEqual(44);
  }
  await controls.getByRole("button", { name: "Thème clair", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-vistaire-theme", "light");
  await expect(page.locator("main[data-public-vistaire]")).toHaveCSS("background-color", "rgb(247, 243, 233)");
  const menu = page.locator("[data-public-menu]");
  const trigger = nav.locator("button[aria-controls]");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toHaveAttribute("aria-hidden", "false");
  await controls.getByRole("button").focus();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await controls.getByRole("link", { name: "View this page in English" }).click();
  await expect(page).toHaveURL(/\/en\/about\?utm_source=theme-test$/);
  await expect(page.locator("html")).toHaveAttribute("data-vistaire-theme", "light");
  await expect(topNavigation(page).locator("button[aria-controls]")).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await showPublicNavigation(page);
  await expect(page.locator("html")).toHaveAttribute("data-vistaire-theme", "light");
  await expect(topNavigation(page).getByRole("button", { name: "Light theme", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const other = await context.newPage();
  await other.goto("/contact");
  await showPublicNavigation(other);
  await other.locator("[data-public-theme-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-vistaire-theme", "dark");
  await expect(topNavigation(page).getByRole("button", { name: "Light theme", exact: true })).toHaveAttribute("aria-pressed", "false");
  await other.close();
  expect(errors.filter((error) => /hydration|did not match/i.test(error))).toEqual([]);
});

test("public theme remains usable when local storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
  });
  await page.goto("/contact");
  await showPublicNavigation(page);
  await expect(page.locator("html")).toHaveAttribute("data-vistaire-theme", "dark");
  await page.locator("[data-public-theme-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-vistaire-theme", "light");
});

test("public theme uses BeUI blinds with keyboard and rapid-click safety on mobile and desktop", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.removeItem("vistaire-public-theme");
    const nativeStart = document.startViewTransition.bind(document);
    const captures: { variant: string | null; animation: string; mask: string }[] = [];
    Object.assign(window, { themeTransitionCaptures: captures });
    Object.defineProperty(document, "startViewTransition", { value: (update: () => void) => {
      const transition = nativeStart(update);
      void transition.ready.then(() => {
        const style = getComputedStyle(document.documentElement, "::view-transition-new(root)");
        captures.push({
          variant: document.documentElement.getAttribute("data-vistaire-theme-transition"),
          animation: style.animationName,
          mask: style.maskImage,
        });
      }).catch(() => {});
      return transition;
    } });
  });
  for (const scenario of [
    { path: "/a-propos", width: 390, label: "Thème clair" },
    { path: "/en/about", width: 430, label: "Light theme" },
    { path: "/contact", width: 1440, label: "Thème clair" },
  ]) {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await page.goto(scenario.path);
    await showPublicNavigation(page);
    const toggle = page.getByRole("button", { name: scenario.label, exact: true });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).not.toHaveAttribute("data-vistaire-theme-transition");
    await expect(toggle).toBeFocused();
    // Two synchronous activations must not create competing page snapshots.
    await toggle.evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("html")).not.toHaveAttribute("data-vistaire-theme-transition");
    const captures = await page.evaluate(() => (window as unknown as {
      themeTransitionCaptures: { variant: string; animation: string; mask: string }[];
    }).themeTransitionCaptures);
    expect(captures).toHaveLength(2);
    for (const capture of captures) {
      expect(capture.variant).toBe("blinds");
      expect(capture.animation).toBe("vistaire-theme-blinds-reveal");
      expect(capture.mask).toContain("linear-gradient");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("public theme skips animation for reduced motion and unsupported browsers", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("vistaire-public-theme");
    const probe = { starts: 0 };
    Object.assign(window, { themeTransitionProbe: probe });
    Object.defineProperty(document, "startViewTransition", { value: () => {
      probe.starts += 1;
      throw new Error("Reduced motion started a transition");
    }, configurable: true });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/contact");
  await showPublicNavigation(page);
  const toggle = page.locator("[data-public-theme-toggle]");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).not.toHaveAttribute("data-vistaire-theme-transition");
  expect(await page.evaluate(() => (window as unknown as { themeTransitionProbe: { starts: number } }).themeTransitionProbe.starts)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => Object.defineProperty(document, "startViewTransition", { value: undefined }));
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toBeFocused();
  await expect(page.locator("html")).not.toHaveAttribute("data-vistaire-theme-transition");
  expect(errors).toEqual([]);
});

for (const [width, height, path, target, label] of [
  [1440, 720, '/a-propos', '/apercu-restaurateur', 'Le Dashboard'],
  [390, 844, '/en/about', '/en/restaurant-preview', 'The dashboard'],
  [430, 932, '/a-propos', '/apercu-restaurateur', 'Le Dashboard'],
] as const) {
  test(`landing-style public Menu remains reachable through routes, themes and history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(path);
    await showPublicNavigation(page);
    const nav = topNavigation(page);
    const menu = page.locator('[data-public-menu]');
    const trigger = nav.locator('button[aria-controls]');
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await expect(menu).toHaveAttribute('aria-hidden', 'false');
    await expect(menu).toHaveCSS('background-color', 'rgb(5, 5, 5)');
    const panel = await menu.boundingBox();
    const header = await nav.boundingBox();
    expect(panel!.x + panel!.width).toBeCloseTo(width, 0);
    expect(panel!.width).toBeCloseTo(Math.min(width * 0.9, 440), 0);
    expect(panel!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 8);
    expect(panel!.y + panel!.height).toBeCloseTo(height - 12, 0);
    expect(await menu.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    for (const link of await menu.getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.y).toBeGreaterThanOrEqual(panel!.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(panel!.y + panel!.height);
    }
    const chapters = menu.locator('nav').first().getByRole('link');
    await expect(chapters).toHaveCount(5);
    for (const [index, id] of ['hero', 'features', 'product', 'open-weight', 'footer'].entries()) {
      await expect(chapters.nth(index)).toHaveAttribute('href', `${path.startsWith('/en/') ? '/en' : '/'}#${id}`);
    }
    await expect(menu.locator('nav').nth(1).getByRole('link')).toHaveCount(10);
    await expect(chapters.first()).toBeFocused();
    const firstControl = page.locator('[data-public-navigation-toggle]');
    const lastControl = menu.getByRole('link', { name: 'contact@vistaire.ca', exact: true });
    await firstControl.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(lastControl).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(firstControl).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    expect(await menu.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--vistaire-menu-top'))).toBe('');
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    await nav.locator('[data-public-theme-toggle]').click();
    await trigger.click();
    await expect(menu).toHaveCSS('background-color', 'rgb(247, 243, 233)');
    await menu.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(topNavigation(page).locator('button[aria-controls]')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-vistaire-theme', 'light');
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(topNavigation(page).locator('button[aria-controls]')).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const [width, height, label] of [
  [390, 420, 'short mobile viewport'],
  [720, 450, 'effective viewport at 200% desktop zoom'],
] as const) {
  test(`public Menu keeps every link accessible with ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/a-propos');
    await showPublicNavigation(page);
    const nav = topNavigation(page);
    const trigger = nav.locator('button[aria-controls]');
    const menu = page.locator('[data-public-menu]');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await expect(menu).toHaveCSS('overflow-y', 'auto');
    expect(await menu.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    const header = await nav.boundingBox();
    const panel = await menu.boundingBox();
    expect(panel!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 8);
    await expect(menu.getByRole('link')).toHaveCount(16);
    const lastLink = menu.getByRole('link', { name: 'contact@vistaire.ca', exact: true });
    await lastLink.focus();
    await expect(lastLink).toBeInViewport();
    expect(await menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect((await menu.boundingBox())!.y).toBeCloseTo(panel!.y, 0);
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-public-navigation-toggle]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(menu.getByRole('link').first()).toBeFocused();
    await expect(menu.getByRole('link').first()).toBeInViewport();
    expect(await menu.evaluate((element) => element.scrollTop)).toBe(0);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('landing Menu shares the measured compact viewport and accessible scroll fallback', async ({ page }) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await showPublicNavigation(page);
  await expect(page.locator('.preloader')).toHaveCount(0, { timeout: 120_000 });
  const header = page.locator('.site-header');
  const trigger = header.locator('.menu-toggle');
  const menu = page.locator('.mobile-menu');
  const controls = menu.locator('button, a[href]');
  for (const [width, height] of [[390, 844], [430, 932], [1440, 720]]) {
    await page.setViewportSize({ width, height });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    const topbar = await header.boundingBox();
    const panel = await menu.boundingBox();
    expect(panel!.y).toBeGreaterThanOrEqual(topbar!.y + topbar!.height + 8);
    expect(panel!.y + panel!.height).toBeCloseTo(height - 12, 0);
    expect(await menu.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await expect(controls).toHaveCount(16);
    for (const control of await controls.all()) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.y).toBeGreaterThanOrEqual(panel!.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(panel!.y + panel!.height);
    }
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  }
  for (const [width, height] of [[390, 420], [720, 450]]) {
    await page.setViewportSize({ width, height });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await expect(menu).toHaveCSS('overflow-y', 'auto');
    expect(await menu.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    const topbar = await header.boundingBox();
    const panel = await menu.boundingBox();
    expect(panel!.y).toBeGreaterThanOrEqual(topbar!.y + topbar!.height + 8);
    await expect(controls).toHaveCount(16);
    await menu.getByRole('link', { name: 'contact@vistaire.ca', exact: true }).focus();
    await expect(menu.getByRole('link', { name: 'contact@vistaire.ca', exact: true })).toBeInViewport();
    expect(await menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect((await menu.boundingBox())!.y).toBeCloseTo(panel!.y, 0);
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  }
});

for (const path of ['/a-propos', '/en/about', '/']) {
  test(`navigation stays parked until its side tab is opened on ${path}`, async ({ page }) => {
    if (path === '/') test.setTimeout(150_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    if (path === '/') await expect(page.locator('.preloader')).toHaveCount(0, { timeout: 120_000 });
    const tab = page.locator('[data-public-navigation-toggle]');
    const header = page.locator('[data-public-navigation-open]');
    const menuTrigger = header.locator('button[aria-controls]');
    const drawer = page.locator('[data-public-menu], .mobile-menu');
    for (const [width, height] of [[390, 844], [844, 390], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await expect(tab).toBeVisible();
      await expect(tab).toHaveAttribute('aria-expanded', 'false');
      await expect(header).toHaveAttribute('inert', '');
      await expect(header).toHaveAttribute('aria-hidden', 'true');
      await expect(header).toHaveCSS('pointer-events', 'none');
      const tabBox = await tab.boundingBox();
      expect(tabBox!.width).toBeGreaterThanOrEqual(44);
      expect(tabBox!.height).toBeGreaterThanOrEqual(44);
      expect(tabBox!.x).toBeGreaterThanOrEqual(0);
      expect(tabBox!.y + tabBox!.height).toBeLessThanOrEqual(height);
      const before = await page.evaluate(() => ({ scrollY, mainTop: document.querySelector('main')!.getBoundingClientRect().top }));
      expect(await page.evaluate(() => !document.elementFromPoint(innerWidth / 2, 40)?.closest('[data-public-navigation-open], [data-public-navigation-toggle]'))).toBe(true);
      await tab.focus();
      await page.keyboard.press('Enter');
      await expect(tab).toHaveAttribute('aria-expanded', 'true');
      await expect(header).toHaveAttribute('aria-hidden', 'false');
      await expect(header).not.toHaveAttribute('inert');
      await expect(header.locator('button, a[href]').first()).toBeFocused();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
      expect(await page.evaluate(() => ({ scrollY, mainTop: document.querySelector('main')!.getBoundingClientRect().top }))).toEqual(before);
      await menuTrigger.click();
      await expect(menuTrigger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
      await page.keyboard.press('Escape');
      await expect(menuTrigger).toHaveAttribute('aria-expanded', 'false');
      await expect(tab).toHaveAttribute('aria-expanded', 'true');
      await expect(menuTrigger).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(tab).toHaveAttribute('aria-expanded', 'false');
      await expect(tab).toBeFocused();
      await expect(header).toHaveAttribute('inert', '');
      await tab.click();
      await menuTrigger.click();
      await tab.click();
      await expect(tab).toHaveAttribute('aria-expanded', 'false');
      await expect(menuTrigger).toHaveAttribute('aria-expanded', 'false');
      await expect(drawer).toHaveAttribute('inert', '');
      await expect(tab).toBeFocused();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
      expect(await page.evaluate(() => scrollY)).toBe(before.scrollY);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}
