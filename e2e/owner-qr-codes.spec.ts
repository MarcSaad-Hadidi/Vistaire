import { expect, type BrowserContext, type Page, test } from "@playwright/test";

const OWNER_E2E_TOKEN =
  process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
  "vistaire-owner-e2e-local-token";

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
  const consoleErrors: string[] = [];
  const networkIssues: string[] = [];
  const mediaRequests: string[] = [];
  const qrPosts: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("Failed to load resource")) return;
    consoleErrors.push(text);
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  page.on("response", (response) => {
    const url = response.url();
    const status = response.status();
    if (/\.(?:glb|usdz|mp4)(?:$|[?#])/i.test(url)) mediaRequests.push(url);
    if (url.includes("/api/owner/qr-codes") && response.request().method() === "POST") {
      qrPosts.push(`${status} ${url}`);
    }
    if (status === 404 || status >= 500) networkIssues.push(`${status} ${url}`);
  });

  return {
    qrPosts,
    expectClean() {
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      expect(networkIssues, networkIssues.join("\n")).toEqual([]);
      expect(mediaRequests, mediaRequests.join("\n")).toEqual([]);
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

type LifecycleStatus = "active" | "paused" | "archived" | "revoked";

function expectExactKeys(
  body: Record<string, unknown>,
  expected: string[]
) {
  expect(Object.keys(body).sort()).toEqual([...expected].sort());
}

function lifecycleRecord({
  id = "e2e-menu",
  status = "active",
  configVersion = 1,
  redirectUrl = "/q/e2e-menu-token",
  isCanonical = true
}: {
  id?: string;
  status?: LifecycleStatus;
  configVersion?: number;
  redirectUrl?: string;
  isCanonical?: boolean;
} = {}) {
  return {
    id,
    restaurantId: "11111111-1111-1111-1111-111111111111",
    label: "QR menu - Maison Elyse",
    targetKind: "menu",
    purposeKey: "default",
    targetPath: "/menu/maison-elyse",
    redirectUrl,
    persisted: true,
    recoverable: true,
    tokenPreview: "...token",
    status,
    isCanonical,
    scanCount: 3,
    lastScannedAt: null,
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: `2026-07-20T12:00:0${configVersion}.000Z`,
    configVersion,
    style: {
      foregroundColor: "#111111",
      backgroundColor: "#ffffff",
      accentColor: "#c9a96e",
      logoMode: "none",
      logoText: "ME",
      logoImageUrl: "",
      logoSizePercent: 18,
      padding: 2,
      errorCorrectionLevel: "H"
    }
  };
}

function inventoryRecord<
  T extends { recoverable?: unknown; redirectUrl?: unknown; tokenPreview?: unknown }
>(record: T) {
  const { recoverable, redirectUrl, tokenPreview, ...metadataOnly } = record;
  void recoverable;
  void redirectUrl;
  void tokenPreview;
  return metadataOnly;
}

test("owner QR page supports menu/admin targets, logo modes, save states, and mobile widths", async ({
  context,
  page
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  await enableOwnerBypass(context, baseURL);
  const health = installPageHealth(page);
  await page.route("**/api/owner/qr-codes**", async (route) => {
    if (route.request().method() === "GET") {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/owner/qr-codes/inventory") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, records: [] })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          found: false,
          recoverable: false,
          configVersion: null,
          canonical: null,
          record: null,
          history: []
        })
      });
      return;
    }
    const body = route.request().postDataJSON() as {
      targetKind?: string;
      targetPath?: string;
      label?: string;
      restaurantId?: string;
      purposeKey?: string;
      style?: Record<string, unknown>;
    };
    expect(route.request().method()).toBe("POST");
    expectExactKeys(body as Record<string, unknown>, [
      "restaurantId",
      "label",
      "targetKind",
      "purposeKey",
      "targetPath",
      "style"
    ]);
    const targetKind = body.targetKind === "admin" ? "admin" : "menu";
    const targetPath =
      typeof body.targetPath === "string" && body.targetPath
        ? body.targetPath
        : "/menu/maison-elyse";

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        redirectUrl: `/q/e2e-${targetKind}-token`,
        targetPath,
        targetKind,
        persisted: true,
        configVersion: 1,
        history: [],
        record: {
          id: `e2e-${targetKind}`,
          restaurantId: body.restaurantId ?? "e2e-restaurant",
          label: body.label ?? "QR e2e",
          targetKind,
          purposeKey: body.purposeKey ?? "default",
          isCanonical: true,
          targetPath,
          redirectUrl: `/q/e2e-${targetKind}-token`,
          persisted: true,
          recoverable: true,
          status: "active",
          scanCount: 0,
          lastScannedAt: null,
          createdAt: "2026-07-20T12:00:00.000Z",
          updatedAt: "2026-07-20T12:00:00.000Z",
          configVersion: 1,
          tokenPreview: "…token",
          style: body.style ?? {}
        }
      })
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/owner/qr-codes", { waitUntil: "networkidle" });

  await expect(page.locator("select").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /QR menu public/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /QR dashboard restaurant/i })
  ).toBeVisible();
  await expect(page.getByText("Destination exacte")).toBeVisible();
  await expect(page.getByText("Logo au centre")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /QR menu public/i }).click();
  const logoSelect = page.locator("select").nth(1);
  await logoSelect.selectOption("none");
  await logoSelect.selectOption("monogram");
  await logoSelect.selectOption("imageUrl");
  await page.getByLabel("URL du logo").fill(`${baseURL}/icon.svg`);
  await expect(page.getByText("SVG reste recommande")).toBeVisible();
  await page.getByRole("button", { name: "Créer le QR menu" }).click();
  await expect(page.getByRole("status")).toContainText(/actif|enregistr/i);

  await page.getByRole("button", { name: /QR dashboard restaurant/i }).click();
  await expect(page.getByText("Interne restaurant").first()).toBeVisible();
  await expect(page.getByText("/admin", { exact: true }).first()).toBeVisible();
  await page.locator("select").nth(1).selectOption("none");
  await page.getByRole("button", { name: "Créer le QR admin" }).click();
  await expect(page.getByRole("status")).toContainText(
    /admin|destination \/admin/i
  );

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 860 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /QR menu public/i })).toBeVisible();
    await expect(page.getByText("Logo au centre")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  expect(health.qrPosts.length).toBeGreaterThanOrEqual(2);
  expect(health.qrPosts.every((entry) => entry.startsWith("201 "))).toBe(true);
  health.expectClean();
});

test("owner QR lifecycle enforces versioned writes, safe rotation, conflict reload, and accessible mobile dialogs", async ({
  context,
  page
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  await enableOwnerBypass(context, baseURL);

  let current = lifecycleRecord();
  let history = [
    lifecycleRecord({
      id: "e2e-historical",
      status: "archived",
      configVersion: 1,
      redirectUrl: "",
      isCanonical: false
    })
  ];
  let getRequests = 0;
  let inventoryRequests = 0;
  let patchRequests = 0;
  let returnConflict = true;
  let returnStatusConflict = true;
  const statusBodies: Record<string, unknown>[] = [];
  const rotationBodies: Record<string, unknown>[] = [];

  await page.route("**/api/owner/qr-codes**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const idPath = `/api/owner/qr-codes/${current.id}`;

    if (method === "GET" && url.pathname === "/api/owner/qr-codes/inventory") {
      expect(url.searchParams.get("restaurantId")).toBe(
        "11111111-1111-1111-1111-111111111111"
      );
      inventoryRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          records: [inventoryRecord(current), ...history.map(inventoryRecord)]
        })
      });
      return;
    }

    if (method === "GET" && url.pathname === "/api/owner/qr-codes") {
      expect(url.searchParams.get("restaurantId")).toBe(
        "11111111-1111-1111-1111-111111111111"
      );
      expect(url.searchParams.get("targetKind")).toBe("menu");
      expect(url.searchParams.get("purposeKey")).toBe("default");
      getRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          found: true,
          recoverable: current.recoverable,
          configVersion: current.configVersion,
          canonical: current,
          record: current,
          history
        })
      });
      return;
    }

    if (method === "PATCH" && url.pathname === idPath) {
      const body = request.postDataJSON() as Record<string, unknown>;
      expectExactKeys(body, ["style", "expectedConfigVersion"]);
      expect(body.expectedConfigVersion).toBe(current.configVersion);
      patchRequests += 1;
      if (returnConflict) {
        returnConflict = false;
        current = {
          ...current,
          configVersion: current.configVersion + 1
        };
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            code: "stale-config",
            error: "Le QR a ete modifie ailleurs.",
            configVersion: current.configVersion
          })
        });
        return;
      }
      current = {
        ...current,
        style: body.style as typeof current.style,
        configVersion: current.configVersion + 1
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, record: current, configVersion: current.configVersion })
      });
      return;
    }

    if (method === "POST" && url.pathname === `${idPath}/status`) {
      const body = request.postDataJSON() as Record<string, unknown>;
      expectExactKeys(body, ["action", "expectedConfigVersion", "idempotencyKey"]);
      expect(body.action).toMatch(/^(pause|resume|archive|revoke)$/);
      expect(body.expectedConfigVersion).toBe(current.configVersion);
      expect(body.idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      statusBodies.push(body);
      if (returnStatusConflict) {
        returnStatusConflict = false;
        current = {
          ...current,
          configVersion: current.configVersion + 1
        };
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            code: "stale-config",
            error: "Le QR a ete modifie ailleurs.",
            record: current,
            configVersion: current.configVersion
          })
        });
        return;
      }
      const statusByAction: Record<string, LifecycleStatus> = {
        pause: "paused",
        resume: "active",
        archive: "archived",
        revoke: "revoked"
      };
      current = {
        ...current,
        status: statusByAction[String(body.action)],
        configVersion: current.configVersion + 1
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, record: current, configVersion: current.configVersion })
      });
      return;
    }

    if (method === "POST" && url.pathname === `${idPath}/rotate`) {
      const body = request.postDataJSON() as Record<string, unknown>;
      expectExactKeys(body, [
        "confirmed",
        "idempotencyKey",
        "previousDisposition",
        "expectedConfigVersion"
      ]);
      expect(body.confirmed).toBe(true);
      expect(body.idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(body.previousDisposition).toBe("pause");
      expect(body.expectedConfigVersion).toBe(current.configVersion);
      rotationBodies.push(body);
      const previous = { ...current, status: "paused" as const, isCanonical: false };
      current = lifecycleRecord({
        id: "e2e-menu-rotated",
        configVersion: current.configVersion + 1,
        redirectUrl: "/q/e2e-menu-rotated-token"
      });
      history = [previous, ...history];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          previous,
          current,
          configVersion: current.configVersion,
          history
        })
      });
      return;
    }

    throw new Error(`Unexpected owner QR request: ${method} ${url.pathname}`);
  });

  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto("/owner/qr-codes", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Enregistrer le style" })).toBeDisabled();
  await expect(page.getByText(/Historique/i)).toBeVisible();
  await expect(page.getByText(/Archivé|Archive/i).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("Premier plan").fill("#222222");
  await page.getByRole("button", { name: "Enregistrer le style" }).click();
  await expect(page.getByRole("status")).toContainText(/chang|conflit/i);
  await expect(page.getByRole("button", { name: "Recharger" })).toBeVisible();
  const getsBeforeReload = getRequests;
  const inventoryBeforeReload = inventoryRequests;
  await page.getByRole("button", { name: "Recharger" }).click();
  await expect.poll(() => getRequests).toBeGreaterThan(getsBeforeReload);
  await expect.poll(() => inventoryRequests).toBeGreaterThan(inventoryBeforeReload);
  expect(patchRequests).toBe(1);

  await page.getByRole("button", { name: "Suspendre temporairement" }).click();
  await expect(page.getByRole("status")).toContainText(/chang|conflit/i);
  await expect(page.getByRole("button", { name: "Recharger" })).toBeVisible();
  const getsBeforeStatusReload = getRequests;
  await page.getByRole("button", { name: "Recharger" }).click();
  await expect.poll(() => getRequests).toBeGreaterThan(getsBeforeStatusReload);
  await page.getByRole("button", { name: "Suspendre temporairement" }).click();
  await expect(page.getByRole("button", { name: "Réactiver" })).toBeVisible();
  await page.getByRole("button", { name: "Réactiver" }).click();
  await expect(page.getByRole("button", { name: "Suspendre temporairement" })).toBeVisible();
  expect(statusBodies.map((body) => body.action)).toEqual(["pause", "pause", "resume"]);

  await page.getByRole("button", { name: "Archiver" }).click();
  const archiveDialog = page.getByRole("dialog");
  await expect(archiveDialog).toHaveAttribute("aria-modal", "true");
  await archiveDialog.getByRole("button", { name: /Confirmer/i }).click();
  await expect(archiveDialog).toBeHidden();
  await expect(page.getByRole("status")).toContainText(/archiv/i);
  expect(statusBodies.map((body) => body.action)).toEqual([
    "pause",
    "pause",
    "resume",
    "archive"
  ]);

  current = { ...current, status: "active" };
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Révoquer définitivement" }).click();
  const revokeDialog = page.getByRole("dialog");
  await expect(revokeDialog).toHaveAttribute("aria-modal", "true");
  await revokeDialog.getByRole("button", { name: /Confirmer/i }).click();
  await expect(revokeDialog).toBeHidden();
  await expect(page.getByRole("status")).toContainText(/voqu/i);
  expect(statusBodies.map((body) => body.action)).toEqual([
    "pause",
    "pause",
    "resume",
    "archive",
    "revoke"
  ]);
  expect(statusBodies.map((body) => body.expectedConfigVersion)).toEqual([2, 3, 4, 5, 6]);
  expect(new Set(statusBodies.map((body) => body.idempotencyKey)).size).toBe(
    statusBodies.length
  );

  current = { ...current, status: "active" };
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Régénérer le lien sécurisé" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toContainText(/ancien QR|précédent|precedent/i);
  await expectNoHorizontalOverflow(page);

  const focusedBeforeTab = await page.evaluate(() => document.activeElement?.tagName);
  expect(focusedBeforeTab).not.toBe("BODY");
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((element) => element.contains(document.activeElement))
  ).toBe(true);
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((element) => element.contains(document.activeElement))
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Régénérer le lien sécurisé" })).toBeFocused();

  await page.getByRole("button", { name: "Régénérer le lien sécurisé" }).click();
  await dialog.getByLabel(/pause/i).check();
  await dialog.getByRole("button", { name: /Confirmer/i }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toContainText(/Nouveau QR actif/i);
  await expect(page.getByText("En pause", { exact: true }).first()).toBeVisible();
  expect(rotationBodies).toHaveLength(1);

  const inventoryBeforeHistoryReload = inventoryRequests;
  await page.setViewportSize({ width: 430, height: 860 });
  await page.reload({ waitUntil: "networkidle" });
  await expect.poll(() => inventoryRequests).toBeGreaterThan(inventoryBeforeHistoryReload);
  await expect(page.getByText("En pause", { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Régénérer le lien sécurisé" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press("Escape");
});

test("owner QR unrecoverable state never renders or exports a fabricated QR URL", async ({
  context,
  page
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  await enableOwnerBypass(context, baseURL);
  const unrecoverable = {
    ...lifecycleRecord(),
    recoverable: false,
    redirectUrl: undefined,
    tokenPreview: ""
  };

  await page.route("**/api/owner/qr-codes**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.method()).toBe("GET");
    if (url.pathname === "/api/owner/qr-codes/inventory") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, records: [inventoryRecord(unrecoverable)] })
      });
      return;
    }
    expect(url.pathname).toBe("/api/owner/qr-codes");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        found: true,
        recoverable: false,
        configVersion: unrecoverable.configVersion,
        canonical: unrecoverable,
        record: unrecoverable,
        history: []
      })
    });
  });

  await page.goto("/owner/qr-codes", { waitUntil: "networkidle" });
  await expect(page.getByRole("status")).toContainText(
    /ne peut pas être récupérée|indisponible/i
  );
  await expect(page.getByRole("button", { name: "Copier URL QR" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Télécharger SVG" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Télécharger PNG" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Créer une nouvelle version sécurisée" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Créer une nouvelle version sécurisée" })
    .click();
  const recoveryDialog = page.getByRole("dialog");
  await expect(recoveryDialog).toHaveAttribute("aria-modal", "true");
  await expect(recoveryDialog).toContainText("Disposition de l’ancien QR");
  await page.keyboard.press("Escape");
  await expect(recoveryDialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Créer une nouvelle version sécurisée" })
  ).toBeFocused();
  await expect(page.locator("[aria-label^='QR pour'] svg")).toHaveCount(0);
  await expect(page.getByText(/\/q\/<token>|À générer après sauvegarde/)).toHaveCount(0);
});
