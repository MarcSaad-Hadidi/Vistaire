import { createServer } from "node:http";
import { stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const ROOT = resolve(process.cwd());
const OUT_DIR = resolve(ROOT, "asset-review/3d-candidates/visual-qa");
const SCREENSHOT_DIR = resolve(OUT_DIR, "screenshots");
const PORT = 4179;

const PAIRS = [
  ["ravioles-chevre-miel", "safe", "public/models/demo/ravioles-chevre-miel.glb", "asset-review/3d-candidates/ravioles-chevre-miel/ravioles-chevre-miel.safe.glb"],
  ["ravioles-chevre-miel", "medium-targeted-review-only", "public/models/demo/ravioles-chevre-miel.glb", "asset-review/3d-candidates/ravioles-chevre-miel/ravioles-chevre-miel.medium-targeted-review-only.glb"],
  ["ravioles-chevre-miel", "aggressive-targeted-review-only", "public/models/demo/ravioles-chevre-miel.glb", "asset-review/3d-candidates/ravioles-chevre-miel/ravioles-chevre-miel.aggressive-targeted-review-only.glb"],
  ["homard-bisque", "safe", "public/models/demo/homard-bisque.glb", "asset-review/3d-candidates/homard-bisque/homard-bisque.safe.glb"],
  ["homard-bisque", "medium-targeted-review-only", "public/models/demo/homard-bisque.glb", "asset-review/3d-candidates/homard-bisque/homard-bisque.medium-targeted-review-only.glb"],
  ["homard-bisque", "aggressive-targeted-review-only", "public/models/demo/homard-bisque.glb", "asset-review/3d-candidates/homard-bisque/homard-bisque.aggressive-targeted-review-only.glb"],
  ["souffle-chocolat", "safe", "public/models/demo/souffle-chocolat.glb", "asset-review/3d-candidates/souffle-chocolat/souffle-chocolat.safe.glb"],
  ["souffle-chocolat", "medium-targeted-review-only", "public/models/demo/souffle-chocolat.glb", "asset-review/3d-candidates/souffle-chocolat/souffle-chocolat.medium-targeted-review-only.glb"],
  ["souffle-chocolat", "aggressive-targeted-review-only", "public/models/demo/souffle-chocolat.glb", "asset-review/3d-candidates/souffle-chocolat/souffle-chocolat.aggressive-targeted-review-only.glb"],
];

const ANGLES = [
  ["front", "0deg 70deg 105%"],
  ["left45", "45deg 70deg 105%"],
  ["right45", "-45deg 70deg 105%"],
  ["high", "0deg 45deg 105%"],
];

const MIMES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".glb", "model/gltf-binary"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".wasm", "application/wasm"],
]);

function toUrl(path) {
  return `/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

function htmlFor(original, candidate, orbit) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="module" src="/node_modules/@google/model-viewer/dist/model-viewer.min.js"></script>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f4f2ee; font-family: Arial, sans-serif; color: #171717; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; width: 1280px; height: 760px; }
      .panel { border: 1px solid #cfc8bd; background: #f7f5f0; }
      .label { height: 36px; padding: 9px 12px; font-size: 13px; border-bottom: 1px solid #cfc8bd; }
      model-viewer { display: block; width: 100%; height: 706px; background: #f4f2ee; }
    </style>
  </head>
  <body>
    <main class="grid">
      <section class="panel">
        <div class="label">original</div>
        <model-viewer id="original" src="${toUrl(original)}" camera-controls interaction-prompt="none" camera-orbit="${orbit}" camera-target="0m 0m 0m" field-of-view="30deg" exposure="1.05" shadow-intensity="1"></model-viewer>
      </section>
      <section class="panel">
        <div class="label">candidate</div>
        <model-viewer id="candidate" src="${toUrl(candidate)}" camera-controls interaction-prompt="none" camera-orbit="${orbit}" camera-target="0m 0m 0m" field-of-view="30deg" exposure="1.05" shadow-intensity="1"></model-viewer>
      </section>
    </main>
  </body>
</html>`;
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
      if (url.pathname === "/visual-qa.html") {
        const original = url.searchParams.get("original");
        const candidate = url.searchParams.get("candidate");
        const orbit = url.searchParams.get("orbit");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(htmlFor(original, candidate, orbit));
        return;
      }
      const decoded = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      const target = resolve(ROOT, normalize(decoded));
      if (!target.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const fileStat = await stat(target);
      if (!fileStat.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": MIMES.get(extname(target).toLowerCase()) || "application/octet-stream" });
      createReadStream(target).pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return new Promise((resolveServer) => {
    server.listen(PORT, "127.0.0.1", () => resolveServer(server));
  });
}

await mkdir(SCREENSHOT_DIR, { recursive: true });
const server = await startServer();
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 760 },
  deviceScaleFactor: 1,
});

const results = [];
try {
  for (const [slug, candidateName, original, candidate] of PAIRS) {
    for (const [angleName, orbit] of ANGLES) {
      const page = await context.newPage();
      const consoleMessages = [];
      page.on("console", (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
      const url = `http://127.0.0.1:${PORT}/visual-qa.html?original=${encodeURIComponent(original)}&candidate=${encodeURIComponent(candidate)}&orbit=${encodeURIComponent(orbit)}`;
      let loaded = false;
      let error = null;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForSelector("model-viewer#candidate", { timeout: 10_000 });
        await page.evaluate(async () => {
          const viewers = Array.from(document.querySelectorAll("model-viewer"));
          await Promise.race([
            Promise.all(viewers.map((viewer) => viewer.loaded ? Promise.resolve() : new Promise((resolve, reject) => {
              viewer.addEventListener("load", resolve, { once: true });
              viewer.addEventListener("error", reject, { once: true });
            }))),
            new Promise((_, reject) => setTimeout(() => reject(new Error("model-viewer load timeout")), 30_000)),
          ]);
        });
        loaded = true;
        await page.waitForTimeout(500);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      const output = join(SCREENSHOT_DIR, `${slug}.${candidateName}.${angleName}.png`);
      await page.screenshot({ path: output, fullPage: false });
      results.push({
        slug,
        candidateName,
        angleName,
        orbit,
        loaded,
        error,
        screenshot: output.replace(ROOT + "\\", "").replaceAll("\\", "/"),
        consoleMessages,
      });
      await page.close();
    }
  }
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

await writeFile(
  join(OUT_DIR, "visual-qa-results.json"),
  `${JSON.stringify({
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 1,
    cameraTarget: "0m 0m 0m",
    fieldOfView: "30deg",
    exposure: "1.05",
    shadowIntensity: "1",
    autoRotate: false,
    server: `http://127.0.0.1:${PORT}`,
    results,
  }, null, 2)}\n`,
);
console.log(`Wrote ${join(OUT_DIR, "visual-qa-results.json").replace(ROOT + "\\", "").replaceAll("\\", "/")}`);
