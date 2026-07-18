import { expect, type BrowserContext, type Page, test } from "@playwright/test";
import {
  QR_FUNCTIONAL_APP_ORIGIN,
  startQrFunctionalEnvironment
} from "./qr-functional-fixture";

const OWNER_E2E_TOKEN = "qr-functional-owner-bypass";

test.use({
  screenshot: "off",
  trace: "off",
  video: "off"
});

let environment: Awaited<ReturnType<typeof startQrFunctionalEnvironment>>;

test.beforeAll(async () => {
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
      value: OWNER_E2E_TOKEN,
      url: QR_FUNCTIONAL_APP_ORIGIN
    }
  ]);
}

async function openOwnerQr(page: Page) {
  await page.goto(`${QR_FUNCTIONAL_APP_ORIGIN}/owner/qr-codes`, {
    waitUntil: "domcontentloaded"
  });
  await expect(
    page.getByRole("button", { name: /Sauvegarder \/ Generer QR/i })
  ).toBeEnabled();
}

function saveButton(page: Page) {
  return page.getByRole("button", { name: /Sauvegarder \/ Generer QR/i });
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

  await saveButton(page).click();
  await expect(page.getByRole("status")).toContainText("QR securise enregistre");

  const [svgDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Telecharger SVG" }).click()
  ]);
  expect(svgDownload.suggestedFilename()).toMatch(/^vistaire-qr-.+\.svg$/);
  expect(await downloadLooksValid(svgDownload, "svg")).toBe(true);

  const [pngDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Telecharger PNG" }).click()
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
  await expect(page.getByRole("status")).toContainText("QR securise enregistre");
  const reloadedRenderedFingerprint = await renderedQrFingerprint(page);
  await saveButton(page).click();

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
  await saveButton(page).click();
  await expect(page.getByRole("status")).toContainText("QR securise enregistre");

  const initial = environment.fixture.snapshot()[0];
  await page.getByLabel("Premier plan").fill("#222222");
  await saveButton(page).click();
  await expect(page.getByRole("status")).toContainText("QR securise enregistre");

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

  await saveButton(page).dblclick();
  await expect(page.getByRole("status")).toContainText("QR securise enregistre");

  expect(environment.fixture.createdRecords).toBe(1);
  expect(environment.fixture.snapshot()).toHaveLength(1);
  expect(environment.fixture.postRequests).toBe(1);
  health.expectClean();
});

test("QR fonctionnel: deux onglets et deux handlers convergent vers le meme canonique", async ({
  context,
  page
}) => {
  const firstHealth = installPageHealth(page);
  environment.fixture.createDelayMs = 80;
  await enableOwnerBypass(context);
  const secondPage = await context.newPage();
  const secondHealth = installPageHealth(secondPage);
  await Promise.all([openOwnerQr(page), openOwnerQr(secondPage)]);

  await Promise.all([saveButton(page).click(), saveButton(secondPage).click()]);
  await Promise.all([
    expect(page.getByRole("status")).toContainText("QR securise enregistre"),
    expect(secondPage.getByRole("status")).toContainText("QR securise enregistre")
  ]);

  expect(environment.fixture.postRequests).toBe(2);
  expect(environment.fixture.createdRecords).toBe(1);
  expect(environment.fixture.snapshot()).toHaveLength(1);
  expect(environment.fixture.postResultIds).toHaveLength(2);
  expect(
    environment.fixture.postResultIds[0] ===
      environment.fixture.postResultIds[1]
  ).toBe(true);
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
  await expect(saveButton(page)).toBeEnabled();
  await saveButton(page).click();
  await expect(page.getByRole("status")).toContainText("QR securise enregistre");

  const created = environment.fixture.snapshot()[0];
  expect(created.status).toBe("active");
  expect(created.recoverable).toBe(true);
  expect(created.targetKind).toBe("admin");
  expect(created.restaurantId).toBe(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  );
  await followRenderedQrWithoutExportingToken(page);
  await expect
    .poll(async () => {
      try {
        return await page.evaluate(() => window.location.pathname === "/admin");
      } catch {
        return false;
      }
    })
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
        authorized: document.body.innerText.includes("Restaurant Fixture QR"),
        accessRequired: document.body.innerText.includes(
          "Accès dashboard restaurant requis"
        ),
        dashboardUnavailable: document.body.innerText.includes(
          "Dashboard indisponible"
        )
      }))
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
    page.getByRole("heading", { name: /Restaurant Fixture QR/i })
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
  await saveButton(page).click();
  await expect(page.getByRole("status")).toContainText("QR securise enregistre");
  const previous = environment.fixture.snapshot()[0];

  const rotation = await page.evaluate(async (id) => {
    const response = await fetch(`/api/owner/qr-codes/${encodeURIComponent(id)}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true })
    });
    const payload = await response.json();
    return {
      ok: response.ok && payload.ok === true,
      previousIdMatches: payload.previous?.id === id,
      currentDiffers: payload.current?.id !== id
    };
  }, previous.id);

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
    await expect(saveButton(page)).toBeVisible();
  }
  health.expectClean();
});
