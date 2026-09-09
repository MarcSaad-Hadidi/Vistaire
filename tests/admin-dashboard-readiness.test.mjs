import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const loadMenuReadiness = () => import("../lib/admin/menuReadiness.ts");

const categories = [
  { id: "starters", label: "Entrées", slug: "entrees" },
  { id: "mains", label: "Plats", slug: "plats" }
];

function dish(overrides) {
  return {
    id: "dish",
    slug: "dish",
    name: "Plat",
    category: "Plats",
    description: "Une description utile.",
    priceLabel: "18,00 $",
    priceCents: 1800,
    imageUrl: "/images/dish.jpg",
    thumbnailUrl: "/images/dish.jpg",
    hasPhoto: true,
    photoStatus: "ready",
    hasImmersive: false,
    has3d: false,
    hasAr: false,
    available: true,
    ...overrides
  };
}

const dishes = [
  dish({ id: "complete", slug: "complete" }),
  dish({
    id: "missing-price",
    slug: "missing-price",
    priceLabel: "",
    priceCents: 0,
    imageUrl: "",
    thumbnailUrl: "",
    hasPhoto: false,
    photoStatus: "missing"
  }),
  dish({
    id: "missing-description",
    slug: "missing-description",
    description: "",
    hasImmersive: true,
    has3d: true
  }),
  dish({
    id: "unavailable",
    slug: "unavailable",
    available: false,
    imageUrl: "",
    thumbnailUrl: "",
    hasPhoto: false,
    photoStatus: "missing"
  })
];

test("builds deterministic restaurant menu readiness counts and priorities", async () => {
  const { buildAdminMenuReadiness } = await loadMenuReadiness();
  const summary = buildAdminMenuReadiness(categories, dishes);

  assert.deepEqual(summary.counts, {
    categories: 2,
    dishes: 4,
    available: 3,
    unavailable: 1,
    missingPrice: 1,
    missingDescription: 1,
    missingPhoto: 2,
    withPhoto: 2,
    withImmersive: 1
  });
  assert.equal(summary.actions[0].kind, "missing-price");
  assert.ok(summary.score >= 0 && summary.score <= 100);
});

test("empty menus have a finite zero score and a concrete setup action", async () => {
  const { buildAdminMenuReadiness } = await loadMenuReadiness();
  const summary = buildAdminMenuReadiness([], []);

  assert.equal(summary.score, 0);
  assert.equal(Number.isFinite(summary.score), true);
  assert.equal(summary.counts.dishes, 0);
  assert.ok(summary.actions.length > 0);
});

test("admin menu selection chooses one deterministic editable menu without mixing drafts", async () => {
  const { selectAdminDashboardMenu } = await loadMenuReadiness();
  const selected = selectAdminDashboardMenu([
    { id: "draft-primary", status: "draft", is_primary: true, updated_at: "2026-07-10T10:00:00.000Z" },
    { id: "published-secondary-old", status: "published", is_primary: false, updated_at: "2026-07-08T10:00:00.000Z" },
    { id: "published-secondary-new", status: "published", is_primary: false, updated_at: "2026-07-09T10:00:00.000Z" },
    { id: "published-primary", status: "published", is_primary: true, updated_at: "2026-07-01T10:00:00.000Z" },
    { id: "archived-primary", status: "archived", is_primary: true, updated_at: "2026-07-11T10:00:00.000Z" }
  ]);

  assert.deepEqual(selected, {
    id: "published-primary",
    status: "published"
  });

  assert.deepEqual(
    selectAdminDashboardMenu([
      { id: "published-b", status: "published", is_primary: false, updated_at: "2026-07-09T10:00:00.000Z" },
      { id: "published-a", status: "published", is_primary: false, updated_at: "2026-07-09T10:00:00.000Z" },
      { id: "draft-primary", status: "draft", is_primary: true }
    ]),
    { id: "published-a", status: "published" }
  );

  assert.deepEqual(
    selectAdminDashboardMenu([
      { id: "archived", status: "archived", is_primary: true },
      { id: "draft-primary", status: "draft", is_primary: true }
    ]),
    { id: "draft-primary", status: "draft" }
  );
  assert.equal(selectAdminDashboardMenu([{ id: "draft", status: "draft" }]), null);
});

test("admin dashboard stays locked without a QR session and remains noindex", async () => {
  const page = await readFile("app/(fr)/admin/page.tsx", "utf8");
  const layout = await readFile("app/(fr)/admin/layout.tsx", "utf8");

  assert.match(page, /requireAdminRestaurantAccess\("dashboard:read"\)/);
  assert.match(page, /Accès dashboard restaurant requis/);
  assert.match(page, /Scannez le QR admin interne de votre restaurant\./);
  assert.doesNotMatch(page, /getDemoRestaurantId|searchParams\?\.|searchParams\[/);
  assert.match(page, /const params = await searchParams/);
  assert.match(page, /parseAdminPageSearchParams\(params[\s\S]*\)/);
  assert.doesNotMatch(page, /href=["']\/owner\//);
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /noarchive:\s*true/);
});

test("admin dashboard exposes only menu reading and dish availability", async () => {
  const page = await readFile("app/(fr)/admin/page.tsx", "utf8");
  const dashboard = await readFile(
    "components/admin/overview/AdminOverview.tsx",
    "utf8"
  );
  const worklist = await readFile("components/admin/AdminDishWorklist.tsx", "utf8");
  const combined = `${page}\n${dashboard}\n${worklist}`;

  assert.match(combined, /dashboard:read/);
  assert.match(combined, /AdminDishAvailabilityControl|data-admin-availability-slot/);
  assert.doesNotMatch(combined, /AdminAssistant|\/api\/owner|OwnerDish/);
  assert.doesNotMatch(combined, /(?:create|delete|remove|upload)(?:Dish|Media|Restaurant)/i);
});

test("unproven instrumentation suppresses presentation numbers", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const observationWindow = { range: "7d", startInclusive: "a", endExclusive: "b", comparisonStartInclusive: "c", comparisonEndExclusive: "a" };
  const state = buildAdminAnalyticsState({ observationWindow });
  assert.equal(state.kind, "insufficient");
  assert.equal(state.reason, "instrumentation-unproven");
});

test("analytics evidence states distinguish complete, partial and insufficient reads", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const observationWindow = { range: "7d", startInclusive: "a", endExclusive: "b", comparisonStartInclusive: "c", comparisonEndExclusive: "a" };
  assert.equal(buildAdminAnalyticsState({ observationWindow, instrumentationProven: true, eventCount: 20 }).kind, "real");
  assert.equal(buildAdminAnalyticsState({ observationWindow, partialSource: true }).completeness, "partial-source");
  assert.equal(buildAdminAnalyticsState({ observationWindow, instrumentationProven: true, eventCount: 0 }).reason, "no-relevant-events");
  assert.equal(buildAdminAnalyticsState({ observationWindow, instrumentationProven: true, eventCount: 2 }).reason, "sample-too-small");
});

test("admin page and loader delegate fallback handling to the analytics state boundary", async () => {
  const page = await readFile("app/(fr)/admin/page.tsx", "utf8");
  const loader = await readFile("lib/admin/dashboardData.ts", "utf8");
  const combined = `${page}\n${loader}`;

  assert.match(loader, /import\s*\{[\s\S]*?buildAdminAnalyticsState[\s\S]*?\}\s*from\s*["']@\/lib\/admin\/analyticsState["']/);
  assert.match(loader, /analytics:\s*buildAdminAnalyticsState\(/);
  assert.doesNotMatch(page, /getDemoRestaurantId|getDemoAdminInsights|source\s*===\s*["']preview/);
  assert.doesNotMatch(page, /@\/lib\/analytics\/insights/);
  assert.doesNotMatch(combined, /insights\.summary|insights\.topDishes/);
});

test("admin page loads only the authorized restaurant and renders the dashboard data contract", async () => {
  const page = await readFile("app/(fr)/admin/page.tsx", "utf8");
  const dashboard = await readFile(
    "components/admin/today/AdminTodayPage.tsx",
    "utf8"
  );

  assert.match(page, /import\s*\{\s*loadAdminDataBundle\s*\}/);
  assert.match(page, /const\s+result\s*=\s*await\s+loadAdminDataBundle\(access, range\)/);
  assert.match(page, /if\s*\(!result\.ok\)/);
  assert.match(page, /buildTodayViewModel\(\{ locale: preferences\.locale, bundle: result\.bundle \}\)/);
  assert.match(page, /<AdminTodayPage/);
  assert.match(page, /restaurantName=\{result\.presentation\.restaurantName\}/);
  assert.match(page, /menuPath=\{result\.presentation\.publicMenuPath\}/);
  assert.doesNotMatch(page, /getDemo|getRestaurantInsights|@\/lib\/analytics\/insights/);
  assert.match(dashboard, /model:\s*TodayViewModel/);
  assert.match(dashboard, /activeRoute="today"/);
  assert.doesNotMatch(dashboard, /adaptDashboardData|ViewData|getDemo|fixture/i);
});
