import { expect, test, type Page } from "@playwright/test";

const LANDING_VIDEO_ROUTE = "/videos/Vistaire2.mp4";
const MODEL_ASSET_REQUEST_RE =
  /\.(?:glb|usdz)(?:$|\?)|raw\.githubusercontent\.com|githubusercontent/i;

const viewports = [
  { label: "iphone-375", width: 375, height: 812 },
  { label: "iphone-390", width: 390, height: 844 },
  { label: "iphone-430", width: 430, height: 932 },
  { label: "tablet-768", width: 768, height: 1024 },
  { label: "desktop", width: 1280, height: 720 }
];

function collectModelAssetRequests(page: Page) {
  const requests: string[] = [];

  page.on("request", (request) => {
    const url = request.url();

    if (MODEL_ASSET_REQUEST_RE.test(url)) {
      requests.push(url);
    }
  });

  return requests;
}

async function expectNoHorizontalOverflow(page: Page) {
  const gap = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });

  expect(gap).toBeLessThanOrEqual(2);
}

async function expectLandingVideoLoop(page: Page) {
  const video = page.locator("main video").first();

  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate((element) => {
        const media = element as HTMLVideoElement;
        return {
          autoplay: media.autoplay,
          controls: media.controls,
          loop: media.loop,
          muted: media.muted,
          paused: media.paused,
          playsInline: media.playsInline,
          src: media.currentSrc || media.querySelector("source")?.src || ""
        };
      })
    )
    .toEqual(
      expect.objectContaining({
        autoplay: true,
        controls: false,
        loop: true,
        muted: true,
        paused: false,
        playsInline: true
      })
    );

  await expect
    .poll(() =>
      video.evaluate((element) => {
        const media = element as HTMLVideoElement;
        return media.currentSrc || media.querySelector("source")?.src || "";
      })
    )
    .toContain(LANDING_VIDEO_ROUTE);
}

test.describe("Landing responsive", () => {
  for (const vp of viewports) {
    test(`no horizontal overflow at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe("Landing production experience", () => {
  test("landing renders the promoted Vistaire preview with a looping video", async ({
    page
  }) => {
    const modelAssetRequests = collectModelAssetRequests(page);

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Donnez envie avant la première bouchée/
      })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explorer Maison Élyse" })
    ).toHaveAttribute("href", "/demo");
    await expect(
      page.getByRole("link", { name: "Prendre rendez-vous" }).first()
    ).toHaveAttribute("href", "/prendre-rendez-vous");
    await expect(page.getByText(/Demander une demo|Demander une démo/i)).toHaveCount(
      0
    );
    await expect(page.getByText(/pause|mettre en pause|reprendre/i)).toHaveCount(0);

    await expectLandingVideoLoop(page);
    await expectNoHorizontalOverflow(page);
    expect(modelAssetRequests).toEqual([]);
  });

  test("mobile landing keeps the same looping video and touchable CTA", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expectLandingVideoLoop(page);
    await expect(
      page.getByRole("link", { name: "Prendre rendez-vous" }).first()
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("Contact links to the dedicated rendez-vous form", async ({ page }) => {
    await page.goto("/contact", { waitUntil: "domcontentloaded" });

    await page
      .getByRole("link", { name: "Prendre rendez-vous" })
      .first()
      .click();

    await expect(page).toHaveURL(/\/prendre-rendez-vous$/);
    await expect(
      page.getByRole("heading", { name: /Prendre rendez-vous/ })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour au contact" })).toHaveAttribute(
      "href",
      "/contact"
    );
  });
});

test.describe("Menu and dish regression", () => {
  test("menu links to a dish detail and returns to the carte", async ({ page }) => {
    const modelAssetRequests = collectModelAssetRequests(page);

    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByTestId("demo-phone-viewport").getByText("LA COLLECTION")
    ).toBeVisible();
    await expect(
      page.getByTestId("demo-phone-viewport").getByRole("heading", { name: "LA CARTE" })
    ).toBeVisible();
    await expect(
      page
        .getByTestId("demo-phone-viewport")
        .getByRole("heading", { level: 1, name: /Bienvenue chez Maison/i })
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    expect(modelAssetRequests).toEqual([]);

    await expect(
      page
        .getByTestId("demo-phone-viewport")
        .getByRole("button", { name: "Voir toute la carte" })
    ).toHaveCount(0);

    await page
      .getByTestId("demo-phone-viewport")
      .getByRole("button", { name: /Ravioles/i })
      .click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(
      page
        .getByTestId("demo-phone-viewport")
        .getByRole("heading", { level: 1, name: /Ravioles/i })
    ).toBeVisible();
    await expect(page.locator("model-viewer")).toHaveCount(0);
    expect(modelAssetRequests).toEqual([]);

    await page
      .getByTestId("demo-phone-viewport")
      .getByRole("button", { name: /Retour . la carte/i })
      .click();
    await expect(
      page.getByTestId("demo-phone-viewport").getByRole("heading", { name: "LA CARTE" })
    ).toBeVisible();
  });

  test("/admin still loads as the public noindex restaurant preview", async ({
    page
  }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
