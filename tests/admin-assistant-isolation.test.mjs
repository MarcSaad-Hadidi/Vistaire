import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin assistant client sends no restaurant identifier", async () => {
  const component = await readFile("components/admin/AdminAssistant.tsx", "utf8");

  assert.match(component, /fetch\(["']\/admin\/api\/assistant["']/);
  assert.match(
    component,
    /JSON\.stringify\(\{\s*mode:\s*["']question["'],\s*question\s*}\)/
  );
  assert.doesNotMatch(component, /restaurantId/);
  assert.doesNotMatch(component, /\/api\/admin\/assistant/);
});

test("admin assistant endpoint authenticates the session before deriving restaurant scope", async () => {
  const route = await readFile("app/(fr)/admin/api/assistant/route.ts", "utf8");

  assert.match(route, /requireAdminRestaurantAccess\(["']dashboard:read["']\)/);
  assert.match(route, /restaurantId:\s*access\.restaurantId/);
  assert.doesNotMatch(route, /body\.restaurantId|validation\.restaurantId/);
  assert.match(route, /readBoundedJsonBody\(request,\s*MAX_BODY_BYTES\)/);
  assert.doesNotMatch(route, /request\.text\(\)/);
  assert.match(route, /Cache-Control["']?\s*:\s*["']no-store["']/i);
  assert.ok(
    route.indexOf('requireAdminRestaurantAccess("dashboard:read")') <
      route.indexOf("readBoundedJsonBody(request, MAX_BODY_BYTES)")
  );
});

test("legacy assistant endpoint is inert", async () => {
  const route = await readFile("app/api/admin/assistant/route.ts", "utf8");

  assert.match(route, /status:\s*410/);
  assert.match(route, /Cache-Control["']?\s*:\s*["']no-store["']/i);
  assert.doesNotMatch(route, /getAdminAssistantAnswer|generateMistral|restaurantId/);
});
