import { expect, test, type Page } from "@playwright/test";

const TROUVABLE_HREF =
  "https://search.google.com/local/writereview?placeid=ChIJTrouvableDemoVistaire";
const MAISON_ELYSE_HREF =
  "https://search.google.com/local/writereview?placeid=ChIJMaisonElyseDemoVistaire";

const VIEWPORTS = [
  { name: "390px", size: { width: 390, height: 844 } },
  { name: "430px", size: { width: 430, height: 932 } },
  { name: "desktop", size: { width: 1280, height: 800 } }
];

async function assertNoLocalReviewForm(page: Page) {
  await expect(page.locator("textarea")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Publier l'avis|POST REVIEW/i })).toHaveCount(0);
  await expect(page.locator("[class*='reviewStars']")).toHaveCount(0);
  await expect(page.locator("[class*='reviewTextarea']")).toHaveCount(0);
  await expect(page.locator("[data-google-review-trigger='true']")).toHaveCount(0);
}

async function assertDirectGoogleCta(page: Page, href: string) {
  const cta = page.locator("[data-google-review-action='true']");
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", href);
  await expect(cta).toHaveAttribute("target", "_blank");
  await expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  await expect(cta).toHaveRole("link");
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

async function clickCtaWithoutLeaving(page: Page) {
  await page.evaluate(() => {
    window.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("[data-google-review-action='true']")) {
          event.preventDefault();
        }
      },
      true
    );
  });

  const popupPromise = page.waitForEvent("popup", { timeout: 750 }).catch(() => null);
  await page.locator("[data-google-review-action='true']").click();
  const popup = await popupPromise;
  if (popup) {
    await popup.close();
    throw new Error("Google Review CTA opened a popup despite click interception");
  }
  await expect(page).not.toHaveURL(/search\.google\.com|g\.page/);
}

test.describe("Google Review direct CTA", () => {
  for (const viewport of VIEWPORTS) {
    test(`Trouvable opens Google directly at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport.size);
      await page.goto("/menu/trouvable?lang=fr-CA", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("region", { name: /Carte Trouvable|Trouvable menu/i })
      ).toBeVisible();

      await page.locator("[data-google-review-card='true']").scrollIntoViewIfNeeded();
      await assertNoLocalReviewForm(page);
      await assertDirectGoogleCta(page, TROUVABLE_HREF);
      await expectNoHorizontalOverflow(page);
      await clickCtaWithoutLeaving(page);
    });

    test(`Maison Elyse opens Google directly at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport.size);
      await page.goto("/menu/maison-elyse?lang=fr-CA", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { exact: true, name: "LA CARTE" })).toBeVisible();

      await page.locator("[data-google-review-card='true']").scrollIntoViewIfNeeded();

      await assertNoLocalReviewForm(page);
      await assertDirectGoogleCta(page, MAISON_ELYSE_HREF);
      await expectNoHorizontalOverflow(page);
      await clickCtaWithoutLeaving(page);
    });
  }

  test("Trouvable English copy stays on the direct Google CTA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/menu/trouvable?lang=en-CA", { waitUntil: "domcontentloaded" });
    await page.locator("[data-google-review-card='true']").scrollIntoViewIfNeeded();

    await expect(page.getByRole("heading", { name: "Your experience matters" })).toBeVisible();
    await expect(page.getByText("Share your experience directly on Google.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Leave a Google review/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Votre expérience compte" })).toHaveCount(0);
    await assertNoLocalReviewForm(page);
    await assertDirectGoogleCta(page, TROUVABLE_HREF);
  });

  test("Trouvable dish detail uses the shared direct Google CTA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/menu/trouvable/dishes/dejeuner-classique-maison?lang=fr-CA", {
      waitUntil: "domcontentloaded"
    });
    await page.locator("[data-google-review-card='true']").scrollIntoViewIfNeeded();
    await assertNoLocalReviewForm(page);
    await assertDirectGoogleCta(page, TROUVABLE_HREF);
  });
});
