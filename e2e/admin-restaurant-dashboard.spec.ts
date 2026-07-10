import { expect, type BrowserContext, type Page, test } from "@playwright/test";

const OWNER_E2E_TOKEN =
  process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
  "vistaire-owner-e2e-local-token";
const ADMIN_E2E_QR_TOKEN = process.env.VISTAIRE_ADMIN_E2E_QR_TOKEN;
const ADMIN_E2E_FALLBACK_QR_TOKEN = process.env.VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN;
const ADMIN_E2E_RESTAURANT_NAME = process.env.VISTAIRE_ADMIN_E2E_RESTAURANT_NAME;
const ADMIN_E2E_OTHER_QR_TOKEN = process.env.VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN;
const ADMIN_E2E_OTHER_RESTAURANT_NAME = process.env.VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME;
const ADMIN_E2E_SUSPENDED_QR_TOKEN = process.env.VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN;
const REQUIRE_ADMIN_E2E = process.env.VISTAIRE_REQUIRE_ADMIN_E2E === "1";

function requireAdminFixture(value: string | undefined, name: string) {
  expect(value, `${name} must be configured for required admin E2E`).toBeTruthy();
}

function requireAdminPreviewUrl() {
  const value = process.env.PLAYWRIGHT_BASE_URL;
  expect(value, "VISTAIRE_ADMIN_E2E_BASE_URL must be configured for required admin E2E").toBeTruthy();
  expect(new URL(value as string).protocol, "Admin E2E must use an HTTPS preview URL").toBe(
    "https:"
  );
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

test("required admin E2E fixtures are never silently skipped", () => {
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
  requireAdminFixture(
    ADMIN_E2E_FALLBACK_QR_TOKEN,
    "VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN"
  );
});

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

test("authorized admin filters dishes and persists then restores availability", async ({
  page
}) => {
  test.skip(!ADMIN_E2E_QR_TOKEN, "requires an active admin QR fixture");
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
    await page.goto(`/q/${encodeURIComponent(ADMIN_E2E_QR_TOKEN ?? "")}`, {
      waitUntil: "networkidle"
    });
    await expect(page).toHaveURL(/\/admin$/);
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
    const toggle = row.getByRole("button", {
      name: initiallyAvailable ? /Rendre .* indisponible/i : /Rendre .* disponible/i
    });
    let changed = false;
    try {
      await toggle.click();
      changed = true;
      await expect.poll(() => requestedStates.at(-1)).toBe(!initiallyAvailable);
      await expect(row).toHaveAttribute("data-available", initiallyAvailable ? "false" : "true");
    } finally {
      if (changed) {
        await row
          .getByRole("button", {
            name: initiallyAvailable ? /Rendre .* disponible/i : /Rendre .* indisponible/i
          })
          .click();
        await expect.poll(() => requestedStates.at(-1)).toBe(initiallyAvailable);
        await expect(row).toHaveAttribute(
          "data-available",
          initiallyAvailable ? "true" : "false"
        );
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

test("a restaurant B session cannot mutate a dish exposed to restaurant A", async ({ browser }) => {
  test.skip(
    !ADMIN_E2E_QR_TOKEN || !ADMIN_E2E_OTHER_QR_TOKEN,
    "requires active QR fixtures for two different restaurants"
  );
  const restaurantA = await browser.newContext();
  const restaurantB = await browser.newContext();

  try {
    const pageA = await restaurantA.newPage();
    await pageA.goto(`/q/${encodeURIComponent(ADMIN_E2E_QR_TOKEN ?? "")}`, {
      waitUntil: "networkidle"
    });
    await expect(pageA).toHaveURL(/\/admin$/);
    const dishId = await pageA.locator("[data-admin-dish-row]").first().getAttribute("data-admin-dish-row");
    expect(dishId).toBeTruthy();

    const pageB = await restaurantB.newPage();
    await pageB.goto(`/q/${encodeURIComponent(ADMIN_E2E_OTHER_QR_TOKEN ?? "")}`, {
      waitUntil: "networkidle"
    });
    await expect(pageB).toHaveURL(/\/admin$/);
    if (ADMIN_E2E_OTHER_RESTAURANT_NAME) {
      await expect(pageB.getByText(ADMIN_E2E_OTHER_RESTAURANT_NAME, { exact: true }).first()).toBeVisible();
    }

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
  } finally {
    await restaurantA.close();
    await restaurantB.close();
  }
});

test("a suspended QR cannot establish an admin session", async ({ page }) => {
  test.skip(!ADMIN_E2E_SUSPENDED_QR_TOKEN, "requires a suspended admin QR fixture");

  await page.goto(`/q/${encodeURIComponent(ADMIN_E2E_SUSPENDED_QR_TOKEN ?? "")}`, {
    waitUntil: "networkidle"
  });
  await expect(page).not.toHaveURL(/\/admin$/);
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === "vistaire_admin_access")).toBeUndefined();
});

test("admin logout removes the restaurant session", async ({ page }) => {
  test.skip(!ADMIN_E2E_QR_TOKEN, "requires an active admin QR fixture");

  await page.goto(`/q/${encodeURIComponent(ADMIN_E2E_QR_TOKEN ?? "")}`, {
    waitUntil: "networkidle"
  });
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: /Déconnexion|Se déconnecter/i }).click();
  await expect(page.getByRole("heading", { name: "Accès dashboard restaurant requis" })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === "vistaire_admin_access")).toBeUndefined();
});

test("partial analytics retain real metrics without demo contamination", async ({ page }) => {
  test.skip(!ADMIN_E2E_FALLBACK_QR_TOKEN, "requires the fallback analytics QR fixture");
  await page.goto(`/q/${encodeURIComponent(ADMIN_E2E_FALLBACK_QR_TOKEN ?? "")}`, {
    waitUntil: "networkidle"
  });
  await expect(page.getByText(/Données réelles — échantillon encore limité/i)).toBeVisible();
  await expect(page.getByText(/Maison Elyse|Homard bleu|Lecture de présentation/i)).toHaveCount(0);
  await expect(page.getByText(/987654|123456|777777/)).toHaveCount(0);
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
