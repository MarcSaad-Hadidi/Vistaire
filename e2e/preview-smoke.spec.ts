import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const previewBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
if (!previewBaseUrl) throw new Error("Preview Gate requires PLAYWRIGHT_BASE_URL.");

const previewUrl = new URL(previewBaseUrl);
if (previewUrl.username || previewUrl.password || previewUrl.port) {
  throw new Error("Preview Gate requires an origin URL without credentials or an explicit port.");
}
const expectedOrigin = previewUrl.origin;
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
if (!protectionBypass) {
  throw new Error("Preview Gate requires VERCEL_AUTOMATION_BYPASS_SECRET.");
}

async function establishPreviewAccess(context: BrowserContext) {
  // Keep the secret on one direct API request. maxRedirects: 0 ensures a
  // Preview-controlled redirect cannot forward it to another origin.
  const response = await context.request.get(`${expectedOrigin}/`, {
    headers: {
      "x-vercel-protection-bypass": validatedProtectionBypass,
      "x-vercel-set-bypass-cookie": "true"
    },
    maxRedirects: 0
  });
  const location = response.headers().location;
  if (location && new URL(location, expectedOrigin).origin !== expectedOrigin) {
    throw new Error("Preview access bootstrap redirect left the validated origin.");
  }
  if (response.status() >= 400) {
    throw new Error(`Preview access bootstrap returned HTTP ${response.status()}.`);
  }
}

test.beforeEach(async ({ context }) => {
  await establishPreviewAccess(context);
});

type RuntimeIssues = {
  failedResponses: string[];
  failedRequests: string[];
  consoleErrors: string[];
  pageErrors: string[];
};

function observeRuntimeIssues(page: Page): RuntimeIssues {
  const issues: RuntimeIssues = {
    failedResponses: [],
    failedRequests: [],
    consoleErrors: [],
    pageErrors: []
  };
  page.on("response", (response) => {
    try {
      if (new URL(response.url()).origin === expectedOrigin && response.status() >= 400) {
        issues.failedResponses.push(`${response.status()} ${response.url()}`);
      }
    } catch {
      // Ignore browser-internal URLs.
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText;
    if (failure === "net::ERR_ABORTED" && /\/videos\//i.test(request.url())) return;
    try {
      if (new URL(request.url()).origin === expectedOrigin) {
        issues.failedRequests.push(`${failure ?? "request failed"} ${request.url()}`);
      }
    } catch {
      // Ignore browser-internal URLs.
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") issues.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => issues.pageErrors.push(error.message));
  return issues;
}

async function expectLoadedImages(page: Page) {
  const images = page.locator("img:visible");
  const inViewportCount = () =>
    images.evaluateAll((elements) => {
      const viewportHeight = window.innerHeight;
      return elements.filter((element) => {
        const image = element as HTMLImageElement;
        const rect = image.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < viewportHeight && image.currentSrc;
      }).length;
    });
  const loadedInViewportCount = () =>
    images.evaluateAll((elements) => {
      const viewportHeight = window.innerHeight;
      return elements.filter((element) => {
        const image = element as HTMLImageElement;
        const rect = image.getBoundingClientRect();
        return (
          rect.bottom > 0 &&
          rect.top < viewportHeight &&
          image.currentSrc &&
          image.complete &&
          image.naturalWidth > 0 &&
          image.naturalHeight > 0
        );
      }).length;
    });
  const count = await inViewportCount();
  if (!count) return;
  await expect.poll(loadedInViewportCount).toBe(count);
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

async function expectHealthyRoute(page: Page, path: string, html = true) {
  const issues = observeRuntimeIssues(page);
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `Expected ${path} to return 200`).toBe(200);
  expect(new URL(page.url()).origin).toBe(expectedOrigin);
  if (html) {
    await expect(page.locator("main")).toBeVisible();
    await expectLoadedImages(page);
    await expectNoHorizontalOverflow(page);
  }
  expect(issues.failedResponses).toEqual([]);
  expect(issues.failedRequests).toEqual([]);
  expect(issues.consoleErrors).toEqual([]);
  expect(issues.pageErrors).toEqual([]);
}

test.describe("trusted Vercel Preview Gate", () => {
  for (const path of [
    "/",
    "/en",
    "/demo",
    "/menu/trouvable?lang=en-CA",
    "/menu/sauge-noire?lang=en-CA",
    "/menu/trouvable/dishes/pesto-burrata-verde?lang=en-CA"
  ]) {
    test(`loads ${path} without runtime failures`, async ({ page }) => {
      await expectHealthyRoute(page, path);
    });
  }

  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    test(`serves ${path} without an unexpected error`, async ({ page }) => {
      await expectHealthyRoute(page, path, false);
    });
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    test(`keeps the landing route within ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await expectHealthyRoute(page, "/");
    });
  }
});
