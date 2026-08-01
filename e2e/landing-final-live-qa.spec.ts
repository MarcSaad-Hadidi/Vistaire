import { expect, test, type Page } from "@playwright/test";

const finalQaBaseUrl = process.env.VISTAIRE_FINAL_QA_BASE_URL;
const playwrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

if (!finalQaBaseUrl || !playwrightBaseUrl) {
  throw new Error(
    "Final landing QA requires VISTAIRE_FINAL_QA_BASE_URL and PLAYWRIGHT_BASE_URL."
  );
}

const expectedOrigin = new URL(finalQaBaseUrl).origin;
if (new URL(playwrightBaseUrl).origin !== expectedOrigin) {
  throw new Error(
    "PLAYWRIGHT_BASE_URL must use the same origin as VISTAIRE_FINAL_QA_BASE_URL."
  );
}

const landingPaths = ["/", "/en"] as const;
const previewExperiences = ["maison-elyse", "trouvable", "sauge-noire"] as const;
const featuredDishRoutes = [
  {
    name: "Maison Élyse",
    path: "/menu/maison-elyse/dishes/ravioles-de-chevre-frais-miel-de-monteregie?lang=en-CA"
  },
  {
    name: "Trouvable",
    path: "/menu/trouvable/dishes/pesto-burrata-verde?lang=en-CA"
  },
  {
    name: "Sauge Noire",
    path: "/menu/sauge-noire/dishes/betterave-sous-la-cendre?lang=en-CA&view=sauge-2"
  }
] as const;

const threeDRoute =
  "/menu/sauge-noire/dishes/truite-des-laurentides?lang=en-CA&view=sauge-3";
const modelRequestPattern =
  /\.(?:glb|usdz)(?:$|[?#])|\/model\/|model-viewer|babylon|three(?:\.module)?(?:\.min)?\.js/i;

type RuntimeFailures = ReturnType<typeof observeRuntimeFailures>;

function observeRuntimeFailures(page: Page) {
  const failedResponses: Array<{ status: number; url: string }> = [];
  const failedRequests: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const modelRequests: string[] = [];

  page.on("response", (response) => {
    const url = response.url();
    if (modelRequestPattern.test(url)) modelRequests.push(url);
    try {
      if (
        new URL(url).origin === expectedOrigin &&
        response.status() >= 400
      ) {
        failedResponses.push({ status: response.status(), url });
      }
    } catch {
      // Ignore non-HTTP browser URLs.
    }
  });
  page.on("request", (request) => {
    if (modelRequestPattern.test(request.url())) modelRequests.push(request.url());
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText;
    if (
      failure === "net::ERR_ABORTED" &&
      /\/videos\//i.test(request.url())
    ) {
      return;
    }
    try {
      if (new URL(request.url()).origin === expectedOrigin) {
        failedRequests.push(`${failure ?? "request failed"} ${request.url()}`);
      }
    } catch {
      // Ignore non-HTTP browser URLs.
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  return {
    failedResponses,
    failedRequests,
    consoleErrors,
    pageErrors,
    modelRequests
  };
}

async function expectLoadedImages(
  page: Page,
  locator = page.locator("img:visible")
) {
  const imageCount = await locator.count();
  if (imageCount === 0) return;
  await expect
    .poll(() =>
      locator.evaluateAll((elements) =>
        elements.filter((element) => {
          const image = element as HTMLImageElement;
          return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
        }).length
      )
    )
    .toBe(imageCount);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(2);
}

function expectRuntimeHealthy(runtime: RuntimeFailures) {
  expect(runtime.failedResponses).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(
    runtime.failedResponses.filter(({ status }) => status === 424 || status === 404)
  ).toEqual([]);
}

async function expectPublicRoute(page: Page, path: string) {
  const runtime = observeRuntimeFailures(page);
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `Expected ${path} to resolve`).toBe(200);
  await expect(page.locator("main")).toBeVisible();
  await expectLoadedImages(page);
  expectRuntimeHealthy(runtime);
}

test.describe("PR #173 final live QA", () => {
  test("loads French and English landing routes without runtime failures", async ({
    page
  }) => {
    for (const path of landingPaths) {
      await page.setViewportSize({ width: 430, height: 932 });
      const runtime = observeRuntimeFailures(page);
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `Expected ${path} to resolve`).toBe(200);
      await expect(page.getByTestId("landing-dishes")).toBeVisible();
      await expect(
        page.getByTestId("landing-dishes").locator("[data-menu-slug]")
      ).toHaveCount(3);
      await expectLoadedImages(
        page,
        page.getByTestId("landing-dishes").locator("img")
      );
      await expectNoHorizontalOverflow(page);
      await expect(page.locator("model-viewer")).toHaveCount(0);
      expect(runtime.modelRequests).toEqual([]);
      expectRuntimeHealthy(runtime);
    }
  });

  for (const experience of previewExperiences) {
    test(`returns the English ${experience} preview payload`, async ({ request }) => {
      const response = await request.get(
        `/api/public/landing-menu-preview/${experience}?locale=en`
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        ok?: boolean;
        payload?: {
          locale?: string;
          menuSlug?: string;
          menuUi?: { menu?: { dishes?: unknown[] } };
        };
      };
      expect(body.ok).toBe(true);
      expect(body.payload?.locale).toBe("en");
      expect(body.payload?.menuSlug).toBe(experience);
      expect(body.payload?.menuUi?.menu?.dishes?.length ?? 0).toBeGreaterThan(0);
    });
  }

  for (const dish of featuredDishRoutes) {
    test(`loads the ${dish.name} English dish route without failures`, async ({
      page
    }) => {
      await expectPublicRoute(page, dish.path);
      expect(await page.locator("h1").count()).toBeGreaterThan(0);
    });
  }

  test("keeps the hero video policy explicit and defers 3D until intent", async ({
    page
  }) => {
    const runtime = observeRuntimeFailures(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    const landingResponse = await page.goto("/", {
      waitUntil: "domcontentloaded"
    });
    expect(landingResponse?.status()).toBe(200);
    const video = page.locator('[data-hero-media="video"] video');
    await expect(video).toHaveCount(1);
    await expect
      .poll(() =>
        video.evaluate((element) => {
          const media = element as HTMLVideoElement;
          return {
            autoplay: media.autoplay,
            controls: media.controls,
            loop: media.loop,
            muted: media.muted,
            playsInline: media.playsInline,
            source: media.currentSrc || media.querySelector("source")?.src || ""
          };
        })
      )
      .toEqual(
        expect.objectContaining({
          autoplay: true,
          controls: false,
          loop: true,
          muted: true,
          playsInline: true,
          source: expect.stringContaining("Vistaire2.mp4")
        })
      );
    await expect(video).toHaveAttribute("poster", "/frames/menualive/frame_0200.webp");
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(runtime.modelRequests).toEqual([]);
    expectRuntimeHealthy(runtime);

    const threeDRuntime = observeRuntimeFailures(page);
    await expectPublicRoute(page, threeDRoute);
    expect(threeDRuntime.modelRequests).toEqual([]);
    await expect(page.locator("model-viewer")).toHaveCount(0);
    const viewerButton = page
      .getByRole("button", { name: "VIEW IN 3D", exact: true })
      .filter({ visible: true });
    await expect(viewerButton).toHaveCount(1);
    await viewerButton.click();
    await expect
      .poll(() => threeDRuntime.modelRequests.length)
      .toBeGreaterThan(0);
    expectRuntimeHealthy(threeDRuntime);
  });

  test("checks both required mobile widths for horizontal overflow", async ({
    page
  }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 }
    ]) {
      await page.setViewportSize(viewport);
      for (const path of landingPaths) {
        const runtime = observeRuntimeFailures(page);
        const response = await page.goto(path, {
          waitUntil: "domcontentloaded"
        });
        expect(response?.status()).toBe(200);
        await expect(page.getByTestId("landing-dishes")).toBeVisible();
        await expectNoHorizontalOverflow(page);
        expectRuntimeHealthy(runtime);
      }
    }
  });

  test("keeps an unknown public route as a real 404", async ({ page }) => {
    const response = await page.goto("/__vistaire-final-live-qa-404__", {
      waitUntil: "domcontentloaded"
    });
    expect(response?.status()).toBe(404);
    await expect(page.getByText("404", { exact: true })).toBeVisible();
  });
});
