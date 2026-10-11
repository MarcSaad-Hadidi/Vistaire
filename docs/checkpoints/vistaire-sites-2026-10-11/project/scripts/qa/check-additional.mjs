import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
const root = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(root + "/package.json");
const { chromium } = require("@playwright/test");
const { createServer } = await import(
  root + "/node_modules/vite/dist/node/index.js"
);
const dir = root + "/docs/validation/revision";
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port: 5177, strictPort: true },
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
const results = [];
try {
  for (const [mode, width, height] of [
    ["compact", 1000, 765],
    ["wide", 1697, 750],
    ["mobile430", 430, 900],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "reduce",
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5177");
    await page
      .locator(".scene-canvas[data-ready=true]")
      .waitFor({ timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    for (const id of [
      "hero",
      "ai",
      "wearable",
      "features",
      "encryption",
      "grip",
      "sustainability",
      "testimonies",
      "social-content",
      "product",
      "open-weight",
      "footer",
    ]) {
      await page
        .locator("#" + id)
        .evaluate((el) =>
          scrollTo({
            top:
              el.offsetTop +
              Math.max(0, el.offsetHeight - el.firstElementChild.clientHeight) *
                0.4,
            behavior: "instant",
          }),
        );
      await page.waitForFunction(
        (id) =>
          document.querySelector(".scene-canvas").dataset.section === id &&
          document.querySelector(".scene-canvas").dataset.settled === "true",
        id,
        { timeout: 45000 },
      );
      const record = await page.locator("#" + id).evaluate((el) => {
        const c = document.querySelector(".scene-canvas"),
          f = el.querySelector(".scene-focus");
        const rect = (e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        return {
          id: el.id,
          viewport: [innerWidth, innerHeight],
          scrollWidth: document.documentElement.scrollWidth,
          model: c.dataset.subjectBounds
            ? JSON.parse(c.dataset.subjectBounds)
            : null,
          focus: f ? rect(f) : null,
          heading: rect(el.querySelector("h1,h2")),
          stage: rect(el.firstElementChild),
        };
      });
      if (record.scrollWidth > width)
        throw Error(mode + " " + id + " horizontaloverflow");
      if (record.focus && record.model) {
        const f = record.focus,
          m = record.model;
        if (
          m.x < f.x - 2 ||
          m.y < f.y - 2 ||
          m.x + m.width > f.x + f.width + 2 ||
          m.y + m.height > f.y + f.height + 2
        )
          throw Error(mode + " " + id + " modeloutsidefocus");
      }
      results.push({ mode, ...record });
      await page.screenshot({
        path: root + "/artifacts/" + mode + "-" + id + ".png",
      });
    }
    if (errors.length) throw Error(JSON.stringify(errors));
    await page.close();
    console.log("Verified", mode);
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    isMobile: true,
    hasTouch: true,
  });
  await page.addInitScript(() => {
    const old = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function (token) {
      return token === "ar" ? true : old.call(this, token);
    };
  });
  await page.goto("http://127.0.0.1:5177/?dish=sushi#grip");
  await page
    .locator(".scene-canvas[data-ready=true]")
    .waitFor({ timeout: 90000 });
  const ids = [
    "homard",
    "souffle",
    "huitres",
    "sushi",
    "chocolat-fume",
    "poutine",
    "burger",
  ];
  for (const id of ids) {
    await page.locator(".dish-switch button").evaluateAll((buttons, id) => {
      const ids = [
        "homard",
        "souffle",
        "huitres",
        "sushi",
        "chocolat-fume",
        "poutine",
        "burger",
      ];
      buttons[ids.indexOf(id)].click();
    }, id);
    await page.waitForFunction(
      (id) =>
        document.querySelector("#grip a[rel=ar]")?.getAttribute("href") ===
        "/assets/ar/" + id + ".usdz",
      id,
    );
    const a = page.locator("#grip a[rel=ar]");
    if ((await a.evaluate((x) => x.firstElementChild.tagName)) !== "IMG")
      throw Error("Missing QuickLookimage");
  }
  results.push({
    routeTest:
      "iOS capability simulation only, all7nativeanchors/firstimage andselecteddeeplink verified; no nativecamera",
  });
  await page.close();
  await fs.writeFile(
    dir + "/additional-viewports.json",
    JSON.stringify(results, null, 2) + "\n",
  );
} catch (e) {
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
