import { expect, test, type Page } from "@playwright/test";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

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

function topNavigation(page: Page) {
  return page.locator(
    'nav[aria-label="Navigation preview"], nav[aria-label="Main navigation"]'
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
  expect(sourceResponse, `${scenario.sourcePath}: source response`).not.toBeNull();
  expect(sourceResponse?.status()).toBeLessThan(400);
  expect(rawDocumentLanguage(await sourceResponse!.text())).toBe(
    scenario.sourceLocale
  );
  await expect(page.locator("html")).toHaveAttribute("lang", scenario.sourceLocale);

  const sourceLanguageControl = page
    .locator(`div[aria-label="${scenario.sourceControl}"]`)
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

  const destinationLanguageControl = page
    .locator(`div[aria-label="${scenario.destinationControl}"]`)
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
        cta: "Prendre rendez-vous",
        compactCta: "Rendez-vous"
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
      const compactNavigation = (page.viewportSize()?.width ?? 0) <= 520;
      await expect(
        nav.getByRole("link", {
          name: compactNavigation ? scenario.compactCta : scenario.cta,
          exact: true
        })
      ).toBeVisible();
    }
  });

  test("keeps landing home anchors valid in both locales", async ({ page }) => {
    for (const scenario of [
      { path: "/", label: "Accueil", expectedPath: "/" },
      { path: "/en", label: "Home", expectedPath: "/en" }
    ] as const) {
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      const nav = topNavigation(page);
      const home = nav.getByRole("link", { name: scenario.label, exact: true });

      await expect(home).toHaveAttribute("href", "#accueil");
      await expect(page.locator("#accueil")).toHaveCount(1);
      await expect(home).toHaveAttribute("aria-current", "page");
      await expectNoCurrent(nav, [
        scenario.label === "Accueil" ? "Carte" : "Menu",
        scenario.label === "Accueil" ? "À propos" : "About",
        "Contact"
      ]);
      await expectPricingNavigation(
        nav,
        scenario.path === "/en" ? "en" : "fr"
      );
    }
  });

  test("keeps the canonical menu route and local Carte anchor", async ({ page }) => {
    for (const scenario of [
      { path: "/demo", label: "Carte", expectedPath: "/" },
      { path: "/en/vistaire-menu", label: "Menu", expectedPath: "/en" }
    ] as const) {
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
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
