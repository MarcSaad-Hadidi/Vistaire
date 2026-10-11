import { readFile } from "node:fs/promises";
import { expect, test, type Page, type Request } from "@playwright/test";
// @ts-expect-error -- dependency-free ESM policy is also exercised directly by Node contracts.
import { classifyRestaurateurPreviewRequest, shouldIgnoreRestaurateurPreviewRequestFailure } from "./support/restaurateur-preview-request-policy.mjs";

type Scenario = {
  path: "/apercu-restaurateur" | "/en/restaurant-preview";
  sampleMenu: {label: string; href: string};
  navigation: string; pages: readonly [string, string, string, string];
  period: string; search: string; availability: string; category: string;
  export: string; exportTitle: string; close: string; download: string; schedule: string;
};
const scenarios: Scenario[] = [
  {path: "/apercu-restaurateur", sampleMenu: {label: "Voir la carte exemple", href: "/demo"}, navigation: "Navigation principale", pages: ["Vue d’ensemble", "Analyses", "Les plats", "Planning"], period: "Période fictive (UTC)", search: "Rechercher un plat", availability: "Disponibilité", category: "Catégorie", export: "Exporter", exportTitle: "Exporter les données", close: "Fermer", download: "Télécharger JSON", schedule: "Planifier"},
  {path: "/en/restaurant-preview", sampleMenu: {label: "View sample menu", href: "/en/vistaire-menu"}, navigation: "Main navigation", pages: ["Overview", "Insights", "Dishes", "Scheduling"], period: "Sample period (UTC)", search: "Search dishes", availability: "Availability", category: "Category", export: "Export", exportTitle: "Export data", close: "Close", download: "Download JSON", schedule: "Schedule"}
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
      expect(videoRequests, "video requests").toEqual([]);
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
  test(`${scenario.path} uses the shared Studio with anonymous, localized, synthetic data`, async ({baseURL, page}) => {
    test.setTimeout(60_000);
    const runtime = observeRuntime(page, baseURL ?? "http://127.0.0.1:3000");
    const response = await page.goto(scenario.path, {waitUntil: "domcontentloaded"});
    expect(response?.status()).toBe(200);
    const studio = page.locator("[data-public-studio-demo] [data-admin-studio]");
    await expect(studio).toHaveCount(1);
    await expect(page.getByRole("heading", {level: 1})).toHaveCount(1);
    await expect(studio.locator("[data-studio-preview-banner]")).toContainText(/données fictives|fictional data/);
    await expect(studio.locator("[data-studio-preview-banner]")).toContainText(/illustratives|illustrative/);
    const nav = studio.getByRole("navigation", {name: scenario.navigation});
    for (const name of scenario.pages) await expect(nav.getByRole("button", {name, exact: true})).toBeVisible();
    const period = studio.getByRole("combobox", {name: scenario.period});
    await expect(period.locator("option")).toHaveCount(3);
    const kpis = studio.locator('[class*="kpis"] > button');
    await expect(kpis).toHaveCount(4);
    const initial = await kpis.allTextContents();
    await period.selectOption("7d");
    await expect.poll(() => kpis.allTextContents()).not.toEqual(initial);
    await period.selectOption("today-utc");
    await expect.poll(() => kpis.allTextContents()).toEqual(initial);
    await kpis.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(kpis.first()).toBeFocused();

    await nav.getByRole("button", {name: scenario.pages[1], exact: true}).click();
    await expect(studio.locator('[data-studio-chart="trend"]')).toBeVisible();
    const chart = studio.getByRole("application").first();
    await chart.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await nav.getByRole("button", {name: scenario.pages[2], exact: true}).click();
    const dishes = studio.locator("[data-admin-menu-dish]");
    await expect(dishes).toHaveCount(12);
    for (const toggle of await dishes.getByRole("switch").all()) await expect(toggle).toBeDisabled();
    await studio.getByRole("combobox", {name: scenario.availability, exact: true}).selectOption("unavailable");
    await expect(dishes).toHaveCount(2);
    await studio.getByRole("combobox", {name: scenario.availability, exact: true}).selectOption("all");
    await studio.getByRole("searchbox", {name: scenario.search, exact: true}).fill("vistaire-no-matching-dish-zzzz");
    await expect(dishes).toHaveCount(0);
    await expect(studio.getByRole("status").filter({hasText: /Aucun plat trouvé|No dishes found/})).toBeVisible();
    await studio.getByRole("searchbox", {name: scenario.search, exact: true}).fill("");
    await expect(dishes).toHaveCount(12);
    await nav.getByRole("button", {name: scenario.pages[3], exact: true}).click();
    await studio.getByRole("button", {name: scenario.schedule, exact: true}).first().click();
    await expect(page.getByRole("dialog")).toContainText(/Aucune règle|No demonstration rule/);
    await page.getByRole("dialog").getByRole("button", {name: scenario.close, exact: true}).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await studio.getByRole("button", {name: scenario.export, exact: true}).click();
    const dialog = page.getByRole("dialog", {name: scenario.exportTitle});
    await expect(dialog).toContainText(/Données fictives|Fictional demonstration data/);
    await dialog.getByRole("radio", {name: /JSON/}).check();
    const downloadEvent = page.waitForEvent("download");
    await dialog.getByRole("button", {name: scenario.download, exact: true}).click();
    const download = await downloadEvent;
    const file = await download.path();
    expect(file).toBeTruthy();
    const report = JSON.parse(await readFile(file!, "utf8"));
    expect(report.synthetic).toBe(true);
    await dialog.getByRole("button", {name: scenario.close, exact: true}).first().click();
    await expectSafeDom(page, scenario);
    await expectSafeSeo(page, scenario);
    await expect(page.locator("model-viewer")).toHaveCount(0);
    runtime.expectClean();
  });

  test(`${scenario.path} keeps Studio embedded at mobile and desktop widths in both themes`, async ({page}) => {
    for (const width of [390, 430, 1440]) {
      await page.setViewportSize({width, height: 900});
      await page.goto(scenario.path, {waitUntil: "domcontentloaded"});
      const studio = page.locator("[data-public-studio-demo] [data-admin-studio]");
      await expect(studio).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
      const sidebar = studio.locator("aside");
      expect(await sidebar.evaluate(element => getComputedStyle(element).position)).toBe("static");
      for (const control of await studio.getByRole("navigation").getByRole("button").all()) {
        const box = await control.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      }
      const before = await studio.getAttribute("data-theme");
      await studio.getByRole("button", {name: /Passer au thème|Switch to .* theme/}).click();
      await expect(studio).toHaveAttribute("data-theme", before === "dark" ? "light" : "dark");
      await expect(page.locator("html")).toHaveAttribute("data-vistaire-theme", before === "dark" ? "light" : "dark");
    }
  });
}
