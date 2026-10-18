import { randomUUID } from "node:crypto";
import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { ADMIN_ACCESS_COOKIE_NAME, createAdminAccessToken } from "../lib/admin/accessSessionCore";
import { ADMIN_VISUAL_FULL_MENU_DISH_IDS, ADMIN_VISUAL_QR_ID, ADMIN_VISUAL_RESTAURANT_ID } from "./support/adminVisualFixtureData";

// Deliberately public, fixture-only value. Never configure it outside loopback E2E.
const fixtureSecret = "admin-visual-fixture-session-secret-2026-only";
test.skip(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE !== "1", "Requires the hermetic admin visual fixture");

// A separate fixture request survives page failures/timeouts. Reset the complete
// in-memory baseline, including dish availability, menu settings and replay IDs.
async function resetSchedulingFixture({ request }: { request: APIRequestContext }) {
  const port = process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT ?? "3110";
  const response = await request.post(`http://127.0.0.1:${port}/fixture/reset-admin-scheduling`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
}
test.beforeEach(resetSchedulingFixture);
test.afterEach(resetSchedulingFixture);

function fixtureOrigin(baseURL: string): URL {
  const origin = new URL(baseURL);
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(origin.hostname);
  // NextRequest normalizes all loopback addresses to localhost, but preserves
  // the Origin header. Match that canonical origin rather than weakening CSRF.
  origin.hostname = "localhost";
  return origin;
}

// Use the same browser request path as StudioPlanning. APIRequestContext is a
// separate HTTP client and does not supply browser Fetch Metadata headers.
async function patchSchedule(page: Page, input: unknown) {
  return page.evaluate(async (payload) => {
    const response = await fetch("/admin/api/scheduling", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  }, input);
}

test("studio scheduling signed admin saves, reloads, edits and resets schedules; stale writes conflict", { tag: "@critical" }, async ({ page, context, baseURL }) => {
  test.setTimeout(120_000);
  const origin = fixtureOrigin(baseURL!);
  await context.addCookies([{ name: ADMIN_ACCESS_COOKIE_NAME, value: createAdminAccessToken({ qrId: ADMIN_VISUAL_QR_ID, restaurantId: ADMIN_VISUAL_RESTAURANT_ID }, fixtureSecret), domain: origin.hostname, path: "/admin", httpOnly: true, sameSite: "Lax" }]);
  const endpoint = `${origin.origin}/admin/api/scheduling`;
  const initial = await context.request.get(endpoint);
  expect(initial.status()).toBe(200);
  const initialData = await initial.json();
  expect(initialData.timezone).toBe("America/Toronto");
  const dishId = ADMIN_VISUAL_FULL_MENU_DISH_IDS[0];
  const current = initialData.schedules.find((row: { dish_id: string }) => row.dish_id === dishId);
  expect(current).toBeTruthy();
  const input = { dishId, timezone: "America/Toronto", expectedTimezone: initialData.timezone, baseAvailable: false, manualOverride: null, expectedRevision: current.revision, requestId: randomUUID(), rules: [{ type: "weekly", days: [1, 2, 3, 4, 5, 6, 7], start: "22:00", end: "02:00", available: true }] };
  await page.goto(endpoint.replace("/api/scheduling", "/planning"));
  const saved = await patchSchedule(page, input);
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  expect(saved.body.ok).toBe(true);
  const replay = await patchSchedule(page, input);
  expect(replay.status, JSON.stringify(replay.body)).toBe(200);
  const stale = await patchSchedule(page, { ...input, requestId: randomUUID() });
  expect(stale.status, JSON.stringify(stale.body)).toBe(409);
  const crossOrigin = await context.request.patch(endpoint, { headers: { Origin: "https://untrusted.example", "Sec-Fetch-Site": "cross-site" }, data: { ...input, requestId: randomUUID() } });
  expect(crossOrigin.status()).toBe(403);
  await page.goto(endpoint.replace("/api/scheduling", "/planning"));
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".studio-planning .calendar")).toBeVisible();
  await expect(page.locator(".studio-planning .event").first()).toContainText("22:00 — 02:00 (+1 jour)");
  await page.reload();
  await expect(page.locator(".studio-planning .event").first()).toContainText("22:00 — 02:00 (+1 jour)");
  await page.getByRole("button", { name: "Gérer les horaires", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Choix manuel", { exact: true }).selectOption("false");
  await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".studio-planning .event").first()).toContainText("choix manuel actif");
  await page.getByRole("button", { name: "Gérer les horaires", exact: true }).click();
  await dialog.getByRole("button", { name: "Revenir à la planification", exact: true }).click();
  await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const reloaded = await (await context.request.get(endpoint)).json();
  expect(reloaded.schedules.find((row: { dish_id: string }) => row.dish_id === dishId)).toMatchObject({ rules: input.rules, base_available: false, manual_override: null, revision: current.revision + 3 });
  expect(reloaded.history.some((row: { dish_id: string; kind: string }) => row.dish_id === dishId && row.kind === "schedule")).toBe(true);
  for (const width of [390, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("studio scheduling anonymous, invalid QR and read-only preview cannot mutate schedules", { tag: "@critical" }, async ({ page, context, baseURL }) => {
  const origin = fixtureOrigin(baseURL!).origin;
  const endpoint = `${origin}/admin/api/scheduling`;
  expect((await context.request.get(endpoint)).status()).toBe(401);
  const input = { dishId: ADMIN_VISUAL_FULL_MENU_DISH_IDS[0], timezone: "America/Toronto", expectedTimezone: "America/Toronto", baseAvailable: true, manualOverride: null, rules: [], expectedRevision: 0, requestId: randomUUID() };
  await page.goto(endpoint.replace("/api/scheduling", "/planning"));
  const denied = await patchSchedule(page, input);
  expect(denied.status, JSON.stringify(denied.body)).toBe(401);
  await context.addCookies([{ name: ADMIN_ACCESS_COOKIE_NAME, value: createAdminAccessToken({ qrId: "revoked-fixture-qr", restaurantId: ADMIN_VISUAL_RESTAURANT_ID }, fixtureSecret), url: `${origin}/admin`, httpOnly: true, sameSite: "Lax" }]);
  expect((await context.request.get(endpoint)).status()).toBe(401);
  await context.clearCookies();
  const preview = await context.request.post(`${origin}/admin/preview`, { headers: { Origin: origin }, maxRedirects: 0 });
  expect(preview.status()).toBe(303);
  // Preview is deliberately not a signed writable admin session.
  await page.goto(endpoint.replace("/api/scheduling", "/planning"));
  const previewDenied = await patchSchedule(page, input);
  expect(previewDenied.status, JSON.stringify(previewDenied.body)).toBe(401);
  await page.goto(endpoint.replace("/api/scheduling", "/planning"));
  await expect(page.getByRole("button", { name: "Gérer les horaires", exact: true })).toBeDisabled();
});
