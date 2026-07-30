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
  const versionedPhotoPath =
    "/api/public/menu-dishes/44444444-4444-4444-8444-000000000001/photo" +
    "?v=0000000000000000000000000000000000000000000000000000000000000002";
  const redirectResponse = await page.request.get(versionedPhotoPath, {
    maxRedirects: 0
  });
  expect(redirectResponse.status()).toBe(307);
  expect(redirectResponse.headers()["cache-control"]).toContain("max-age=120");
  expect(redirectResponse.headers().location).toMatch(
    /^http:\/\/127\.0\.0\.1:55434\/storage\/v1\/object\/sign\/vistaire-media\/.+\?token=fixture-photo-token$/
  );

  const landingResponse = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(landingResponse?.status()).toBe(200);
  const dishes = page.getByTestId("landing-dishes");
  await dishes.scrollIntoViewIfNeeded();
  const versionedPhoto = dishes.locator(
    'img[data-public-dish-image][src*="/api/public/menu-dishes/"][src*="?v="]'
  );
  await expect(versionedPhoto).toHaveCount(1);
  await versionedPhoto.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      versionedPhoto.evaluate((image) => {
        const element = image as HTMLImageElement;
        return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
      })
    )
    .toBe(true);

  const src = await versionedPhoto.getAttribute("src");
  expect(src).not.toBeNull();
  const resolvedSrc = new URL(src!, page.url());
  expect(`${resolvedSrc.pathname}${resolvedSrc.search}`).toMatch(
    /^\/api\/public\/menu-dishes\/[0-9a-f-]+\/photo\?v=[0-9a-f]{64}$/i
  );
  expect(`${resolvedSrc.pathname}${resolvedSrc.search}`).toBe(versionedPhotoPath);
  expect(resolvedSrc.pathname).not.toContain("/_next/image");
  expect(failedResponses).toEqual([]);
  expect(
    imageResponses.some(
      (response) =>
        response.status === 200 &&
        response.contentType?.startsWith("image/") &&
        /\/storage\/v1\/object\/sign\/vistaire-media\//.test(response.url)
    )
  ).toBe(true);
});
