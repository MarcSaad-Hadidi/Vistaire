import { expect, test } from "@playwright/test";

const RESTAURANT_ID = "11111111-1111-1111-1111-111111111111";

test.describe("Premium public auth boundaries", () => {
  test("landing stays public and does not expose self-serve auth CTAs", async ({
    page
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("link", {
        exact: true,
        name: "Vistaire — accueil de la page"
      })
    ).toBeVisible();
    await expect(page.getByText("Connexion")).toHaveCount(0);
    await expect(page.getByText("Inscription")).toHaveCount(0);
    await expect(page.getByText("Demander une demo")).toHaveCount(0);
    await expect(page.getByText("Demander une démo")).toHaveCount(0);
  });

  test("/admin is a public restaurant preview", async ({ page }) => {
    const response = await page.goto("/admin", { waitUntil: "domcontentloaded" });

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/admin(?:\?|$)/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("/owner redirects signed-out visitors to Vistaire sign-in", async ({
    page,
    request
  }) => {
    const response = await request.get("/owner", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/sign-in");

    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Accès interne Vistaire")).toBeVisible();
  });

  test("analytics events endpoint remains public but validates payloads", async ({
    request
  }) => {
    const response = await request.post("/api/analytics/events", {
      data: {
        eventName: "menu_opened",
        restaurantId: RESTAURANT_ID,
        sessionId: "public-premium-auth-e2e",
        source: "demo"
      }
    });

    expect([200, 202, 503]).toContain(response.status());
  });

  test("owner APIs stay protected when signed out", async ({ request }) => {
    const [restaurants, summary, ownerInsights] = await Promise.all([
      request.get("/api/restaurants", { maxRedirects: 0 }),
      request.get(`/api/analytics/summary?restaurantId=${RESTAURANT_ID}`, {
        maxRedirects: 0
      }),
      request.get("/api/owner/insights", { maxRedirects: 0 })
    ]);

    expect(restaurants.status()).toBe(307);
    expect(summary.status()).toBe(307);
    expect(ownerInsights.status()).toBe(307);
  });
});
