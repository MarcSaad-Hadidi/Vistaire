import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ADMIN_ACCESS_COOKIE_NAME, createAdminAccessToken } from "../lib/admin/accessSessionCore";
import { ADMIN_VISUAL_FULL_MENU_DISH_IDS, ADMIN_VISUAL_QR_ID, ADMIN_VISUAL_RESTAURANT_ID } from "./support/adminVisualFixtureData";

// Deliberately public, fixture-only value. Never configure it outside loopback E2E.
const fixtureSecret = "admin-visual-fixture-session-secret-2026-only";
test.skip(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE !== "1", "Requires the hermetic admin visual fixture");

test("studio scheduling signed admin saves, reloads, edits and resets schedules; stale writes conflict", { tag: "@critical" }, async ({ page, context, baseURL }) => {
  test.setTimeout(120_000);
  const origin = new URL(baseURL!);
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(origin.hostname);
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
  const saved = await context.request.patch(endpoint, { headers: { Origin: origin.origin }, data: input });
  expect(saved.status()).toBe(200);
  expect((await saved.json()).ok).toBe(true);
  const replay = await context.request.patch(endpoint, { headers: { Origin: origin.origin }, data: input });
  expect(replay.status()).toBe(200);
  const stale = await context.request.patch(endpoint, { headers: { Origin: origin.origin }, data: { ...input, requestId: randomUUID() } });
  expect(stale.status()).toBe(409);
  await page.goto("/admin/planning");
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
  const origin = new URL(baseURL!).origin;
  const endpoint = `${origin}/admin/api/scheduling`;
  expect((await context.request.get(endpoint)).status()).toBe(401);
  const input = { dishId: ADMIN_VISUAL_FULL_MENU_DISH_IDS[0], timezone: "America/Toronto", expectedTimezone: "America/Toronto", baseAvailable: true, manualOverride: null, rules: [], expectedRevision: 0, requestId: randomUUID() };
  expect((await context.request.patch(endpoint, { headers: { Origin: origin }, data: input })).status()).toBe(401);
  await context.addCookies([{ name: ADMIN_ACCESS_COOKIE_NAME, value: createAdminAccessToken({ qrId: "revoked-fixture-qr", restaurantId: ADMIN_VISUAL_RESTAURANT_ID }, fixtureSecret), url: `${origin}/admin`, httpOnly: true, sameSite: "Lax" }]);
  expect((await context.request.get(endpoint)).status()).toBe(401);
  await context.clearCookies();
  const preview = await context.request.post(`${origin}/admin/preview`, { headers: { Origin: origin }, maxRedirects: 0 });
  expect(preview.status()).toBe(303);
  // Preview is deliberately not a signed writable admin session.
  expect((await context.request.patch(endpoint, { headers: { Origin: origin }, data: input })).status()).toBe(401);
  await page.goto("/admin/planning");
  await expect(page.getByRole("button", { name: "Gérer les horaires", exact: true })).toBeDisabled();
});
