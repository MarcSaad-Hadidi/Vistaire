import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const output = "artifacts/public-pages";
await mkdir(output, { recursive: true });
const server = await createServer({
  server: { host: "127.0.0.1", port: 5183, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.VISTAIRE_QA_CHROMIUM,
  ignoreDefaultArgs: [
    "--enable-unsafe-swiftshader",
    "--unsafely-disable-devtools-self-xss-warnings",
  ],
});
const results = [];
const failures = [];
const interactions = [];
const captureRoutes = new Map([
  ["/a-propos", "about"],
  ["/contact", "contact"],
  ["/prendre-rendez-vous", "booking"],
  ["/tarifs-menu-digital-restaurant", "pricing"],
  ["/demo", "menus"],
  ["/apercu-restaurateur", "dashboard"],
  ["/menu-pdf-vs-menu-digital", "comparison"],
  ["/guides/anatomie-menu-digital-premium", "guide"],
  ["/menu-digital-restaurant-montreal", "local"],
  ["/en", "english"],
]);
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 430, height: 900 },
  ]) {
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 600,
      hasTouch: viewport.width < 600,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    let errors = [];
    let requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        requests.push(`${response.status()} ${response.url()}`);
    });
    await page.goto("http://127.0.0.1:5183/a-propos");
    await page.locator("[data-public-vistaire] h1").waitFor();
    const paths = await page.evaluate(async () => {
      const module = await import("/src/pages/PublicPageRouter.jsx");
      return module.publicPagePaths;
    });
    for (const route of paths) {
      errors = [];
      requests = [];
      await page.goto(`http://127.0.0.1:5183${route}`);
      await page.locator("[data-public-vistaire] h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      const view = await page.evaluate(async () => {
        // Exercise native page scrolling and trigger every lazy image.
        for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
          scrollTo({ top: y, behavior: "instant" });
          await new Promise(requestAnimationFrame);
        }
        await Promise.all(
          [...document.images].map((image) => image.decode().catch(() => {})),
        );
        scrollTo({ top: 0, behavior: "instant" });
        const root = document.querySelector("[data-public-vistaire]");
        return {
          h1: document.querySelector("h1")?.textContent,
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          color: getComputedStyle(root).color,
          background: getComputedStyle(root).backgroundColor,
          language: document.documentElement.lang,
          brokenImages: [...document.images]
            .filter((image) => !image.naturalWidth)
            .map((image) => image.getAttribute("src")),
          badLinks: [...document.querySelectorAll("a[href]")]
            .map((link) => link.getAttribute("href"))
            .filter((href) =>
              /(?:undefined|localhost|terminal\.local)/.test(href),
            ),
        };
      });
      const result = { route, viewport, ...view, errors, requests };
      results.push(result);
      if (
        view.scrollWidth > viewport.width ||
        /Page introuvable|Page not found/.test(view.h1) ||
        view.brokenImages.length ||
        view.badLinks.length ||
        errors.length ||
        requests.length
      )
        failures.push(result);
      const label = captureRoutes.get(route);
      if (label && viewport.width !== 430) {
        await page.screenshot({
          path: `${output}/${viewport.width}-${label}.png`,
        });
        if (route === "/apercu-restaurateur" && viewport.width === 1440) {
          // Make the whole real panel visible below the sticky navigation;
          // capture a 16:10 excerpt without moving or redrawing its UI.
          await page.setViewportSize({ width: 1440, height: 1800 });
          const panel = page.locator("section[class*='dashboardDemo']");
          await panel.evaluate((element) => {
            scrollTo({
              top: element.getBoundingClientRect().top + scrollY - 120,
              behavior: "instant",
            });
          });
          const box = await panel.boundingBox();
          await page.screenshot({
            path: `${output}/dashboard-screen.png`,
            clip: {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.width / 1.6,
            },
          });
          await page.setViewportSize(viewport);
        }
      }
    }
    if (viewport.width !== 430) {
      await page.goto("http://127.0.0.1:5183/prendre-rendez-vous");
      await page.getByRole("button", { name: "Préparer ma demande" }).click();
      assert.equal(await page.locator('[aria-invalid="true"]').count(), 4);
      for (const [name, value] of Object.entries({
        Nom: "Test local",
        Courriel: "test@example.com",
        Restaurant: "Restaurant de démonstration",
        Message: "Vérification locale du formulaire, sans envoi.",
      }))
        await page.getByLabel(name, { exact: true }).fill(value);
      await page.getByRole("button", { name: "Préparer ma demande" }).click();
      const draft = await page
        .getByRole("link", { name: "Ouvrir le courriel préparé" })
        .getAttribute("href");
      assert.match(draft, /^mailto:contact@vistaire\.ca\?/);
      assert.equal(await page.locator('[aria-invalid="true"]').count(), 0);

      await page.goto("http://127.0.0.1:5183/apercu-restaurateur");
      await page.locator('[data-demo-period="7d"]').click();
      assert.equal(
        await page
          .locator('[data-demo-period="7d"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      await page.getByRole("tab", { name: "Disponibilités" }).click();
      assert.equal(await page.locator("[data-demo-dish]").count(), 12);
      await page.getByRole("searchbox").fill("Homard");
      assert.equal(await page.locator("[data-demo-dish]").count(), 1);
      const toggle = page.locator("[data-demo-dish]").getByRole("switch");
      const before = await toggle.getAttribute("aria-checked");
      await toggle.click();
      assert.notEqual(await toggle.getAttribute("aria-checked"), before);
      await page.getByRole("tab", { name: "Analyses" }).click();
      await page.locator("[data-chart-kind]").first().waitFor();

      await page.goto("http://127.0.0.1:5183/tarifs-menu-digital-restaurant");
      await page
        .getByRole("button", { name: "Augmenter le nombre de tables" })
        .click();
      assert.equal(
        await page.locator("[data-pricing-table-input]").inputValue(),
        "21",
      );
      assert.equal(
        await page
          .locator('[data-pricing-collection][data-table-count="21"]')
          .count(),
        4,
      );
      await page
        .getByRole("button", { name: "Réduire le nombre de tables" })
        .click();
      assert.equal(
        await page.locator("[data-pricing-table-input]").inputValue(),
        "20",
      );

      await page.goto("http://127.0.0.1:5183/menu-pdf-vs-menu-digital");
      await page.locator(".public-tabs").waitFor();
      const comparisonTabs = page.locator(".public-tabs").getByRole("tab");
      assert.equal(await comparisonTabs.count(), 3);
      await comparisonTabs.nth(1).click();
      assert.equal(
        await comparisonTabs.nth(1).getAttribute("aria-selected"),
        "true",
      );
      const slider = page.getByRole("slider");
      await slider.press("Home");
      await expect(slider).toHaveAttribute("aria-valuenow", "0");
      await slider.press("End");
      await expect(slider).toHaveAttribute("aria-valuenow", "100");
      interactions.push({
        viewport,
        booking: "validated draft; no send",
        dashboard: "period, tabs, search, local toggle, charts",
        pricing: "four cards follow table quantity",
        comparison: "restaurant tabs; keyboard 0–100",
      });
    }
    await context.close();
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      { checked: results.length, failures, interactions, results },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { checked: results.length, failures, interactions },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
