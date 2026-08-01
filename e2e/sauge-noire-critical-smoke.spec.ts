import { expect, test, type Page } from "@playwright/test";

const viewport = { width: 390, height: 844 };
const context = {
  lang: "fr-CA",
  currency: "CAD",
  table: "main",
  zone: "terrasse"
};

function menuPath(view: string) {
  return `/menu/sauge-noire?${new URLSearchParams({ ...context, view })}`;
}

function dishPath(slug: string, view: string) {
  return `/menu/sauge-noire/dishes/${slug}?${new URLSearchParams({
    ...context,
    view
  })}`;
}

function canonicalSurface(page: Page) {
  return page.locator(
    '[data-sauge-route-renderer-pending-handoff="false"]'
  ).locator(
    '[data-sauge-reading-surface="true"]' +
      '[data-sauge-scroll-owner="true"]' +
      '[data-sauge-reading-visible="true"]'
  );
}

async function expectSettledSurface(page: Page) {
  await expect(page.locator('[data-page-flip-fallback="error"]')).toHaveCount(0);
  await expect(
    page.locator(
      '[data-sauge-route-renderer-pending-handoff="false"] ' +
        '[data-page-flip-state="ready"]'
    )
  ).toHaveCount(1, { timeout: 15_000 });
  const surface = canonicalSurface(page);
  await expect(surface).toHaveCount(1, { timeout: 15_000 });
  await expect(surface).toBeVisible({ timeout: 15_000 });
  return surface;
}

async function expectUrlContext(page: Page, expectedPath: string, view: string) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(expectedPath);
  await expect.poll(() => {
    const params = new URL(page.url()).searchParams;
    return {
      lang: params.get("lang"),
      currency: params.get("currency"),
      table: params.get("table"),
      zone: params.get("zone"),
      view: params.get("view")
    };
  }).toEqual({ ...context, view });
}

test.use({ viewport });

test("loads the menu and opens a real section", async ({ page }) => {
  await page.goto(menuPath("sauge-1"), { waitUntil: "domcontentloaded" });

  const book = page.getByTestId("sauge-noire-book");
  await expect(book).toBeVisible();
  await expect(book).toHaveAttribute("data-page-index", "1");
  const contentsSurface = await expectSettledSurface(page);

  await contentsSurface
    .getByRole("button", { name: /Premiers gestes/i })
    .click();

  await expect(book).toHaveAttribute("data-page-index", "2");
  await expectUrlContext(page, "/menu/sauge-noire", "sauge-2");
  const sectionSurface = await expectSettledSurface(page);
  await expect(
    sectionSurface.getByRole("heading", { name: "PREMIERS GESTES" })
  ).toBeVisible();
});

test("opens a dish from the menu and returns to its section", async ({ page }) => {
  await page.goto(menuPath("sauge-2"), { waitUntil: "domcontentloaded" });

  const menuSurface = await expectSettledSurface(page);
  await expect(
    menuSurface.getByRole("heading", { name: "PREMIERS GESTES" })
  ).toBeVisible();
  await menuSurface.locator('[data-sauge-featured-dish="true"]').click();

  const detailPathname =
    "/menu/sauge-noire/dishes/betterave-sous-la-cendre";
  await expectUrlContext(page, detailPathname, "sauge-2");
  await expect(page.getByTestId("sauge-noire-dish-detail")).toBeVisible();
  const detailSurface = await expectSettledSurface(page);
  await expect(
    detailSurface.getByRole("heading", { name: "BETTERAVE SOUS LA CENDRE" })
  ).toBeVisible();

  await detailSurface
    .locator('[data-sauge-typography-role="back-control"]')
    .click();

  await expectUrlContext(page, "/menu/sauge-noire", "sauge-2");
  const returnedSurface = await expectSettledSurface(page);
  await expect(
    returnedSurface.getByRole("heading", { name: "PREMIERS GESTES" })
  ).toBeVisible();
});

test("moves to the next dish and back to the initial dish", async ({ page }) => {
  const initialPath = "/menu/sauge-noire/dishes/betterave-sous-la-cendre";
  await page.goto(dishPath("betterave-sous-la-cendre", "sauge-2"), {
    waitUntil: "domcontentloaded"
  });

  let surface = await expectSettledSurface(page);
  const initialHeading = surface.getByRole("heading", {
    name: "BETTERAVE SOUS LA CENDRE"
  });
  await expect(initialHeading).toBeVisible();

  await surface.getByRole("link", { name: /prochain plat/i }).click();

  await expect.poll(() => new URL(page.url()).pathname).not.toBe(initialPath);
  surface = await expectSettledSurface(page);
  await expect(surface.getByRole("heading", { level: 1 })).not.toHaveText(
    "BETTERAVE SOUS LA CENDRE"
  );

  await surface.getByRole("link", { name: /plat précédent/i }).click();

  await expectUrlContext(page, initialPath, "sauge-2");
  surface = await expectSettledSurface(page);
  await expect(
    surface.getByRole("heading", { name: "BETTERAVE SOUS LA CENDRE" })
  ).toBeVisible();
});

test("mounts the 3D stage only after user intent", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const glbRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (/\.glb(?:$|\?)/i.test(request.url())) glbRequests.push(request.url());
  });

  await page.goto(dishPath("truite-des-laurentides", "sauge-3"), {
    waitUntil: "domcontentloaded"
  });

  const surface = await expectSettledSurface(page);
  await expect(
    surface.getByRole("heading", { name: "TRUITE DES LAURENTIDES" })
  ).toBeVisible();
  await expect(page.locator("[data-viewer-copy-locale]")).toHaveCount(0);
  await expect(page.locator("model-viewer")).toHaveCount(0);
  expect(glbRequests).toEqual([]);

  const viewerButton = surface.getByRole("button", { name: "VOIR EN 3D" });
  await expect(viewerButton).toBeVisible();
  await viewerButton.click();

  await expect(page.locator('[data-viewer-copy-locale="fr"]')).toBeVisible();
  await expect.poll(() => glbRequests.length).toBeGreaterThan(0);
  expect(
    glbRequests.some(
      (url) => new URL(url).pathname === "/models/demo/maison-elyse-n1.glb"
    )
  ).toBe(true);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
