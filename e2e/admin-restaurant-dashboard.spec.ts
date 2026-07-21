import { expect, type BrowserContext, type Page, test } from "@playwright/test";

const OWNER_E2E_TOKEN =
  process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
  "vistaire-owner-e2e-local-token";
const ADMIN_E2E_QR_TOKEN = process.env.VISTAIRE_ADMIN_E2E_QR_TOKEN;
const ADMIN_E2E_RESTAURANT_NAME = process.env.VISTAIRE_ADMIN_E2E_RESTAURANT_NAME;
const ADMIN_E2E_OTHER_QR_TOKEN = process.env.VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN;
const ADMIN_E2E_OTHER_RESTAURANT_NAME = process.env.VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME;
const ADMIN_E2E_SUSPENDED_QR_TOKEN = process.env.VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN;
const REQUIRE_ADMIN_E2E = process.env.VISTAIRE_REQUIRE_ADMIN_E2E === "1";

function requireAdminFixture(value: string | undefined, name: string): string {
  if (value) return value;
  if (REQUIRE_ADMIN_E2E) {
    throw new Error(`${name} must be configured for required admin E2E`);
  }
  test.skip(true, `requires ${name}`);
  return "";
}

function requireAdminPreviewUrl(): string {
  const value = process.env.PLAYWRIGHT_BASE_URL;
  if (!value) {
    throw new Error("VISTAIRE_ADMIN_E2E_BASE_URL must be configured for required admin E2E");
  }
  const url = new URL(value);
  expect(url.protocol, "Admin E2E must use an HTTPS preview URL").toBe("https:");
  expect(url.hostname === "vistaire.ca" || url.hostname.endsWith(".vistaire.ca"),
    "Admin E2E must never target the production client").toBe(false);
  return value;
}

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

  function redactSensitivePath(rawUrl: string): string {
    try {
      return new URL(rawUrl).pathname.replace(/^\/q\/[^/]+/, "/q/[redacted]");
    } catch {
      return "[invalid-url]";
    }
  }

  page.on("console", (message) => {
    if (message.type() === "error") errors.push("console:error");
  });
  page.on("pageerror", () => errors.push("page:error"));
  page.on("response", (response) => {
    if (response.status() === 404 || response.status() >= 500) {
      networkIssues.push(`${response.status()} ${redactSensitivePath(response.url())}`);
    }
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown request failure";
    if (errorText !== "net::ERR_ABORTED") {
      networkIssues.push(`request-failed ${redactSensitivePath(request.url())}`);
    }
  });
  page.on("request", (request) => {
    if (/\.(?:glb|usdz)(?:$|[?#])/i.test(request.url())) {
      immersiveRequests.push(`immersive ${redactSensitivePath(request.url())}`);
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

async function expectPublicMenuDishState(
  page: Page,
  menuPath: string,
  dishName: string,
  available: boolean
) {
  await page.goto(menuPath, { waitUntil: "networkidle" });
  if (available) {
    const revealMenu = page.getByRole("button", { name: /Voir le menu|Tout voir/i }).first();
    if (await revealMenu.count()) {
      await revealMenu.click();
    } else {
      const allTab = page.getByRole("tab", { name: /Tout/i }).first();
      if (await allTab.count()) await allTab.click();
    }
    await expect(page.getByText(dishName, { exact: true }).first()).toBeVisible();
  } else {
    await expect(page.getByText(dishName, { exact: true })).toHaveCount(0);
  }
}

test("required admin E2E fixtures are never silently skipped @admin-e2e-live", () => {
  if (!REQUIRE_ADMIN_E2E) return;

  requireAdminPreviewUrl();
  requireAdminFixture(ADMIN_E2E_QR_TOKEN, "VISTAIRE_ADMIN_E2E_QR_TOKEN");
  requireAdminFixture(
    ADMIN_E2E_RESTAURANT_NAME,
    "VISTAIRE_ADMIN_E2E_RESTAURANT_NAME"
  );
  requireAdminFixture(ADMIN_E2E_OTHER_QR_TOKEN, "VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN");
  requireAdminFixture(
    ADMIN_E2E_OTHER_RESTAURANT_NAME,
    "VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME"
  );
  requireAdminFixture(
    ADMIN_E2E_SUSPENDED_QR_TOKEN,
    "VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN"
  );
});

test("direct admin access stays locked at 390 and 430 pixels @admin-e2e-live", async ({ page }) => {
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

test("authorized admin filters dishes and persists then restores availability @admin-e2e-live", async ({
  page
}) => {
  const adminQrToken = requireAdminFixture(
    ADMIN_E2E_QR_TOKEN,
    "VISTAIRE_ADMIN_E2E_QR_TOKEN"
  );
  const health = installPageHealth(page);
  const requestedStates: boolean[] = [];
  const actionRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      actionRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await page.route("**/admin/api/dishes/*/availability", async (route) => {
    const body = route.request().postDataJSON() as { available?: boolean };
    if (typeof body.available === "boolean") requestedStates.push(body.available);
    await route.continue();
  });

  const filters = [
    { name: "Tous", expected: null },
    { name: "Disponibles", expected: /Disponible/i },
    { name: "Indisponibles", expected: /Indisponible/i },
    { name: "Prix manquant", expected: /Prix manquant/i },
    { name: "Description manquante", expected: /Description manquante/i },
    { name: "Photo manquante", expected: /Photo manquante/i },
    { name: "3D/AR", expected: /3D|AR/i }
  ];
  const filterAttributes: Record<string, readonly [string, string]> = {
    Disponibles: ["data-available", "true"],
    Indisponibles: ["data-available", "false"],
    "Prix manquant": ["data-missing-price", "true"],
    "Description manquante": ["data-missing-description", "true"],
    "Photo manquante": ["data-missing-photo", "true"],
    "3D/AR": ["data-immersive", "true"]
  };
  const filterRowKeys: Record<
    string,
    "available" | "missingPrice" | "missingDescription" | "missingPhoto" | "immersive"
  > = {
    "data-available": "available",
    "data-missing-price": "missingPrice",
    "data-missing-description": "missingDescription",
    "data-missing-photo": "missingPhoto",
    "data-immersive": "immersive"
  };

  for (const width of [390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/q/${encodeURIComponent(adminQrToken)}`, {
      waitUntil: "networkidle"
    });
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: ADMIN_E2E_RESTAURANT_NAME, exact: true })
    ).toBeVisible();
    await expect(page.getByText("Dashboard restaurant").first()).toBeVisible();
    for (const forbidden of [
      /Modifier (?:le plat|les détails)/i,
      /Supprimer/i,
      /Téléverser|Uploader/i,
      /Paramètres/i,
      /Espace owner|Ouvrir owner/i
    ]) {
      await expect(page.getByRole("button", { name: forbidden })).toHaveCount(0);
      await expect(page.getByRole("link", { name: forbidden })).toHaveCount(0);
    }
    await expect(page.getByRole("link", { name: /Ouvrir menu client/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Copier.*menu/i })).toBeVisible();
    const visibleForms = page.locator("form:visible");
    await expect(visibleForms).toHaveCount(1);
    await expect(visibleForms.first()).toHaveAttribute("action", "/admin/logout");
    await expect(visibleForms.first()).toHaveAttribute("method", "post");
    const accessibleActions = await page
      .locator('button:visible, a[href]:visible')
      .evaluateAll((items) =>
        items.map((item) =>
          (item.getAttribute("aria-label") || item.textContent || "").trim().replace(/\s+/g, " ")
        )
      );
    const allowedActions = [
      /^Ouvrir menu client$/i,
      /^Copier(?: le)? lien (?:du )?menu$/i,
      /^Déconnexion$/i,
      /^(?:Tous|Disponibles|Indisponibles|Prix manquant|Description manquante|Photo manquante|3D\/AR)$/,
      /^Rendre .+ (?:disponible|indisponible)$/i
    ];
    assertActions: for (const action of accessibleActions) {
      for (const allowed of allowedActions) {
        if (allowed.test(action)) continue assertActions;
      }
      throw new Error(`Action dashboard non autorisée: ${action || "<sans nom>"}`);
    }

    const rows = page.locator("[data-admin-dish-row]");
    const allRows = await rows.evaluateAll((items) =>
      items.map((item) => ({
        id: item.getAttribute("data-admin-dish-row"),
        available: item.getAttribute("data-available"),
        missingPrice: item.getAttribute("data-missing-price"),
        missingDescription: item.getAttribute("data-missing-description"),
        missingPhoto: item.getAttribute("data-missing-photo"),
        immersive: item.getAttribute("data-immersive")
      }))
    );
    for (const filter of filters) {
      await page.getByRole("button", { name: filter.name, exact: true }).click();
      await expect(rows.first(), `${filter.name} must retain a matching dish`).toBeVisible();
      const visible = page.locator("[data-admin-dish-row]:visible");
      const visibleIds = await visible.evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-admin-dish-row"))
      );
      expect(visibleIds.length).toBeGreaterThan(0);
      const attribute = filterAttributes[filter.name];
      if (attribute) {
        const rowKey = filterRowKeys[attribute[0]];
        const expectedIds = allRows
          .filter((row) => row[rowKey] === attribute[1])
          .map((row) => row.id);
        expect([...visibleIds].sort()).toEqual([...expectedIds].sort());
        const values = await visible.evaluateAll(
          (items, name) => items.map((item) => item.getAttribute(name)),
          attribute[0]
        );
        expect(values.every((value) => value === attribute[1])).toBe(true);
      } else {
        expect([...visibleIds].sort()).toEqual(allRows.map((row) => row.id).sort());
      }
    }

    await page.getByRole("button", { name: "Tous", exact: true }).click();
    const row = rows.first();
    const initialAvailability = await row.getAttribute("data-available");
    expect(["true", "false"]).toContain(initialAvailability);
    const initiallyAvailable = initialAvailability === "true";
    const dishId = await row.getAttribute("data-admin-dish-row");
    if (!dishId) throw new Error("Controlled Restaurant A must expose a dish id.");
    const dishName = (await row.locator("h3").innerText()).trim();
    expect(dishName).toBeTruthy();
    const menuPath = await page
      .getByRole("link", { name: /Ouvrir menu client/i })
      .getAttribute("href");
    expect(menuPath).toMatch(/^\/menu\/[^/?#]+$/);
    await expectPublicMenuDishState(page, menuPath as string, dishName, initiallyAvailable);
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin$/);
    const restoredPageRow = page.locator(`[data-admin-dish-row="${dishId}"]`);
    const toggle = row.getByRole("button", {
      name: initiallyAvailable ? /Rendre .* indisponible/i : /Rendre .* disponible/i
    });
    let mutationStarted = false;
    try {
      mutationStarted = true;
      await toggle.click();
      await expect.poll(() => requestedStates.at(-1)).toBe(!initiallyAvailable);
      await expect(row).toHaveAttribute("data-available", initiallyAvailable ? "false" : "true");
      await expectPublicMenuDishState(page, menuPath as string, dishName, !initiallyAvailable);
    } finally {
      if (mutationStarted) {
        const restore = await page.evaluate(
          async ({ dishId, available }) => {
            const response = await fetch(`/admin/api/dishes/${encodeURIComponent(dishId)}/availability`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ available })
            });
            return { status: response.status, body: await response.json() };
          },
          {
            dishId,
            available: initiallyAvailable
          }
        );
        expect(restore.status).toBe(200);
        expect(restore.body.ok).toBe(true);
        expect(restore.body.available).toBe(initiallyAvailable);
        await expect.poll(() => requestedStates.at(-1)).toBe(initiallyAvailable);
        await page.goto("/admin", { waitUntil: "networkidle" });
        await expect(restoredPageRow).toHaveAttribute(
          "data-available",
          initiallyAvailable ? "true" : "false"
        );
        await expectPublicMenuDishState(page, menuPath as string, dishName, initiallyAvailable);
        await page.goto("/admin", { waitUntil: "networkidle" });
      }
    }
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 430, height: 900 });
  await expectNoHorizontalOverflow(page);
  expect(requestedStates).toHaveLength(2);
  expect(requestedStates[0]).toBe(!requestedStates[1]);
  expect(actionRequests).toHaveLength(2);
  expect(
    actionRequests.every((entry) =>
      /^PATCH \/admin\/api\/dishes\/[^/]+\/availability$/.test(entry)
    )
  ).toBe(true);
  health.expectClean();
});

test("a restaurant B session cannot mutate a dish exposed to restaurant A @admin-e2e-live", async ({ browser }) => {
  const adminQrToken = requireAdminFixture(
    ADMIN_E2E_QR_TOKEN,
    "VISTAIRE_ADMIN_E2E_QR_TOKEN"
  );
  const otherAdminQrToken = requireAdminFixture(
    ADMIN_E2E_OTHER_QR_TOKEN,
    "VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN"
  );
  const restaurantAName = requireAdminFixture(
    ADMIN_E2E_RESTAURANT_NAME,
    "VISTAIRE_ADMIN_E2E_RESTAURANT_NAME"
  );
  const restaurantBName = requireAdminFixture(
    ADMIN_E2E_OTHER_RESTAURANT_NAME,
    "VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME"
  );
  const restaurantA = await browser.newContext();
  const restaurantB = await browser.newContext();

  try {
    const pageA = await restaurantA.newPage();
    const healthA = installPageHealth(pageA);
    await pageA.goto(`/q/${encodeURIComponent(adminQrToken)}`, {
      waitUntil: "networkidle"
    });
    await expect(pageA).toHaveURL(/\/admin$/);
    await expect(pageA.getByRole("heading", { name: restaurantAName, exact: true })).toBeVisible();
    const dishId = await pageA.locator("[data-admin-dish-row]").first().getAttribute("data-admin-dish-row");
    expect(dishId).toBeTruthy();

    const pageB = await restaurantB.newPage();
    const healthB = installPageHealth(pageB);
    await pageB.goto(`/q/${encodeURIComponent(otherAdminQrToken)}`, {
      waitUntil: "networkidle"
    });
    await expect(pageB).toHaveURL(/\/admin$/);
    await expect(pageB.getByRole("heading", { name: restaurantBName, exact: true })).toBeVisible();

    const result = await pageB.evaluate(async (id) => {
      const response = await fetch(`/admin/api/dishes/${encodeURIComponent(id ?? "")}/availability`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ available: false })
      });
      return { status: response.status, body: await response.json() };
    }, dishId);
    expect(result.status).toBe(404);
    expect(result.body.ok).toBe(false);
    healthA.expectClean();
    healthB.expectClean();
  } finally {
    await restaurantA.close();
    await restaurantB.close();
  }
});

test("a suspended QR cannot establish an admin session @admin-e2e-live", async ({ page }) => {
  const suspendedQrToken = requireAdminFixture(
    ADMIN_E2E_SUSPENDED_QR_TOKEN,
    "VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN"
  );

  await page.goto(`/q/${encodeURIComponent(suspendedQrToken)}`, {
    waitUntil: "networkidle"
  });
  await expect(page).not.toHaveURL(/\/admin$/);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "vistaire_admin_access")).toBe(false);
});

test("admin logout removes the restaurant session @admin-e2e-live", async ({ page }) => {
  const adminQrToken = requireAdminFixture(
    ADMIN_E2E_QR_TOKEN,
    "VISTAIRE_ADMIN_E2E_QR_TOKEN"
  );

  await page.goto(`/q/${encodeURIComponent(adminQrToken)}`, {
    waitUntil: "networkidle"
  });
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: /Déconnexion|Se déconnecter/i }).click();
  await expect(page.getByRole("heading", { name: "Accès dashboard restaurant requis" })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "vistaire_admin_access")).toBe(false);
});

test("real admin QR exchange sets the session cookie when credentials exist @admin-e2e-live", async ({
  request
}) => {
  const adminQrToken = requireAdminFixture(
    ADMIN_E2E_QR_TOKEN,
    "VISTAIRE_ADMIN_E2E_QR_TOKEN"
  );

  const response = await request.get(`/q/${encodeURIComponent(adminQrToken)}`, {
    maxRedirects: 0
  });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers().location).toBe("/admin");
  const hasAdminSessionCookie =
    response.headers()["set-cookie"]?.includes("vistaire_admin_access=") ?? false;
  expect(hasAdminSessionCookie, "QR exchange must set the admin session cookie").toBe(true);
});
