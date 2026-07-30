import { expect, test, type Page } from "@playwright/test";

const contextQuery = {
  menu: "carte",
  lang: "fr-CA",
  currency: "CAD"
};

const menuPath =
  `/menu/sauge-noire?${new URLSearchParams({
    ...contextQuery,
    view: "sauge-2"
  })}`;
const dishPath =
  `/menu/sauge-noire/dishes/betterave-sous-la-cendre?${new URLSearchParams({
    ...contextQuery,
    view: "sauge-2"
  })}`;

async function waitForPhysicalBook(page: Page) {
  await expect(
    page.locator('[data-sauge-page-origin="react-original"]').first()
  ).toBeAttached();
  await expect(
    page.locator('[data-page-flip-engine-visible="false"]')
  ).toBeAttached();
}

test.describe("Sauge Noire runtime photo policy", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("menu keeps non-current physical sheets deferred and prioritizes only canonical featured media", async ({
    page
  }) => {
    await page.goto(menuPath, { waitUntil: "domcontentloaded" });
    await waitForPhysicalBook(page);

    const physicalImages = page.locator(
      '[data-sauge-page-origin="react-original"] img'
    );
    const policy = await physicalImages.evaluateAll((images) =>
      images.map((image) => {
        const sheet = image.closest<HTMLElement>("[data-sauge-flip-page-index]");
        return {
          pageIndex: sheet?.dataset.saugeFlipPageIndex ?? "",
          src: image.getAttribute("src"),
          deferredSrc: image.getAttribute("data-sauge-deferred-src"),
          fetchPriority: image.getAttribute("fetchpriority")
        };
      })
    );
    expect(policy.length).toBeGreaterThan(0);
    expect(
      policy.filter((image) => image.pageIndex !== "2").every(
        (image) => image.src === null && Boolean(image.deferredSrc)
      )
    ).toBe(true);
    expect(
      policy.filter((image) => image.pageIndex === "2").every(
        (image) => Boolean(image.src)
      )
    ).toBe(true);
    expect(policy.every((image) => image.fetchPriority !== "high")).toBe(true);

    const readingSurface = page.locator(
      '[data-sauge-reading-surface="true"]'
    );
    const featuredPhoto = readingSurface.locator(
      '[data-sauge-featured-dish] img'
    );
    await expect(featuredPhoto).toHaveAttribute("loading", "eager");
    await expect(featuredPhoto).toHaveAttribute("fetchpriority", "high");
    const rowPhotos = readingSurface.locator("[data-sauge-dish-row] img");
    await expect(rowPhotos.first()).toHaveAttribute("loading", "lazy");
  });

  test("dish initial load transfers only the current photo and leaves physical neighbors deferred", async ({
    page
  }) => {
    const photoRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      const isDemoPhoto = url.pathname.includes("/images/demo/dishes/");
      const isRuntimePhoto =
        url.pathname.startsWith("/api/public/menu-dishes/") &&
        url.pathname.endsWith("/photo");
      if (isDemoPhoto || isRuntimePhoto) {
        photoRequests.push(`${url.pathname}${url.search}`);
      }
    });

    await page.goto(dishPath, { waitUntil: "networkidle" });
    await waitForPhysicalBook(page);

    const physicalPolicy = await page
      .locator('[data-sauge-page-origin="react-original"] img')
      .evaluateAll((images) =>
        images.map((image) => {
          const sheet = image.closest<HTMLElement>(
            "[data-sauge-flip-page-index]"
          );
          return {
            pageIndex: sheet?.dataset.saugeFlipPageIndex ?? "",
            src: image.getAttribute("src"),
            deferredSrc: image.getAttribute("data-sauge-deferred-src"),
            fetchPriority: image.getAttribute("fetchpriority")
          };
        })
      );
    expect(
      physicalPolicy.filter((image) => image.pageIndex !== "1").every(
        (image) => image.src === null && Boolean(image.deferredSrc)
      )
    ).toBe(true);
    expect(
      physicalPolicy.filter((image) => image.pageIndex === "1").every(
        (image) => Boolean(image.src)
      )
    ).toBe(true);
    expect(
      physicalPolicy.every((image) => image.fetchPriority !== "high")
    ).toBe(true);

    const canonicalPhoto = page.locator(
      '[data-sauge-reading-surface="true"] [data-photo-slot] img'
    );
    await expect(canonicalPhoto).toHaveAttribute("loading", "eager");
    await expect(canonicalPhoto).toHaveAttribute("fetchpriority", "high");
    expect(photoRequests).toHaveLength(1);
    expect(new Set(photoRequests).size).toBe(1);
  });

  test("new logical navigation cancels stale target media preparation", async ({
    page
  }) => {
    let releasePhoto: (() => void) | undefined;
    let markPhotoRequested: (() => void) | undefined;
    const photoRelease = new Promise<void>((resolve) => {
      releasePhoto = resolve;
    });
    const photoRequested = new Promise<void>((resolve) => {
      markPhotoRequested = resolve;
    });

    await page.route("**/__e2e__/delayed-page-photo.png", async (route) => {
      markPhotoRequested?.();
      await photoRelease;
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nFsAAAAASUVORK5CYII=",
          "base64"
        )
      });
    });

    try {
      await page.goto(menuPath, { waitUntil: "domcontentloaded" });
      await waitForPhysicalBook(page);

      const targetImage = page
        .locator(
          '[data-sauge-page-origin="react-original"]' +
            '[data-sauge-flip-page-index="3"] img'
        )
        .first();
      await expect(targetImage).toBeAttached();
      await targetImage.evaluate((image) => {
        image.setAttribute(
          "data-sauge-deferred-src",
          "/__e2e__/delayed-page-photo.png"
        );
        image.removeAttribute("src");
      });

      const readingSurface = page.locator(
        '[data-sauge-reading-surface="true"]'
      );
      const readingBox = await readingSurface.boundingBox();
      expect(readingBox).not.toBeNull();
      const startX = readingBox!.x + readingBox!.width * 0.75;
      const startY = readingBox!.y + readingBox!.height * 0.42;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX - 180, startY - 24, { steps: 6 });
      await page.mouse.up();
      await photoRequested;
      await expect(
        page.locator('[data-page-flip-media-preparing="true"]')
      ).toHaveCount(1);

      const lastPageIndex =
        (await page
          .locator('[data-sauge-page-origin="react-original"]')
          .count()) - 1;
      await page.keyboard.press("End");
      await expect(
        page.locator('[data-testid="sauge-noire-book"]')
      ).toHaveAttribute("data-page-index", String(lastPageIndex));

      releasePhoto?.();

      await expect(
        page.locator(
          `[data-page-flip-current-page="${lastPageIndex}"]` +
            `[data-page-flip-actual-page="${lastPageIndex}"]`
        )
      ).toHaveCount(1, { timeout: 20_000 });
      await expect(page).toHaveURL(
        new RegExp(`[?&]view=sauge-${lastPageIndex}(?:&|$)`)
      );
    } finally {
      releasePhoto?.();
    }
  });
});
