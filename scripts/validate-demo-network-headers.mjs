import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEMO_DATA = join(ROOT, "lib", "demoMenuData.ts");
const MAX_PRODUCTION_IOS_USDZ_BYTES = 5 * 1024 * 1024;

const BASE_URL = (
  process.env.VALIDATE_DEMO_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

const ROUTES = [
  "/demo",
  "/demo/dishes/ravioles-romarin",
  "/demo/dishes/homard-bisque",
  "/demo/dishes/souffle-chocolat",
  "/demo/dishes/cocktail-maison-elyse",
  "/admin",
  "/owner"
];

function readText(path) {
  return readFileSync(path, "utf8");
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK ${message}`);
}

function warn(message) {
  console.warn(`WARN ${message}`);
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function absoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, `${BASE_URL}/`).toString();
}

function extractDishes() {
  const source = readText(DEMO_DATA);
  const blocks = source.match(/\{\s*id:\s*"dish-[\s\S]*?\n  \}/g) ?? [];
  return blocks
    .map((block) => ({
      slug: block.match(/slug:\s*"([^"]+)"/)?.[1] ?? "",
      model3dUrl: block.match(/model3dUrl:\s*"([^"]*)"/)?.[1] ?? "",
      webModel3dUrl: block.match(/webModel3dUrl:\s*"([^"]*)"/)?.[1] ?? "",
      arModel3dUrl: block.match(/arModel3dUrl:\s*"([^"]*)"/)?.[1] ?? "",
      usdzUrl: block.match(/usdzUrl:\s*"([^"]*)"/)?.[1] ?? "",
      arUsdzUrl: block.match(/arUsdzUrl:\s*"([^"]*)"/)?.[1] ?? ""
    }))
    .filter((dish) => dish.slug);
}

async function head(url) {
  let response = await fetch(url, { method: "HEAD", redirect: "manual" });
  if (response.status === 405) {
    response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "manual"
    });
  }
  return response;
}

function headerIncludes(response, name, expected, label) {
  const actual = response.headers.get(name) ?? "";
  if (!actual.toLowerCase().includes(expected.toLowerCase())) {
    fail(`${label} header ${name}: expected ${expected}, got ${actual || "(missing)"}`);
    return;
  }
  ok(`${label} header ${name}: ${actual}`);
}

async function checkRoute(route) {
  const response = await head(absoluteUrl(route));
  if (route === "/owner") {
    if (![200, 302, 303, 307, 308].includes(response.status)) {
      fail(`${route} status ${response.status}`);
      return;
    }
    ok(`${route} status ${response.status}`);
    return;
  }

  if (response.status >= 400) {
    fail(`${route} status ${response.status}`);
    return;
  }
  ok(`${route} status ${response.status}`);
}

async function checkAsset(assetUrl, label, options = {}) {
  if (options.productionQuickLook && /[?#]/.test(assetUrl)) {
    fail(`${label} active arUsdzUrl must not include query string or hash`);
  }

  const response = await head(absoluteUrl(assetUrl));
  if (response.status >= 300 && response.status < 400) {
    fail(
      `${label} redirect status ${response.status}: ${
        response.headers.get("location") ?? "(missing Location)"
      }`
    );
    return;
  }

  if (response.status >= 400) {
    fail(`${label} status ${response.status}`);
    return;
  }

  ok(`${label} status ${response.status}`);
  if (options.productionQuickLook) {
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      fail(`${label} missing Content-Length for production iPhone USDZ`);
    } else if (contentLength > MAX_PRODUCTION_IOS_USDZ_BYTES) {
      fail(
        `${label} exceeds production iPhone USDZ budget over network: ${formatSize(
          contentLength
        )}`
      );
    } else {
      ok(`${label} network Content-Length within <= 5 MiB budget`);
    }
  }
  const pathname = new URL(assetUrl, "http://local").pathname;
  if (pathname.endsWith(".usdz")) {
    headerIncludes(response, "content-type", "model/vnd.usdz+zip", label);
    headerIncludes(response, "content-disposition", "inline", label);
    headerIncludes(response, "cache-control", "public", label);
    headerIncludes(response, "cache-control", "max-age=31536000", label);
    headerIncludes(response, "cache-control", "immutable", label);
    return;
  }

  if (pathname.endsWith(".glb")) {
    headerIncludes(response, "content-type", "model/gltf-binary", label);
    headerIncludes(response, "cache-control", "public", label);
    headerIncludes(response, "cache-control", "max-age=31536000", label);
    headerIncludes(response, "cache-control", "immutable", label);
    return;
  }

  if (pathname.endsWith(".js")) {
    headerIncludes(response, "content-type", "javascript", label);
    headerIncludes(response, "cache-control", "public", label);
    headerIncludes(response, "cache-control", "max-age=31536000", label);
    headerIncludes(response, "cache-control", "immutable", label);
  }
}

async function main() {
  console.log(`Validating demo network headers at ${BASE_URL}`);

  for (const route of ROUTES) {
    await checkRoute(route);
  }

  const dishes = extractDishes();
  const assets = [];
  for (const dish of dishes) {
    if (dish.model3dUrl) {
      assets.push({
        url: dish.model3dUrl,
        label: `${dish.slug} GLB ${dish.model3dUrl}`
      });
    }
    if (dish.webModel3dUrl) {
      assets.push({
        url: dish.webModel3dUrl,
        label: `${dish.slug} web GLB ${dish.webModel3dUrl}`
      });
    }
    if (dish.arModel3dUrl) {
      assets.push({
        url: dish.arModel3dUrl,
        label: `${dish.slug} AR-lite GLB ${dish.arModel3dUrl}`
      });
    }
    if (dish.usdzUrl) {
      assets.push({
        url: dish.usdzUrl,
        label: `${dish.slug} USDZ ${dish.usdzUrl}`
      });
    }
    if (dish.arUsdzUrl) {
      assets.push({
        url: dish.arUsdzUrl,
        label: `${dish.slug} AR-lite USDZ ${dish.arUsdzUrl}`,
        productionQuickLook: true
      });
    }
  }
  assets.push({
    url: "/model-viewer/meshopt-decoder-74188840.js",
    label: "model-viewer Meshopt decoder /model-viewer/meshopt-decoder-74188840.js"
  });

  if (assets.length === 0) {
    warn("No 3D assets found in demoMenuData.ts");
  }

  for (const asset of assets) {
    await checkAsset(asset.url, asset.label, {
      productionQuickLook: Boolean(asset.productionQuickLook)
    });
  }

  if (process.exitCode) {
    console.error("Demo network header validation failed.");
    process.exit(process.exitCode);
  }

  console.log("Demo network header validation completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
