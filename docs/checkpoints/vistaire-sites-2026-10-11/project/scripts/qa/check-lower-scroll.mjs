import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const root = new URL("../..", import.meta.url).pathname;
const out = `${root}/docs/validation/lower-scroll`;
await fs.mkdir(out, { recursive: true });
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port: 5184, strictPort: true, hmr: false },
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
const report = {
  label: process.env.QA_LABEL || "before",
  motion: true,
  renderer:
    process.env.QA_WEBGL === "0"
      ? "Chromium native touch with the explicit video fallback; not a physical iPhone"
      : "Chromium software WebGL; not a physical iPhone",
  cases: [],
  failures: [],
  errors: [],
};
const webgl = process.env.QA_WEBGL !== "0";
report.webgl = webgl;
try {
  for (const width of (process.env.QA_WIDTHS || "390,430")
    .split(",")
    .map(Number)) {
    const height = width === 430 ? 900 : 844;
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: Number(process.env.QA_DPR || 1),
    });
    if (!webgl)
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return type.startsWith("webgl")
            ? null
            : getContext.call(this, type, ...args);
        };
      });
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.goto("http://127.0.0.1:5184/#sustainability");
    await page
      .locator(
        webgl
          ? ".scene-canvas[data-ready=true][data-laptop-ready=true]"
          : ".world-fallback",
      )
      .waitFor({ timeout: 120000 });
    const session = await page.context().newCDPSession(page);
    await page.evaluate(() => {
      window.lowerQA = { captures: 0, canceled: 0, target: null };
      const capture = Element.prototype.setPointerCapture;
      Element.prototype.setPointerCapture = function (id) {
        window.lowerQA.captures++;
        return capture.call(this, id);
      };
      document.addEventListener(
        "touchmove",
        (e) => {
          if (e.defaultPrevented) window.lowerQA.canceled++;
        },
        { passive: true },
      );
    });
    const sample = () =>
      page.evaluate(() => ({
        y: scrollY,
        docHeight: document.documentElement.scrollHeight,
        section: document.documentElement.dataset.chapter,
        progress: document.querySelector(".scene-canvas")?.dataset.progress,
        laptop: document.querySelector(".scene-canvas")?.dataset.laptopAngle,
        frames: Number(
          document.querySelector(".scene-canvas")?.dataset.frames || 0,
        ),
        captures: window.lowerQA.captures,
        canceled: window.lowerQA.canceled,
        innerScroll: [...document.querySelectorAll("main *")]
          .filter((e) => e.scrollTop !== 0)
          .map((e) => ({ tag: e.tagName, cls: e.className, y: e.scrollTop })),
        menu: document
          .querySelector(".menu-toggle")
          .getAttribute("aria-expanded"),
        modal: !!document.querySelector("[role=dialog]"),
      }));
    for (const item of [
      { id: "sustainability", selector: ".living .scene-focus", offset: 0.72 },
      { id: "sustainability", selector: ".living-description a", offset: 0.5 },
      { id: "testimonies", selector: ".experience-list button", offset: 0.4 },
      {
        id: "social-content",
        selector: ".social-rail article.is-current .walkthrough-frame",
        offset: 0.78,
      },
      { id: "product", selector: ".support-gesture", offset: 0.72 },
      { id: "open-weight", selector: ".pricing-collection-image", offset: 0 },
      {
        id: "open-weight",
        selector: ".pricing-faq summary",
        offset: 0,
        natural: true,
      },
      { id: "footer", selector: ".footer-scene", offset: 0 },
      {
        id: "testimonies",
        selector: ".experience-list button",
        offset: 0.04,
        edge: true,
      },
      { id: "product", selector: ".support-gesture", offset: 0.04, edge: true },
      { id: "footer", selector: ".footer-main h2", offset: 0, edge: true },
    ].filter(
      (item) =>
        !process.env.QA_CASES ||
        process.env.QA_CASES.split(",").includes(item.id),
    )) {
      await page.locator(`#${item.id}`).evaluate((el, item) => {
        const top = el.getBoundingClientRect().top + scrollY;
        scrollTo({
          top:
            top +
            (el.offsetHeight - el.firstElementChild.clientHeight) * item.offset,
          behavior: "instant",
        });
      }, item);
      if (item.natural)
        await page
          .locator(item.selector)
          .first()
          .evaluate((el) =>
            scrollTo({
              top: el.getBoundingClientRect().top + scrollY - 350,
              behavior: "instant",
            }),
          );
      await page.waitForTimeout(400);
      const b = await page.locator(item.selector).first().boundingBox();
      const x = Math.min(width - 30, Math.max(30, b.x + b.width / 2));
      let y = Math.min(height - 160, Math.max(170, b.y + b.height / 2));
      const hit = await page.evaluate(
        ([x, y]) => {
          const el = document.elementFromPoint(x, y);
          return {
            tag: el?.tagName,
            cls: el?.className,
            ancestors: [
              ...(function* () {
                for (let p = el; p; p = p.parentElement) yield p;
              })(),
            ].map((e) => ({
              tag: e.tagName,
              cls: e.className,
              overflow: getComputedStyle(e).overflow,
              touch: getComputedStyle(e).touchAction,
              pointer: getComputedStyle(e).pointerEvents,
            })),
          };
        },
        [x, y],
      );
      const before = await sample(),
        samples = [];
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ id: 1, x, y }],
      });
      await page.waitForTimeout(650);
      for (const destination of [
        height - 110,
        120,
        height - 110,
        120,
        height - 110,
      ]) {
        const start = y;
        for (let i = 1; i <= 6; i++) {
          y = start + ((destination - start) * i) / 6;
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ id: 1, x: x + (i % 2), y }],
          });
          await page.waitForTimeout(30);
          samples.push({ fingerY: y, ...(await sample()) });
        }
        await page.waitForTimeout(70);
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      const after = await sample();
      const travel =
        Math.max(...samples.map((s) => s.y)) -
        Math.min(...samples.map((s) => s.y));
      const entry = { width, ...item, hit, before, after, travel, samples };
      report.cases.push(entry);
      for (let stroke = 1; stroke < 5; stroke++) {
        const part = samples.slice(stroke * 6, (stroke + 1) * 6);
        const direction = stroke % 2 ? -1 : 1;
        const last = part.at(-1);
        const atBoundary =
          direction < 0 ? last.y >= last.docHeight - height - 2 : last.y <= 2;
        if (!atBoundary && (last.y - part[0].y) * direction > -150)
          report.failures.push(
            `${width}/${item.id}/${item.selector}: stroke ${stroke} reverse fails`,
          );
      }
      if (
        after.captures !== before.captures ||
        after.canceled !== before.canceled ||
        after.modal ||
        after.menu !== "false" ||
        after.innerScroll.length
      )
        report.failures.push(`${width}/${item.id}: native gesture intercepted`);
      console.log(
        `${width}/${item.id}/${item.selector}: ${travel}px, hit ${hit.tag}.${hit.cls}`,
      );
    }
    // Offscreen chapter state must already match the side we return from.
    const endpointStates = [];
    for (const [id, offset] of [
      ["product", 100],
      ["social-content", 0],
      ["testimonies", 100],
      ["sustainability", 1200],
      ["grip", 100],
    ]) {
      await page.locator(`#${id}`).evaluate(
        (el, offset) =>
          scrollTo({
            top: el.getBoundingClientRect().top + scrollY + offset,
            behavior: "instant",
          }),
        offset,
      );
      await page.waitForTimeout(800);
      if (webgl)
        await page.waitForFunction(
          (id) =>
            document.querySelector(".scene-canvas")?.dataset.section === id &&
            document.querySelector(".scene-canvas")?.dataset.settled === "true",
          id,
          { timeout: 45000 },
        );
      const state = await page.evaluate(() => ({
        chapter: document.documentElement.dataset.chapter,
        rail: document
          .querySelector(".social-rail")
          .style.getPropertyValue("--rail-progress"),
        laptopProgress: Number(
          document.querySelector(".scene-canvas")?.dataset.laptopProgress,
        ),
        laptopAngle: Number(
          document.querySelector(".scene-canvas")?.dataset.laptopAngle,
        ),
      }));
      endpointStates.push({ id, ...state });
      if (report.label !== "before" && id === "product" && state.rail !== "2")
        report.failures.push(`${width}: gallery reset after exit`);
      if (
        webgl &&
        report.label !== "before" &&
        id === "testimonies" &&
        state.laptopProgress !== 1
      )
        report.failures.push(`${width}: laptop closed after exit`);
      if (
        webgl &&
        report.label !== "before" &&
        id === "grip" &&
        (state.laptopProgress !== 0 || state.laptopAngle > 1)
      )
        report.failures.push(`${width}: laptop not closed before entrance`);
    }
    report.endpointStates ??= [];
    report.endpointStates.push({ width, states: endpointStates });
    if (report.label !== "before") {
      const layers = await page
        .locator(".world,.social-rail article,.walkthrough-frame")
        .evaluateAll((els) =>
          els.map((el) => ({
            cls: el.className,
            overflow: getComputedStyle(el).overflow,
          })),
        );
      if (layers.some((layer) => layer.overflow !== "clip"))
        report.failures.push(
          `${width}: decorative nested scroll container remains`,
        );
      report.layers ??= [];
      report.layers.push({ width, layers });
    }
    for (const id of [
      "sustainability",
      "social-content",
      "product",
      "footer",
    ]) {
      await page.locator(`#${id}`).evaluate((el) =>
        scrollTo({
          top:
            el.getBoundingClientRect().top +
            scrollY +
            (el.id === "sustainability" ? 1000 : 200),
          behavior: "instant",
        }),
      );
      await page.waitForTimeout(800);
      await page.screenshot({
        path: `${out}/${report.label}-${width}-${id}.png`,
      });
    }
    await page.close();
  }
} finally {
  await fs.writeFile(
    `${out}/${report.label}.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  await server.close();
}
console.log(
  JSON.stringify({
    cases: report.cases.length,
    failures: report.failures,
    errors: report.errors,
  }),
);
if (report.failures.length || report.errors.length) process.exitCode = 1;
