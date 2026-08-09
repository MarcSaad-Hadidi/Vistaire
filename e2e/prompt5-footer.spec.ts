import { expect, test, type Page } from "@playwright/test";

const locales = [
  {
    path: "/menu-digital-restaurant",
    menu: "/demo",
    appointment: "/prendre-rendez-vous",
    groups: ["Produit", "Guides", "Besoins", "Local", "Contact"],
    guides: [
      "/guides/anatomie-menu-digital-premium",
      "/guides/menu-qr-mobile-sans-application",
      "/guides/3d-restaurant-utile-vs-gadget"
    ],
    locals: [
      "/menu-digital-restaurant-montreal",
      "/menu-digital-restaurant-laval",
      "/menu-digital-restaurant-brossard"
    ]
  },
  {
    path: "/en/digital-restaurant-menu",
    menu: "/en/vistaire-menu",
    appointment: "/en/book-a-call",
    groups: ["Product", "Guides", "Solutions", "Local", "Contact"],
    guides: [
      "/en/guides/premium-digital-menu-anatomy",
      "/en/guides/mobile-qr-menu-without-app",
      "/en/guides/restaurant-3d-useful-vs-gimmick"
    ],
    locals: [
      "/en/digital-restaurant-menu-montreal",
      "/en/digital-restaurant-menu-laval",
      "/en/digital-restaurant-menu-brossard"
    ]
  }
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(2);
}

for (const locale of locales) {
  test(`${locale.path} renders one focused premium footer`, async ({ page }) => {
    const response = await page.goto(locale.path, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);

    const footer = page.locator("footer#contact");
    await expect(footer).toHaveCount(1);
    for (const group of locale.groups) {
      await expect(footer.getByRole("heading", { name: group, exact: true })).toHaveCount(1);
    }
    await expect(
      footer.getByRole("region", { name: "Guides", exact: true })
    ).toHaveCount(1);

    for (const href of [...locale.guides, ...locale.locals]) {
      await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
    await expect(
      footer.locator(
        'a[href*="haut-de-gamme"], a[href*="gastronomique"], a[href*="high-end"], a[href*="fine-dining"]'
      )
    ).toHaveCount(0);

    const sectionHrefs = await footer.locator("section a").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? "")
    );
    expect(sectionHrefs.some((href) => href === "" || href === "#")).toBe(false);
    expect(new Set(sectionHrefs).size).toBe(sectionHrefs.length);
    await expect(footer.locator(`a[href="${locale.appointment}"]`)).toHaveCount(1);

    const finalCta = page.locator('section[aria-labelledby="final-cta-title"]');
    await expect(finalCta.locator(`a[href="${locale.menu}"]`)).toHaveCount(1);
    await expect(
      finalCta.locator(`nav a[href="${locale.menu}"]`)
    ).toHaveCount(0);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    test(`${locale.path} footer stacks and keeps touch targets at ${viewport.width}px`, async ({
      page
    }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(locale.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(400);

      const footer = page.locator("footer#contact");
      const columns = await footer.evaluate(
        (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length
      );
      expect(columns).toBe(1);

      const undersizedTargets = await footer.locator("section a").evaluateAll((links) =>
        links
          .map((link) => ({
            href: link.getAttribute("href"),
            height: link.getBoundingClientRect().height
          }))
          .filter((target) => target.height < 43.5)
      );
      expect(undersizedTargets).toEqual([]);
      await expectNoHorizontalOverflow(page);
    });
  }

  for (const viewport of [
    { width: 1024, height: 900 },
    { width: 1180, height: 900 }
  ]) {
    test(`${locale.path} footer stays contained at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(locale.path, { waitUntil: "domcontentloaded" });

      const footer = page.locator("footer#contact");
      await expect(footer).toBeVisible();
      const geometry = await footer.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
          left: box.left,
          right: box.right,
          viewportWidth: document.documentElement.clientWidth
        };
      });
      expect(geometry.columns).toBe(3);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
      await expectNoHorizontalOverflow(page);
    });
  }
}
