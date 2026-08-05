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

async function swipePage(page: Page, direction: "next" | "previous") {
  const readingSurface = page.locator(
    '[data-sauge-reading-surface="true"]'
  );
  const readingBox = await readingSurface.boundingBox();
  expect(readingBox).not.toBeNull();
  const startX = readingBox!.x + readingBox!.width * 0.75;
  const startY = readingBox!.y + readingBox!.height * 0.42;
  const endX = startX + (direction === "next" ? -180 : 180);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, startY - 24, { steps: 6 });
  await page.mouse.up();
}

function configuredHttpsCdnOrigin() {
  const configured = process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "";
  for (const value of configured.split(",")) {
    try {
      const origin = new URL(value.trim());
      if (origin.protocol === "https:") return origin.origin;
    } catch {
      // The application ignores malformed configured origins; the test does too.
    }
  }
  return null;
}

function installRuntimeGuards(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const dialogs: string[] = [];
  const navigations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.type());
    void dialog.dismiss();
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  return { consoleErrors, pageErrors, dialogs, navigations };
}

test.describe("Sauge Noire runtime photo policy", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("menu keeps non-current physical sheets deferred and prioritizes only canonical featured media", async ({
    page
  }) => {
    await page.goto(menuPath, { waitUntil: "domcontentloaded" });
    await waitForPhysicalBook(page);

    const physicalImages = page.locator(
      '[data-sauge-page-origin="react-original"] [data-photo-slot] img'
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
      .locator(
        '[data-sauge-page-origin="react-original"] [data-photo-slot] img'
      )
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
    expect(photoRequests.length).toBeGreaterThan(0);
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

  test("rejects malicious deferred media through the real PageFlip policy", async ({
    page
  }) => {
    const runtime = installRuntimeGuards(page);
    let evilRequests = 0;
    await page.route("https://evil.example/**", async (route) => {
      evilRequests += 1;
      await route.abort();
    });

    for (const deferredSrc of [
      "https://evil.example/attack.png",
      "javascript:alert(1)",
      "data:image/svg+xml,<svg/onload=window.__saugeSecurityProbeExecuted=1>"
    ]) {
      await page.goto(menuPath, { waitUntil: "domcontentloaded" });
      await waitForPhysicalBook(page);
      const menuOrigin = new URL(page.url()).origin;
      runtime.consoleErrors.length = 0;
      runtime.pageErrors.length = 0;
      runtime.dialogs.length = 0;
      runtime.navigations.length = 0;
      await page.evaluate(() => {
        (window as Window & { __saugeSecurityProbeExecuted?: number })
          .__saugeSecurityProbeExecuted = 0;
      });

      const targetImage = page
        .locator(
          '[data-sauge-page-origin="react-original"]' +
            '[data-sauge-flip-page-index="3"] img'
        )
        .first();
      await expect(targetImage).toBeAttached();
      await targetImage.evaluate((image, value) => {
        image.setAttribute("data-sauge-deferred-src", value);
        image.removeAttribute("src");
      }, deferredSrc);

      await swipePage(page, "next");
      const book = page.locator('[data-testid="sauge-noire-book"]');
      await expect(book).toHaveAttribute("data-page-index", "3", {
        timeout: 20_000
      });
      const flipViewport = page.locator('[data-page-flip-state="ready"]').first();
      await expect(flipViewport).toBeAttached();
      await expect(flipViewport).toHaveAttribute(
        "data-page-flip-engine-state",
        "read"
      );
      await page.waitForTimeout(250);

      const mediaState = await page
        .locator("img[data-sauge-deferred-src]")
        .evaluateAll((images, value) =>
          images
            .filter((image) => image.getAttribute("data-sauge-deferred-src") === value)
            .map((image) => ({
              src: image.getAttribute("src"),
              deferredSrc: image.getAttribute("data-sauge-deferred-src")
            })),
          deferredSrc
        );
      expect(mediaState.length).toBeGreaterThan(0);
      expect(mediaState.every((image) => image.src === null)).toBe(true);
      expect(mediaState.every((image) => image.deferredSrc === deferredSrc)).toBe(
        true
      );
      expect(evilRequests).toBe(0);
      expect(runtime.dialogs).toEqual([]);
      expect(runtime.consoleErrors).toEqual([]);
      expect(runtime.pageErrors).toEqual([]);
      expect(
        runtime.navigations.every((url) => {
          const navigated = new URL(url);
          return (
            navigated.origin === menuOrigin &&
            navigated.pathname === "/menu/sauge-noire"
          );
        })
      ).toBe(true);
      expect(
        await page.evaluate(
          () =>
            (window as Window & { __saugeSecurityProbeExecuted?: number })
              .__saugeSecurityProbeExecuted
        )
      ).toBe(0);
    }
  });

  test("activates one explicitly allowlisted photo and removes it when the page is no longer prepared", async ({
    page
  }) => {
    const configuredOrigin = configuredHttpsCdnOrigin();
    const deferredSrc = configuredOrigin
      ? `${configuredOrigin}/__e2e__/allowlisted-page-photo.png`
      : "/__e2e__/allowlisted-page-photo.png";
    let photoRequests = 0;
    const routePattern = configuredOrigin
      ? `${configuredOrigin}/**`
      : "**/__e2e__/allowlisted-page-photo.png";
    await page.route(routePattern, async (route) => {
      if (route.request().url().endsWith("/__e2e__/allowlisted-page-photo.png")) {
        photoRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nFsAAAAASUVORK5CYII=",
            "base64"
          )
        });
        return;
      }
      await route.continue();
    });

    await page.goto(menuPath, { waitUntil: "domcontentloaded" });
    await waitForPhysicalBook(page);
    const targetImage = page
      .locator(
        '[data-sauge-page-origin="react-original"]' +
          '[data-sauge-flip-page-index="3"] img'
      )
      .first();
    await expect(targetImage).toBeAttached();
    await targetImage.evaluate((image, value) => {
      image.setAttribute("data-sauge-deferred-src", value);
      image.removeAttribute("src");
    }, deferredSrc);

    await swipePage(page, "next");
    const book = page.locator('[data-testid="sauge-noire-book"]');
    await expect(book).toHaveAttribute("data-page-index", "3", {
      timeout: 20_000
    });
    const flipViewport = page.locator('[data-page-flip-state="ready"]').first();
    await expect(flipViewport).toBeAttached();
    await expect(flipViewport).toHaveAttribute(
      "data-page-flip-engine-state",
      "read"
    );
    await expect
      .poll(
        async () =>
          await targetImage.evaluate((image) => ({
            src: image.getAttribute("src"),
            loading: image.getAttribute("loading"),
            fetchPriority: image.getAttribute("fetchpriority")
          }))
      )
      .toMatchObject({ src: expect.any(String), loading: "lazy", fetchPriority: "low" });
    expect(photoRequests).toBe(1);

    await page.keyboard.press("ArrowLeft");
    await expect(book).toHaveAttribute("data-page-index", "2", {
      timeout: 20_000
    });
    await expect
      .poll(() => targetImage.getAttribute("src"))
      .toBeNull();
    await expect(targetImage).toHaveAttribute("data-sauge-deferred-src", deferredSrc);
  });
});
