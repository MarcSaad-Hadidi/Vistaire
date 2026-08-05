import { expect, test } from "@playwright/test";

test("PDF versus digital menu keeps its accessible restaurant switcher and comparison slider", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/menu-pdf-vs-menu-digital", {
    waitUntil: "domcontentloaded"
  });

  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("tablist")).toBeVisible();
  await page.waitForTimeout(250);
  expect(pageErrors).toEqual([]);

  const trouvableTab = page.getByRole("tab", { name: "Trouvable" });
  await trouvableTab.click();
  await expect(trouvableTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-active-preview="trouvable"]')).toBeVisible();

  const slider = page.getByRole("slider");
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "54");
  await expect(slider).toHaveAttribute("aria-valuetext", /54 pour cent PDF/);
  expect(
    await page.locator("html").evaluate(
      (element) => element.scrollWidth - element.clientWidth <= 2
    )
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("digital restaurant menu keeps the circular reveal lock and Escape reset", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 430, height: 932 });
  const response = await page.goto("/menu-digital-restaurant", {
    waitUntil: "domcontentloaded"
  });

  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator("h1")).toHaveCount(1);
  await page.waitForTimeout(250);
  expect(pageErrors).toEqual([]);
  const saugeTab = page.getByRole("tab", { name: "Sauge Noire" });
  await saugeTab.click();
  await expect(saugeTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-active-preview="sauge-noire"]')).toBeVisible();

  const reveal = page.locator('[data-preview-reveal-frame="true"]');
  await reveal.focus();
  await reveal.press("Enter");
  await expect(reveal).toHaveAttribute("data-reveal-locked", "true");
  await reveal.press("Escape");
  await expect(reveal).toHaveAttribute("data-reveal-locked", "false");
  await expect(reveal).toHaveAttribute("style", /pan-y pinch-zoom/);
  expect(
    await page.locator("html").evaluate(
      (element) => element.scrollWidth - element.clientWidth <= 2
    )
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});
