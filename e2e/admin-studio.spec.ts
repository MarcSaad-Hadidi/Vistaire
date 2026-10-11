import { test, expect, type Page } from "@playwright/test";

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)
  test.use({
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  });
async function preview(page: Page) {
  await page.goto("/admin");
  const origin = new URL(page.url()).origin;
  const response = await page.context().request.post(`${origin}/admin/preview`, {
    headers: { Origin: origin },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  await page.goto("/admin");
  await expect(page.locator("[data-admin-studio]")).toBeVisible();
}
for (const width of [390, 430, 1440])
  test(`studio four destinations, theme, evidence and export cancellation at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const badResponses: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 500)
        badResponses.push(
          `${response.status()} ${new URL(response.url()).pathname}`,
        );
    });
    await preview(page);
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link")).toHaveCount(4);
    for (const name of ["Vue d’ensemble", "Analyses", "Les plats", "Planning"])
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Vue d’ensemble",
    );
    await expect(
      page.locator('[data-studio-chart="trend"] svg').first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Passer au thème sombre" }).click();
    await expect(page.locator("[data-admin-studio]")).toHaveAttribute(
      "data-theme",
      "dark",
    );
    await page
      .getByRole("button", { name: "Consultations de plats", exact: false })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`vistaire-studio-overview-dark-${width}.png`),
      fullPage: true,
    });
    for (const name of ["Analyses", "Les plats", "Planning"]) {
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
      const exporter = page.getByRole("button", {
        name: "Exporter",
        exact: true,
      });
      await exporter.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(exporter).toBeFocused();
      await page.screenshot({
        path: testInfo.outputPath(
          `vistaire-studio-${name.replaceAll(" ", "-")}-dark-${width}.png`,
        ),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await nav.getByRole("link", { name: "Les plats", exact: true }).click();
    await expect(
      page.getByText("Accès en lecture seule.", { exact: false }),
    ).toBeVisible();
    for (const input of await page.getByRole("switch").all())
      await expect(input).toBeDisabled();
    await page
      .getByRole("searchbox", { name: "Rechercher un plat" })
      .fill("no-such-dish");
    await expect(page.getByText("Aucun plat trouvé")).toBeVisible();
    await page.getByRole("button", { name: "Effacer les filtres" }).click();
    await expect(page.locator("[data-dish-id]").first()).toBeVisible();
    await expect(
      page
        .getByRole("button", { name: "Déconnexion", exact: true })
        .filter({ visible: true }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Passer au thème clair" }).click();
    await page.screenshot({
      path: testInfo.outputPath(`vistaire-studio-${width}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(badResponses).toEqual([]);
  });
test("studio downloads all four real formats without leaving the private page", async ({
  page,
}) => {
  await preview(page);
  for (const format of ["JSON", "CSV", "Excel", "PDF"]) {
    await page.getByRole("button", { name: "Exporter", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: new RegExp(format) }).check();
    const download = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: new RegExp(`Télécharger ${format}`) })
      .click();
    const file = await download;
    await file.saveAs(`/tmp/${file.suggestedFilename()}`);
    expect(await file.failure()).toBeNull();
    if (await dialog.count()) await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/admin(?:\?|$)/);
  }
});
