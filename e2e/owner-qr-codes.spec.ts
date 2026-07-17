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

test("owner QR page supports menu/admin targets, logo modes, save states, and mobile widths", async ({
  context,
  page
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  await enableOwnerBypass(context, baseURL);
  const health = installPageHealth(page);
  await page.route("**/api/owner/qr-codes**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          found: false,
          recoverable: false,
          record: null
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
        record: {
          id: `e2e-${targetKind}`,
          restaurantId: body.restaurantId ?? "e2e-restaurant",
          label: body.label ?? "QR e2e",
          targetKind,
          purposeKey: body.purposeKey ?? "default",
          targetPath,
          redirectUrl: `/q/e2e-${targetKind}-token`,
          persisted: true,
          recoverable: true,
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
  await page.getByRole("button", { name: /Sauvegarder \/ Generer QR/i }).click();
  await expect(page.getByRole("status")).toContainText(/non persiste|QR securise enregistre/);

  await page.getByRole("button", { name: /QR dashboard restaurant/i }).click();
  await expect(page.getByText("Interne restaurant").first()).toBeVisible();
  await expect(page.getByText("/admin", { exact: true }).first()).toBeVisible();
  await page.locator("select").nth(1).selectOption("none");
  await page.getByRole("button", { name: /Sauvegarder \/ Generer QR/i }).click();
  await expect(page.getByRole("status")).toContainText(
    /Type admin; destination \/admin/
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
