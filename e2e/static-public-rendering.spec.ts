import {
  expect,
  test,
  type APIResponse,
  type BrowserContext,
  type Page
} from "@playwright/test";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const BASE_ORIGIN = new URL(BASE_URL).origin;
const CANONICAL_ORIGIN = "https://www.vistaire.ca";
const EXPECT_VERCEL_RESPONSE_TRANSFORM =
  process.env.VISTAIRE_EXPECT_VERCEL_RESPONSE_TRANSFORM === "1";

const STATIC_ROUTE_PAIRS = [
  ["/", "/en"],
  ["/tarifs-menu-digital-restaurant", "/en/pricing-digital-restaurant-menu"],
  ["/menu-digital-restaurant", "/en/digital-restaurant-menu"],
  ["/menu-qr-code-restaurant", "/en/qr-code-restaurant-menu"],
  ["/menu-3d-ar-restaurant", "/en/3d-ar-restaurant-menu"],
  ["/menu-pdf-vs-menu-digital", "/en/pdf-vs-digital-menu"],
  ["/a-propos", "/en/about"],
  ["/contact", "/en/contact"],
  ["/prendre-rendez-vous", "/en/book-a-call"],
  ["/apercu-restaurateur", "/en/restaurant-preview"],
  [
    "/guides/anatomie-menu-digital-premium",
    "/en/guides/premium-digital-menu-anatomy"
  ],
  [
    "/guides/menu-qr-mobile-sans-application",
    "/en/guides/mobile-qr-menu-without-app"
  ],
  [
    "/guides/3d-restaurant-utile-vs-gadget",
    "/en/guides/restaurant-3d-useful-vs-gimmick"
  ]
] as const;

type StaticRoute = {
  path: string;
  locale: "fr-CA" | "en-CA";
  alternates: Record<"fr-CA" | "en-CA" | "x-default", string>;
};

const STATIC_ROUTES: readonly StaticRoute[] = STATIC_ROUTE_PAIRS.flatMap(
  ([frenchPath, englishPath]) => {
    const alternates = {
      "fr-CA": frenchPath,
      "en-CA": englishPath,
      "x-default": frenchPath
    } as const;
    return [
      { path: frenchPath, locale: "fr-CA" as const, alternates },
      { path: englishPath, locale: "en-CA" as const, alternates }
    ];
  }
);

const REPRESENTATIVE_430_ROUTES = [
  "/",
  "/en",
  "/a-propos",
  "/en/about",
  "/guides/anatomie-menu-digital-premium",
  "/en/guides/premium-digital-menu-anatomy"
] as const;

const EXPECTED_DISCOVERY_LINKS = [
  {
    target: "/.well-known/api-catalog",
    rel: "api-catalog",
    type: "application/linkset+json"
  },
  {
    target: "/.well-known/agent-skills/index.json",
    rel: "service-desc",
    type: "application/json"
  },
  {
    target: "/.well-known/mcp/server-card.json",
    rel: "service-desc",
    type: "application/json"
  },
  {
    target: "/auth.md",
    rel: "service-doc",
    type: "text/markdown"
  },
  {
    target: "/openapi.json",
    rel: "service-desc",
    type: "application/openapi+json"
  }
] as const;

const HYDRATION_WARNING_RE =
  /hydration|hydrated|server[- ]rendered|server.*client|client.*server|did not match|content does not match|text content does not match/i;
const OBSERVED_RESOURCE_TYPES = new Set([
  "document",
  "script",
  "stylesheet",
  "image",
  "font",
  "media"
]);
const ERROR_OVERLAY_SELECTOR =
  "[data-nextjs-dialog], nextjs-portal, #webpack-dev-server-client-overlay, .vite-error-overlay";

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|amp|quot|apos|lt|gt);/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      const named: Record<string, string> = {
        "&amp;": "&",
        "&quot;": '"',
        "&apos;": "'",
        "&lt;": "<",
        "&gt;": ">"
      };
      return named[entity.toLowerCase()] ?? entity;
    }
  );
}

function readAttributes(tag: string) {
  const attributes = new Map<string, string>();
  const attributePattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.matchAll(attributePattern)) {
    const name = match[1].toLowerCase();
    if (name === "html" || name === "link" || name === "script") continue;
    attributes.set(
      name,
      decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "")
    );
  }
  return attributes;
}

function absoluteUrl(value: string) {
  return new URL(value).toString();
}

function expectedUrl(path: string) {
  return new URL(path, CANONICAL_ORIGIN).toString();
}

function jsonLdPayloads(html: string) {
  const payloads: unknown[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const attributes = readAttributes(`<script ${match[1]}>`);
    if (attributes.get("type")?.toLowerCase() !== "application/ld+json") continue;
    payloads.push(JSON.parse(match[2].trim()));
  }
  return payloads;
}

function hasPageSpecificSchema(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const records = Array.isArray(payload) ? payload : [payload];
  const globalTypes = new Set(["Organization", "ProfessionalService", "WebSite"]);
  return records.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const record = entry as Record<string, unknown>;
    const context = record["@context"];
    const rawType = record["@type"];
    const types = Array.isArray(rawType) ? rawType : [rawType];
    return (
      typeof context === "string" &&
      context.includes("schema.org") &&
      types.some((type) => typeof type === "string" && !globalTypes.has(type))
    );
  });
}

async function expectRawHtmlContract(
  response: APIResponse,
  body: string,
  route: StaticRoute
) {
  expect(response.status(), `${route.path}: response status`).toBeLessThan(400);
  expect(
    response.headers()["content-type"],
    `${route.path}: HTML content type`
  ).toMatch(/^text\/html\b/i);
  expect(
    new URL(response.url()).pathname,
    `${route.path}: response must not cross into the opposite locale`
  ).toBe(route.path);

  const htmlTags = body.match(/<html\b[^>]*>/gi) ?? [];
  expect(htmlTags, `${route.path}: exactly one opening html tag`).toHaveLength(1);
  const htmlTag = htmlTags[0];
  if (!htmlTag) throw new Error(`${route.path}: missing opening html tag`);
  expect(
    readAttributes(htmlTag).get("lang"),
    `${route.path}: raw initial language`
  ).toBe(route.locale);

  const linkTags = (body.match(/<link\b[^>]*>/gi) ?? []).map(readAttributes);
  const canonicals = linkTags.filter((attributes) =>
    (attributes.get("rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .includes("canonical")
  );
  expect(canonicals, `${route.path}: one canonical`).toHaveLength(1);
  expect(absoluteUrl(canonicals[0].get("href") ?? ""))
    .toBe(expectedUrl(route.path));

  const alternates = linkTags.filter((attributes) =>
    (attributes.get("rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .includes("alternate")
  );
  for (const [hreflang, alternatePath] of Object.entries(route.alternates)) {
    const matching = alternates.filter(
      (attributes) => attributes.get("hreflang")?.toLowerCase() === hreflang.toLowerCase()
    );
    expect(matching, `${route.path}: one ${hreflang} alternate`).toHaveLength(1);
    expect(absoluteUrl(matching[0].get("href") ?? ""))
      .toBe(expectedUrl(alternatePath));
  }

  const payloads = jsonLdPayloads(body);
  expect(payloads.length, `${route.path}: JSON-LD blocks`).toBeGreaterThan(0);
  expect(
    payloads.some(hasPageSpecificSchema),
    `${route.path}: page-specific schema with stable @context and @type`
  ).toBe(true);
}

type BrowserHealth = {
  consoleSignals: string[];
  pageErrors: string[];
  failedResponses: string[];
  failedRequests: string[];
};

function collectBrowserHealth(page: Page): BrowserHealth {
  const health: BrowserHealth = {
    consoleSignals: [],
    pageErrors: [],
    failedResponses: [],
    failedRequests: []
  };

  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      (message.type() === "warning" && HYDRATION_WARNING_RE.test(message.text()))
    ) {
      health.consoleSignals.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => health.pageErrors.push(error.message));
  page.on("response", (response) => {
    const request = response.request();
    if (!OBSERVED_RESOURCE_TYPES.has(request.resourceType())) return;
    if (new URL(response.url()).origin !== BASE_ORIGIN) return;
    if (response.status() >= 400) {
      health.failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    health.failedRequests.push(
      `${request.failure()?.errorText ?? "request failed"} ${request.url()}`
    );
  });

  return health;
}

async function expectHealthyRenderedRoute(page: Page, path: string) {
  const health = collectBrowserHealth(page);
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `${path}: main-document response`).not.toBeNull();
  expect(response?.status(), `${path}: main-document status`).toBeLessThan(400);
  await page.waitForLoadState("load");

  const content = page.locator("#contenu");
  await expect(content, `${path}: #contenu`).toBeVisible();
  await expect(page.locator("h1").first(), `${path}: route heading`).toBeVisible();
  await expect
    .poll(() => page.locator("body").innerText().then((text) => text.trim().length))
    .toBeGreaterThan(40);
  await expect(page.locator(ERROR_OVERLAY_SELECTOR)).toHaveCount(0);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `${path}: document horizontal overflow`).toBeLessThanOrEqual(2);
  expect(health.consoleSignals, `${path}: console/hydration signals`).toEqual([]);
  expect(health.pageErrors, `${path}: page errors`).toEqual([]);
  expect(health.failedResponses, `${path}: bad same-origin responses`).toEqual([]);
  expect(health.failedRequests, `${path}: failed requests`).toEqual([]);
}

function parseLinkHeader(value: string | undefined) {
  const entries: Array<{ target: string; rel: string; type: string }> = [];
  if (!value) return entries;
  for (const match of value.matchAll(/<([^>]+)>((?:\s*;\s*[^,]+)*)/g)) {
    const parameters = new Map<string, string>();
    for (const parameter of match[2].matchAll(
      /;\s*([^=;,\s]+)\s*=\s*(?:"([^"]*)"|([^;,\s]+))/g
    )) {
      parameters.set(parameter[1].toLowerCase(), parameter[2] ?? parameter[3]);
    }
    entries.push({
      target: match[1],
      rel: parameters.get("rel") ?? "",
      type: parameters.get("type") ?? ""
    });
  }
  return entries;
}

function expectDiscoveryLinks(response: APIResponse, label: string) {
  const entries = parseLinkHeader(response.headers().link);
  for (const expected of EXPECTED_DISCOVERY_LINKS) {
    expect(
      entries.filter(
        (entry) =>
          entry.target === expected.target &&
          entry.rel === expected.rel &&
          entry.type === expected.type
      ),
      `${label}: ${expected.target} discovery link`
    ).toHaveLength(1);
  }
  expect(
    entries.filter((entry) =>
      EXPECTED_DISCOVERY_LINKS.some((expected) => expected.target === entry.target)
    ),
    `${label}: no duplicated logical discovery links`
  ).toHaveLength(EXPECTED_DISCOVERY_LINKS.length);
}

function varyTokens(response: APIResponse) {
  return (response.headers().vary ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function expectSingleAcceptVary(response: APIResponse, label: string) {
  const tokens = varyTokens(response);
  expect(
    tokens.filter((token) => token === "accept"),
    `${label}: exactly one Accept Vary token`
  ).toHaveLength(1);
}

async function firstPreviewRequest(
  context: BrowserContext,
  path: string,
  headers: Record<string, string>
) {
  const protectionBypass =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  const response = await context.request.get(path, {
    headers: protectionBypass
      ? {
          ...headers,
          "x-vercel-protection-bypass": protectionBypass,
          "x-vercel-set-bypass-cookie": "true"
        }
      : headers,
    maxRedirects: 0
  });
  const location = response.headers().location;
  if (location && new URL(location, BASE_URL).origin !== BASE_ORIGIN) {
    throw new Error("Preview access bootstrap redirected outside the configured origin.");
  }
  return response;
}

test.describe("static public rendering", () => {
  for (const route of STATIC_ROUTES) {
    test(`${route.path} keeps raw locale, exact SEO, JSON-LD, and browser health`, async ({
      page,
      request
    }) => {
      const rawResponse = await request.get(route.path, {
        headers: { accept: "text/html" }
      });
      const rawBody = await rawResponse.text();
      await expectRawHtmlContract(rawResponse, rawBody, route);

      await page.setViewportSize({ width: 390, height: 844 });
      await expectHealthyRenderedRoute(page, route.path);
      await expect(page.locator("html")).toHaveAttribute("lang", route.locale);
    });
  }

  for (const path of REPRESENTATIVE_430_ROUTES) {
    test(`${path} stays healthy at 430px`, async ({ page }) => {
      await page.setViewportSize({ width: 430, height: 932 });
      await expectHealthyRenderedRoute(page, path);
    });
  }

  test("@preview-root-headers keeps HTML and Markdown representations distinct", async ({
    context
  }) => {
    let requestCount = 0;
    const rootHtml = await firstPreviewRequest(context, "/", {
      accept: "text/html"
    });
    requestCount += 1;
    const rootHtmlBody = await rootHtml.text();
    if (
      EXPECT_VERCEL_RESPONSE_TRANSFORM &&
      /vercel.*(?:authentication|log\s*in|sign\s*in)/i.test(rootHtmlBody)
    ) {
      throw new Error(
        "Preview Protection intercepted the root request; provide VERCEL_AUTOMATION_BYPASS_SECRET."
      );
    }
    await expectRawHtmlContract(rootHtml, rootHtmlBody, STATIC_ROUTES[0]);
    expectDiscoveryLinks(rootHtml, "HTML GET /");
    if (EXPECT_VERCEL_RESPONSE_TRANSFORM) {
      expectSingleAcceptVary(rootHtml, "HTML GET /");
    }

    const rootHtmlHead = await context.request.head("/", {
      headers: { accept: "text/html" }
    });
    requestCount += 1;
    expect(rootHtmlHead.status()).toBeLessThan(400);
    expect(rootHtmlHead.headers()["content-type"]).toMatch(/^text\/html\b/i);
    expect((await rootHtmlHead.body()).byteLength).toBe(0);
    expectDiscoveryLinks(rootHtmlHead, "HTML HEAD /");
    if (EXPECT_VERCEL_RESPONSE_TRANSFORM) {
      expectSingleAcceptVary(rootHtmlHead, "HTML HEAD /");
    }

    const englishHtml = await context.request.get("/en", {
      headers: { accept: "text/html" }
    });
    requestCount += 1;
    await expectRawHtmlContract(
      englishHtml,
      await englishHtml.text(),
      STATIC_ROUTES[1]
    );

    const markdownGet = await context.request.get("/", {
      headers: { accept: "text/markdown" }
    });
    requestCount += 1;
    const markdownBody = await markdownGet.text();
    expect(markdownGet.status()).toBeLessThan(400);
    expect(markdownGet.headers()["content-type"]).toMatch(/^text\/markdown\b/i);
    expect(markdownBody).toMatch(/^# Vistaire\s*$/m);
    expect(markdownBody).not.toMatch(/<html\b/i);
    expectDiscoveryLinks(markdownGet, "Markdown GET /");
    expectSingleAcceptVary(markdownGet, "Markdown GET /");

    const markdownHead = await context.request.head("/", {
      headers: { accept: "text/markdown" }
    });
    requestCount += 1;
    expect(markdownHead.status()).toBeLessThan(400);
    expect(markdownHead.headers()["content-type"]).toMatch(/^text\/markdown\b/i);
    expect((await markdownHead.body()).byteLength).toBe(0);
    expectDiscoveryLinks(markdownHead, "Markdown HEAD /");
    expectSingleAcceptVary(markdownHead, "Markdown HEAD /");

    expect(requestCount, "controlled representation request budget").toBe(5);
  });
});
