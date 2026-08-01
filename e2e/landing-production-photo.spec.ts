import { expect, test } from "@playwright/test";

test("production landing renders a versioned public dish photo through its signed redirect", async ({
  page
}) => {
  const imageResponses: Array<{
    cacheControl: string | null;
    contentType: string | null;
    status: number;
    url: string;
  }> = [];
  const failedResponses: string[] = [];

  page.on("response", (response) => {
    const url = response.url();
    if (
      /\/api\/public\/menu-dishes\/[^/]+\/photo\?v=/i.test(url) ||
      /\/storage\/v1\/object\/sign\/vistaire-media\//i.test(url)
    ) {
      imageResponses.push({
        cacheControl: response.headers()["cache-control"] ?? null,
        contentType: response.headers()["content-type"] ?? null,
        status: response.status(),
        url
      });
    }
    if (
      response.status() >= 400 &&
      new URL(url).origin === new URL(page.url()).origin
    ) {
      failedResponses.push(`${response.status()} ${url}`);
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const landingResponse = await page.goto("/", {
    waitUntil: "domcontentloaded"
  });
  expect(landingResponse?.status()).toBe(200);
  const dishes = page.getByTestId("landing-dishes");
  await dishes.scrollIntoViewIfNeeded();
  const versionedPhotos = dishes.locator(
    'img[data-public-dish-image][src*="/api/public/menu-dishes/"][src*="?v="]'
  );
  await expect(versionedPhotos).toHaveCount(3);
  const photoPaths = await versionedPhotos.evaluateAll((images) =>
    images.map((image) => {
      const src = image.getAttribute("src");
      if (!src) throw new Error("Versioned landing photo is missing its src.");
      const resolved = new URL(src, window.location.href);
      return `${resolved.pathname}${resolved.search}`;
    })
  );
  expect(new Set(photoPaths).size).toBe(3);
  for (const photoPath of photoPaths) {
    expect(photoPath).toMatch(
      /^\/api\/public\/menu-dishes\/[0-9a-f-]+\/photo\?v=[0-9a-f]{64}$/i
    );
  }

  const redirectResponse = await page.request.get(photoPaths[0], {
    maxRedirects: 0
  });
  expect(redirectResponse.status()).toBe(307);
  expect(redirectResponse.headers()["cache-control"]).toContain("max-age=120");
  expect(redirectResponse.headers().location).toMatch(
    /^http:\/\/127\.0\.0\.1:55434\/storage\/v1\/object\/sign\/vistaire-media\/.+\?token=fixture-photo-token$/
  );

  await expect
    .poll(() =>
      versionedPhotos.evaluateAll((images) =>
        images.every((image) => {
          const element = image as HTMLImageElement;
          return (
            element.complete &&
            element.naturalWidth > 0 &&
            element.naturalHeight > 0
          );
        })
      )
    )
    .toBe(true);

  expect(photoPaths.every((path) => !path.includes("/_next/image"))).toBe(true);
  expect(failedResponses).toEqual([]);
  expect(
    new Set(
      imageResponses
        .filter(
          (response) =>
            response.status === 200 &&
            response.contentType?.startsWith("image/") &&
            /\/storage\/v1\/object\/sign\/vistaire-media\//.test(response.url)
        )
        .map((response) => response.url)
    ).size
  ).toBeGreaterThanOrEqual(3);
});
