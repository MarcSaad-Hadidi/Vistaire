import { expect, type BrowserContext, type Page, test } from "@playwright/test";

const OWNER_E2E_TOKEN =
  process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
  "vistaire-owner-e2e-local-token";
const ADMIN_E2E_QR_TOKEN = process.env.VISTAIRE_ADMIN_E2E_QR_TOKEN;
const ADMIN_E2E_FALLBACK_QR_TOKEN = process.env.VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN;

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
  const requestedStates: boolean[] = [];

  await page.route("**/admin/api/dishes/*/availability", async (route) => {
    const body = route.request().postDataJSON() as { available?: boolean };
    if (typeof body.available === "boolean") requestedStates.push(body.available);
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

  for (const width of [390, 430]) {
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
    const toggle = row.getByRole("button", { name: /Rendre .* indisponible/i });
    const dishName = await toggle.getAttribute("aria-label");
    await toggle.click();
    await expect.poll(() => requestedStates.at(-1)).toBe(false);
    await expect(row).toContainText("Indisponible");
    await expect(row).toHaveAttribute("data-available", "false");
    await expect(
      row.getByRole("button", {
        name: dishName?.replace("indisponible", "disponible") ?? /Rendre .* disponible/i
      })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  expect(requestedStates).toEqual([false, false]);
  health.expectClean();
});

test("fallback analytics show only the insufficient evidence state", async ({ page }) => {
  test.skip(!ADMIN_E2E_FALLBACK_QR_TOKEN, "requires the fallback analytics QR fixture");
  await page.goto(`/q/${encodeURIComponent(ADMIN_E2E_FALLBACK_QR_TOKEN ?? "")}`, {
    waitUntil: "networkidle"
  });
  await expect(page.getByText(/Pas encore assez d'activité réelle/i)).toBeVisible();
  await expect(page.getByText(/Données insuffisantes/i)).toBeVisible();
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
