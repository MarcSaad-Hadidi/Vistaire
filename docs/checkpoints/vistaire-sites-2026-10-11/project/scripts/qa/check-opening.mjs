import { createServer } from "vite";
import { chromium, expect as browserExpect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { dishes } from "../../src/content.js";
import { getDishHref } from "../../src/dishDestinations.js";
const expect = browserExpect.configure({ timeout: 45000 });
const root = fileURLToPath(new URL("../..", import.meta.url));
const out =
  process.env.VISTAIRE_OPENING_EVIDENCE || `${root}/artifacts/opening`;
await fs.mkdir(out, { recursive: true });
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
const results = [];
let activePage;
async function capture(page, path, freezePhone = false) {
  if (freezePhone) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path, type: "jpeg", quality: 92, timeout: 60000 });
  if (freezePhone) await page.emulateMedia({ reducedMotion: "reduce" });
}
try {
  for (const [width, height, dpr] of [
    [390, 844, 3],
    [1440, 900, 1],
    [430, 900, 3],
  ].filter(
    ([w]) =>
      !process.env.VISTAIRE_QA_ONLY_WIDTH ||
      w === Number(process.env.VISTAIRE_QA_ONLY_WIDTH),
  )) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      isMobile: width < 768,
      hasTouch: width < 768,
      reducedMotion: "reduce",
    });
    activePage = page;
    page.setDefaultTimeout(20000);
    const section = async (id, p = 0.35) => {
      await page.locator(`#${id}`).evaluate(
        (el, p) =>
          scrollTo({
            top:
              el.getBoundingClientRect().top +
              scrollY +
              Math.max(1, el.offsetHeight - el.firstElementChild.clientHeight) *
                p,
            behavior: "instant",
          }),
        p,
      );
      await expect(canvas).toHaveAttribute("data-section", id);
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-progress")), {
          timeout: 30000,
        })
        .toBeCloseTo(p, 1);
      await expect(canvas).toHaveAttribute("data-settled", "true", {
        timeout: 45000,
      });
    };
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("http://127.0.0.1:5178/");
    const canvas = page.locator(".scene-canvas");
    await expect(canvas).toHaveAttribute("data-ready", "true", {
      timeout: 90000,
    });
    await page.evaluate(() => document.fonts.ready);
    const samples = [];
    for (const p of [0, 0.2, 0.35, 0.5, 0.56, 0.8, 0.95, 1]) {
      console.log("Sample", width, p);
      await page.locator(".opening-journey").evaluate(
        (el, p) =>
          scrollTo({
            top:
              el.getBoundingClientRect().top +
              scrollY +
              (el.offsetHeight - el.firstElementChild.clientHeight) * p,
            behavior: "instant",
          }),
        p,
      );
      await page.waitForFunction(
        (p) =>
          Math.abs(
            Number(
              document.querySelector(".scene-canvas").dataset.openingProgress,
            ) - p,
          ) < 0.002,
        p,
      );
      await expect(canvas).toHaveAttribute("data-settled", "true", {
        timeout: 45000,
      });
      const sample = await canvas.evaluate((c) => {
        const parse = (key) =>
          c.dataset[key] ? JSON.parse(c.dataset[key]) : null;
        return {
          progress: Number(c.dataset.openingProgress),
          opacity: Number(c.dataset.dishOpacity),
          phone: parse("phoneBounds"),
          support: parse("supportBounds"),
          dish: parse("dishBounds"),
          focus: parse("focusBounds"),
          subjects: parse("subjectBounds"),
          phonePosition: c.dataset.phonePosition.split(",").map(Number),
          supportPosition: c.dataset.supportPosition.split(",").map(Number),
          buffer: [c.width, c.height],
        };
      });
      const b = sample.subjects,
        f = sample.focus;
      expect(b.x).toBeGreaterThanOrEqual(f.x - 2);
      expect(b.y).toBeGreaterThanOrEqual(f.y - 2);
      expect(b.x + b.width).toBeLessThanOrEqual(f.x + f.width + 2);
      expect(b.y + b.height).toBeLessThanOrEqual(f.y + f.height + 2);
      if (p === 0) {
        expect(sample.phone.width).toBeGreaterThan(30);
        expect(sample.support.width).toBeGreaterThan(40);
        expect(sample.dish.width).toBeGreaterThan(80);
        expect(sample.buffer).toEqual([width * dpr, height * dpr]);
      }
      if (samples.length)
        expect(sample.opacity).toBeLessThanOrEqual(samples.at(-1).opacity);
      if ([0, 0.35, 0.56, 0.95].includes(p))
        await capture(page, `${out}/${width}-opening-${p}.jpg`, p >= 0.3);
      samples.push(sample);
    }
    expect(samples[0].opacity).toBe(1);
    expect(samples.at(-1).opacity).toBe(0);
    expect(
      samples.find((s) => s.progress > 0.55 && s.progress < 0.57)
        .phonePosition[1],
    ).toBeGreaterThan(samples[0].phonePosition[1]);
    const before = await page.evaluate(() => scrollY);
    if (width >= 768) {
      await page.mouse.wheel(0, -240);
    } else {
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 195, y: 350 }],
      });
      for (let y = 390; y <= 550; y += 40)
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: 195, y }],
        });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await session.detach();
    }
    await page.waitForFunction((before) => scrollY < before - 20, before);
    // Wait for native touch momentum to finish before a scripted seek.
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          addEventListener("scrollend", resolve, { once: true });
          setTimeout(resolve, 2000);
        }),
    );
    // Reverse the exact opening and verify the plate returns progressively.
    for (const p of [0.8, 0.56, 0.35, 0.2, 0]) {
      await page.locator(".opening-journey").evaluate(
        (el, p) =>
          scrollTo({
            top: (el.offsetHeight - el.firstElementChild.clientHeight) * p,
            behavior: "instant",
          }),
        p,
      );
      await page.waitForFunction(
        (p) =>
          Math.abs(
            Number(
              document.querySelector(".scene-canvas").dataset.openingProgress,
            ) - p,
          ) < 0.002,
        p,
      );
      await expect(canvas).toHaveAttribute("data-settled", "true", {
        timeout: 45000,
      });
      await expect
        .poll(() => canvas.getAttribute("data-dish-opacity"), {
          timeout: 30000,
        })
        .toBe(
          samples
            .find((s) => Math.abs(s.progress - p) < 0.002)
            .opacity.toFixed(4),
        );
    }
    console.log("Opening and upward scroll passed", width);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const laptop = [];
    await expect(canvas).toHaveAttribute("data-laptop-ready", "true", {
      timeout: 60000,
    });
    for (const p of [0, 0.3, 0.75]) {
      console.log("Laptop seek", width, p);
      await section("sustainability", p);
      const data = await canvas.evaluate((c) => ({
        angle: Number(c.dataset.laptopAngle),
        bounds: JSON.parse(c.dataset.laptopBounds),
        focus: JSON.parse(c.dataset.focusBounds),
      }));
      expect(data.bounds.width).toBeGreaterThan(100);
      expect(data.bounds.x).toBeGreaterThanOrEqual(data.focus.x - 2);
      expect(data.bounds.y).toBeGreaterThanOrEqual(data.focus.y - 2);
      expect(data.bounds.x + data.bounds.width).toBeLessThanOrEqual(
        data.focus.x + data.focus.width + 2,
      );
      expect(data.bounds.y + data.bounds.height).toBeLessThanOrEqual(
        data.focus.y + data.focus.height + 2,
      );
      laptop.push({ p, ...data });
      await page.screenshot({
        path: `${out}/${width}-dashboard-${p}.jpg`,
        type: "jpeg",
        quality: 92,
      });
    }
    expect(laptop[0].angle).toBeLessThan(5);
    expect(laptop[1].angle).toBeGreaterThan(15);
    expect(laptop[2].angle).toBeGreaterThan(90);
    console.log("Laptop passed", width);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await section("footer");
    const footer = await canvas.evaluate((c) =>
      Object.fromEntries(
        ["phone", "support", "dish"].map((k) => [
          k,
          JSON.parse(c.dataset[k + "Bounds"]),
        ]),
      ),
    );
    for (const b of Object.values(footer)) expect(b.width).toBeGreaterThan(35);
    await capture(page, `${out}/${width}-footer.jpg`, true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    console.log("Footer passed", width);
    const food = [];
    for (const item of process.env.VISTAIRE_QA_QUICK
      ? dishes.filter((d) => d.id === "burger")
      : dishes) {
      console.log("Dish", width, item.id);
      await page.locator("#grip").evaluate((el) =>
        scrollTo({
          top: el.getBoundingClientRect().top + scrollY + 100,
          behavior: "instant",
        }),
      );
      await expect(canvas).toHaveAttribute("data-section", "grip");
      await page
        .locator(".dish-switch")
        .getByRole("button", {
          name: item.label,
          exact: true,
        })
        .click();
      await expect(page.locator("#grip .detail-link")).toHaveAttribute(
        "href",
        getDishHref(item),
      );
      await expect(page.locator("#grip .detail-link")).toHaveAttribute(
        "target",
        "_blank",
      );
      await expect(canvas).toHaveAttribute("data-model", item.id, {
        timeout: 60000,
      });
      await expect(canvas).toHaveAttribute("data-rendered-model", item.id, {
        timeout: 60000,
      });
      for (const id of ["features", "grip"]) {
        await page.locator(`#${id}`).evaluate((el) =>
          scrollTo({
            top:
              el.getBoundingClientRect().top +
              scrollY +
              Math.max(1, el.offsetHeight - el.firstElementChild.clientHeight) *
                0.35,
            behavior: "instant",
          }),
        );
        await expect(canvas).toHaveAttribute("data-section", id);
        await expect(canvas).toHaveAttribute("data-settled", "true", {
          timeout: 45000,
        });
        const b = await canvas.evaluate((c) =>
          JSON.parse(c.dataset.dishBounds),
        );
        expect(b.width).toBeLessThanOrEqual(
          width * (width < 768 ? 0.74 : 0.4) + 2,
        );
        food.push({ id: item.id, section: id, ...b });
        if (item.id === "burger")
          await page.screenshot({
            path: `${out}/${width}-burger-${id}.jpg`,
            type: "jpeg",
            quality: 92,
          });
      }
    }
    // Explicit zoom does not capture the native page pinch or vertical scroll.
    await section("grip");
    await page
      .getByRole("button", { name: "Recentrer le plat", exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-settled", "true", {
      timeout: 45000,
    });
    const baseWidth = await canvas.evaluate(
      (c) => JSON.parse(c.dataset.dishBounds).width,
    );
    for (let i = 0; i < 3; i++)
      await page
        .getByRole("button", { name: "Zoomer le plat", exact: true })
        .click();
    await expect(canvas).toHaveAttribute("data-settled", "true", {
      timeout: 45000,
    });
    const zoomWidth = await canvas.evaluate(
      (c) => JSON.parse(c.dataset.dishBounds).width,
    );
    expect(zoomWidth / baseWidth).toBeCloseTo(1.6, 1);
    console.log("Zoom passed", width);
    await page.screenshot({
      path: `${out}/${width}-zoom.jpg`,
      type: "jpeg",
      quality: 92,
    });
    await page
      .getByRole("button", { name: "Recentrer le plat", exact: true })
      .click();
    const gestures = [];
    if (width < 768) {
      const cdp = await page.context().newCDPSession(page);
      for (const id of ["grip", "product"]) {
        console.log("Native gestures", width, id);
        await section(id, 0.5);
        const control = page.locator(`#${id} .scene-focus`);
        const b = await control.boundingBox(),
          x = b.x + b.width / 2,
          y = b.y + b.height / 2;
        const start = await page.evaluate(() => scrollY);
        const value = await control.getAttribute("aria-valuenow");
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        await page.waitForTimeout(800);
        for (let i = 1; i <= 5; i++) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y - i * 22 }],
          });
          await page.waitForTimeout(40);
        }
        const down = await page.evaluate(() => scrollY);
        expect(down).toBeGreaterThan(start + 50);
        for (let i = 4; i >= -2; i--) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y - i * 22 }],
          });
          await page.waitForTimeout(40);
        }
        const up = await page.evaluate(() => scrollY);
        expect(up).toBeLessThan(down - 70);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        expect(await control.getAttribute("aria-valuenow")).toBe(value);
        expect(await page.evaluate(() => getSelection().toString())).toBe("");
        gestures.push({ id, start, down, up });
        await section(id, 0.5);
        const box = await control.boundingBox(),
          cy = box.y + box.height / 2,
          sx = box.x + box.width * 0.3;
        const scrollStart = await page.evaluate(() => scrollY);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: sx, y: cy }],
        });
        for (let i = 1; i <= 5; i++) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: sx + i * 20, y: cy }],
          });
          await page.waitForTimeout(40);
        }
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        expect(
          Number(await control.getAttribute("aria-valuenow")),
        ).toBeGreaterThan(Number(value) + 30);
        expect(
          Math.abs((await page.evaluate(() => scrollY)) - scrollStart),
        ).toBeLessThan(10);
      }
      await cdp.detach();
      console.log("Native hold, direction reversal and rotation passed", width);
    }
    let toolbarSimulation = null;
    if (width === 390) {
      // Simulate the large viewport being taller than the visible viewport.
      // This proves coordinate consistency; it does not emulate Safari UI.
      await page.locator(".world").evaluate((el) => {
        el.style.height = "924px";
      });
      await section("grip");
      console.log("Large viewport simulation", width);
      toolbarSimulation = await canvas.evaluate((c) => ({
        height: c.clientHeight,
        host: c.parentElement.clientHeight,
        world: document.querySelector(".world").clientHeight,
        bounds: JSON.parse(c.dataset.dishBounds),
        focus: JSON.parse(c.dataset.focusBounds),
      }));
      expect(toolbarSimulation.height).toBe(924);
      expect(toolbarSimulation.host).toBe(924);
      expect(toolbarSimulation.bounds.y).toBeGreaterThanOrEqual(
        toolbarSimulation.focus.y - 2,
      );
      expect(
        toolbarSimulation.bounds.y + toolbarSimulation.bounds.height,
      ).toBeLessThanOrEqual(
        toolbarSimulation.focus.y + toolbarSimulation.focus.height + 2,
      );
    }
    expect(errors).toEqual([]);
    let iosAnchors = [];
    if (width === 390) {
      await page.addInitScript(() =>
        Object.defineProperty(navigator, "userAgent", {
          get: () =>
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        }),
      );
      await page.goto("http://127.0.0.1:5178/?dish=homard#grip");
      await expect(canvas).toHaveAttribute("data-ready", "true", {
        timeout: 90000,
      });
      for (const item of dishes) {
        console.log("Native iOS anchor", width, item.id);
        await page
          .locator(".dish-switch")
          .getByRole("button", { name: item.label, exact: true })
          .click();
        const a = page.locator("#grip a[rel=ar]");
        await expect(a).toHaveAttribute("href", item.iosModel);
        const data = await a.evaluate((a) => ({
          href: a.getAttribute("href"),
          children: a.children.length,
          tag: a.firstElementChild.tagName,
          target: a.getAttribute("target"),
          download: a.hasAttribute("download"),
        }));
        expect(data.children).toBe(1);
        expect(data.tag).toBe("IMG");
        expect(data.target).toBe(null);
        expect(data.download).toBe(false);
        iosAnchors.push({ id: item.id, ...data });
      }
    }
    expect(errors).toEqual([]);
    results.push({
      width,
      height,
      dpr,
      samples,
      laptop,
      footer,
      food,
      zoom: { baseWidth, zoomWidth },
      gestures,
      toolbarSimulation,
      iosAnchors,
      errors,
    });
    console.log(
      `Opening, native scroll and ${food.length / 2} plate sizes passed: ${width} × ${height}, DPR ${dpr}`,
    );
    await page.close();
  }
  await fs.writeFile(
    `${out}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
} catch (error) {
  console.log("QA failure:", error.message);
  if (activePage) {
    const debug = await activePage
      .evaluate(() => ({
        scrollY,
        viewport: [innerWidth, innerHeight],
        canvas: { ...document.querySelector(".scene-canvas")?.dataset },
        chapters: [...document.querySelectorAll(".chapter")].map((el) => ({
          id: el.id,
          top: el.getBoundingClientRect().top + scrollY,
          height: el.offsetHeight,
          stage: el.firstElementChild.clientHeight,
        })),
      }))
      .catch((e) => ({ error: e.message }));
    console.log(JSON.stringify(debug));
    await fs.writeFile(`${out}/failure.json`, JSON.stringify(debug, null, 2));
  }
  throw error;
} finally {
  await browser.close();
  await server.close();
}
