import test from "node:test";
import assert from "node:assert/strict";

const routes = await import("../lib/admin/foundationRoutes.ts");

test("admin vNext exposes the exact five-route contract", () => {
  assert.deepEqual(routes.ADMIN_ROUTE_PATHS, {
    today: "/admin",
    availability: "/admin/availability",
    intelligence: "/admin/insights",
    reports: "/admin/reports",
    more: "/admin/more"
  });
  assert.deepEqual(
    routes.ADMIN_ROUTES.map(({ id, href, availability }) => ({ id, href, availability })),
    [
      { id: "today", href: "/admin", availability: "integrated" },
      { id: "availability", href: "/admin/availability", availability: "integrated" },
      { id: "intelligence", href: "/admin/insights", availability: "integrated" },
      { id: "reports", href: "/admin/reports", availability: "deferred" },
      { id: "more", href: "/admin/more", availability: "deferred" }
    ]
  );
  assert.equal(Object.isFrozen(routes.ADMIN_ROUTE_PATHS), true);
  assert.equal(Object.isFrozen(routes.ADMIN_ROUTES), true);
});

test("legacy page identifiers map additively to vNext identifiers", () => {
  assert.equal(routes.normalizeLegacyAdminRoute("overview"), "today");
  assert.equal(routes.normalizeLegacyAdminRoute("availability"), "availability");
  assert.equal(routes.normalizeLegacyAdminRoute("insights"), "intelligence");
});
