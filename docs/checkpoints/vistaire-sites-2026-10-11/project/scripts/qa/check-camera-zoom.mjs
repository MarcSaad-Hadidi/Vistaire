import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { dishes } from "../../src/content.js";

const root = new URL("../..", import.meta.url).pathname;
const out = `${root}/docs/validation/camera-zoom`;
const port = Number(process.env.QA_PORT || 5185);
await fs.mkdir(out, { recursive: true });
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
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
const report = {
  renderer: "Chromium software WebGL; not physical Safari or device FPS",
  cases: [],
  errors: [],
};
const resultName = process.env.QA_LABEL || "results";
try {
  for (const width of (process.env.QA_WIDTHS || "1440,390,430")
    .split(",")
    .map(Number)) {
    const mobile = width < 768;
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 900 },
      deviceScaleFactor: width === 390 ? 3 : 1,
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/#grip`);
    await page
      .locator(".scene-canvas[data-ready=true]")
      .waitFor({ timeout: 120000 });
    const chapter = async (id, progress = 0.3) => {
      await page.locator(`#${id}`).evaluate(
        (el, p) =>
          scrollTo({
            top:
              scrollY +
              el.getBoundingClientRect().top +
              (el.offsetHeight - el.firstElementChild.clientHeight) * p,
            behavior: "instant",
          }),
        progress,
      );
      await page.waitForFunction(
        (id) => {
          const d = document.querySelector(".scene-canvas").dataset;
          return d.section === id && d.settled === "true";
        },
        id,
        { timeout: 90000 },
      );
    };
    const settle = async () => {
      await page.waitForTimeout(150);
      await page.waitForFunction(
        () => {
          const d = document.querySelector(".scene-canvas").dataset;
          return d.settled === "true" && !d.loadingModel;
        },
        null,
        { timeout: 90000 },
      );
    };
    const snapshot = () =>
      page.evaluate(() => ({
        ...document.querySelector(".scene-canvas").dataset,
        pageScale: visualViewport.scale,
        y: scrollY,
        buffer: [
          document.querySelector(".scene-canvas").width,
          document.querySelector(".scene-canvas").height,
        ],
      }));
    const verify = (before, after, minimum = 1.1) => {
      assert(
        Number(after.cameraDistance) < Number(before.cameraDistance) / minimum,
        "camera actually approaches food",
      );
      assert.equal(Number(after.cameraZoom), 1, "projection zoom fixed");
      assert.equal(Number(after.cameraFov), 40, "normal lens fixed");
      for (const key of ["dishScale", "dishMeshScale"]) {
        const a = before[key].split(",").map(Number);
        const b = after[key].split(",").map(Number);
        assert(
          b.every((v, i) => Math.abs(v - a[i]) < 1e-9),
          `${key} fixed to numerical precision`,
        );
      }
      assert.equal(after.pageScale, 1, "page does not magnify");
      assert.equal(after.zoomClipped, "true", "close-up clipped within viewer");
      assert(
        Math.abs(after.y - before.y) < 10,
        "zoom does not scroll document",
      );
    };
    await chapter("grip");
    for (const dish of process.env.QA_GESTURES_ONLY
      ? []
      : width === 430
        ? dishes.filter((d) => ["homard", "burger"].includes(d.id))
        : dishes) {
      await page
        .locator(".dish-switch")
        .getByRole("button", { name: dish.label, exact: true })
        .click({ noWaitAfter: true, timeout: 90000 });
      await page
        .locator(`.scene-canvas[data-model="${dish.id}"]`)
        .waitFor({ timeout: 120000 });
      await settle();
      const before = await snapshot();
      assert(
        Math.abs(Number(before.cameraDolly) - 1) < 0.001,
        "selection restores base camera",
      );
      if (["homard", "burger"].includes(dish.id))
        await page.screenshot({
          path: `${out}/${width}-${dish.id}-normal.png`,
          timeout: 90000,
        });
      for (let n = 0; n < 15; n++)
        await page
          .getByRole("button", { name: "Zoomer le plat", exact: true })
          .click({ noWaitAfter: true, timeout: 90000 });
      await settle();
      const after = await snapshot();
      verify(before, after);
      assert(
        Math.abs(Number(after.cameraDolly) - 4) < 0.001,
        "close-up reaches requested 4x",
      );
      if (["homard", "burger"].includes(dish.id))
        await page.screenshot({
          path: `${out}/${width}-${dish.id}-close.png`,
          timeout: 90000,
        });
      report.cases.push({
        width,
        dish: dish.id,
        kind: "camera-close-up",
        before,
        after,
      });
      await page
        .getByRole("button", { name: "Recentrer le plat", exact: true })
        .click({ noWaitAfter: true, timeout: 90000 });
      await settle();
      const reset = await snapshot();
      assert(
        Math.abs(Number(reset.cameraDistance) - Number(before.cameraDistance)) <
          0.002,
        "reset returns camera",
      );
      console.log(
        "camera-close-up",
        width,
        dish.id,
        before.cameraDistance,
        after.cameraDistance,
      );
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page
      .locator(".dish-switch")
      .getByRole("button", { name: dishes[0].label, exact: true })
      .click({ noWaitAfter: true, timeout: 90000 });
    await settle();
    const before = await snapshot();
    const box = await page.locator(".dish-gesture").boundingBox();
    const cx = box.x + box.width / 2,
      cy = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    if (mobile) {
      const points = (d) => [
        { id: 1, x: cx - d / 2, y: cy },
        { id: 2, x: cx + d / 2, y: cy },
      ];
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: points(60),
      });
      for (const d of [75, 95, 120, 150, 180]) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: points(d),
        });
        await page.waitForTimeout(75);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      for (let n = 0; n < 10; n++)
        await page
          .getByRole("button", { name: "Zoomer le plat", exact: true })
          .click({ noWaitAfter: true, timeout: 90000 });
    }
    await settle();
    const after = await snapshot();
    verify(before, after, 2);
    report.cases.push({
      width,
      kind: mobile ? "native-pinch" : "smoothed-camera-buttons",
      before,
      after,
    });
    // The closer camera remains usable while orbiting; no scale-based zoom.
    const angleBefore = await page
      .getByRole("slider", { name: "Faire tourner le plat en 3D", exact: true })
      .getAttribute("aria-valuenow");
    if (mobile) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ id: 1, x: cx - 45, y: cy }],
      });
      for (let n = 1; n <= 5; n++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ id: 1, x: cx - 45 + n * 18, y: cy }],
        });
        await page.waitForTimeout(35);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await page.mouse.move(cx - 45, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 60, cy + 20, { steps: 5 });
      await page.mouse.up();
    }
    await settle();
    const rotated = await snapshot();
    const angleAfter = await page
      .getByRole("slider", { name: "Faire tourner le plat en 3D", exact: true })
      .getAttribute("aria-valuenow");
    assert(
      Math.abs(Number(angleAfter) - Number(angleBefore)) > 20,
      "natural orbit remains active at close-up",
    );
    verify(before, rotated, 2);
    report.cases.push({
      width,
      kind: "orbit-while-camera-close",
      angleBefore,
      angleAfter,
      before,
      rotated,
    });
    // Return across the zoomed viewer/Mac join in both directions.
    const transition = await page.locator("#grip").evaluate((e) => ({
      top: scrollY + e.getBoundingClientRect().top,
      travel: e.offsetHeight - e.firstElementChild.clientHeight,
    }));
    const boundaries = [];
    const macTop = await page
      .locator("#sustainability")
      .evaluate((e) => scrollY + e.getBoundingClientRect().top);
    for (const boundary of [transition.top + transition.travel, macTop])
      for (const direction of [1, -1]) {
        const values = [];
        for (const offset of direction === 1 ? [-2, 0, 2] : [2, 0, -2]) {
          await page.evaluate(
            (y) => scrollTo({ top: y, behavior: "instant" }),
            boundary + offset,
          );
          await settle();
          values.push(await snapshot());
        }
        for (let n = 1; n < values.length; n++) {
          const a = values[n - 1].fittedCameraPosition.split(",").map(Number);
          const b = values[n].fittedCameraPosition.split(",").map(Number);
          assert(
            Math.hypot(...b.map((v, i) => v - a[i])) < 0.06,
            "zoomed chapter boundary continuous",
          );
        }
        boundaries.push({ boundary, direction, values });
      }
    report.cases.push({
      width,
      kind: "zoomed-transition-both-directions",
      boundaries,
    });
    await chapter("grip");
    if (mobile) {
      await page.evaluate(() => {
        window.zoomQA = { captures: 0, canceled: 0 };
        const original = Element.prototype.setPointerCapture;
        Element.prototype.setPointerCapture = function (...a) {
          window.zoomQA.captures++;
          return original.apply(this, a);
        };
        document.addEventListener(
          "touchmove",
          (e) => {
            if (e.defaultPrevented) window.zoomQA.canceled++;
          },
          { passive: true },
        );
      });
      const checkpoints = [await snapshot()];
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ id: 1, x: cx, y: cy }],
      });
      await page.waitForTimeout(650);
      for (const sign of [-1, 1, -1, 1]) {
        for (let step = 1; step <= 5; step++) {
          const y = sign < 0 ? cy - step * 18 : cy - 90 + step * 18;
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ id: 1, x: cx, y }],
          });
          await page.waitForTimeout(40);
        }
        checkpoints.push(await snapshot());
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      for (let n = 1; n < checkpoints.length; n++) {
        const delta = checkpoints[n].y - checkpoints[n - 1].y;
        assert(
          n % 2 ? delta > 40 : delta < -40,
          "held finger still reverses native scroll after pinch",
        );
      }
      assert.deepEqual(await page.evaluate(() => window.zoomQA), {
        captures: 0,
        canceled: 0,
      });
      report.cases.push({
        width,
        kind: "held-scroll-after-pinch",
        checkpoints,
      });
    }
    await cdp.detach();
    await page.close();
    await fs.writeFile(
      `${out}/${resultName}.json`,
      JSON.stringify(report, null, 2),
    );
  }
  assert.deepEqual(report.errors, []);
} catch (e) {
  report.failure = e.stack;
  console.error(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    `${out}/${resultName}.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  await server.close();
}
