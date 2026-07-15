import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const fixtureOrigin = "http://127.0.0.1:55432";
const activeToken = "admin_fixture_token-1234567890ab";
const inactiveToken = "archived_fixture_token-12345678";
const storageHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

async function scanCount(token: string) {
  const state = (await fetch(`${fixtureOrigin}/fixture/state`).then((response) => response.json())) as Record<string, number>;
  return state[storageHash(token)] ?? 0;
}

test("active legacy admin QR creates a fresh scoped session and redirects to admin", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  await page.route("**/admin", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body><main>Admin QR resolved</main></body></html>"
    })
  );

  expect(await context.cookies()).toEqual([]);
  const before = await scanCount(activeToken);
  await page.goto(`/q/${encodeURIComponent(activeToken)}`, { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/admin$/);
  const session = (await context.cookies()).find(
    (cookie) => cookie.name === "vistaire_admin_access"
  );
  expect(session).toBeDefined();
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  expect(session?.path).toBe("/admin");
  expect(await scanCount(activeToken)).toBe(before + 1);
  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
  }
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  await context.close();
});

test("unknown, truncated, and archived QR values do not increment scan count", async ({ request }) => {
  const beforeActive = await scanCount(activeToken);
  const beforeInactive = await scanCount(inactiveToken);

  for (const token of ["unknown-token", activeToken.slice(0, -1), inactiveToken]) {
    const response = await request.get(`/q/${encodeURIComponent(token)}`, {
      maxRedirects: 0
    });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(new URL(response.headers().location).pathname).toBe("/q/invalid");
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }

  expect(await scanCount(activeToken)).toBe(beforeActive);
  expect(await scanCount(inactiveToken)).toBe(beforeInactive);
});
