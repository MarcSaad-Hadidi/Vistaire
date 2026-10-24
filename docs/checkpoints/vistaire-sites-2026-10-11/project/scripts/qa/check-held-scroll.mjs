import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../..", import.meta.url).pathname;
const out = `${root}/docs/validation/held-scroll`;
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
const baseline = Boolean(process.env.QA_BASELINE);
const motion = Boolean(process.env.QA_MOTION);
const width = Number(process.env.QA_WIDTH || 390);
const height = width === 430 ? 900 : 844;
const dpr = Number(process.env.QA_DPR || 1);
try {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    isMobile: true,
    hasTouch: true,
    reducedMotion: motion ? "no-preference" : "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5178");
  await page
    .locator(".scene-canvas[data-ready=true]")
    .waitFor({ timeout: 90000 });
  const session = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    window.heldQA = {
      writes: 0,
      events: [],
      touches: 0,
      interactivityChanges: 0,
    };
    new MutationObserver((records) => {
      window.heldQA.writes += records.length;
    }).observe(document.querySelector(".scene-canvas"), {
      attributes: true,
      attributeFilter: ["width", "height"],
    });
    new MutationObserver((records) => {
      if (window.heldQA.touches)
        window.heldQA.interactivityChanges += records.length;
    }).observe(document.querySelector(".opening-stage"), {
      attributes: true,
      subtree: true,
      attributeFilter: ["inert", "aria-hidden"],
    });
    for (const name of [
      "touchstart",
      "touchend",
      "touchcancel",
      "pointercancel",
    ])
      document.addEventListener(
        name,
        (e) => {
          if (e.touches) window.heldQA.touches = e.touches.length;
          window.heldQA.events.push({
            name,
            touches: e.touches?.length,
            target: e.target.className,
          });
        },
        { passive: true, capture: true },
      );
  });
  const snapshot = () =>
    page.evaluate(() => ({
      y: scrollY,
      scale: visualViewport.scale,
      writes: window.heldQA.writes,
      interactivityChanges: window.heldQA.interactivityChanges,
      frames: document.querySelector(".scene-canvas").dataset.frames,
      section: document.querySelector(".scene-canvas").dataset.section,
      stageScrolls: [...document.querySelectorAll(".stage")].map(
        (e) => e.scrollTop,
      ),
      selection: String(getSelection()),
      menuOpen: document
        .querySelector(".menu-toggle")
        .getAttribute("aria-expanded"),
    }));
  const cases = [
    {
      name: "opening-action",
      id: "ai",
      selector: "#ai .action",
      opening: true,
    },
    { name: "dish", id: "grip", selector: ".dish-gesture" },
    { name: "support", id: "product", selector: ".support-gesture" },
    {
      name: "feature-button",
      id: "features",
      selector: ".feature-card button",
      nearBeat: true,
    },
    { name: "header", id: "grip", selector: ".brand" },
    {
      name: "pricing-text",
      id: "open-weight",
      selector: ".pricing-heading h2",
    },
  ];
  const report = {
    baseline,
    viewport: [width, height],
    dpr,
    motion,
    renderer: "Chromium software WebGL, not physical Safari",
    cases: [],
  };
  for (const item of cases.filter(
    (item) =>
      !process.env.QA_CASES ||
      process.env.QA_CASES.split(",").includes(item.name),
  )) {
    await page.locator(`#${item.id}`).evaluate(
      (el, item) =>
        scrollTo({
          top:
            (item.opening ? 0 : el.getBoundingClientRect().top) +
            scrollY +
            (item.opening
              ? (document.querySelector(".opening-journey").offsetHeight -
                  document.querySelector(".opening-stage").clientHeight) *
                  0.64 -
                scrollY
              : item.nearBeat
                ? (el.offsetHeight - el.firstElementChild.clientHeight) / 3 -
                  100
                : 200),
          behavior: "instant",
        }),
      item,
    );
    await page.waitForTimeout(250);
    const b = await page.locator(item.selector).boundingBox();
    const x = Math.min(350, Math.max(40, b.x + b.width / 2));
    let previousY = Math.min(650, Math.max(100, b.y + b.height / 2));
    const before = await snapshot();
    const targetBefore = await page.locator(item.selector).evaluate((el) => {
      window.heldQATarget = el;
      return {
        className: el.className,
        overflow: getComputedStyle(el.closest(".stage") || el).overflow,
      };
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x, y: previousY }],
    });
    await page.waitForTimeout(800);
    const samples = [];
    for (const destination of [150, 650, 150, 650]) {
      const start = previousY;
      for (let i = 1; i <= 5; i++) {
        const fingerY = start + ((destination - start) * i) / 5;
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ id: 1, x: x + (i % 2), y: fingerY }],
        });
        await page.evaluate(() => dispatchEvent(new Event("resize")));
        await page.waitForTimeout(35);
        samples.push({ fingerY, ...(await snapshot()) });
      }
      previousY = destination;
      await page.waitForTimeout(150);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(250);
    const after = await snapshot();
    const sameTarget = await page.evaluate(
      () => window.heldQATarget.isConnected,
    );
    const travel =
      Math.max(...samples.map((s) => s.y)) -
      Math.min(...samples.map((s) => s.y));
    const entry = {
      name: item.name,
      before,
      after,
      travel,
      targetBefore,
      sameTarget,
      samples,
    };
    report.cases.push(entry);
    console.log(item.name, {
      travel,
      writes: after.writes - before.writes,
      sameTarget,
    });
    assert(
      travel > 350,
      `${item.name}: held gesture moves the page in both directions`,
    );
    for (let stroke = 1; stroke < 4; stroke++) {
      const part = samples.slice(stroke * 5, (stroke + 1) * 5);
      const expected = stroke % 2 === 1 ? -1 : 1;
      assert(
        (part.at(-1).y - part[0].y) * expected > 250,
        `${item.name}: reversal ${stroke} remains native`,
      );
    }
    assert.equal(after.scale, 1, "one finger never scales page");
    assert(
      after.stageScrolls.every((y) => y === 0),
      "stages do not consume document scroll",
    );
    assert.equal(
      after.menuOpen,
      "false",
      "a held pan does not activate navigation",
    );
    if (!baseline) {
      assert.equal(
        after.writes - before.writes,
        0,
        "toolbar-like resize notifications do not reset the unchanged canvas",
      );
      assert(sameTarget, "the touched control survives reading-beat changes");
      assert.equal(
        after.interactivityChanges - before.interactivityChanges,
        0,
        "opening interactivity stays stable until physical touch end",
      );
    }
  }
  report.events = await page.evaluate(() => window.heldQA.events);
  if (!baseline) {
    // Layout movement during a contact must not leave stale opening controls
    // after the contact finishes outside that journey.
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(100);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: 180, y: 400 }],
    });
    await page.locator("#features").evaluate((el) =>
      scrollTo({
        top: el.getBoundingClientRect().top + scrollY + 100,
        behavior: "instant",
      }),
    );
    await page.waitForTimeout(100);
    assert.equal(await page.locator("#hero").evaluate((el) => el.inert), false);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(100);
    report.openingRelease = await page
      .locator(".opening-stage > .chapter")
      .evaluateAll((els) =>
        els.map((el) => ({
          id: el.id,
          inert: el.inert,
          hidden: el.getAttribute("aria-hidden"),
        })),
      );
    assert(
      report.openingRelease.find((el) => el.id === "hero").inert,
      "flush opening interactivity after an outside release",
    );
    assert(report.openingRelease.find((el) => el.id === "ai").inert);

    const resized = [];
    for (const nextWidth of [width + 20, width]) {
      const before = await snapshot();
      await page.setViewportSize({ width: nextWidth, height });
      await page.waitForFunction(
        ([w, h, dpr]) => {
          const c = document.querySelector(".scene-canvas");
          return (
            c.width === w * dpr &&
            c.height === h * dpr &&
            c.dataset.settled === "true"
          );
        },
        [nextWidth, height, dpr],
        { timeout: 90000 },
      );
      const after = await snapshot();
      assert(
        Number(after.frames) > Number(before.frames),
        "true viewport resize redraws the scene",
      );
      resized.push({ width: nextWidth, before, after });
    }
    report.viewportResize = resized;
  }
  report.errors = errors;
  report.pacing = await page
    .locator(".chapter:not(.pricing)")
    .evaluateAll((elements) =>
      elements
        .filter((el) => !el.closest(".opening-stage") && el.id !== "footer")
        .map((el) => ({
          id: el.id,
          readingViewports:
            (el.offsetHeight - el.firstElementChild.clientHeight) /
            el.firstElementChild.clientHeight,
        })),
    );
  if (!baseline)
    for (const stage of report.pacing)
      assert(
        Math.abs(
          stage.readingViewports -
            (["features", "social-content"].includes(stage.id) ? 3 : 2),
        ) < 0.01,
        `${stage.id}: uniform reading distance`,
      );
  assert.equal(errors.length, 0, errors.join("\n"));
  if (!baseline)
    assert(
      await page
        .locator(".chapter:not(.pricing) .stage")
        .evaluateAll((elements) =>
          elements.every((e) => getComputedStyle(e).overflow === "clip"),
        ),
      "presentation stages only clip, with no inner scroll containers",
    );
  const suffix = baseline
    ? "before"
    : `after-${motion ? "motion" : "reduced"}-${width}-dpr${dpr}`;
  await page.locator("#grip").evaluate((el) =>
    scrollTo({
      top: el.getBoundingClientRect().top + scrollY + 250,
      behavior: "instant",
    }),
  );
  await page.waitForFunction(
    () => document.querySelector(".scene-canvas").dataset.settled === "true",
    null,
    { timeout: 60000 },
  );
  await page.screenshot({
    path: `${out}/${suffix}.jpg`,
    type: "jpeg",
    quality: 90,
  });
  await fs.writeFile(`${out}/${suffix}.json`, JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await server.close();
}
