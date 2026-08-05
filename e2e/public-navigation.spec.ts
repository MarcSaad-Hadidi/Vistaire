import { expect, test, type Page } from "@playwright/test";

type HomeScenario = {
  label: "Accueil" | "Home";
  path: string;
  expectedPath: "/" | "/en";
};

const frenchSecondaryHomeScenarios: HomeScenario[] = [
  { label: "Accueil", path: "/menu-qr-code-restaurant", expectedPath: "/" },
  { label: "Accueil", path: "/menu-pdf-vs-menu-digital", expectedPath: "/" },
  { label: "Accueil", path: "/menu-digital-restaurant", expectedPath: "/" },
  { label: "Accueil", path: "/menu-3d-ar-restaurant", expectedPath: "/" },
  { label: "Accueil", path: "/apercu-restaurateur", expectedPath: "/" }
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

async function expectHomeNavigation(
  page: Page,
  scenario: HomeScenario
) {
  await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
  const nav = topNavigation(page);
  const home = nav.getByRole("link", { name: scenario.label, exact: true });

  await expect(home).toHaveAttribute("href", scenario.expectedPath);
  await expect(home).not.toHaveAttribute("aria-current");

  await home.click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(scenario.expectedPath);
  expect(new URL(page.url()).hash).toBe("");
}

test.describe("Vistaire public navigation", () => {
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

  test("keeps landing home anchors valid in both locales", async ({ page }) => {
    for (const scenario of [
      { path: "/", label: "Accueil", expectedPath: "/" },
      { path: "/en", label: "Home", expectedPath: "/en" }
    ] as const) {
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      const nav = topNavigation(page);
      const home = nav.getByRole("link", { name: scenario.label, exact: true });
      const href = await home.getAttribute("href");

      if (href?.startsWith("#")) {
        await expect(page.locator(href)).toHaveCount(1);
        await expect(home).toHaveAttribute("aria-current", "page");
      } else {
        await expect(home).toHaveAttribute("href", scenario.expectedPath);
      }
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
    }
  });

  test("preserves accessible navigation names and keyboard focus", async ({ page }) => {
    await page.goto("/menu-qr-code-restaurant", { waitUntil: "domcontentloaded" });
    const nav = topNavigation(page);

    await expect(nav.getByRole("link", { name: "Accueil", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Carte", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "À propos", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Contact", exact: true })).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.locator("a:focus-visible")).toHaveCount(1);
  });
});
