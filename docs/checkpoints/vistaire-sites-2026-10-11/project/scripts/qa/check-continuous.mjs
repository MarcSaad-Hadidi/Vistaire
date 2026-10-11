import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { dishes } from "../../src/content.js";
const root = new URL("../..", import.meta.url).pathname;
const out = root + "/docs/validation/continuous";
await fs.mkdir(out, { recursive: true });
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port: 5178, strictPort: true, hmr: false },
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    "/workspace/scratch/51ebef2040ae/.browser-tools/runtime/chromium",
  headless: true,
  ignoreDefaultArgs: [
    "--enable-unsafe-swiftshader",
    "--unsafely-disable-devtools-self-xss-warnings",
  ],
});
const report = [];
try {
  for (const [width, height, dpr] of [
    [1440, 900, 1],
    [1880, 856, 1],
    [390, 844, 3],
    [430, 900, 3],
  ].filter(
    ([w]) =>
      (!process.env.QA_WIDTH || w === Number(process.env.QA_WIDTH)) &&
      (!process.env.QA_WIDTHS ||
        process.env.QA_WIDTHS.split(",").map(Number).includes(w)),
  )) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      isMobile: width < 768,
      hasTouch: width < 768,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("http://127.0.0.1:5178");
    await page
      .locator(".scene-canvas[data-ready=true]")
      .waitFor({ timeout: 90000 });
    const snapshot = () =>
      page.evaluate(() => {
        let c = document.querySelector(".scene-canvas");
        const gl = c.getContext("webgl2");
        return {
          ...c.dataset,
          scrollY,
          scale: visualViewport.scale,
          buffer: [c.width, c.height],
          antialias: gl.getContextAttributes().antialias,
        };
      });
    const scroll = async (y) => {
      await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
      await page.waitForTimeout(250);
      await page.waitForFunction(
        () =>
          document.querySelector(".scene-canvas").dataset.settled === "true",
        { timeout: 45000 },
      );
    };
    const frames = [];
    const chapter = async (id, p = 0.35) => {
      const y = await page
        .locator(`#${id}`)
        .evaluate(
          (el, p) =>
            el.getBoundingClientRect().top +
            scrollY +
            Math.max(0, el.offsetHeight - el.firstElementChild.clientHeight) *
              p,
          p,
        );
      await scroll(y);
    };
    const travel = await page
      .locator(".opening-journey")
      .evaluate((e) => e.offsetHeight - e.firstElementChild.clientHeight);
    for (let p of [0, 0.25, 0.56, 1]) {
      await scroll(travel * p);
      let data = await snapshot();
      assert.deepEqual(data.buffer, [width * dpr, height * dpr]);
      assert.equal(data.antialias, true);
      if (p === 0) {
        assert(
          JSON.parse(data.phoneBounds).width > 30,
          "initial phone visible",
        );
        assert(JSON.parse(data.supportBounds).width > 40, "initial QR visible");
        assert(
          JSON.parse(data.dishBounds).width >
            JSON.parse(data.focusBounds).width * 0.5,
          "initial large plate",
        );
      }
      frames.push({ p, ...data });
      await page.screenshot({
        path: `${out}/${width}-opening-${p}.jpg`,
        quality: 90,
        type: "jpeg",
        timeout: 60000,
      });
      console.log("opening", width, p, data.dishBounds, data.supportPosition);
    }
    const grip = await page
      .locator("#grip")
      .evaluate((e) => e.getBoundingClientRect().top + scrollY);
    await scroll(grip + 250);
    await page.screenshot({
      path: `${out}/${width}-grip.jpg`,
      quality: 90,
      type: "jpeg",
      timeout: 60000,
    });
    console.log("grip", width, await snapshot());
    const food = [];
    for (const dish of process.env.QA_DISHES
      ? dishes
      : dishes.filter((d) => d.id === "burger")) {
      await chapter("grip", 0.35);
      await page
        .locator(".dish-switch")
        .getByRole("button", { name: dish.label, exact: true })
        .click();
      await page.waitForFunction(
        (id) => {
          const c = document.querySelector(".scene-canvas");
          return (
            c.dataset.model === id &&
            c.dataset.renderedModel === id &&
            c.dataset.settled === "true"
          );
        },
        dish.id,
        { timeout: 90000 },
      );
      for (const id of ["features", "grip"]) {
        await chapter(id);
        const d = await snapshot(),
          b = JSON.parse(d.dishBounds),
          f = JSON.parse(d.focusBounds);
        assert(
          b.x >= f.x - 2 &&
            b.y >= f.y - 2 &&
            b.x + b.width <= f.x + f.width + 2 &&
            b.y + b.height <= f.y + f.height + 2,
          `${width} ${dish.id} ${id} visible bounds inside focus`,
        );
        food.push({
          dish: dish.id,
          section: id,
          bounds: b,
          camera: d.fittedCameraPosition,
          triangles: d.triangles,
          calls: d.drawCalls,
        });
        await page.screenshot({
          path: `${out}/${width}-${dish.id}-${id}.jpg`,
          type: "jpeg",
          quality: 90,
        });
      }
    }
    const viewerCameras = food
      .filter((x) => x.section === "grip")
      .map((x) => x.camera);
    assert.equal(
      new Set(viewerCameras).size,
      1,
      "dish selection preserves framing camera",
    );
    const closing = [];
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const p of [0, 0.3, 0.75]) {
      await chapter("sustainability", p);
      const d = await snapshot();
      closing.push({ p, angle: Number(d.laptopAngle), bounds: d.laptopBounds });
      await page.screenshot({
        path: `${out}/${width}-dashboard-${p}.jpg`,
        quality: 90,
        type: "jpeg",
      });
    }
    assert(closing[0].angle < 5, "laptop initially closed");
    assert(closing[1].angle > 15 && closing[1].angle < 90, "laptop midway");
    assert(closing[2].angle > 90, "laptop open");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await chapter("footer");
    const footer = await snapshot();
    for (const name of ["phone", "support", "dish"])
      assert(JSON.parse(footer[name + "Bounds"]).width > 35, `footer ${name}`);
    await page.screenshot({
      path: `${out}/${width}-footer.jpg`,
      quality: 90,
      type: "jpeg",
    });
    // Dense samples of the actual rendered projection, including both directions.
    const boundaries = [];
    for (const id of process.env.QA_QUICK
      ? []
      : [
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
      const top = await page
        .locator("#" + id)
        .evaluate((e) => e.getBoundingClientRect().top + scrollY);
      for (const direction of [1, -1]) {
        const samples = [];
        for (const offset of direction === 1
          ? [-4, -1, 0, 1, 4]
          : [4, 1, 0, -1, -4]) {
          await scroll(top + offset);
          let d = await snapshot();
          samples.push({
            offset,
            camera: d.fittedCameraPosition,
            zoom: d.cameraDolly,
            look: d.fittedLook,
            bounds: d.subjectBounds,
            transition: d.transition,
          });
        }
        boundaries.push({ id, direction, samples });
        const vectors = samples.map((s) => s.camera.split(",").map(Number));
        for (let i = 1; i < vectors.length; i++)
          assert(
            Math.hypot(...vectors[i].map((v, j) => v - vectors[i - 1][j])) <
              0.15,
            `camera discontinuity ${width} ${id}: ${JSON.stringify(samples)}`,
          );
      }
      console.log("boundary", width, id);
    }
    await scroll(grip + 250);
    const zoomBefore = await snapshot();
    if (width < 768) {
      const session = await page.context().newCDPSession(page);
      const box = await page.locator(".dish-gesture").boundingBox();
      const cx = box.x + box.width / 2,
        cy = box.y + box.height / 2;
      const pts = (d) => [
        { id: 1, x: cx - d / 2, y: cy, radiusX: 5, radiusY: 5 },
        { id: 2, x: cx + d / 2, y: cy, radiusX: 5, radiusY: 5 },
      ];
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: pts(70),
      });
      for (let d of [85, 110, 140, 175, 210]) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: pts(d),
        });
        await page.waitForTimeout(60);
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.waitForTimeout(300);
      const zoomAfter = await snapshot();
      assert(Number(zoomAfter.cameraDolly) > 2.5, "camera dolly pinch");
      assert.equal(Number(zoomAfter.cameraZoom), 1, "lens remains fixed");
      assert(
        Number(zoomAfter.cameraDistance) < Number(zoomBefore.cameraDistance),
        "pinch moves the camera closer",
      );
      assert.equal(
        zoomAfter.dishScale,
        zoomBefore.dishScale,
        "dish scale unchanged",
      );
      assert.equal(
        zoomAfter.dishMeshScale,
        zoomBefore.dishMeshScale,
        "mesh scale unchanged",
      );
      assert.equal(zoomAfter.scale, 1, "page zoom untouched");
      assert(
        Math.abs(zoomAfter.scrollY - zoomBefore.scrollY) < 10,
        "pinch scroll stable",
      );
      await page.screenshot({
        path: `${out}/${width}-pinch.jpg`,
        quality: 90,
        type: "jpeg",
        timeout: 60000,
      });
      const zoomBoundaries = [];
      const gripEnd = await page
        .locator("#grip")
        .evaluate(
          (e) =>
            e.getBoundingClientRect().top +
            scrollY +
            e.offsetHeight -
            e.firstElementChild.clientHeight,
        );
      const laptopTop = await page
        .locator("#sustainability")
        .evaluate((e) => e.getBoundingClientRect().top + scrollY);
      for (const boundary of [gripEnd, laptopTop])
        for (const direction of [1, -1]) {
          const samples = [];
          for (const offset of direction === 1 ? [-2, 0, 2] : [2, 0, -2]) {
            await scroll(boundary + offset);
            const d = await snapshot();
            samples.push({
              offset,
              zoom: Number(d.cameraDolly),
              camera: d.fittedCameraPosition,
            });
          }
          for (let i = 1; i < samples.length; i++)
            assert(
              Math.abs(samples[i].zoom - samples[i - 1].zoom) < 0.025,
              "zoom transition continuous",
            );
          zoomBoundaries.push({ boundary, direction, samples });
        }
      await scroll(grip + 250);
      await page.getByRole("button", { name: "Recentrer le plat" }).click();
      // A horizontal finger drag rotates the model without moving the page.
      const initialTurn = await snapshot();
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ id: 1, x: cx - 60, y: cy }],
      });
      for (const dx of [15, 30, 50, 75, 100]) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ id: 1, x: cx - 60 + dx, y: cy }],
        });
        await page.waitForTimeout(30);
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      const rotated = await page
        .getByRole("slider", {
          name: "Faire tourner le plat en 3D",
          exact: true,
        })
        .getAttribute("aria-valuenow");
      assert(Math.abs(Number(rotated) - 180) > 20, "natural finger rotation");
      assert(
        Math.abs((await snapshot()).scrollY - initialTurn.scrollY) < 10,
        "rotation leaves page stable",
      );
      await page.getByRole("button", { name: "Recentrer le plat" }).click();
      const verticalBefore = await snapshot();
      const verticalPoints = (d) => [
        { id: 1, x: cx, y: cy - d / 2 },
        { id: 2, x: cx, y: cy + d / 2 },
      ];
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: verticalPoints(70),
      });
      for (const distance of [85, 110, 140, 175, 210]) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: verticalPoints(distance),
        });
        await page.waitForTimeout(60);
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      const verticalAfter = await snapshot();
      assert(
        Number(verticalAfter.cameraDolly) > 2.5,
        "vertical two-finger pinch moves the camera",
      );
      assert.equal(
        verticalAfter.scale,
        1,
        "vertical pinch leaves page scale intact",
      );
      assert(
        Math.abs(verticalAfter.scrollY - verticalBefore.scrollY) < 10,
        "vertical pinch leaves native page position intact",
      );
      await page.getByRole("button", { name: "Recentrer le plat" }).click();
      for (const selector of [".dish-gesture", ".support-gesture"]) {
        if (selector.includes("support"))
          await scroll(
            (await page
              .locator("#product")
              .evaluate((e) => e.getBoundingClientRect().top + scrollY)) + 250,
          );
        const b = await page.locator(selector).boundingBox(),
          x = b.x + b.width / 2,
          y = b.y + b.height / 2;
        const before = await snapshot();
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ id: 1, x, y, radiusX: 5, radiusY: 5 }],
        });
        await page.waitForTimeout(800);
        for (const dy of [-20, -45, -85, -120, -160, -120, -70, -20, 30, 90]) {
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ id: 1, x, y: y + dy, radiusX: 5, radiusY: 5 }],
          });
          await page.waitForTimeout(60);
        }
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await page.waitForTimeout(300);
        const after = await snapshot();
        assert(
          Math.abs(after.scrollY - before.scrollY) > 40,
          `${selector} hold vertical native`,
        );
        console.log("hold", selector, before.scrollY, after.scrollY);
      }
      report.push({
        width,
        height,
        dpr,
        opening: frames,
        boundaries,
        pinch: { before: zoomBefore, after: zoomAfter },
        zoomBoundaries,
        closing,
        footer,
        food,
        verticalPinch: { before: verticalBefore, after: verticalAfter },
        errors,
      });
    } else
      report.push({
        width,
        height,
        dpr,
        opening: frames,
        boundaries,
        closing,
        footer,
        food,
        errors,
      });
    assert.equal(errors.length, 0, errors.join("\n"));
    await fs.writeFile(
      `${out}/${width}${process.env.QA_QUICK ? "-quick" : ""}.json`,
      JSON.stringify(report.at(-1), null, 2),
    );
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
