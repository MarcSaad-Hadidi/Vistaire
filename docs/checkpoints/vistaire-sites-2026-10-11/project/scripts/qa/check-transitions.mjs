import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
const root = fileURLToPath(new URL("../..", import.meta.url));
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port: 5178, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.VISTAIRE_QA_CHROMIUM ||
    "/workspace/scratch/51ebef2040ae/.browser-tools/runtime/chromium",
  headless: true,
  ignoreDefaultArgs: [
    "--enable-unsafe-swiftshader",
    "--unsafely-disable-devtools-self-xss-warnings",
  ],
});
const samples = [];
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    await page.goto("http://127.0.0.1:5178");
    await page
      .locator(".scene-canvas[data-ready=true]")
      .waitFor({ timeout: 90000 });
    for (const id of [
      "ai",
      "wearable",
      "features",
      "encryption",
      "grip",
      "sustainability",
      "product",
    ]) {
      await page
        .locator("#" + id)
        .evaluate((el) =>
          scrollTo({ top: el.offsetTop + 2, behavior: "instant" }),
        );
      await page.waitForFunction(
        (id) => document.querySelector(".scene-canvas")?.dataset.section === id,
        id,
      );
      for (let i = 0; i < 3; i++) {
        const sample = await page.evaluate(() => {
          const c = document.querySelector(".scene-canvas");
          return {
            section: c.dataset.section,
            settled: c.dataset.settled,
            model: JSON.parse(c.dataset.subjectBounds),
            focus: JSON.parse(c.dataset.focusBounds),
          };
        });
        const { model: m, focus: f } = sample;
        if (
          m.x < f.x - 2 ||
          m.y < f.y - 2 ||
          m.x + m.width > f.x + f.width + 2 ||
          m.y + m.height > f.y + f.height + 2
        )
          throw Error("Transition escaped focus " + id + " " + width);
        samples.push({ width, height, ...sample });
        await page.waitForTimeout(90);
      }
    }
    await page.close();
    console.log("Transition bounds passed", width);
  }
  await fs.writeFile(
    root + "/docs/validation/revision/transitions.json",
    JSON.stringify(samples, null, 2) + "\n",
  );
} finally {
  await browser.close();
  await server.close();
}
