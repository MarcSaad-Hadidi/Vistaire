import { expect, type Page, test, type TestInfo } from "@playwright/test";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;
const TEST_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const TEST_ORIGIN = new URL(TEST_BASE_URL).origin;
const TEST_RUN_ID = Date.now().toString(16).slice(-4);
const SUCCESS_MESSAGE =
  "Votre demande a bien \u00e9t\u00e9 envoy\u00e9e. Nous vous r\u00e9pondrons rapidement \u00e0 l'adresse indiqu\u00e9e.";
const ERROR_MESSAGE =
  "L'envoi n'a pas fonctionn\u00e9 pour le moment. Vous pouvez \u00e9crire directement \u00e0 contact@vistaire.ca.";
const VALID_CONTACT_PAYLOAD = {
  name: "Camille Laurier",
  email: "camille@example.com",
  restaurant: "Maison Laurier",
  message:
    "Nous souhaitons planifier un rendez-vous pour moderniser notre carte.",
  company: ""
};

type PageHealth = {
  expectClean: () => void;
};

function shouldTrackPageUrl(page: Page, url: string) {
  if (url.startsWith("data:") || url.startsWith("blob:")) return false;

  try {
    const target = new URL(url);
    const currentUrl = page.url();
    if (!currentUrl.startsWith("http")) return true;

    return target.origin === new URL(currentUrl).origin;
  } catch {
    return true;
  }
}

function installPageHealth(page: Page): PageHealth {
  const networkIssues: string[] = [];
  const consoleErrors: string[] = [];

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
    if (!shouldTrackPageUrl(page, url)) return;

    const status = response.status();
    if (status === 404 || status >= 500) {
      networkIssues.push(`${status} ${url}`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? "request failed";

    if (failure === "net::ERR_ABORTED") return;
    if (!shouldTrackPageUrl(page, url)) return;
    networkIssues.push(`${failure} ${url}`);
  });

  return {
    expectClean() {
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      expect(networkIssues, networkIssues.join("\n")).toEqual([]);
    }
  };
}

function collectModelAssetRequests(page: Page) {
  const requests: string[] = [];

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;

    if (MODEL_ASSET_RE.test(pathname)) {
      requests.push(request.url());
    }
  });

  return requests;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function openRendezVous(page: Page) {
  const response = await page.goto("/prendre-rendez-vous", {
    waitUntil: "domcontentloaded"
  });

  expect(response, "route should return a response").not.toBeNull();
  expect(response?.status()).toBeLessThan(400);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Prendre rendez-vous pour une carte digitale Vistaire/i
    })
  ).toBeVisible();
}

async function fillValidContactForm(page: Page) {
  await page.getByLabel("Nom").fill("Camille Laurier");
  await page.getByLabel("Courriel").fill("camille@example.com");
  await page.getByLabel("Restaurant").fill("Maison Laurier");
  await page
    .getByLabel("Message")
    .fill("Nous souhaitons planifier un rendez-vous pour moderniser notre carte.");
}

function hashTestLabel(label: string) {
  return [...label].reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) % 0xffff;
  }, 17);
}

function sameOriginHeaders(
  testInfo: TestInfo,
  label: string
): Record<string, string> {
  const worker = (testInfo.workerIndex + 1).toString(16);
  const retry = (testInfo.retry + 1).toString(16);
  const labelPart = hashTestLabel(label).toString(16);
  const forwardedFor = `2001:db8:${TEST_RUN_ID}:${worker}:${retry}:${labelPart}:0:1`;

  return {
    Origin: TEST_ORIGIN,
    Referer: `${TEST_ORIGIN}/prendre-rendez-vous`,
    "Sec-Fetch-Site": "same-origin",
    "X-Forwarded-For": forwardedFor,
    "X-Vercel-Forwarded-For": forwardedFor
  };
}

test.describe("rendez-vous contact form", () => {
  test("renders the expected accessible fields", async ({ page }) => {
    const health = installPageHealth(page);
    const modelRequests = collectModelAssetRequests(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await openRendezVous(page);

    await expect(page.getByLabel("Nom")).toBeVisible();
    await expect(page.getByLabel("Courriel")).toBeVisible();
    await expect(page.getByLabel("Restaurant")).toBeVisible();
    await expect(page.getByLabel("Message")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Envoyer la demande" })
    ).toBeVisible();
    await expect(page.getByText(/Aucun message n'est envoy/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    expect(modelRequests).toEqual([]);
    health.expectClean();
  });

  test("empty submit shows client errors without posting", async ({ page }) => {
    let contactPosts = 0;
    await page.route("**/api/contact", async (route) => {
      contactPosts += 1;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await openRendezVous(page);
    await page.getByRole("button", { name: "Envoyer la demande" }).click();

    await expect(page.getByText("Indiquez votre nom.")).toBeVisible();
    await expect(page.getByText("Indiquez votre courriel.")).toBeVisible();
    await expect(page.getByText("Indiquez le nom du restaurant.")).toBeVisible();
    await expect(page.getByText("Ajoutez un message.")).toBeVisible();
    expect(contactPosts).toBe(0);
  });

  test("invalid email and short message stay client-side", async ({ page }) => {
    let contactPosts = 0;
    await page.route("**/api/contact", async (route) => {
      contactPosts += 1;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await openRendezVous(page);
    await page.getByLabel("Nom").fill("Camille Laurier");
    await page.getByLabel("Courriel").fill("courriel-invalide");
    await page.getByLabel("Restaurant").fill("Maison Laurier");
    await page.getByLabel("Message").fill("Court");
    await page.getByRole("button", { name: "Envoyer la demande" }).click();

    await expect(page.getByText("Indiquez un courriel valide.")).toBeVisible();
    await expect(
      page.getByText("Ajoutez quelques d\u00e9tails sur votre projet.")
    ).toBeVisible();
    expect(contactPosts).toBe(0);
  });

  test("rapid repeated submit posts once and shows success", async ({
    page
  }) => {
    let contactPosts = 0;
    let payload: Record<string, unknown> | null = null;
    let releaseResponse: () => void = () => {};
    let markFirstRequestSeen: () => void = () => {};
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    const firstRequestSeen = new Promise<void>((resolve) => {
      markFirstRequestSeen = resolve;
    });

    await page.route("**/api/contact", async (route) => {
      contactPosts += 1;
      payload = route.request().postDataJSON() as Record<string, unknown>;
      markFirstRequestSeen();
      await responseGate;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await openRendezVous(page);
    await fillValidContactForm(page);
    const submitButton = page.getByRole("button", {
      name: "Envoyer la demande"
    });
    await submitButton.click();
    await firstRequestSeen;
    await expect(
      page.getByRole("button", { name: "Envoi en cours..." })
    ).toBeDisabled();
    await page.locator("form").first().dispatchEvent("submit");
    expect(contactPosts).toBe(1);
    releaseResponse();

    await expect(page.getByText(SUCCESS_MESSAGE)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Demande envoy\u00e9e" })
    ).toBeDisabled();
    expect(page.url()).toContain("/prendre-rendez-vous");
    expect(contactPosts).toBe(1);
    expect(payload).toEqual(
      expect.objectContaining({
        name: "Camille Laurier",
        email: "camille@example.com",
        restaurant: "Maison Laurier",
        message:
          "Nous souhaitons planifier un rendez-vous pour moderniser notre carte.",
        company: ""
      })
    );

    await page.getByLabel("Message").fill(
      "Nous souhaitons planifier un rendez-vous pour moderniser notre carte cette semaine."
    );
    await expect(
      page.getByRole("button", { name: "Envoyer la demande" })
    ).toBeEnabled();
  });

  test("success state locks identical submission until the form changes", async ({
    page
  }) => {
    let contactPosts = 0;

    await page.route("**/api/contact", async (route) => {
      contactPosts += 1;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await openRendezVous(page);
    await fillValidContactForm(page);
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByText(SUCCESS_MESSAGE)).toBeVisible();

    await page.locator("form").first().dispatchEvent("submit");
    expect(contactPosts).toBe(1);

    await page.getByLabel("Message").fill(
      "Nous souhaitons planifier un rendez-vous pour moderniser notre carte cette semaine."
    );
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(
      page.getByRole("button", { name: "Demande envoy\u00e9e" })
    ).toBeDisabled();
    expect(contactPosts).toBe(2);
  });

  test("server error keeps a visible direct email fallback", async ({ page }) => {
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "temporary failure" })
      });
    });

    await openRendezVous(page);
    await fillValidContactForm(page);
    await page.getByRole("button", { name: "Envoyer la demande" }).click();

    await expect(page.getByText(ERROR_MESSAGE)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "contact@vistaire.ca" }).first()
    ).toHaveAttribute("href", /^mailto:contact@vistaire\.ca/);
  });

  for (const viewport of [
    { label: "390", width: 390, height: 844 },
    { label: "430", width: 430, height: 932 }
  ]) {
    test(`mobile ${viewport.label}px remains usable without overflow`, async ({
      page
    }) => {
      const health = installPageHealth(page);

      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height
      });
      await openRendezVous(page);

      await expect(
        page.getByRole("button", { name: "Envoyer la demande" })
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      health.expectClean();
    });
  }

  test.describe.serial("contact API abuse guards", () => {
    test("contact API validates bad requests before Brevo config", async (
      { request },
      testInfo
    ) => {
      const response = await request.post("/api/contact", {
        headers: sameOriginHeaders(testInfo, "invalid-payload"),
        data: {
          name: "",
          email: "bad-email",
          restaurant: "",
          message: "court",
          company: ""
        }
      });

      expect(response.status()).toBe(400);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ ok: false })
      );
    });

    test("contact API accepts honeypot submissions before Brevo config", async (
      { request },
      testInfo
    ) => {
      const response = await request.post("/api/contact", {
        headers: sameOriginHeaders(testInfo, "honeypot"),
        data: {
          ...VALID_CONTACT_PAYLOAD,
          company: "bot-filled-field"
        }
      });

      expect(response.status()).toBe(202);
      await expect(response.json()).resolves.toEqual({ ok: true });
    });

    test("contact API rejects clearly external origins", async (
      { request },
      testInfo
    ) => {
      const response = await request.post("/api/contact", {
        headers: {
          ...sameOriginHeaders(testInfo, "external-origin"),
          Origin: "https://attacker.example",
          Referer: "https://attacker.example/form",
          "Sec-Fetch-Site": "cross-site"
        },
        data: VALID_CONTACT_PAYLOAD
      });

      expect(response.status()).toBe(403);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ ok: false })
      );
    });

    test("contact API rejects external referers without origin", async (
      { request },
      testInfo
    ) => {
      const headersWithoutOrigin = sameOriginHeaders(
        testInfo,
        "external-referer"
      );
      delete headersWithoutOrigin.Origin;

      const response = await request.post("/api/contact", {
        headers: {
          ...headersWithoutOrigin,
          Referer: "https://attacker.example/form",
          "Sec-Fetch-Site": "cross-site"
        },
        data: VALID_CONTACT_PAYLOAD
      });

      expect(response.status()).toBe(403);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ ok: false })
      );
    });

    test("contact API rate limits repeated valid submissions", async (
      { request },
      testInfo
    ) => {
      const headers = sameOriginHeaders(testInfo, "rate-limit");

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await request.post("/api/contact", {
          headers,
          data: {
            ...VALID_CONTACT_PAYLOAD,
            company: "rate-limit-test"
          }
        });

        expect(response.status()).toBe(202);
      }

      const limited = await request.post("/api/contact", {
        headers,
        data: {
          ...VALID_CONTACT_PAYLOAD,
          company: "rate-limit-test"
        }
      });

      expect(limited.status()).toBe(429);
      expect(limited.headers()["retry-after"]).toBeTruthy();
      await expect(limited.json()).resolves.toEqual({
        ok: false,
        error: "Trop de demandes. R\u00e9essayez plus tard."
      });
    });

    test("contact API returns clean errors for malformed and oversized JSON", async (
      { request },
      testInfo
    ) => {
      const malformed = await request.post("/api/contact", {
        headers: {
          ...sameOriginHeaders(testInfo, "malformed-json"),
          "Content-Type": "application/json"
        },
        data: "{not-json"
      });

      expect(malformed.status()).toBe(400);
      await expect(malformed.json()).resolves.toEqual(
        expect.objectContaining({ ok: false })
      );

      const oversized = await request.post("/api/contact", {
        headers: {
          ...sameOriginHeaders(testInfo, "oversized-json"),
          "Content-Type": "application/json"
        },
        data: JSON.stringify({
          ...VALID_CONTACT_PAYLOAD,
          message: "x".repeat(12_001)
        })
      });

      expect(oversized.status()).toBe(400);
      await expect(oversized.json()).resolves.toEqual(
        expect.objectContaining({ ok: false })
      );
    });
  });
});
