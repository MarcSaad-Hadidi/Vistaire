import { expect, type BrowserContext, type Page, test } from "@playwright/test";
import {
  QR_FUNCTIONAL_APP_ORIGIN,
  startQrFunctionalEnvironment
} from "./qr-functional-fixture";

test.setTimeout(120_000);

test.use({
  screenshot: "off",
  trace: "off",
  video: "off"
});

let environment: Awaited<ReturnType<typeof startQrFunctionalEnvironment>>;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  environment = await startQrFunctionalEnvironment();
});

test.afterAll(async () => {
  await environment?.stop();
});

test.beforeEach(() => {
  environment.fixture.reset();
});

async function enableOwnerBypass(context: BrowserContext) {
  await context.addCookies([
    {
      name: "__vistaire_owner_e2e",
      value: environment.ownerBypassToken,
      url: QR_FUNCTIONAL_APP_ORIGIN
    }
  ]);
}

async function openOwnerQr(page: Page) {
  await page.goto(`${QR_FUNCTIONAL_APP_ORIGIN}/owner/qr-codes`, {
    waitUntil: "domcontentloaded"
  });
  await expect(createButton(page, "menu")).toBeEnabled();
}

function createButton(page: Page, targetKind: "menu" | "admin") {
  return page.getByRole("button", {
    name: targetKind === "menu" ? "Créer le QR menu" : "Créer le QR admin"
  });
}

function styleButton(page: Page) {
  return page.getByRole("button", { name: "Enregistrer le style" });
}

function installPageHealth(page: Page) {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    networkErrors.push(`failed ${request.method()}`);
  });
  page.on("response", (response) => {
    if (response.status() === 404 || response.status() >= 500) {
      networkErrors.push(`${response.status()} ${response.request().method()}`);
    }
  });

  return {
    expectClean() {
      expect(consoleErrors, "unexpected browser console errors").toEqual([]);
      expect(networkErrors, "unexpected failed/404/5xx requests").toEqual([]);
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

async function downloadLooksValid(
  download: import("@playwright/test").Download,
  kind: "svg" | "png"
) {
  const stream = await download.createReadStream();
  if (!stream) return false;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  if (kind === "svg") {
    return body.length > 100 && body.subarray(0, 500).includes(Buffer.from("<svg"));
  }
  return (
    body.length > 100 &&
    body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  );
}

async function renderedQrFingerprint(page: Page): Promise<string> {
  return page
    .getByText("URL QR :", { exact: true })
    .locator("..")
    .evaluate(async (element) => {
      const value = element.textContent?.match(/\/q\/[A-Za-z0-9._~-]+/)?.[0];
      if (!value) throw new Error("Rendered QR route is missing.");
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value)
      );
      return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 16);
    });
}

async function followRenderedQrWithoutExportingToken(page: Page) {
  await page
    .getByText("URL QR :", { exact: true })
    .locator("..")
    .evaluate((element) => {
    const value = element.textContent?.match(/\/q\/[A-Za-z0-9._~-]+/)?.[0];
    if (!value) throw new Error("Rendered QR route is missing.");
    window.location.assign(value);
  });
}

test("QR fonctionnel: creation, reload durable, Save idempotent et downloads controles", async ({
  context,
  page
}) => {
  const health = installPageHealth(page);
  await enableOwnerBypass(context);
  await openOwnerQr(page);

  await createButton(page, "menu").click();
  await expect(page.getByRole("status")).toContainText(
    "QR sécurisé créé et enregistré"
  );

  const [svgDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Télécharger SVG" }).click()
  ]);
  expect(svgDownload.suggestedFilename()).toMatch(/^vistaire-qr-.+\.svg$/);
  expect(await downloadLooksValid(svgDownload, "svg")).toBe(true);

  const [pngDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Télécharger PNG" }).click()
  ]);
  expect(pngDownload.suggestedFilename()).toMatch(/^vistaire-qr-.+\.png$/);
  expect(await downloadLooksValid(pngDownload, "png")).toBe(true);

  const first = environment.fixture.snapshot()[0];
  const firstRenderedFingerprint = await renderedQrFingerprint(page);
  expect(first).toBeDefined();
  expect(first.status).toBe("active");
  expect(first.recoverable).toBe(true);
  expect(environment.fixture.postRequests).toBe(1);
  expect(environment.fixture.createdRecords).toBe(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status")).toContainText(
    "QR actif. Le style enregistré est à jour."
  );
  const reloadedRenderedFingerprint = await renderedQrFingerprint(page);
  await expect(styleButton(page)).toBeDisabled();

  expect(environment.fixture.postRequests).toBe(1);
  expect(environment.fixture.patchRequests).toBe(0);
  expect(environment.fixture.snapshot()[0].id).toBe(first.id);
  expect(environment.fixture.snapshot()[0].fingerprint).toBe(first.fingerprint);
  expect(reloadedRenderedFingerprint).toBe(firstRenderedFingerprint);
  health.expectClean();
});

test("QR fonctionnel: style PATCH-only persiste apres reload sans changer l'identite", async ({
  context,
  page
}) => {
  const health = installPageHealth(page);
  await enableOwnerBypass(context);
  await openOwnerQr(page);
  await createButton(page, "menu").click();
  await expect(page.getByRole("status")).toContainText(
    "QR sécurisé créé et enregistré"
  );

  const initial = environment.fixture.snapshot()[0];
  await page.getByLabel("Premier plan").fill("#222222");
  await expect(styleButton(page)).toBeEnabled();
  await styleButton(page).click();
  await expect(page.getByRole("status")).toContainText("Style du QR enregistré");

  const updated = environment.fixture.snapshot()[0];
  expect(environment.fixture.patchRequests).toBe(1);
  expect(updated.style.foregroundColor).toBe("#222222");
  expect(updated.id).toBe(initial.id);
  expect(updated.fingerprint).toBe(initial.fingerprint);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Premier plan")).toHaveValue("#222222");
  expect(environment.fixture.snapshot()[0].id).toBe(initial.id);
  health.expectClean();
});

test("QR fonctionnel: un double clic Save traverse le handler sans doublon", async ({
  context,
  page
}) => {
  const health = installPageHealth(page);
  environment.fixture.createDelayMs = 80;
  await enableOwnerBypass(context);
  await openOwnerQr(page);

  await createButton(page, "menu").dblclick();
  await expect(page.getByRole("status")).toContainText(
    "QR sécurisé créé et enregistré"
  );

  expect(environment.fixture.createdRecords).toBe(1);
  expect(environment.fixture.snapshot()).toHaveLength(1);
  expect(environment.fixture.postRequests).toBe(1);
  health.expectClean();
});

test("QR fonctionnel: deux onglets convergent vers le meme canonique", async ({
  context,
  page
}) => {
  const firstHealth = installPageHealth(page);
  environment.fixture.createDelayMs = 80;
  await enableOwnerBypass(context);
  const secondPage = await context.newPage();
  const secondHealth = installPageHealth(secondPage);
  await Promise.all([openOwnerQr(page), openOwnerQr(secondPage)]);

  await Promise.all([
    createButton(page, "menu").click(),
    createButton(secondPage, "menu").click()
  ]);
  await Promise.all([
    expect(page.getByRole("status")).toContainText(
      "QR sécurisé créé et enregistré"
    ),
    expect(secondPage.getByRole("status")).toContainText(
      "QR sécurisé créé et enregistré"
    )
  ]);

  expect(environment.fixture.postRequests).toBeGreaterThanOrEqual(1);
  expect(environment.fixture.postRequests).toBeLessThanOrEqual(2);
  expect(environment.fixture.createdRecords).toBe(1);
  expect(environment.fixture.snapshot()).toHaveLength(1);
  expect(environment.fixture.postResultIds).toHaveLength(
    environment.fixture.postRequests
  );
  expect(new Set(environment.fixture.postResultIds).size).toBe(1);
  const [firstLinkFingerprint, secondLinkFingerprint] = await Promise.all([
    renderedQrFingerprint(page),
    renderedQrFingerprint(secondPage)
  ]);
  expect(firstLinkFingerprint === secondLinkFingerprint).toBe(true);
  firstHealth.expectClean();
  secondHealth.expectClean();
});

test("QR fonctionnel: creation owner admin, echange HttpOnly et dashboard restaurant-scoped", async ({
  context,
  page
}) => {
  const health = installPageHealth(page);
  await enableOwnerBypass(context);
  await openOwnerQr(page);
  await page.getByRole("button", { name: /QR dashboard restaurant/i }).click();
  await expect(createButton(page, "admin")).toBeEnabled();
  await createButton(page, "admin").click();
  await expect(page.getByRole("status")).toContainText(
    "QR sécurisé créé et enregistré"
  );

  const created = environment.fixture.snapshot()[0];
  expect(created.status).toBe("active");
  expect(created.recoverable).toBe(true);
  expect(created.targetKind).toBe("admin");
  expect(created.restaurantId).toBe(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  );
  await followRenderedQrWithoutExportingToken(page);
  await expect
    .poll(
      async () => {
        try {
          return await page.evaluate(() => window.location.pathname === "/admin");
        } catch {
          return false;
        }
      },
      { timeout: 30_000 }
    )
    .toBe(true);

  const safeCookies = (await context.cookies()).map(
    ({ name, httpOnly, path, domain }) => ({ name, httpOnly, path, domain })
  );
  expect(
    safeCookies.some(
      (cookie) =>
        cookie.httpOnly &&
        cookie.path === "/admin" &&
        cookie.name === "vistaire_admin_access"
    ),
    JSON.stringify(safeCookies)
  ).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        authorized: (document.body?.innerText ?? "").toLocaleLowerCase().includes("restaurant fixture qr"),
        accessRequired: (document.body?.innerText ?? "").includes(
          "Accès dashboard restaurant requis"
        ),
        dashboardUnavailable: (document.body?.innerText ?? "").includes(
          "Dashboard indisponible"
        )
      })),
      { timeout: 30_000 }
    )
    .toEqual({
      authorized: true,
      accessRequired: false,
      dashboardUnavailable: false
    });
  expect(environment.fixture.liveQrReads).toBeGreaterThanOrEqual(1);
  expect(environment.fixture.liveQrReadMatches).toBe(
    environment.fixture.liveQrReads
  );
  await expect(
    page.getByRole("banner").getByText("Restaurant Fixture QR", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Restaurant Hors Scope")).toHaveCount(0);
  expect(environment.fixture.adminScopeVerified()).toBe(true);
  health.expectClean();
});

test("QR fonctionnel: rotation API remplace le canonique et preserve l'ancien actif", async ({
  context,
  page
}) => {
  const health = installPageHealth(page);
  await enableOwnerBypass(context);
  await openOwnerQr(page);
  await createButton(page, "menu").click();
  await expect(page.getByRole("status")).toContainText(
    "QR sécurisé créé et enregistré"
  );
  const previous = environment.fixture.snapshot()[0];

  const rotation = await page.evaluate(async ({ id, expectedConfigVersion }) => {
    const response = await fetch(`/api/owner/qr-codes/${encodeURIComponent(id)}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed: true,
        idempotencyKey: crypto.randomUUID(),
        previousDisposition: "keep-active",
        expectedConfigVersion
      })
    });
    const payload = await response.json();
    return {
      ok: response.ok && payload.ok === true,
      previousIdMatches: payload.previous?.id === id,
      currentDiffers: payload.current?.id !== id
    };
  }, { id: previous.id, expectedConfigVersion: previous.configVersion });

  const rows = environment.fixture.snapshot();
  expect(rotation).toEqual({
    ok: true,
    previousIdMatches: true,
    currentDiffers: true
  });
  expect(environment.fixture.rotateRequests).toBe(1);
  expect(rows).toHaveLength(2);
  expect(rows.filter((row) => row.isCanonical)).toHaveLength(1);
  expect(rows.find((row) => row.id === previous.id)?.status).toBe("active");
  expect(rows.find((row) => row.id === previous.id)?.isCanonical).toBe(false);
  health.expectClean();
});

test("QR fonctionnel: le customizer reste utilisable sans overflow a 390px et 430px", async ({
  context,
  page
}) => {
  const health = installPageHealth(page);
  await enableOwnerBypass(context);

  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 860 });
    await openOwnerQr(page);
    await expectNoHorizontalOverflow(page);
    await expect(createButton(page, "menu")).toBeVisible();
  }
  health.expectClean();
});
