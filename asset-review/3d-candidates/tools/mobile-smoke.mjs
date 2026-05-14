import { chromium, devices } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["iPhone 14 Pro"],
});
const page = await context.newPage();
const consoleMessages = [];
page.on("console", (message) => consoleMessages.push({ type: message.type(), text: message.text() }));

const result = {
  route: "http://localhost:3000/demo/dishes/homard-bisque",
  hasTouch: true,
  steps: [],
  consoleMessages,
};

try {
  await page.goto(result.route, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: "Voir en 3D" }).click();
  const viewer = page.locator("model-viewer");
  await viewer.waitFor({ state: "visible", timeout: 90_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector("model-viewer");
    return Boolean(el && el.loaded);
  }, { timeout: 90_000 });
  result.steps.push("model-viewer loaded");

  const arLink = page.getByRole("link", { name: "Afficher devant moi" });
  result.arLinkVisible = await arLink.isVisible({ timeout: 5_000 }).catch(() => false);
  result.arHref = result.arLinkVisible ? await arLink.getAttribute("href") : null;

  const box = await viewer.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.48, { steps: 8 });
    await page.mouse.up();
    result.steps.push("simulated drag over model-viewer");
  }

  const beforeScroll = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollBy(0, 420));
  await page.waitForTimeout(300);
  const afterScroll = await page.evaluate(() => window.scrollY);
  result.scrollOutsideViewerChanged = afterScroll > beforeScroll;
  result.steps.push("page scroll outside viewer checked");

  result.resourceUrls = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /models\/demo|candidate|review|lite|raw|backup/.test(name)),
  );
  result.ok = true;
} catch (error) {
  result.ok = false;
  result.error = error instanceof Error ? error.message : String(error);
} finally {
  await context.close();
  await browser.close();
}

await writeFile(
  resolve(ROOT, "asset-review/3d-candidates/visual-qa/mobile-smoke-results.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
