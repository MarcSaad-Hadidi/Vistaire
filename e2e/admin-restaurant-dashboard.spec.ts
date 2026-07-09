import { expect, type BrowserContext, type Page, test } from "@playwright/test";

const OWNER_E2E_TOKEN =
  process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
  "vistaire-owner-e2e-local-token";
const ADMIN_E2E_QR_TOKEN = process.env.VISTAIRE_ADMIN_E2E_QR_TOKEN;

async function enableOwnerBypass(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    {
      name: "__vistaire_owner_e2e",
      value: OWNER_E2E_TOKEN,
      url: baseURL
    }
  ]);
}

function installPageHealth(page: Page) {
  const errors: string[] = [];
  const networkIssues: string[] = [];
  const immersiveRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() === 404 || response.status() >= 500) {
      networkIssues.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("request", (request) => {
    if (/\.(?:glb|usdz)(?:$|[?#])/i.test(request.url())) {
      immersiveRequests.push(request.url());
    }
  });

  return {
    expectClean() {
      expect(errors, errors.join("\n")).toEqual([]);
      expect(networkIssues, networkIssues.join("\n")).toEqual([]);
      expect(immersiveRequests, immersiveRequests.join("\n")).toEqual([]);
    }
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    )
    .toBe(true);
}

test("direct admin access stays locked at 390 and 430 pixels", async ({ page }) => {
  const health = installPageHealth(page);

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/admin?restaurantId=untrusted", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Accès dashboard restaurant requis" })
    ).toBeVisible();
    await expect(
      page.getByText("Scannez le QR admin interne de votre restaurant.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Rendre .*disponible/i })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }

  health.expectClean();
});

test("owner QR page distinguishes public menu and internal restaurant access", async ({
  context,
  page
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  await enableOwnerBypass(context, baseURL);
  const health = installPageHealth(page);

  await page.route("**/api/owner/qr-codes", async (route) => {
    const body = route.request().postDataJSON() as { targetKind?: string };
    const targetKind = body.targetKind === "admin" ? "admin" : "menu";
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        token: `e2e-${targetKind}`,
        redirectUrl: `/q/e2e-${targetKind}`,
        targetPath: targetKind === "admin" ? "/admin" : "/menu/maison-elyse",
        targetKind,
        persisted: true
      })
    });
  });

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/owner/qr-codes", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /QR menu public/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /QR dashboard restaurant/i })
    ).toBeVisible();
    await page.getByRole("button", { name: /QR dashboard restaurant/i }).click();
    await expect(page.getByText("Interne restaurant").first()).toBeVisible();
    await expect(page.getByText("Ne pas imprimer pour les clients").first()).toBeVisible();
    await expect(page.getByText("/admin", { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  health.expectClean();
});

test("authorized admin filters dishes and toggles a final availability state", async ({
  page
}) => {
  test.skip(!ADMIN_E2E_QR_TOKEN, "requires an active admin QR fixture");
  const health = installPageHealth(page);
  let requestedState: boolean | undefined;

  await page.route("**/admin/api/dishes/*/availability", async (route) => {
    const body = route.request().postDataJSON() as { available?: boolean };
    requestedState = body.available;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        dishId: "dish-1",
        available: body.available,
        updatedAt: new Date(0).toISOString()
      })
    });
  });

  await page.goto(`/q/${encodeURIComponent(ADMIN_E2E_QR_TOKEN ?? "")}`, {
    waitUntil: "networkidle"
  });
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Dashboard restaurant").first()).toBeVisible();

  for (const filter of [
    "Tous",
    "Disponibles",
    "Indisponibles",
    "Prix manquant",
    "Description manquante",
    "Photo manquante",
    "3D/AR"
  ]) {
    await expect(page.getByRole("button", { name: filter, exact: true })).toBeVisible();
  }

  const toggle = page.getByRole("button", { name: /Rendre .* indisponible/i }).first();
  await toggle.click();
  await expect.poll(() => requestedState).toBe(false);
  await expectNoHorizontalOverflow(page);
  health.expectClean();
});

test("real admin QR exchange sets the session cookie when credentials exist", async ({
  request
}) => {
  test.skip(!ADMIN_E2E_QR_TOKEN, "requires an active admin QR fixture");

  const response = await request.get(`/q/${encodeURIComponent(ADMIN_E2E_QR_TOKEN ?? "")}`, {
    maxRedirects: 0
  });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers().location).toBe("/admin");
  expect(response.headers()["set-cookie"]).toContain("vistaire_admin_access=");
});
