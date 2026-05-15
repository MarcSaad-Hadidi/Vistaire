import { expect, test } from "@playwright/test";

const viewports = [
  { label: "iphone-390", width: 390, height: 844 },
  { label: "iphone-430", width: 430, height: 932 },
  { label: "tablet-768", width: 768, height: 1024 },
  { label: "desktop", width: 1280, height: 720 }
];

test.describe("Landing responsive", () => {
  for (const vp of viewports) {
    test(`no horizontal overflow at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const gap = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(gap).toBeLessThanOrEqual(2);
    });
  }
});

test.describe("Landing scroll experience", () => {
  test("hero renders video and responds to scroll", async ({ page }) => {
    const frameRequests: string[] = [];
    const videoResponseStatuses: number[] = [];

    page.on("request", (request) => {
      if (/\/frames\/|frame_\d{4}\.webp/i.test(request.url())) {
        frameRequests.push(request.url());
      }
    });
    page.on("response", (response) => {
      if (
        response
          .url()
          .includes("/videos/optimized/upscaled-video-desktop-scrub.mp4")
      ) {
        videoResponseStatuses.push(response.status());
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#experience")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    const experience = page.locator("#experience");
    await expect(experience.locator("video")).toBeVisible();
    await expect(experience.locator("canvas")).toHaveCount(0);
    expect(frameRequests.length).toBeLessThanOrEqual(1);

    const scrollMax = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    expect(scrollMax).toBeGreaterThan(400);

    await page.waitForFunction(() => {
      const video = document.querySelector<HTMLVideoElement>("#experience video");
      return Boolean(video && video.readyState >= 1 && video.duration > 0);
    });

    await expect
      .poll(() =>
        videoResponseStatuses.some(
          (status) => status === 200 || status === 206
        )
      )
      .toBe(true);

    const videoNetworkState = await experience
      .locator("video")
      .evaluate((video) => {
        const element = video as HTMLVideoElement;
        return {
          currentSrc: element.currentSrc,
          errorCode: element.error?.code ?? null,
          networkState: element.networkState
        };
      });
    expect(videoNetworkState.currentSrc).toContain(
      "/videos/optimized/upscaled-video-desktop-scrub.mp4"
    );
    expect(videoNetworkState.errorCode).toBeNull();

    const t0 = await experience
      .locator("video")
      .evaluate((video) => (video as HTMLVideoElement).currentTime);

    await page.evaluate((y) => window.scrollTo(0, y), scrollMax * 0.35);
    const y1 = await page.evaluate(() => window.scrollY);
    expect(y1).toBeGreaterThan(200);

    await expect
      .poll(async () =>
        experience
          .locator("video")
          .evaluate((video) => (video as HTMLVideoElement).currentTime)
      )
      .toBeGreaterThan(t0 + 0.1);

    await page.evaluate((y) => window.scrollTo(0, y), scrollMax * 0.85);
    const y2 = await page.evaluate(() => window.scrollY);
    expect(y2).toBeGreaterThan(y1);
  });

  test("scroll updates visible chapter copy and video time", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#experience")).toBeVisible();
    await expect(page.locator("#experience video")).toBeVisible();

    await page.waitForFunction(
      () => document.documentElement.scrollHeight - window.innerHeight > 1_500
    );

    const chapter = page.locator("#experience .chapter-copy").first();
    await expect(chapter).toBeVisible();
    const before = await chapter.getAttribute("data-chapter");
    const videoBefore = await page
      .locator("#experience video")
      .evaluate((video) => (video as HTMLVideoElement).currentTime);

    const { scrollYAfter, scrollMax } = await page.evaluate(() => {
      const scrollMaxVal =
        document.documentElement.scrollHeight - window.innerHeight;
      const target = Math.max(0, Math.floor(scrollMaxVal * 0.92));
      window.scrollTo({ top: target, behavior: "auto" });
      window.dispatchEvent(new Event("scroll"));
      return { scrollYAfter: window.scrollY, scrollMax: scrollMaxVal };
    });
    expect(scrollMax).toBeGreaterThan(1_500);
    expect(scrollYAfter).toBeGreaterThan(400);

    await expect(chapter).not.toHaveAttribute("data-chapter", before ?? "", {
      timeout: 10_000
    });
    await expect
      .poll(async () =>
        page
          .locator("#experience video")
          .evaluate((video) => (video as HTMLVideoElement).currentTime)
      )
      .toBeGreaterThan(videoBefore + 0.1);
  });

  test("mobile viewport uses the upscaled mobile scrub video", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "deviceMemory", {
        configurable: true,
        get: () => 2
      });
      Object.defineProperty(navigator, "hardwareConcurrency", {
        configurable: true,
        get: () => 4
      });
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        get: () => ({ effectiveType: "3g", saveData: false })
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const experience = page.locator("#experience");
    await expect(experience).toBeVisible();
    await expect(experience).toHaveAttribute("data-landing-hero-mode", "mobile");
    await expect(experience).toHaveAttribute(
      "data-video-source",
      "/videos/optimized/upscaled-video-mobile-scrub.mp4"
    );

    await expect
      .poll(() =>
        experience
          .locator("video")
          .evaluate((video) => (video as HTMLVideoElement).currentSrc)
      )
      .toContain("/videos/optimized/upscaled-video-mobile-scrub.mp4");
  });

  test("low-end desktop still uses the upscaled desktop scrub video", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "deviceMemory", {
        configurable: true,
        get: () => 2
      });
      Object.defineProperty(navigator, "hardwareConcurrency", {
        configurable: true,
        get: () => 4
      });
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        get: () => ({ effectiveType: "3g", saveData: false })
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const experience = page.locator("#experience");
    await expect(experience).toBeVisible();
    await expect(experience).toHaveAttribute(
      "data-landing-hero-mode",
      "desktopHigh"
    );
    await expect(experience).toHaveAttribute(
      "data-video-source",
      "/videos/optimized/upscaled-video-desktop-scrub.mp4"
    );
  });

  test('primary CTA "Explorer l\'expérience" points to /demo', async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const link = page
      .getByRole("link", { name: /Explorer l'expérience/i })
      .first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/demo");
  });

  test("benefits section follows hero (non-regression layout)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#benefices")).toBeVisible();
  });
});

test.describe("Demo mobile", () => {
  test("narrow viewport does not offer desktop phone simulation control", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-demo-root]").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Simuler.*mobile/i })
    ).toHaveCount(0);
  });
});

test.describe("Non-regression routes", () => {
  test("/demo loads", async ({ page }) => {
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-demo-root]").first()).toBeVisible();
  });

  test("dish pages load with 3D action before AR is offered in the viewer", async ({ page }) => {
    await page.goto("/demo/dishes/ravioles-romarin", {
      waitUntil: "domcontentloaded"
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const voir3d = page.getByRole("button", { name: "Voir en 3D" });
    await expect(voir3d).toBeVisible();
    await expect(voir3d).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Afficher devant moi" })
    ).toHaveCount(0);
    await expect(page.locator("model-viewer")).toHaveCount(0);

    await page.goto("/demo/dishes/homard-bisque", {
      waitUntil: "domcontentloaded"
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Voir en 3D" })).toBeVisible();
    await expect(page.locator("model-viewer")).toHaveCount(0);

    await page.goto("/demo/dishes/ravioles-romarin", {
      waitUntil: "domcontentloaded"
    });
    const loadedVoir3d = page.getByRole("button", { name: "Voir en 3D" });
    await loadedVoir3d.scrollIntoViewIfNeeded();
    await loadedVoir3d.click({ force: true });
    await expect(page.locator("model-viewer")).toHaveCount(1, {
      timeout: 15_000
    });
  });

  test("/admin loads", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/admin", {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
