import { expect, type Page, test } from "@playwright/test";

const MODEL_ASSET_RE = /\.(?:glb|usdz)(?:$|[?#])/i;
const SUCCESS_MESSAGE =
  "Votre demande a bien \u00e9t\u00e9 envoy\u00e9e. Nous vous r\u00e9pondrons rapidement \u00e0 l'adresse indiqu\u00e9e.";
const ERROR_MESSAGE =
  "L'envoi n'a pas fonctionn\u00e9 pour le moment. Vous pouvez \u00e9crire directement \u00e0 contact@vistaire.ca.";

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

  test("valid submit posts to the contact API and shows success", async ({
    page
  }) => {
    let contactPosts = 0;
    let payload: Record<string, unknown> | null = null;

    await page.route("**/api/contact", async (route) => {
      contactPosts += 1;
      payload = route.request().postDataJSON() as Record<string, unknown>;
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
    await expect(
      page.getByRole("button", { name: "Envoyer la demande" })
    ).toBeEnabled();
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

  test("contact API validates bad requests before Brevo config", async ({
    request
  }) => {
    const response = await request.post("/api/contact", {
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
});
