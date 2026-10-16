import { expect, test } from "@playwright/test";

test("production comparison renders each restaurant’s versioned dish photo through its signed redirect", async ({
  page
}) => {
  test.setTimeout(90_000);
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
  const response = await page.goto("/menu-pdf-vs-menu-digital", {
    waitUntil: "domcontentloaded"
  });
  expect(response?.status()).toBe(200);
  const comparison = page.getByTestId("landing-comparison");
  await comparison.scrollIntoViewIfNeeded();
  await expect(comparison).toHaveAttribute("data-tabs-interactive", "true");
  const photoPaths: string[] = [];
  for (const [slug, name] of [
    ["maison-elyse", "Maison Élyse"],
    ["trouvable", "Trouvable"],
    ["sauge-noire", "Sauge Noire"]
  ]) {
    await comparison.getByRole("tab", { name, exact: true }).click();
    const renderer = comparison.locator(`[data-landing-menu-renderer="${slug}"]`);
    await expect(renderer).toHaveAttribute("data-preview-status", "ready");
    const photo = renderer.locator(
      'img[src*="/api/public/menu-dishes/"][src*="?v="]'
    ).first();
    await expect(photo).toBeAttached();
    await expect.poll(() => photo.evaluate((element: HTMLImageElement) =>
      element.complete && element.naturalWidth > 0 && element.naturalHeight > 0
    )).toBe(true);
    const src = await photo.getAttribute("src");
    expect(src).not.toBeNull();
    const resolved = new URL(src!, page.url());
    const photoPath = `${resolved.pathname}${resolved.search}`;
    expect(photoPath).toMatch(
      /^\/api\/public\/menu-dishes\/[0-9a-f-]+\/photo\?v=[0-9a-f]{64}&variant=(?:display|thumbnail|card)$/i
    );
    photoPaths.push(photoPath);
  }
  expect(new Set(photoPaths).size).toBe(3);

  const redirectResponse = await page.request.get(photoPaths[0], {
    maxRedirects: 0
  });
  expect(redirectResponse.status()).toBe(307);
  expect(redirectResponse.headers()["cache-control"]).toBe("no-store");
  expect(redirectResponse.headers().location).toMatch(
    /^http:\/\/127\.0\.0\.1:55434\/storage\/v1\/object\/sign\/vistaire-media\/.+\?token=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
  );

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
