import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = resolve(process.cwd());
const OUT_DIR = resolve(ROOT, "asset-review/3d-candidates/visual-qa/meshopt");
const SCREENSHOT_DIR = resolve(OUT_DIR, "screenshots");
const CONTACT_DIR = resolve(OUT_DIR, "contact-sheets");

const PAIRS = [
  {
    slug: "ravioles-chevre-miel",
    label: "Ravioles",
    original: "public/models/demo/ravioles-chevre-miel.glb",
    candidate: "asset-review/3d-candidates/ravioles-chevre-miel/ravioles-chevre-miel.meshopt-web-only.glb",
  },
  {
    slug: "homard-bisque",
    label: "Homard",
    original: "public/models/demo/homard-bisque.glb",
    candidate: "asset-review/3d-candidates/homard-bisque/homard-bisque.meshopt-web-only.glb",
  },
  {
    slug: "souffle-chocolat",
    label: "Souffle",
    original: "public/models/demo/souffle-chocolat.glb",
    candidate: "asset-review/3d-candidates/souffle-chocolat/souffle-chocolat.meshopt-web-only.glb",
  },
];

const ANGLES = [
  { name: "front", label: "face", orbit: "0deg 70deg 105%" },
  { name: "left45", label: "45 degres gauche", orbit: "45deg 70deg 105%" },
  { name: "right45", label: "45 degres droite", orbit: "-45deg 70deg 105%" },
  { name: "high", label: "vue legerement haute", orbit: "0deg 45deg 105%" },
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

function toAssetUrl(path) {
  return `/${path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")}`;
}

function rel(path) {
  return path.replace(`${ROOT}\\`, "").replaceAll("\\", "/");
}

function mib(bytes) {
  return bytes / 1024 / 1024;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function qaHtml({ original, candidate, orbit, title }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <script>
      self.ModelViewerElement = self.ModelViewerElement || {};
      self.ModelViewerElement.meshoptDecoderLocation = "/meshopt-decoder-trigger.js";
    </script>
    <script type="module" src="/node_modules/@google/model-viewer/dist/model-viewer.min.js"></script>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 1280px; height: 760px; overflow: hidden; }
      body { background: #f4f2ee; font-family: Arial, sans-serif; color: #171717; }
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
        <model-viewer
          id="original"
          src="${toAssetUrl(original)}"
          camera-controls
          disable-zoom
          interaction-prompt="none"
          loading="eager"
          reveal="auto"
          camera-orbit="${orbit}"
          camera-target="0m 0m 0m"
          field-of-view="30deg"
          exposure="1.05"
          environment-image="neutral"
          shadow-intensity="1"></model-viewer>
      </section>
      <section class="panel">
        <div class="label">candidate meshopt</div>
        <model-viewer
          id="candidate"
          src="${toAssetUrl(candidate)}"
          camera-controls
          disable-zoom
          interaction-prompt="none"
          loading="eager"
          reveal="auto"
          camera-orbit="${orbit}"
          camera-target="0m 0m 0m"
          field-of-view="30deg"
          exposure="1.05"
          environment-image="neutral"
          shadow-intensity="1"></model-viewer>
      </section>
    </main>
  </body>
</html>`;
}

function contactSheetHtml({ label, shots }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(label)} Meshopt QA</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; width: 1280px; min-height: 940px; background: #f4f2ee; font-family: Arial, sans-serif; color: #171717; }
      main { padding: 18px; }
      h1 { margin: 0 0 14px; font-size: 18px; font-weight: 600; }
      .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
      figure { margin: 0; border: 1px solid #cfc8bd; background: #f7f5f0; }
      figcaption { height: 30px; padding: 7px 10px; font-size: 12px; border-bottom: 1px solid #cfc8bd; }
      img { display: block; width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(label)} - original vs candidat Meshopt</h1>
      <section class="grid">
        ${shots.map((shot) => `<figure><figcaption>${escapeHtml(shot.angleLabel)}</figcaption><img src="${toAssetUrl(shot.screenshot)}" /></figure>`).join("")}
      </section>
    </main>
  </body>
</html>`;
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");

      if (url.pathname === "/meshopt-decoder-trigger.js") {
        res.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
        res.end("/* local model-viewer meshopt decoder trigger */");
        return;
      }

      if (url.pathname === "/visual-qa-meshopt.html") {
        const pair = PAIRS.find((item) => item.slug === url.searchParams.get("slug"));
        const angle = ANGLES.find((item) => item.name === url.searchParams.get("angle"));
        if (!pair || !angle) {
          res.writeHead(404);
          res.end("Unknown QA target");
          return;
        }
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(qaHtml({
          original: pair.original,
          candidate: pair.candidate,
          orbit: angle.orbit,
          title: `${pair.label} ${angle.label}`,
        }));
        return;
      }

      if (url.pathname === "/meshopt-contact-sheet.html") {
        const pair = PAIRS.find((item) => item.slug === url.searchParams.get("slug"));
        if (!pair) {
          res.writeHead(404);
          res.end("Unknown contact sheet");
          return;
        }
        const shots = ANGLES.map((angle) => ({
          angleLabel: angle.label,
          screenshot: `asset-review/3d-candidates/visual-qa/meshopt/screenshots/${pair.slug}.meshopt.${angle.name}.png`,
        }));
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(contactSheetHtml({ label: pair.label, shots }));
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
      res.writeHead(200, {
        "content-type": MIMES.get(extname(target).toLowerCase()) || "application/octet-stream",
        "cache-control": "no-store",
      });
      createReadStream(target).pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

async function waitForModelViewerLoad(page) {
  return page.evaluate(async () => {
    const viewers = Array.from(document.querySelectorAll("model-viewer"));
    const waitForViewer = async (viewer) => {
      await customElements.whenDefined("model-viewer");
      if (!viewer.loaded) {
        await new Promise((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error(`${viewer.id} load timeout`)), 180000);
          viewer.addEventListener("load", () => {
            window.clearTimeout(timeout);
            resolve();
          }, { once: true });
          viewer.addEventListener("error", (event) => {
            window.clearTimeout(timeout);
            reject(new Error(`${viewer.id} error: ${event.type}`));
          }, { once: true });
        });
      }
      viewer.cameraOrbit = viewer.getAttribute("camera-orbit");
      viewer.cameraTarget = viewer.getAttribute("camera-target");
      viewer.fieldOfView = viewer.getAttribute("field-of-view");
      await viewer.updateComplete;
      if (typeof viewer.jumpCameraToGoal === "function") {
        viewer.jumpCameraToGoal();
      }
    };
    await Promise.all(viewers.map(waitForViewer));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return viewers.map((viewer) => ({
      id: viewer.id,
      loaded: viewer.loaded,
      dimensions: typeof viewer.getDimensions === "function" ? viewer.getDimensions() : null,
      orbit: viewer.getAttribute("camera-orbit"),
      target: viewer.getAttribute("camera-target"),
      fieldOfView: viewer.getAttribute("field-of-view"),
      exposure: viewer.getAttribute("exposure"),
      environmentImage: viewer.getAttribute("environment-image"),
    }));
  });
}

await mkdir(SCREENSHOT_DIR, { recursive: true });
await mkdir(CONTACT_DIR, { recursive: true });

const assetSizes = {};
for (const pair of PAIRS) {
  const originalSize = (await stat(resolve(ROOT, pair.original))).size;
  const candidateSize = (await stat(resolve(ROOT, pair.candidate))).size;
  assetSizes[pair.slug] = {
    originalBytes: originalSize,
    originalMiB: Number(mib(originalSize).toFixed(4)),
    candidateBytes: candidateSize,
    candidateMiB: Number(mib(candidateSize).toFixed(4)),
    reductionPercent: Number(((1 - candidateSize / originalSize) * 100).toFixed(2)),
  };
}

const server = await startServer();
const address = server.address();
const baseUrl = `http://${address.address}:${address.port}`;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 760 },
  deviceScaleFactor: 1,
});

const results = [];
try {
  for (const pair of PAIRS) {
    for (const angle of ANGLES) {
      const page = await context.newPage();
      page.setDefaultTimeout(180000);
      const consoleMessages = [];
      const failedRequests = [];
      page.on("console", (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
      page.on("requestfailed", (request) => failedRequests.push({
        url: request.url(),
        failure: request.failure()?.errorText || "unknown",
      }));

      const url = `${baseUrl}/visual-qa-meshopt.html?slug=${encodeURIComponent(pair.slug)}&angle=${encodeURIComponent(angle.name)}`;
      const output = join(SCREENSHOT_DIR, `${pair.slug}.meshopt.${angle.name}.png`);
      let loadDetails = [];
      let loaded = false;
      let error = null;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForSelector("model-viewer#candidate", { timeout: 10000 });
        loadDetails = await waitForModelViewerLoad(page);
        loaded = loadDetails.every((item) => item.loaded);
        await page.waitForTimeout(750);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }

      await page.screenshot({ path: output, fullPage: false });
      results.push({
        slug: pair.slug,
        label: pair.label,
        angleName: angle.name,
        angleLabel: angle.label,
        orbit: angle.orbit,
        loaded,
        error,
        screenshot: rel(output),
        loadDetails,
        failedRequests,
        consoleMessages,
      });
      await page.close();
    }
  }

  const contactContext = await browser.newContext({
    viewport: { width: 1280, height: 940 },
    deviceScaleFactor: 1,
  });
  try {
    for (const pair of PAIRS) {
      const page = await contactContext.newPage();
      const url = `${baseUrl}/meshopt-contact-sheet.html?slug=${encodeURIComponent(pair.slug)}`;
      const output = join(CONTACT_DIR, `${pair.slug}.meshopt.contact-sheet.png`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.screenshot({ path: output, fullPage: true });
      page.close();
      const pairResults = results.filter((item) => item.slug === pair.slug);
      for (const result of pairResults) {
        result.contactSheet = rel(output);
      }
    }
  } finally {
    await contactContext.close();
  }
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

const summary = {
  generatedAt: new Date().toISOString(),
  purpose: "Non-production visual QA for original GLB vs Meshopt GLB candidates.",
  productionSafety: {
    publicModelsModified: false,
    demoMenuDataModified: false,
    usdzTouched: false,
    candidatesServedFromPublic: false,
  },
  viewport: { width: 1280, height: 760 },
  deviceScaleFactor: 1,
  cameraTarget: "0m 0m 0m",
  fieldOfView: "30deg",
  exposure: "1.05",
  environmentImage: "neutral",
  shadowIntensity: "1",
  autoRotate: false,
  meshoptDecoder: "model-viewer configured with local meshopt decoder trigger",
  assetSizes,
  results,
};

await writeFile(join(OUT_DIR, "meshopt-visual-qa-results.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Wrote ${rel(join(OUT_DIR, "meshopt-visual-qa-results.json"))}`);
