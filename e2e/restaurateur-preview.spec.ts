import { expect, test, type Page, type Request } from "@playwright/test";
// @ts-expect-error -- dependency-free ESM policy is also exercised directly by Node contracts.
import { classifyRestaurateurPreviewRequest, shouldIgnoreRestaurateurPreviewRequestFailure } from "./support/restaurateur-preview-request-policy.mjs";

type Scenario = {
  path: "/apercu-restaurateur" | "/en/restaurant-preview";
  sampleMenu: {label: string; href: string};
  videoLabel: string;
  transcript: string;
};
const scenarios: Scenario[] = [
  {path: "/apercu-restaurateur", sampleMenu: {label: "Voir la carte exemple", href: "/demo"}, videoLabel: "Vidéo de démonstration du Studio Vistaire, 20 secondes", transcript: "Ce que montre la vidéo"},
  {path: "/en/restaurant-preview", sampleMenu: {label: "View sample menu", href: "/en/vistaire-menu"}, videoLabel: "Vistaire Studio demonstration video, 20 seconds", transcript: "What the video shows"}
];
const canonicalOrigin = "https://www.vistaire.ca";

const allowedJsonLdDocumentTypes = new Set(["WebPage", "Service", "BreadcrumbList"]);
const forbiddenJsonLdTypes = new Set(["AggregateRating", "Review", "SoftwareApplication"]);
const forbiddenJsonLdClaimKeys = new Set([
  "analytics",
  "availability",
  "availabledishes",
  "categorybreakdown",
  "comparison",
  "dishopens",
  "heatmap",
  "immersive",
  "keyinsights",
  "menuopens",
  "metrics",
  "periods",
  "readiness",
  "searchbreakdown",
  "searches",
  "servicebreakdown",
  "summary",
  "topdishes"
]);

function visitJson(value: unknown, visit: (key: string | null, value: unknown) => void, key: string | null = null) {
  visit(key, value);
  if (Array.isArray(value)) {
    for (const item of value) visitJson(item, visit);
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      visitJson(childValue, visit, childKey);
    }
  }
}

function jsonLdDocuments(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(jsonLdDocuments);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  if (Array.isArray(object["@graph"])) return object["@graph"].flatMap(jsonLdDocuments);
  return [object];
}

function requestHeaders(request: Request) {
  const headers = request.headers();
  return Object.fromEntries(
    Object.keys(headers).map((name) => [name, "present"])
  );
}

function observeRuntime(page: Page, baseURL: string) {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  const privateRequests: string[] = [];
  const productMutations: string[] = [];
  const unexpectedWrites: string[] = [];
  const frameworkPosts: string[] = [];
  const modelRequests: string[] = [];
  const videoRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => {
    const result = classifyRestaurateurPreviewRequest({
      baseOrigin: baseURL,
      url: request.url(),
      method: request.method(),
      headers: requestHeaders(request)
    });
    if (result.privateEndpoint) privateRequests.push(result.pathname);
    if (result.productMutation) productMutations.push(result.pathname);
    if (result.unexpectedWrite) unexpectedWrites.push(result.pathname);
    if (result.frameworkInternal) frameworkPosts.push(result.pathname);
    if (result.modelAsset) modelRequests.push(result.pathname);
    if (result.videoAsset) videoRequests.push(result.pathname);
  });
  page.on("requestfailed", (request) => {
    const headers = request.headers();
    const explicitPrefetch =
      /prefetch/i.test(headers.purpose ?? "") ||
      /^(?:1|true|prefetch)$/i.test(headers["next-router-prefetch"] ?? "");
    const errorText = request.failure()?.errorText ?? "request failed";
    if (errorText === "net::ERR_ABORTED" && explicitPrefetch) return;
    if (errorText === "net::ERR_ABORTED" && request.method() === "GET" && new URL(request.url()).pathname === "/videos/demo/dashboard-studio.mp4") return;
    if (shouldIgnoreRestaurateurPreviewRequestFailure({
      baseOrigin: baseURL,
      url: request.url(),
      errorText
    })) return;
    networkErrors.push(`${errorText} ${new URL(request.url()).pathname}`);
  });
  page.on("response", (response) => {
    if (response.status() === 404 || response.status() >= 500) {
      networkErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  return {
    consoleErrors,
    networkErrors,
    privateRequests,
    productMutations,
    unexpectedWrites,
    frameworkPosts,
    modelRequests,
    videoRequests,
    expectClean() {
      expect(consoleErrors, "console and hydration errors").toEqual([]);
      expect(networkErrors, "failed requests and 404/5xx responses").toEqual([]);
      expect(privateRequests, "private/admin/owner/Supabase requests").toEqual([]);
      expect(productMutations, "private product or analytics mutations").toEqual([]);
      expect(unexpectedWrites, `unexpected writes; Next internals: ${frameworkPosts.join(", ")}`).toEqual([]);
      expect(modelRequests, "GLB or USDZ requests").toEqual([]);
      expect(videoRequests.filter(path => path !== "/videos/demo/dashboard-studio.mp4"), "only the requested walkthrough video may load").toEqual([]);
    }
  };
}

async function expectSafeDom(page: Page, scenario: Scenario) {
  const privateDestinations = await page.locator("a[href], form[action], [formaction]").evaluateAll(
    (elements) => elements.flatMap((element) => {
      const raw = element.getAttribute("href") ?? element.getAttribute("action") ?? element.getAttribute("formaction");
      if (!raw) return [];
      const url = new URL(raw, window.location.href);
      return url.origin === window.location.origin && /^\/(?:admin|owner)(?:\/|$)/.test(url.pathname)
        ? [url.pathname]
        : [];
    })
  );
  expect(privateDestinations).toEqual([]);
  const sampleLinks = page.getByRole("link", { name: scenario.sampleMenu.label, exact: true });
  expect(await sampleLinks.count()).toBeGreaterThan(0);
  for (const sampleLink of await sampleLinks.all()) {
    await expect(sampleLink).toHaveAttribute("href", scenario.sampleMenu.href);
  }
  await expect(page.getByRole("contentinfo")).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies, "the anonymous preview must not create any cookie").toEqual([]);
}

async function expectSafeSeo(page: Page, scenario: Scenario) {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new URL(scenario.path, canonicalOrigin).toString()
  );
  for (const hreflang of ["fr-CA", "en-CA", "x-default"]) {
    await expect(page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`)).toHaveCount(1);
  }
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(schemas.length).toBeGreaterThan(0);
  const documentGroups = schemas.map((source, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      throw new Error(`JSON-LD script ${index + 1} is not valid JSON`, { cause: error });
    }
    return jsonLdDocuments(parsed);
  });
  for (const group of documentGroups) expect(group.length).toBeGreaterThan(0);
  const pageIdPrefix = `${canonicalOrigin}${scenario.path}#`;
  const pageDocuments = documentGroups
    .flat()
    .filter((document) =>
      typeof document["@id"] === "string" && document["@id"].startsWith(pageIdPrefix)
    );
  expect(pageDocuments).toHaveLength(3);

  const documentTypes: string[] = [];
  for (const document of pageDocuments) {
    const rawTypes = Array.isArray(document["@type"])
      ? document["@type"]
      : [document["@type"]];
    const types = rawTypes.filter((value): value is string => typeof value === "string");
    expect(types.length, "every page JSON-LD document must declare one @type").toBe(1);
    for (const type of types) {
      expect(allowedJsonLdDocumentTypes.has(type), `unsupported JSON-LD document type ${type}`).toBe(true);
      documentTypes.push(type);
    }

    visitJson(document, (key, value) => {
      if (key) {
        const normalizedKey = key.replace(/[^a-z]/gi, "").toLowerCase();
        expect(forbiddenJsonLdClaimKeys.has(normalizedKey), `fixture/private JSON-LD claim ${key}`).toBe(false);
      }
      if (key === "@type") {
        for (const nestedType of Array.isArray(value) ? value : [value]) {
          if (typeof nestedType === "string") {
            expect(forbiddenJsonLdTypes.has(nestedType), `unsupported JSON-LD claim type ${nestedType}`).toBe(false);
          }
        }
      }
      if (typeof value === "string") {
        expect(value, "fixture/private JSON-LD value").not.toMatch(
          /Maison Élyse\s*[—-]\s*Démo|(?:^|\/)admin(?:\/|$)|(?:^|\/)owner(?:\/|$)|supabase/i
        );
      }
    });
  }
  expect(new Set(documentTypes)).toEqual(new Set(["WebPage", "Service", "BreadcrumbList"]));
}


for (const scenario of scenarios) {
  test(`${scenario.path} presents a genuine video with private data isolation and user-controlled playback`, async ({baseURL, page}) => {
    const runtime = observeRuntime(page, baseURL ?? "http://127.0.0.1:3000");
    await page.setViewportSize({width: 1280, height: 720});
    const response = await page.goto(scenario.path, {waitUntil: "domcontentloaded"});
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", {level: 1})).toHaveCount(1);
    await expect(page.locator("[data-admin-studio]")).toHaveCount(0);
    const film = page.locator("[data-dashboard-walkthrough]");
    const video = film.locator("video");
    await expect(video).toHaveAttribute("aria-label", scenario.videoLabel);
    await expect(video).toHaveAttribute("controls", "");
    await expect(video).toHaveAttribute("playsinline", "");
    await expect(video).toHaveAttribute("preload", "none");
    await expect(video).not.toHaveAttribute("autoplay", "");
    await expect(video).toHaveAttribute("poster", "/images/demo-walkthrough/dashboard-studio.webp");
    await video.scrollIntoViewIfNeeded();
    await expect(video).toHaveAttribute("src", "/videos/demo/dashboard-studio.mp4");
    expect(await video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
    await video.evaluate(element => (element as HTMLVideoElement).play());
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(.2);
    expect(await video.evaluate(element => (element as HTMLVideoElement).duration)).toBeCloseTo(20, 0);
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
    await film.getByText(scenario.transcript, {exact: true}).click();
    await expect(film.locator("ol li")).toHaveCount(4);
    await expectSafeDom(page, scenario);
    await expectSafeSeo(page, scenario);
    runtime.expectClean();
  });

  test(`${scenario.path} keeps the video readable at mobile widths and still under reduced motion`, async ({page}) => {
    await page.emulateMedia({reducedMotion: "reduce"});
    for (const width of [390, 430, 1440]) {
      await page.setViewportSize({width, height: 900});
      await page.goto(scenario.path, {waitUntil: "domcontentloaded"});
      const video = page.locator("[data-dashboard-walkthrough] video");
      await video.scrollIntoViewIfNeeded();
      await expect(video).toBeVisible();
      expect(await video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
      expect(await video.evaluate(element => (element as HTMLVideoElement).controls)).toBe(true);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    }
    await page.locator("[data-dashboard-walkthrough] video").evaluate(element => (element as HTMLVideoElement).play());
    await expect.poll(() => page.locator("[data-dashboard-walkthrough] video").evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(.2);
  });
}
