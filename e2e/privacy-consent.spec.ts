import { expect, test } from "@playwright/test";
import {
  PRIVACY_CONSENT_STORAGE_KEY,
  VISTAIRE_ANALYTICS_SESSION_KEY
} from "../lib/privacy/consent";
import { privacyEmptyStorageState } from "./support/privacy-consent";

test.use({ storageState: privacyEmptyStorageState() });

test("fresh visitors can refuse, accept, and revoke optional analytics", async ({
  page
}) => {
  const clarityRequests: string[] = [];
  const analyticsRequests: string[] = [];

  await page.route("https://www.clarity.ms/**", (route) => route.abort());
  page.on("request", (request) => {
    if (request.url().includes("clarity.ms/")) clarityRequests.push(request.url());
    if (new URL(request.url()).pathname === "/api/analytics/events") {
      analyticsRequests.push(request.url());
    }
  });

  await page.goto("/menu/maison-elyse?table=12&zone=terrasse", {
    waitUntil: "networkidle"
  });
  const banner = page.getByTestId("privacy-consent");
  await expect(banner).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), PRIVACY_CONSENT_STORAGE_KEY)
  ).toBeNull();
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      VISTAIRE_ANALYTICS_SESSION_KEY
    )
  ).toBeNull();
  expect(clarityRequests).toEqual([]);
  expect(analyticsRequests).toEqual([]);

  await page.evaluate((key) => sessionStorage.setItem(key, "pre-consent-sentinel"), VISTAIRE_ANALYTICS_SESSION_KEY);
  await banner.getByRole("button", { name: "Tout refuser" }).click();
  await expect(banner).toBeHidden();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), PRIVACY_CONSENT_STORAGE_KEY)
  ).toEqual({ version: 1, analytics: false });
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      VISTAIRE_ANALYTICS_SESSION_KEY
    )
  ).toBeNull();

  await page.getByRole("button", { name: "Préférences de confidentialité" }).click();
  await expect(banner).toBeVisible();
  const analyticsToggle = banner.getByRole("checkbox");
  await analyticsToggle.check();
  await banner.getByRole("button", { name: "Enregistrer mes choix" }).click();
  await expect(banner).toBeHidden();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), PRIVACY_CONSENT_STORAGE_KEY)
  ).toEqual({ version: 1, analytics: true });

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("privacy-consent")).toHaveCount(0);
  expect(analyticsRequests.length).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      (key) => Boolean(sessionStorage.getItem(key)),
      VISTAIRE_ANALYTICS_SESSION_KEY
    )
  ).toBe(true);

  await page.getByRole("button", { name: "Préférences de confidentialité" }).click();
  const revokeToggle = page.getByTestId("privacy-consent").getByRole("checkbox");
  await revokeToggle.uncheck();
  await page.getByTestId("privacy-consent").getByRole("button", { name: "Enregistrer mes choix" }).click();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), PRIVACY_CONSENT_STORAGE_KEY)
  ).toEqual({ version: 1, analytics: false });
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      VISTAIRE_ANALYTICS_SESSION_KEY
    )
  ).toBeNull();

  const requestsBeforeReload = analyticsRequests.length;
  const clarityRequestsBeforeReload = clarityRequests.length;
  await page.reload({ waitUntil: "networkidle" });
  expect(analyticsRequests.length).toBe(requestsBeforeReload);
  expect(clarityRequests.length).toBe(clarityRequestsBeforeReload);
});
