import { expect, test, type Locator, type Page, type Request } from "@playwright/test";
// @ts-expect-error -- dependency-free ESM policy is also exercised directly by Node contracts.
import { classifyRestaurateurPreviewRequest } from "./support/restaurateur-preview-request-policy.mjs";

type Scenario = {
  path: "/apercu-restaurateur" | "/en/restaurant-preview";
  demoLabel: RegExp;
  forbiddenCopy: RegExp;
  metricSelectorLabel: string;
  metricButtons: readonly [string, string, string];
  activityChartTitle: string;
  noDishes: string;
  tabs: readonly [string, string, string];
  searchLabel: string;
  filters: readonly [string, string, string];
  simulation: RegExp;
  sampleMenu: { label: string; href: string };
  insights: readonly string[];
};

const scenarios: readonly Scenario[] = [
  {
    path: "/apercu-restaurateur",
    demoLabel: /Données de démonstration/i,
    forbiddenCopy: /Demo data|No customer data|Search dishes|View sample menu|this change is not saved/i,
    metricSelectorLabel: "Métrique affichée",
    metricButtons: ["Ouvertures du menu", "Consultations de plats", "Recherches"],
    activityChartTitle: "Activité du menu sur la période",
    noDishes: "Aucun plat ne correspond à cette recherche.",
    tabs: ["Vue d’ensemble", "Disponibilités", "Analyses"],
    searchLabel: "Rechercher un plat",
    filters: ["Tous", "Disponibles", "Indisponibles"],
    simulation: /Simulation — ce changement n’est pas enregistré\./i,
    sampleMenu: { label: "Voir la carte exemple", href: "/demo" },
    insights: [
      "Activité",
      "Comparaison",
      "Moments d’activité",
      "Top plats consultés",
      "Top recherches",
      "Activité par catégorie",
      "Moments de service",
      "Résumé de la période",
      "Insights clés"
    ]
  },
  {
    path: "/en/restaurant-preview",
    demoLabel: /Demo data/i,
    forbiddenCopy: /Données de démonstration|Aucune donnée client|Rechercher un plat|Voir la carte exemple|ce changement n’est pas enregistré/i,
    metricSelectorLabel: "Metric shown",
    metricButtons: ["Menu opens", "Dish views", "Searches"],
    activityChartTitle: "Menu activity over the period",
    noDishes: "No dishes match this search.",
    tabs: ["Overview", "Availability", "Insights"],
    searchLabel: "Search dishes",
    filters: ["All", "Available", "Unavailable"],
    simulation: /Simulation — this change is not saved\./i,
    sampleMenu: { label: "View sample menu", href: "/en/vistaire-menu" },
    insights: [
      "Activity",
      "Comparison",
      "Activity times",
      "Top viewed dishes",
      "Top searches",
      "Activity by category",
      "Service times",
      "Period summary",
      "Key insights"
    ]
  }
];

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 }
] as const;
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
    if (request.failure()?.errorText === "net::ERR_ABORTED" && explicitPrefetch) return;
    networkErrors.push(`${request.failure()?.errorText ?? "request failed"} ${new URL(request.url()).pathname}`);
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

async function activateTab(tab: Locator) {
  await tab.focus();
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.press("Enter");
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

async function expectTabContract(page: Page, scenario: Scenario) {
  const tablist = page.getByRole("tablist");
  const tabs = tablist.getByRole("tab");
  await expect(tablist).toBeVisible();
  await expect(tabs).toHaveCount(3);
  await expect(tablist.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  for (const label of scenario.tabs) await expect(tablist.getByRole("tab", { name: label, exact: true })).toBeVisible();

  const first = tablist.getByRole("tab", { name: scenario.tabs[0], exact: true });
  const second = tablist.getByRole("tab", { name: scenario.tabs[1], exact: true });
  const last = tablist.getByRole("tab", { name: scenario.tabs[2], exact: true });
  await first.focus();
  await first.press("End");
  await expect(last).toBeFocused();
  await activateTab(last);
  await last.press("Home");
  await expect(first).toBeFocused();
  await activateTab(first);
  await first.press("ArrowRight");
  await expect(second).toBeFocused();
  await activateTab(second);
  await second.press("ArrowLeft");
  await expect(first).toBeFocused();
  await activateTab(first);

  const active = tablist.locator('[role="tab"][aria-selected="true"]');
  const controls = await active.getAttribute("aria-controls");
  expect(controls).toBeTruthy();
  await expect(page.locator(`#${controls}`)).toHaveAttribute("role", "tabpanel");
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

async function periodSignature(page: Page) {
  return page.locator("[data-demo-kpi]").allTextContents();
}

async function exercisePeriods(page: Page) {
  const periods = page.locator("button[data-demo-period]");
  await expect(periods).toHaveCount(3);
  await expect(page.locator('button[data-demo-period][aria-pressed="true"]')).toHaveCount(1);
  const initial = await periodSignature(page);
  await periods.filter({ hasText: "7" }).click();
  await expect.poll(() => periodSignature(page)).not.toEqual(initial);
  const sevenDays = await periodSignature(page);
  await periods.filter({ hasText: "30" }).click();
  await expect.poll(() => periodSignature(page)).not.toEqual(sevenDays);
  await periods.filter({ hasText: "24" }).click();
  await expect.poll(() => periodSignature(page)).toEqual(initial);
}

async function exerciseAvailability(page: Page, scenario: Scenario) {
  await page.getByRole("tab", { name: scenario.tabs[1], exact: true }).click();
  const summary = (id: string) => page.locator(`[data-demo-availability-metric="${id}"]`);
  await expect(summary("total")).toContainText("12");
  await expect(summary("available")).toContainText("10");
  await expect(summary("unavailable")).toContainText("2");
  const rows = page.locator("[data-demo-dish]");
  await expect(rows).toHaveCount(12);

  const firstName = await rows.first().getByRole("heading").innerText();
  const search = page.getByRole("searchbox", { name: scenario.searchLabel });
  await search.fill(firstName);
  await expect.poll(() => rows.filter({ visible: true }).count()).toBeLessThan(12);
  const matchingRows = rows.filter({ visible: true });
  expect(await matchingRows.count()).toBeGreaterThan(0);
  for (const row of await matchingRows.all()) await expect(row).toContainText(firstName);
  await search.fill("vistaire-no-matching-dish-zzzz");
  await expect(rows.filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: scenario.noDishes })).toBeVisible();
  await search.fill("");
  await expect(page.getByText(scenario.noDishes, { exact: true })).toBeHidden();

  const all = page.getByRole("button", { name: scenario.filters[0], exact: true });
  const available = page.getByRole("button", { name: scenario.filters[1], exact: true });
  const unavailable = page.getByRole("button", { name: scenario.filters[2], exact: true });
  for (const filter of [all, available, unavailable]) await expect(filter).toHaveAttribute("aria-pressed", /true|false/);
  await unavailable.click();
  await expect(unavailable).toHaveAttribute("aria-pressed", "true");
  expect(await rows.evaluateAll((items) => items.filter((item) => getComputedStyle(item).display !== "none").every((item) => item.getAttribute("data-available") === "false"))).toBe(true);
  await available.click();
  expect(await rows.evaluateAll((items) => items.filter((item) => getComputedStyle(item).display !== "none").every((item) => item.getAttribute("data-available") === "true"))).toBe(true);
  await all.click();

  const toggle = rows.first().getByRole("switch");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("status")).toContainText(scenario.simulation);
  await expect(summary("available")).toContainText("9");
  await expect(summary("unavailable")).toContainText("3");
}

async function exerciseInsightsMetricSelector(page: Page, scenario: Scenario) {
  const selector = page.getByRole("group", { name: scenario.metricSelectorLabel });
  const buttons = selector.getByRole("button");
  await expect(buttons).toHaveCount(3);
  for (const label of scenario.metricButtons) {
    await expect(selector.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", /true|false/);
  }
  const activityChart = page.locator("[data-chart-frame]").filter({
    has: page.getByRole("heading", { name: scenario.activityChartTitle, exact: true })
  });
  await expect(activityChart).toHaveCount(1);
  const signature = () => activityChart.locator("tbody").innerText();
  const menu = selector.getByRole("button", { name: scenario.metricButtons[0], exact: true });
  const dishes = selector.getByRole("button", { name: scenario.metricButtons[1], exact: true });
  const searches = selector.getByRole("button", { name: scenario.metricButtons[2], exact: true });
  await expect(menu).toHaveAttribute("aria-pressed", "true");
  const menuSignature = await signature();
  await dishes.click();
  await expect(dishes).toHaveAttribute("aria-pressed", "true");
  await expect.poll(signature).not.toEqual(menuSignature);
  const dishSignature = await signature();
  await searches.click();
  await expect(searches).toHaveAttribute("aria-pressed", "true");
  await expect.poll(signature).not.toEqual(dishSignature);
  await dishes.click();
  await expect.poll(signature).toEqual(dishSignature);
  await menu.click();
  await expect.poll(signature).toEqual(menuSignature);
}

async function exerciseCharts(page: Page) {
  const heatmap = page.locator('[role="grid"][data-chart-kind="heatmap"]');
  await expect(heatmap).toHaveCount(1);
  await expect(heatmap).toHaveAttribute("aria-rowcount", "7");
  await expect(heatmap).toHaveAttribute("aria-colcount", "24");
  await expect(heatmap.getByRole("gridcell")).toHaveCount(168);
  const charts = page.locator("[data-chart-frame]");
  expect(await charts.count()).toBeGreaterThanOrEqual(3);
  for (const chart of await charts.all()) {
    await expect(chart.locator("table")).toHaveCount(1);
    const marks = chart.locator("[tabindex]");
    if ((await marks.count()) === 0) continue;
    await marks.first().focus();
    await expect(chart.locator("output[data-visible=true]")).toBeVisible();
    if ((await marks.count()) > 1) {
      await marks.first().press("ArrowRight");
      await expect(marks.nth(1)).toBeFocused();
    }
    await page.keyboard.press("Escape");
    await expect(chart.locator("output[data-visible=true]")).toHaveCount(0);
  }
}

test.describe("public restaurateur dashboard preview", () => {
  for (const scenario of scenarios) {
    test(`${scenario.path} is an anonymous local-only product demonstration`, async ({ baseURL, page }) => {
      const origin = baseURL ?? "http://127.0.0.1:3000";
      const runtime = observeRuntime(page, origin);
      const response = await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByText(scenario.demoLabel).first()).toBeVisible();
      await expect(page.getByText(/Aucune donnée client|No customer data/i)).toBeVisible();
      await expect(page.getByText(scenario.forbiddenCopy)).toHaveCount(0);
      await expectTabContract(page, scenario);

      const kpis = page.locator("[data-demo-kpi]");
      await expect(kpis).toHaveCount(5);
      for (const id of ["menu-opens", "dish-opens", "searches", "immersive", "available"]) {
        await expect(page.locator(`[data-demo-kpi="${id}"]`)).toBeVisible();
      }
      const availableKpi = page.locator('[data-demo-kpi="available"]');
      await expect(availableKpi).toContainText("10 / 12");
      await exercisePeriods(page);
      await exerciseAvailability(page, scenario);

      await page.getByRole("tab", { name: scenario.tabs[0], exact: true }).click();
      await expect(availableKpi).toContainText("9 / 12");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(availableKpi).toContainText("10 / 12");
      await expect(availableKpi).not.toContainText("9 / 12");

      await page.getByRole("tab", { name: scenario.tabs[2], exact: true }).click();
      for (const heading of scenario.insights) {
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      }
      await exerciseInsightsMetricSelector(page, scenario);
      await exercisePeriods(page);
      await exerciseCharts(page);
      await expectSafeDom(page, scenario);
      await expectSafeSeo(page, scenario);
      await expect(page.locator("model-viewer")).toHaveCount(0);
      expect(await page.evaluate(() => customElements.get("model-viewer") === undefined)).toBe(true);
      runtime.expectClean();
    });

    test(`${scenario.path} fits every required viewport with mobile touch targets`, async ({ page }) => {
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
        if (viewport.width > 430) continue;
        for (const control of await page.locator('[role="tab"], button[data-demo-period]').all()) {
          const box = await control.boundingBox();
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
        const availabilityTab = page.getByRole("tab", { name: scenario.tabs[1], exact: true });
        await expect(availabilityTab).toBeVisible();
        await availabilityTab.click();
        for (const control of await page.locator('button[data-demo-filter], [role="switch"]').all()) {
          const box = await control.boundingBox();
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }

  test("reduced motion removes chart transitions during a real period change", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/apercu-restaurateur", { waitUntil: "domcontentloaded" });
    const reducedCharts = page.locator('[data-chart-frame] svg[data-reduced-motion="true"]');
    await expect.poll(() => reducedCharts.count()).toBeGreaterThan(0);
    await page.locator('button[data-demo-period="7d"]').click();
    await expect.poll(() => reducedCharts.evaluateAll((elements) => elements.flatMap((element) => element.getAnimations({ subtree: true })).length)).toBe(0);
  });
});
