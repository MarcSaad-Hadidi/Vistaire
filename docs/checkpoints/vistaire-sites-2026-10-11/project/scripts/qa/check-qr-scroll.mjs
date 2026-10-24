import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../..", import.meta.url).pathname;
const out = `${root}/docs/validation/qr-scroll`;
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
const before = Boolean(process.env.QA_BEFORE);
const gl = Boolean(process.env.QA_WEBGL);
const width = Number(process.env.QA_WIDTH || 390);
const height = Number(process.env.QA_HEIGHT || (width === 430 ? 900 : 844));
const dpr = Number(process.env.QA_DPR || (gl ? 3 : 1));
const report = { before, gl, width, cases: [], errors: [], failures: [] };
try {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    isMobile: width < 768,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  if (!gl)
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type.startsWith("webgl")
          ? null
          : original.call(this, type, ...args);
      };
    });
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("http://127.0.0.1:5178");
  if (gl)
    await page
      .locator(".scene-canvas[data-ready=true]")
      .waitFor({ timeout: 90000 });
  if (gl) {
    const buffer = await page
      .locator(".scene-canvas")
      .evaluate((c) => [c.width, c.height]);
    assert.deepEqual(
      buffer,
      [width * dpr, height * dpr],
      "native drawing buffer",
    );
    report.buffer = buffer;
  }
  await page.locator(".support-gesture").waitFor();
  const session = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    window.qrQA = { events: [], captures: [] };
    const capture = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = function (id) {
      window.qrQA.captures.push({ target: this.className, id });
      return capture.call(this, id);
    };
    for (const name of [
      "touchstart",
      "touchmove",
      "touchend",
      "pointerdown",
      "pointermove",
      "pointercancel",
    ])
      window.addEventListener(
        name,
        (e) =>
          window.qrQA.events.push({
            name,
            target: e.target.className,
            prevented: e.defaultPrevented,
            y: scrollY,
          }),
        { passive: true },
      );
  });
  const cases = [
    {
      name: "dish-range-horizontal-then-vertical",
      selector: ".rotation-range",
      startHorizontal: true,
      range: true,
    },
    {
      name: "dish-range-hold-reversals",
      selector: ".rotation-range",
      hold: true,
      range: true,
    },
    {
      name: "dish-horizontal-then-vertical",
      selector: ".dish-gesture",
      startHorizontal: true,
    },
    {
      name: "dish-diagonal-then-vertical",
      selector: ".dish-gesture",
      diagonal: true,
    },
    { name: "dish-hold-reversals", selector: ".dish-gesture", hold: true },
    {
      name: "qr-horizontal-then-vertical",
      selector: ".support-gesture",
      startHorizontal: true,
    },
    {
      name: "qr-diagonal-then-vertical",
      selector: ".support-gesture",
      diagonal: true,
    },
    { name: "qr-hold-reversals", selector: ".support-gesture", hold: true },
    {
      name: "qr-price-panel",
      selector: ".collection-details .price",
      hold: true,
    },
    { name: "pricing-heading", selector: ".pricing-heading h2", hold: true },
    {
      name: "pricing-card-image",
      selector: ".pricing-collection-image img",
      hold: true,
    },
    {
      name: "pricing-card-price",
      selector: ".pricing-collection-price",
      hold: true,
    },
    { name: "pricing-included", selector: ".pricing-included li", hold: true },
    { name: "pricing-pilotage", selector: ".pricing-toggle input", hold: true },
    { name: "pricing-packs", selector: ".pricing-packs strong", hold: true },
    { name: "pricing-faq", selector: ".pricing-faq summary", hold: true },
  ].filter(
    (c) =>
      !process.env.QA_CASES || process.env.QA_CASES.split(",").includes(c.name),
  );
  const snapshot = () =>
    page.evaluate(() => {
      const canvas = document.querySelector(".scene-canvas");
      const price = document
        .querySelector("#open-weight")
        .getBoundingClientRect();
      return {
        y: scrollY,
        scale: visualViewport.scale,
        angle: document
          .querySelector(".support-gesture")
          .getAttribute("aria-valuenow"),
        dishAngle: document
          .querySelector(".dish-gesture")
          .getAttribute("aria-valuenow"),
        dishZoom: document.querySelector(".dish-zoom output")?.textContent,
        captures: window.qrQA.captures.length,
        modal: !!document.querySelector("[role=dialog]"),
        selected: document.querySelector(
          ".pricing-collection.is-selected .pricing-collection-name",
        )?.textContent,
        pilotage: document.querySelector(".pricing-toggle input").checked,
        frames: Number(canvas?.dataset.frames || 0),
        occluded:
          price.top <= 0 &&
          price.bottom >= document.querySelector(".world").clientHeight,
        suspended: canvas?.dataset.suspended,
        fallback: document
          .querySelector(".world")
          .classList.contains("world-fallback"),
      };
    });
  for (const item of cases) {
    const target = page.locator(item.selector).first();
    await target.evaluate((el) => {
      const top = el.getBoundingClientRect().top + scrollY;
      const y =
        el.classList.contains("support-gesture") ||
        el.classList.contains("dish-gesture")
          ? top + el.clientHeight / 2
          : top;
      scrollTo({ top: y - 420, behavior: "instant" });
    });
    await page.waitForTimeout(200);
    if (process.env.QA_AUTO)
      await page
        .locator(".support-gesture")
        .evaluate((el) => (el.style.touchAction = "auto"));
    const box = await target.boundingBox();
    const x = Math.min(width - 80, Math.max(40, box.x + box.width / 2));
    const y = Math.min(height - 40, Math.max(100, box.y + box.height / 2));
    const hit = await page.evaluate(
      ([x, y]) => {
        const result = [];
        let el = document.elementFromPoint(x, y);
        while (el) {
          const css = getComputedStyle(el);
          result.push({
            tag: el.tagName,
            class: el.className,
            id: el.id,
            action: css.touchAction,
            overflow: css.overflow,
            events: css.pointerEvents,
          });
          el = el.parentElement;
        }
        return result;
      },
      [x, y],
    );
    const a = await snapshot();
    if (item.range)
      assert.equal(
        hit[0].tag,
        "DIV",
        "range gesture actually starts on the custom slider",
      );
    if (
      gl &&
      [
        "qr-horizontal-then-vertical",
        "pricing-card-image",
        "pricing-packs",
      ].includes(item.name)
    )
      await page.screenshot({
        path: `${out}/${width}-${item.name}.jpg`,
        type: "jpeg",
        quality: 90,
        timeout: 60000,
      });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x, y }],
    });
    if (item.hold) await page.waitForTimeout(800);
    let fingerX = x,
      fingerY = y;
    const moves = [];
    if (item.startHorizontal || item.diagonal) {
      for (const d of [10, 24, 40])
        moves.push([x + d, y + (item.diagonal ? d * 0.6 : 0)]);
      fingerX = x + 40;
      fingerY = y + (item.diagonal ? 24 : 0);
    }
    for (const destination of [150, 650, 150, 650]) {
      const start = fingerY;
      for (let i = 1; i <= 5; i++)
        moves.push([fingerX, start + ((destination - start) * i) / 5]);
      fingerY = destination;
    }
    const samples = [];
    for (const [px, py] of moves) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ id: 1, x: px, y: py }],
      });
      await page.waitForTimeout(35);
      samples.push({ finger: [px, py], ...(await snapshot()) });
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(200);
    const b = await snapshot();
    const travel =
      Math.max(...samples.map((s) => s.y)) -
      Math.min(...samples.map((s) => s.y));
    const entry = { ...item, hit, before: a, after: b, samples, travel };
    report.cases.push(entry);
    console.log(item.name, {
      travel,
      captures: b.captures - a.captures,
      angle: [a.angle, b.angle],
      hit: hit[0],
    });
    if (travel < 350)
      report.failures.push(
        `${item.name}: document fails to scroll through direction reversals (${travel}px)`,
      );
    const prefix = item.startHorizontal || item.diagonal ? 3 : 0;
    for (let stroke = 1; stroke < 4; stroke++) {
      const dy =
        samples[prefix + stroke * 5 + 4].y -
        samples[prefix + (stroke - 1) * 5 + 4].y;
      if ((stroke % 2 ? -dy : dy) < 100)
        report.failures.push(
          `${item.name}: stroke ${stroke} fails to reverse document scrolling (${dy}px)`,
        );
    }
    if (!before && b.captures !== a.captures)
      report.failures.push(`${item.name}: touch pointer captured`);
    if (b.modal || a.pilotage !== b.pilotage || a.selected !== b.selected)
      report.failures.push(`${item.name}: held pan activates a control`);
    if (item.hold && b.angle !== a.angle)
      report.failures.push(`${item.name}: held pan rotates the QR support`);
    if (item.hold && !item.range && b.dishAngle !== a.dishAngle)
      report.failures.push(`${item.name}: held pan rotates the dish`);
    if (b.scale !== 1)
      report.failures.push(`${item.name}: one finger changes page scale`);
    if (gl && b.fallback)
      report.failures.push(`${item.name}: WebGL fell back during verification`);
    const hiddenFrames = samples
      .slice(1)
      .reduce(
        (n, s, i) =>
          n +
          (s.occluded && samples[i].occluded
            ? s.frames - samples[i].frames
            : 0),
        0,
      );
    if (gl && hiddenFrames > 0)
      report.failures.push(
        `${item.name}: invisible WebGL still renders under opaque pricing (${hiddenFrames} frames)`,
      );
  }
  if (process.env.QA_SLIDER) {
    await page.locator("#grip").evaluate((el) =>
      scrollTo({
        top:
          el.offsetTop +
          (el.offsetHeight - el.firstElementChild.clientHeight) * 0.3,
        behavior: "instant",
      }),
    );
    await page.waitForTimeout(250);
    const slider = page.getByRole("slider", { name: "Rotation du plat 3D" });
    await slider.press("Home");
    await slider.press("PageUp");
    await slider.press("PageUp");
    await slider.press("PageUp");
    await slider.press("PageUp");
    await slider.press("PageUp");
    const box = await slider.boundingBox();
    const x = box.x + box.width * 0.1,
      y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + box.width * 0.1, y, { steps: 5 });
    const dragging = Number(await slider.getAttribute("aria-valuenow"));
    await page.mouse.up();
    const released = Number(await slider.getAttribute("aria-valuenow"));
    report.slider = { dragging, released };
    if (
      Math.abs(dragging - 0.6) > 0.01 ||
      Math.abs(released - dragging) > 0.001
    )
      report.failures.push(
        "mouse slider jumps on release after a relative drag",
      );
    await slider.click({ position: { x: box.width * 0.8, y: box.height / 2 } });
    if (
      Math.abs(Number(await slider.getAttribute("aria-valuenow")) - 0.8) > 0.01
    )
      report.failures.push("slider no longer handles a fresh absolute tap");
    console.log("mouse-slider", report.slider);
    if (gl) {
      await page
        .locator(".scene-canvas[data-settled=true]")
        .waitFor({ timeout: 60000 });
      await page.screenshot({
        path: `${out}/${width}-slider.jpg`,
        type: "jpeg",
        quality: 90,
        timeout: 60000,
      });
    }
  }
  if (process.env.QA_EXTRAS) {
    const go = async (id, p = 0.3) => {
      await page.locator(`#${id}`).evaluate(
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
      await page.waitForTimeout(250);
      if (gl)
        await page.waitForFunction(
          (id) => {
            const c = document.querySelector(".scene-canvas");
            return c.dataset.section === id && c.dataset.settled === "true";
          },
          id,
          { timeout: 60000 },
        );
    };
    const pinchResults = [];
    for (const vertical of [false, true]) {
      await go("grip");
      await page
        .getByRole("button", { name: "Recentrer le plat", exact: true })
        .click();
      if (gl && !vertical)
        await page.screenshot({
          path: `${out}/${width}-dish-viewer.jpg`,
          type: "jpeg",
          quality: 90,
          timeout: 60000,
        });
      const box = await page.locator(".dish-gesture").boundingBox();
      const cx = box.x + box.width / 2,
        cy = box.y + box.height / 2;
      const points = (d) => [
        {
          id: 1,
          x: cx - (vertical ? 0 : d / 2),
          y: cy - (vertical ? d / 2 : 0),
        },
        {
          id: 2,
          x: cx + (vertical ? 0 : d / 2),
          y: cy + (vertical ? d / 2 : 0),
        },
      ];
      const a = await snapshot();
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: points(70),
      });
      for (const d of [85, 110, 140, 175, 210]) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: points(d),
        });
        await page.waitForTimeout(60);
      }
      const b = await snapshot();
      assert.equal(b.dishZoom, "300 %", "two-finger model zoom");
      assert.equal(b.scale, 1, "no page zoom");
      assert(Math.abs(b.y - a.y) < 10, "pinch does not pan the page");
      if (gl && !vertical)
        await page.screenshot({
          path: `${out}/${width}-dish-pinch.jpg`,
          type: "jpeg",
          quality: 90,
          timeout: 60000,
        });
      const remaining = points(210)[0];
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [remaining],
      });
      const samples = [];
      let fy = remaining.y;
      for (const destination of [150, 650, 150, 650]) {
        const start = fy;
        for (let i = 1; i <= 5; i++) {
          fy = start + ((destination - start) * i) / 5;
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...remaining, y: fy }],
          });
          await page.waitForTimeout(35);
          samples.push(await snapshot());
        }
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      const travel =
        Math.max(...samples.map((s) => s.y)) -
        Math.min(...samples.map((s) => s.y));
      // Chromium keeps its multi-touch gesture decision until all fingers lift.
      // Record that limitation and require a fresh one-finger contact to scroll.
      const fresh = [];
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ ...remaining, y: 650 }],
      });
      for (const y of [550, 450, 350, 250, 150]) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ ...remaining, y }],
        });
        await page.waitForTimeout(35);
        fresh.push(await snapshot());
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      const freshTravel =
        Math.max(...fresh.map((s) => s.y)) - Math.min(...fresh.map((s) => s.y));
      assert(freshTravel > 350, "new one-finger contact scrolls after pinch");
      pinchResults.push({
        vertical,
        before: a,
        after: b,
        remainingFingerTravel: travel,
        freshContactTravel: freshTravel,
      });
    }
    report.pinch = pinchResults;
    if (gl) {
      await go("open-weight", 0);
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll(".pricing-collection-image img")].every(
            (i) => i.complete && i.naturalWidth >= 480,
          ),
        undefined,
        { timeout: 30000 },
      );
      await page.screenshot({
        path: `${out}/${width}-pricing.jpg`,
        type: "jpeg",
        quality: 90,
        timeout: 60000,
      });
      const coverage = await page.locator("#open-weight").evaluate((el) => ({
        top: el.getBoundingClientRect().top + scrollY,
        end:
          el.getBoundingClientRect().bottom +
          scrollY -
          document.querySelector(".world").clientHeight,
      }));
      const resume = [];
      for (const y of [
        coverage.top + 2,
        coverage.top - 2,
        coverage.top + 2,
        coverage.end - 2,
        coverage.end + 2,
        coverage.end - 2,
      ]) {
        await page.evaluate(
          (y) => scrollTo({ top: y, behavior: "instant" }),
          y,
        );
        await page.waitForTimeout(300);
        const data = await snapshot();
        assert.equal(
          data.suspended,
          data.occluded ? "true" : "false",
          "renderer follows actual opaque coverage in both directions",
        );
        resume.push(data);
      }
      report.resume = resume;
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const videoResults = [];
      for (const i of [0, 1, 2, 1, 0]) {
        await go("social-content", (i + 0.2) / 3);
        const video = page.locator(".social-rail video").nth(i);
        await video.locator("..").waitFor();
        await page.waitForFunction(
          (i) => {
            const v = document.querySelectorAll(".social-rail video")[i];
            return (
              v.classList.contains("has-decoded-frame") &&
              !v.paused &&
              !v.error &&
              v.currentTime > 0.15
            );
          },
          i,
          { timeout: 45000 },
        );
        videoResults.push(
          await video.evaluate((v) => ({
            id: v.dataset.playWhen,
            rate: v.playbackRate,
            time: v.currentTime,
            poster: v.previousElementSibling.complete,
            opacity: getComputedStyle(v).opacity,
          })),
        );
      }
      assert(
        videoResults.every(
          (v) => v.rate === 2 && v.poster && v.opacity === "1",
        ),
      );
      report.videos = videoResults;
      await page.screenshot({
        path: `${out}/${width}-menu-return.jpg`,
        type: "jpeg",
        quality: 90,
        timeout: 60000,
      });
    }
  }
  if (process.env.QA_PRICING) {
    await page
      .locator("#open-weight")
      .evaluate((el) =>
        scrollTo({
          top: el.getBoundingClientRect().top + scrollY,
          behavior: "instant",
        }),
      );
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".pricing-collection-image img")].every(
        (i) => i.complete && i.naturalWidth >= 480,
      ),
    );
    report.pricingFrames = await page
      .locator(".pricing-collection-image")
      .evaluateAll((elements) =>
        elements.map((el) => {
          const rect = el.getBoundingClientRect(),
            image = el.querySelector("img");
          const [a, b] = getComputedStyle(el)
            .aspectRatio.split("/")
            .map(Number);
          return {
            width: rect.width,
            height: rect.height,
            ratio: a / b,
            natural: [image.naturalWidth, image.naturalHeight],
          };
        }),
      );
    assert.equal(report.pricingFrames.length, 4);
    assert(
      report.pricingFrames.every(
        (r) => Math.abs(r.height * r.ratio - r.width) < 1,
      ),
      "all collection photographs preserve their CSS frame ratio",
    );
    assert(
      Math.max(...report.pricingFrames.map((r) => r.height)) -
        Math.min(...report.pricingFrames.map((r) => r.height)) <
        1,
      "all four collection photographs have the same height",
    );
    if (gl) await page.locator(".scene-canvas[data-suspended=true]").waitFor();
    await page.screenshot({
      path: `${out}/${width}-pricing.jpg`,
      type: "jpeg",
      quality: 90,
      timeout: 60000,
    });
    console.log("pricing-image-frames", report.pricingFrames);
  }
  report.events = await page.evaluate(() => window.qrQA.events);
  const suffix = `${before ? "before" : "after"}-${process.env.QA_LABEL ? process.env.QA_LABEL + "-" : ""}${process.env.QA_AUTO ? "auto-" : ""}${width}${gl ? "-webgl" : "-dom"}`;
  await fs.writeFile(`${out}/${suffix}.json`, JSON.stringify(report, null, 2));
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failures, []);
} finally {
  await browser.close();
  await server.close();
}
