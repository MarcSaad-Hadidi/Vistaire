import { expect, test } from "@playwright/test";

// The public PDF routes now use PdfMenuCinematic; the retired slider is absent.
for (const profile of [
  { path: "/menu-pdf-vs-menu-digital", width: 390, height: 844, menu: "/demo" },
  { path: "/en/pdf-vs-digital-menu", width: 430, height: 932, menu: "/en/vistaire-menu" },
  { path: "/menu-pdf-vs-menu-digital", width: 1440, height: 900, menu: "/demo" },
]) {
  test(`${profile.path} presents the PDF-to-digital journey at ${profile.width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto(profile.path, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    const canvas = page.locator(".scene-canvas");
    await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await expect(page.locator(".preloader")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    for (const [id, shot] of [["pdf-versus", "pdf-compare"], ["pdf-dish", "pdf-dish"]]) {
      const chapter = page.locator(`#${id}`);
      await chapter.evaluate(element => {
        const travel = element.getBoundingClientRect().height - element.firstElementChild!.clientHeight;
        scrollTo({ top: element.getBoundingClientRect().top + scrollY + travel / 2, behavior: "instant" });
      });
      await expect(canvas).toHaveAttribute("data-section", shot);
      await expect(chapter).not.toHaveAttribute("inert");
      await expect(chapter.getByRole("heading").first()).toBeInViewport();
    }
    expect(await page.locator("#pdf-versus .cinematic-compare dt").count()).toBeGreaterThan(0);
    await expect(page.locator("#pdf-dish .cinematic-actions a")).toHaveAttribute("href", profile.menu);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
