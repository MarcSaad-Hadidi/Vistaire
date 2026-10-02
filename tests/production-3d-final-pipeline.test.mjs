import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { chromium } from "@playwright/test";
import { unzipSync, zipSync, zlibSync } from "fflate";
import { selectOptimizationCandidate } from "../scripts/3d/shared/pipeline-command.mjs";

// Visual compare renders in Chromium; the static-quality CI job installs no browser.
const visualCompareSkip = existsSync(chromium.executablePath())
  ? false
  : "Playwright Chromium is not installed";

const stableIso = "2026-05-24T00:00:00.000Z";
const strictPromise =
  "visually indistinguishable under deterministic multi-angle mobile dining-distance review within strict thresholds";

async function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "vistaire-final-3d-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function padJson(value) {
  const raw = Buffer.from(JSON.stringify(value), "utf8");
  const padding = (4 - (raw.length % 4)) % 4;
  return Buffer.concat([raw, Buffer.alloc(padding, 0x20)]);
}

function padBin(bytes) {
  const padding = (4 - (bytes.length % 4)) % 4;
  return Buffer.concat([bytes, Buffer.alloc(padding)]);
}

function makeGlb(gltf, bin = Buffer.alloc(64)) {
  const json = padJson(gltf);
  const binChunk = padBin(bin);
  const totalLength = 12 + 8 + json.length + 8 + binChunk.length;
  const buffer = Buffer.alloc(totalLength);
  buffer.write("glTF", 0, "utf8");
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(totalLength, 8);
  buffer.writeUInt32LE(json.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  json.copy(buffer, 20);
  const binHeaderOffset = 20 + json.length;
  buffer.writeUInt32LE(binChunk.length, binHeaderOffset);
  buffer.writeUInt32LE(0x004e4942, binHeaderOffset + 4);
  binChunk.copy(buffer, binHeaderOffset + 8);
  return buffer;
}

function makeDishGltf(overrides = {}) {
  return {
    asset: { version: "2.0", generator: "vistaire-final-test" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "Assiette" }],
    buffers: [{ byteLength: 64 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 }
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-0.25, 0, -0.2],
        max: [0.25, 0.08, 0.2]
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 3,
        type: "SCALAR"
      }
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: "Sauce champagne", pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }],
    images: [{ bufferView: 0, mimeType: "image/png", name: "albedo" }],
    extensionsUsed: ["KHR_materials_unlit"],
    ...overrides
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function runNode(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd(), ...options });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function makeUsdz() {
  const texture = Buffer.alloc(60_008);
  Buffer.from("89504e470d0a1a0a", "hex").copy(texture);
  let state = 0x12345678;
  for (let index = 8; index < texture.length; index += 1) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    texture[index] = state & 0xff;
  }
  const usda = [
    "#usda 1.0",
    "def Mesh \"Dish\" {",
    "  point3f[] points = [(-0.25, 0, -0.2), (0.25, 0, -0.2), (0, 0.08, 0.2)]",
    "  int[] faceVertexCounts = [3]",
    "  int[] faceVertexIndices = [0, 1, 2]",
    "}",
    "def Material \"PremiumSauce\" {}"
  ].join("\n");
  return Buffer.from(
    zipSync(
      {
        "model.usda": Buffer.from(usda),
        "textures/albedo.png": texture
      },
      { level: 0 }
    )
  );
}

function realDeviceQa() {
  return {
    required: true,
    iphoneQuickLook: {
      required: true,
      status: "passed",
      device: "iPhone 15 Pro",
      os: "iOS 18.5",
      testedBy: "QA Bot",
      testedAt: stableIso,
      evidence: {
        path: "assets/3d/reports/maison-elyse/main/homard-bisque/v1/device-qa/iphone.md",
        sha256: "a".repeat(64),
        bytes: 512
      }
    },
    androidSceneViewer: {
      required: true,
      status: "passed",
      device: "Pixel 8",
      os: "Android 15",
      testedBy: "QA Bot",
      testedAt: stableIso,
      evidence: {
        path: "assets/3d/reports/maison-elyse/main/homard-bisque/v1/device-qa/android.md",
        sha256: "b".repeat(64),
        bytes: 640
      }
    }
  };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  const output = Buffer.alloc(4);
  output.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return output;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, typeBytes, data, crc32(Buffer.concat([typeBytes, data]))]);
}

function makePng({ width = 64, height = 64, changedPixel = false, changedValue = 12, diff = false, filter = 0 } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = filter;
    const unfiltered = Buffer.alloc(width * 4);
    for (let x = 0; x < width; x += 1) {
      const index = x * 4;
      const changed = changedPixel && x === 0 && y === 0;
      const value = diff && changed ? 255 : changed ? changedValue : 0;
      unfiltered[index] = value;
      unfiltered[index + 1] = value;
      unfiltered[index + 2] = value;
      unfiltered[index + 3] = 255;
    }
    for (let index = 0; index < unfiltered.length; index += 1) {
      const left = index >= 4 ? unfiltered[index - 4] : 0;
      if (filter === 0) raw[row + 1 + index] = unfiltered[index];
      else if (filter === 1) raw[row + 1 + index] = (unfiltered[index] - left) & 0xff;
      else throw new Error(`unsupported fixture PNG filter ${filter}`);
    }
  }
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", Buffer.from(zlibSync(raw))),
    pngChunk("IEND")
  ]);
}

function makeRenderableDishGlb() {
  const positions = Buffer.alloc(36);
  [
    -0.25, 0, -0.2,
    0.25, 0, -0.2,
    0, 0.08, 0.2
  ].forEach((value, index) => positions.writeFloatLE(value, index * 4));
  const normals = Buffer.alloc(36);
  [
    0, 1, 0,
    0, 1, 0,
    0, 1, 0
  ].forEach((value, index) => normals.writeFloatLE(value, index * 4));
  const texcoords = Buffer.alloc(24);
  [
    0, 0,
    1, 0,
    0.5, 1
  ].forEach((value, index) => texcoords.writeFloatLE(value, index * 4));
  const indices = Buffer.alloc(6);
  [0, 1, 2].forEach((value, index) => indices.writeUInt16LE(value, index * 2));
  const texture = makePng({ width: 64, height: 64 });
  const imageOffset = positions.length + normals.length + texcoords.length + indices.length + 2;
  const bin = Buffer.concat([positions, normals, texcoords, indices, Buffer.alloc(2), texture]);
  const gltf = makeDishGltf({
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.length },
      { buffer: 0, byteOffset: positions.length, byteLength: normals.length },
      { buffer: 0, byteOffset: positions.length + normals.length, byteLength: texcoords.length },
      { buffer: 0, byteOffset: positions.length + normals.length + texcoords.length, byteLength: indices.length },
      { buffer: 0, byteOffset: imageOffset, byteLength: texture.length }
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-0.25, 0, -0.2],
        max: [0.25, 0.08, 0.2]
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 3,
        type: "VEC3"
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: 3,
        type: "VEC2"
      },
      {
        bufferView: 3,
        componentType: 5123,
        count: 3,
        type: "SCALAR"
      }
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    images: [{ bufferView: 4, mimeType: "image/png", name: "albedo" }]
  });
  return makeGlb(gltf, bin);
}

function usdzTextBundle(bytes) {
  const zip = unzipSync(bytes);
  return Object.entries(zip)
    .filter(([name]) => /\.usd[ac]?$/i.test(name))
    .map(([, entry]) => Buffer.from(entry).toString("utf8"))
    .join("\n");
}

function writePublicFile(root, url, bytes) {
  const filePath = join(root, "public", url.replace(/^\//, ""));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, bytes);
  return {
    filePath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function strictVisualQuality(reviewer = "QA Bot") {
  const angles = ["front", "left", "right", "top"];
  return {
    status: "passed",
    score: 0.991,
    promise: strictPromise,
    method: "deterministic-render-comparison",
    report: "assets/3d/reports/maison-elyse/demo/plat-final/v1/visual-report.json",
    reportArtifacts: {
      web: {
        before: "renders/web/front-before.png",
        after: "renders/web/front-after.png",
        diff: "renders/web/front-diff.png"
      },
      mobile: {
        before: "renders/mobile/front-before.png",
        after: "renders/mobile/front-after.png",
        diff: "renders/mobile/front-diff.png"
      },
      arLite: {
        before: "renders/ar-lite/front-before.png",
        after: "renders/ar-lite/front-after.png",
        diff: "renders/ar-lite/front-diff.png"
      }
    },
    angleReports: ["web", "mobile", "arLite"].flatMap((variant) =>
      angles.map((angle) => ({
        variant,
        angle,
        status: "passed",
        before: `renders/${variant}/${angle}-before.png`,
        after: `renders/${variant}/${angle}-after.png`,
        diff: `renders/${variant}/${angle}-diff.png`,
        ssim: 0.992,
        perceptualScore: 0.991,
        maxDiffRatio: 0.001
      }))
    ),
    meanSsim: 0.992,
    perceptualScore: 0.991,
    maxDiffRatio: 0.001,
    maxSilhouetteDiff: 0.001,
    maxColorDelta: 0.01,
    maxTextureBlurDelta: 0.01,
    maxMaterialDrift: 0.01,
    maxScaleDriftMeters: 0.001,
    maxOriginDriftMeters: 0.001,
    lowPolyVisibilityScore: 0.001,
    appetitePreservationScore: 0.99,
    thresholds: {
      meanSsim: 0.985,
      perceptualScore: 0.98,
      maxDiffRatio: 0.004,
      maxSilhouetteDiff: 0.002,
      maxColorDelta: 0.015,
      maxTextureBlurDelta: 0.02,
      maxMaterialDrift: 0.02,
      maxScaleDriftMeters: 0.003,
      maxOriginDriftMeters: 0.003,
      maxLowPolyVisibility: 0.01,
      minAppetitePreservation: 0.98
    },
    checks: {
      textureSharpness: { status: "passed" },
      silhouette: { status: "passed" },
      color: { status: "passed" },
      material: { status: "passed" },
      scaleOrigin: { status: "passed" },
      lowPoly: { status: "passed" },
      appetite: { status: "passed" }
    },
    manualReview: {
      required: true,
      status: "approved",
      approvalType: "human",
      approvedBy: reviewer,
      approvedAt: stableIso
    },
    realDeviceQa: realDeviceQa()
  };
}

function writeVisualEvidenceFiles(root, manifest) {
  const beforePng = makePng({ filter: 1 });
  const afterPng = makePng({ changedPixel: true, filter: 1 });
  const diffPng = makePng({ changedPixel: true, diff: true, filter: 1 });
  const reportReference = typeof manifest.visualQuality.report === "string"
    ? manifest.visualQuality.report
    : manifest.visualQuality.report.path;
  const reportPath = join(root, reportReference);
  mkdirSync(dirname(reportPath), { recursive: true });
  const writeRef = (container, key) => {
    const ref = container[key];
    const bytes = key === "before" ? beforePng : key === "after" ? afterPng : diffPng;
    const filePath = join(root, ref);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, bytes);
    container[key] = {
      path: ref,
      sha256: sha256(bytes),
      width: 64,
      height: 64
    };
  };
  for (const triplet of Object.values(manifest.visualQuality.reportArtifacts)) {
    writeRef(triplet, "before");
    writeRef(triplet, "after");
    writeRef(triplet, "diff");
  }
  for (const angleReport of manifest.visualQuality.angleReports) {
    writeRef(angleReport, "before");
    writeRef(angleReport, "after");
    writeRef(angleReport, "diff");
  }
  const reportBytes = Buffer.from(`${JSON.stringify({
    status: manifest.visualQuality.status,
    promise: manifest.visualQuality.promise,
    method: manifest.visualQuality.method,
    source: {
      sha256: manifest.sourceAnalysis.sha256
    },
    variants: Object.fromEntries(
      ["web", "mobile", "arLite"].map((variantKey) => [
        variantKey,
        {
          candidate: {
            sha256: manifest.variants[variantKey].sha256
          }
        }
      ])
    )
  }, null, 2)}\n`);
  writeFileSync(reportPath, reportBytes);
  manifest.visualQuality.report = {
    path: reportReference,
    sha256: sha256(reportBytes)
  };
}

function writeBlankDiffEvidenceFiles(root, manifest) {
  const beforeRender = makePng({ changedPixel: true, changedValue: 12, filter: 1 });
  const afterRender = makePng({ changedPixel: true, changedValue: 13, filter: 1 });
  const blankDiff = makePng({ filter: 1 });

  const writeRef = (container, key, bytes) => {
    const currentRef = container[key];
    const ref = typeof currentRef === "string" ? currentRef : currentRef.path;
    const filePath = join(root, ref);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, bytes);
    container[key] = {
      path: ref,
      sha256: sha256(bytes),
      width: 64,
      height: 64
    };
  };

  const writeTriplet = (triplet) => {
    writeRef(triplet, "before", beforeRender);
    writeRef(triplet, "after", afterRender);
    writeRef(triplet, "diff", blankDiff);
  };

  for (const triplet of Object.values(manifest.visualQuality.reportArtifacts)) {
    writeTriplet(triplet);
  }
  for (const angleReport of manifest.visualQuality.angleReports) {
    writeTriplet(angleReport);
  }
}

function writeApprovedManifest(root, version, previousVersion = null, { writeVisualEvidence = false } = {}) {
  const base = `/models/restaurants/maison-elyse/demo/plat-final/${version}`;
  const glb = makeGlb(makeDishGltf());
  const arLiteGlb = makeGlb(
    makeDishGltf({
      asset: { version: "2.0", generator: "vistaire-final-test-ar-lite" }
    })
  );
  const usdz = makeUsdz();
  const poster = makePng();
  const web = writePublicFile(root, `${base}/web/plat-final-web.glb`, glb);
  const mobile = writePublicFile(root, `${base}/mobile/plat-final-mobile.glb`, glb);
  const arLite = writePublicFile(root, `${base}/ar-lite/plat-final-ar-lite.glb`, arLiteGlb);
  const iosUsdz = writePublicFile(root, `${base}/ios/plat-final.usdz`, usdz);
  const posterFile = writePublicFile(root, `${base}/poster/plat-final.png`, poster);
  const manifest = {
    schemaVersion: 2,
    kind: "vistaire.dish-3d-manifest",
    restaurantSlug: "maison-elyse",
    menuSlug: "demo",
    dishSlug: "plat-final",
    activeVersion: version,
    status: "approved",
    validationStatus: "passed",
    variants: {
      web: { url: `${base}/web/plat-final-web.glb`, bytes: web.bytes, sha256: web.sha256, validationStatus: "passed" },
      mobile: { url: `${base}/mobile/plat-final-mobile.glb`, bytes: mobile.bytes, sha256: mobile.sha256, validationStatus: "passed" },
      arLite: {
        url: `${base}/ar-lite/plat-final-ar-lite.glb`,
        bytes: arLite.bytes,
        sha256: arLite.sha256,
        validationStatus: "passed",
        optimizationMethod: "mesh-simplification",
        extensionsRequired: []
      },
      iosUsdz: {
        url: `${base}/ios/plat-final.usdz`,
        bytes: iosUsdz.bytes,
        sha256: iosUsdz.sha256,
        validationStatus: "passed",
        productionFaithful: true
      },
      poster: {
        url: `${base}/poster/plat-final.png`,
        bytes: posterFile.bytes,
        sha256: posterFile.sha256,
        validationStatus: "passed",
        placeholder: false,
        productionPoster: true
      }
    },
    physicalScaleMeters: { width: 0.5, height: 0.08, depth: 0.4 },
    bounds: {
      min: [-0.25, 0, -0.2],
      max: [0.25, 0.08, 0.2],
      centeredXZ: true,
      groundedY: true
    },
    budgets: { profile: "simpleDish" },
    sourceAnalysis: {
      bytes: glb.length,
      sha256: sha256(glb),
      meshes: 1,
      primitives: 1,
      triangles: 1,
      vertices: 3,
      materials: 1,
      textures: 1,
      images: 1,
      externalUris: [],
      classification: "simpleDish"
    },
    visualQuality: strictVisualQuality(),
    quality: {
      manualVisualApprovalRequired: true,
      manualVisualApproved: true,
      approvedBy: "QA Bot",
      manualReview: {
        status: "approved",
        approvalType: "human",
        approvedBy: "QA Bot",
        approvedAt: stableIso
      },
      realDeviceQa: realDeviceQa(),
      notes: []
    },
    lifecycle: {
      phase: "approved",
      generatedBy: "test",
      generatedAt: stableIso
    },
    rollback: {
      previousVersion,
      fromVersion: null,
      toVersion: null
    },
    validation: { warnings: [], fails: [] },
    generatedAt: stableIso,
    approvedAt: stableIso,
    publishedAt: null
  };
  if (writeVisualEvidence) writeVisualEvidenceFiles(root, manifest);
  const manifestPath = join(root, "public", base, "manifest.json");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

function cdnVariantDirectory(variantKey) {
  return variantKey === "arLite" ? "ar-lite" : variantKey === "iosUsdz" ? "ios" : variantKey;
}

function contentTypeForCdnTest(variantKey, url) {
  if (variantKey === "iosUsdz" || url.endsWith(".usdz")) return "model/vnd.usdz+zip";
  if (["web", "mobile", "arLite"].includes(variantKey) || url.endsWith(".glb")) return "model/gltf-binary";
  if (url.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function rewriteManifestToCdn(manifestPath, version, prefix = "vistaire") {
  const manifest = readJson(manifestPath);
  for (const [variantKey, variant] of Object.entries(manifest.variants)) {
    const directory = cdnVariantDirectory(variantKey);
    variant.url = `https://cdn.example.com/${prefix}/maison-elyse/demo/plat-final/${version}/${directory}/${variant.url.split("/").pop()}`;
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function writePassingNetworkReport(root, manifest) {
  const reportPath = join(root, "assets", "3d", "reports", manifest.restaurantSlug, manifest.menuSlug, manifest.dishSlug, manifest.activeVersion, "network-validation.json");
  mkdirSync(dirname(reportPath), { recursive: true });
  const assets = Object.entries(manifest.variants).map(([variantKey, variant]) => ({
    label: `${manifest.restaurantSlug}/${manifest.menuSlug}/${manifest.dishSlug}/${variantKey}`,
    role: variantKey,
    url: variant.url,
    status: 200,
    getStatus: 200,
    contentType: contentTypeForCdnTest(variantKey, variant.url),
    contentDisposition: variantKey === "iosUsdz" ? "inline" : "",
    cacheControl: "public, max-age=31536000, immutable",
    accessControlAllowOrigin: variantKey === "iosUsdz" ? "" : "*",
    contentLength: variant.bytes,
    fetchedBytes: variant.bytes,
    fetchedSha256: variant.sha256
  }));
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        ok: true,
        name: "network-headers",
        metrics: { baseUrl: "https://cdn.example.com", assets },
        warnings: [],
        fails: []
      },
      null,
      2
    )}\n`
  );
  return reportPath;
}

function setManifestBackToReview(manifest, reason = "final approval pending") {
  manifest.status = "review";
  manifest.validationStatus = "failed";
  manifest.validation = { warnings: [], fails: [reason] };
  manifest.approvedAt = null;
  manifest.publishedAt = null;
  manifest.lifecycle.phase = "review";
  return manifest;
}

function writeEvidenceNote(root, relativePath, text = "Real-device QA evidence note") {
  const filePath = join(root, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${text}\n`);
  return {
    path: relativePath,
    sha256: sha256(readFileSync(filePath))
  };
}

function copyManifestPublicAssetsToWork(root, manifest) {
  for (const [variantKey, variant] of Object.entries(manifest.variants)) {
    const sourcePath = join(root, "public", variant.url.replace(/^\//, ""));
    const targetPath = join(
      root,
      "assets",
      "3d",
      "work",
      manifest.restaurantSlug,
      manifest.menuSlug,
      manifest.dishSlug,
      manifest.activeVersion,
      variantKey === "arLite" ? "ar-lite" : variantKey === "iosUsdz" ? "ios" : variantKey,
      variant.url.split("/").pop()
    );
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, readFileSync(sourcePath));
  }
}

function writeApprovedV1Manifest(root) {
  const base = "/models/restaurants/maison-elyse/demo/plat-final/v1";
  const glb = makeGlb(makeDishGltf());
  const usdz = makeUsdz();
  const poster = makePng();
  const web = writePublicFile(root, `${base}/web/plat-final-web.glb`, glb);
  const mobile = writePublicFile(root, `${base}/mobile/plat-final-mobile.glb`, glb);
  const arLite = writePublicFile(root, `${base}/ar-lite/plat-final-ar-lite.glb`, glb);
  const iosUsdz = writePublicFile(root, `${base}/ios/plat-final.usdz`, usdz);
  const posterFile = writePublicFile(root, `${base}/poster/plat-final.webp`, poster);
  const manifest = {
    schemaVersion: 1,
    restaurantSlug: "maison-elyse",
    menuSlug: "demo",
    dishSlug: "plat-final",
    activeVersion: "v1",
    status: "approved",
    validationStatus: "passed",
    variants: {
      web: { url: `${base}/web/plat-final-web.glb`, bytes: web.bytes, sha256: web.sha256, validationStatus: "passed" },
      mobile: { url: `${base}/mobile/plat-final-mobile.glb`, bytes: mobile.bytes, sha256: mobile.sha256, validationStatus: "passed" },
      arLite: {
        url: `${base}/ar-lite/plat-final-ar-lite.glb`,
        bytes: arLite.bytes,
        sha256: arLite.sha256,
        validationStatus: "passed",
        extensionsRequired: []
      },
      iosUsdz: {
        url: `${base}/ios/plat-final.usdz`,
        bytes: iosUsdz.bytes,
        sha256: iosUsdz.sha256,
        validationStatus: "passed"
      },
      poster: {
        url: `${base}/poster/plat-final.webp`,
        bytes: posterFile.bytes,
        sha256: posterFile.sha256,
        validationStatus: "passed"
      }
    },
    bytes: {
      total: web.bytes + mobile.bytes + arLite.bytes + iosUsdz.bytes + posterFile.bytes
    },
    quality: {
      manualVisualApprovalRequired: true,
      manualVisualApproved: true,
      approvedBy: "QA Bot"
    },
    visualQuality: {
      status: "passed",
      manualReview: {
        required: true,
        status: "approved",
        approvedBy: "QA Bot",
        approvedAt: stableIso
      }
    },
    validation: { warnings: [], fails: [] },
    generatedAt: stableIso,
    approvedAt: stableIso,
    publishedAt: null
  };
  const manifestPath = join(root, "public", base, "manifest.json");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

function readVisualReport(root, outDir) {
  const reportPath = join(outDir, "visual-report.json");
  assert.equal(existsSync(reportPath), true, "visual-report.json should exist");
  const report = readJson(reportPath);
  assert.equal(Array.isArray(report.angleReports), true);
  return report;
}

test("analyze-source emits source evidence, geometry metrics, and a markdown review note", () =>
  withTempDir(async (dir) => {
    const sourcePath = join(dir, "source", "dish.glb");
    const reportPath = join(dir, "reports", "analysis.json");
    const markdownPath = join(dir, "reports", "analysis.md");
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, makeGlb(makeDishGltf()));

    const result = await runNode([
      "scripts/3d/analyze-source.mjs",
      "--source",
      sourcePath,
      "--out",
      reportPath,
      "--markdown",
      markdownPath,
      "--json"
    ]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(existsSync(reportPath), true);
    assert.equal(existsSync(markdownPath), true);
    const parsed = readJson(reportPath);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.metrics.bytes, readFileSync(sourcePath).byteLength);
    assert.equal(parsed.metrics.sha256, sha256(readFileSync(sourcePath)));
    assert.equal(parsed.metrics.meshes, 1);
    assert.equal(parsed.metrics.primitives, 1);
    assert.equal(parsed.metrics.vertices, 3);
    assert.equal(parsed.metrics.triangles, 1);
    assert.deepEqual(parsed.metrics.bounds.dimensionsMeters, [0.5, 0.08, 0.4]);
    assert.deepEqual(parsed.metrics.externalUris, []);
  }));

test("optimize-dish writes versioned variants and rejects them until strict visual identity evidence exists", () =>
  withTempDir(async (dir) => {
    const sourcePath = join(dir, "assets", "3d", "source", "maison-elyse", "demo", "plat-final", "source.glb");
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, makeRenderableDishGlb());

    const result = await runNode([
      "scripts/3d/optimize-dish.mjs",
      "--restaurant",
      "maison-elyse",
      "--menu",
      "demo",
      "--dish",
      "plat-final",
      "--version",
      "vfinal",
      "--source",
      sourcePath,
      "--root",
      dir,
      "--write",
      "--allow-public-binaries",
      "--approved-by",
      "QA Bot",
      "--json"
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /strict rendered visual identity/i);
    const manifestPath = join(
      dir,
      "public",
      "models",
      "restaurants",
      "maison-elyse",
      "demo",
      "plat-final",
      "vfinal",
      "manifest.json"
    );
    const manifest = readJson(manifestPath);
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(manifest.status, "review");
    assert.equal(manifest.validationStatus, "failed");
    assert.equal(manifest.quality.manualReview.status, "pending");
    assert.equal(manifest.quality.manualVisualApproved, false);
    assert.equal(manifest.visualQuality.status, "failed");
    assert.equal(manifest.sourceAnalysis.triangles, 1);
    assert.notEqual(manifest.variants.arLite.optimizationMethod, "copy");
    assert.doesNotMatch(manifest.variants.arLite.optimizer?.command ?? "", /\bcopy\b/i);
    assert.notEqual(manifest.variants.arLite.sha256, manifest.sourceAnalysis.sha256);
    assert.equal(manifest.variants.iosUsdz.proxy, false);
    assert.equal(manifest.variants.iosUsdz.productionFaithful, false);
    assert.equal(manifest.variants.iosUsdz.faithfulnessStatus, "unproven-until-real-device-qa");
    for (const key of ["web", "mobile", "arLite", "iosUsdz", "poster"]) {
      assert.equal(existsSync(join(dir, "public", manifest.variants[key].url)), false, key);
      assert.equal(typeof manifest.variants[key].sha256, "string");
      assert.equal(manifest.variants[key].sha256.length, 64);
    }
    const usdzText = usdzTextBundle(
      readFileSync(join(dir, "assets", "3d", "work", "maison-elyse", "demo", "plat-final", "vfinal", "ios", "plat-final.usdz"))
    );
    assert.match(usdzText, /\bdef\s+Mesh\b|\bpoint3f\[\]\s+points\b/);
    assert.doesNotMatch(usdzText, /\bDishProxy\b|vistaire:sourceSha256/);
    assert.equal(
      existsSync(join(dir, "assets", "3d", "work", "maison-elyse", "demo", "plat-final", "vfinal", "web", "plat-final-web.glb")),
      true
    );
    assert.equal(existsSync(join(dir, "assets", "3d", "reports", "maison-elyse", "demo", "plat-final", "vfinal", "visual-quality.json")), true);
  }));

test("optimize-dish rejects generated staging assets until strict rendered visual identity evidence exists", () =>
  withTempDir(async (dir) => {
    const sourcePath = join(dir, "assets", "3d", "source", "maison-elyse", "demo", "plat-final", "source.glb");
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, makeRenderableDishGlb());

    const result = await runNode([
      "scripts/3d/optimize-dish.mjs",
      "--restaurant",
      "maison-elyse",
      "--menu",
      "demo",
      "--dish",
      "plat-final",
      "--version",
      "vstrict",
      "--source",
      sourcePath,
      "--root",
      dir,
      "--write",
      "--allow-public-binaries",
      "--approved-by",
      "QA Bot",
      "--json"
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /strict rendered visual identity/i);

    const manifestPath = join(
      dir,
      "public",
      "models",
      "restaurants",
      "maison-elyse",
      "demo",
      "plat-final",
      "vstrict",
      "manifest.json"
    );
    const manifest = readJson(manifestPath);
    assert.equal(manifest.status, "review");
    assert.equal(manifest.validationStatus, "failed");
    assert.equal(manifest.visualQuality.status, "failed");
    assert.equal(manifest.quality.manualVisualApproved, false);
  }));

test("publish refuses a generated review manifest even when CLI approval flags are supplied", () =>
  withTempDir(async (dir) => {
    const sourcePath = join(dir, "assets", "3d", "source", "maison-elyse", "demo", "plat-final", "source.glb");
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, makeRenderableDishGlb());

    await runNode([
      "scripts/3d/optimize-dish.mjs",
      "--restaurant",
      "maison-elyse",
      "--menu",
      "demo",
      "--dish",
      "plat-final",
      "--version",
      "vproxy",
      "--source",
      sourcePath,
      "--root",
      dir,
      "--write",
      "--allow-public-binaries",
      "--approved-by",
      "QA Bot",
      "--json"
    ]);

    const manifestPath = join(
      dir,
      "public",
      "models",
      "restaurants",
      "maison-elyse",
      "demo",
      "plat-final",
      "vproxy",
      "manifest.json"
    );
    const publish = await runNode([
      "scripts/3d/publish.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--write",
      "--quality-approved",
      "--approved-by",
      "QA Bot",
      "--json"
    ]);

    assert.equal(publish.code, 1);
    assert.match(publish.stdout, /pre-approved strict visual identity manifest/i);
  }));

test("publish refuses approved schema v2 manifests when visual report files are missing", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vmissing");

    const publish = await runNode([
      "scripts/3d/publish.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--write",
      "--quality-approved",
      "--approved-by",
      "QA Bot",
      "--json"
    ]);

    assert.equal(publish.code, 1);
    assert.match(publish.stdout, /visualQuality\.report/i);
    assert.match(publish.stdout, /visualQuality\.reportArtifacts\.web\.before/i);
    assert.match(publish.stdout, /visualQuality\.reportArtifacts\.web\.after/i);
    assert.match(publish.stdout, /visualQuality\.reportArtifacts\.web\.diff/i);
  }));

test("publish refuses blank visual diff artifacts even when recomputed thresholds pass", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vblankdiff", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    writeBlankDiffEvidenceFiles(dir, manifest);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const publish = await runNode([
      "scripts/3d/publish.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--write",
      "--quality-approved",
      "--approved-by",
      "QA Bot",
      "--json"
    ]);

    assert.equal(publish.code, 1);
    assert.match(publish.stdout, /diff image must not be blank/i);
  }));

test("publish refuses approved manifests when real-device QA evidence is absent", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vnoqa", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    delete manifest.quality.realDeviceQa;
    delete manifest.visualQuality.realDeviceQa;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const publish = await runNode([
      "scripts/3d/publish.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--write",
      "--quality-approved",
      "--approved-by",
      "QA Bot",
      "--json"
    ]);

    assert.equal(publish.code, 1);
    assert.match(publish.stdout, /realDeviceQa/i);
  }));

test("publish refuses schema v1 manifests even when legacy approval fields are present", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedV1Manifest(dir);

    const publish = await runNode([
      "scripts/3d/publish.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--write",
      "--quality-approved",
      "--approved-by",
      "QA Bot",
      "--json"
    ]);

    assert.equal(publish.code, 1);
    assert.match(publish.stdout, /schemaVersion.*2/i);
  }));

test("optimize-dish refuses CDN mode when the CDN origin is not allowlisted", () =>
  withTempDir(async (dir) => {
    const sourcePath = join(dir, "assets", "3d", "source", "maison-elyse", "demo", "plat-final", "source.glb");
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, makeGlb(makeDishGltf()));

    const result = await runNode([
      "scripts/3d/optimize-dish.mjs",
      "--restaurant",
      "maison-elyse",
      "--menu",
      "demo",
      "--dish",
      "plat-final",
      "--version",
      "vcdn",
      "--source",
      sourcePath,
      "--root",
      dir,
      "--write",
      "--cdn-base-url",
      "https://cdn.example.com/vistaire",
      "--json"
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /allowlisted/i);
    assert.equal(
      existsSync(join(dir, "public", "models", "restaurants", "maison-elyse", "demo", "plat-final", "vcdn")),
      false
    );
  }));

test("visual-compare renders deterministic before/after/diff artifacts for identical GLBs", { skip: visualCompareSkip }, () =>
  withTempDir(async (dir) => {
    const sourcePath = join(dir, "source.glb");
    const candidatePath = join(dir, "candidate.glb");
    const outDir = join(dir, "assets", "3d", "reports", "visual", "mobile");
    const renderable = makeRenderableDishGlb();
    writeFileSync(sourcePath, renderable);
    writeFileSync(candidatePath, renderable);

    const result = await runNode([
      "scripts/3d/visual-compare.mjs",
      "--source",
      sourcePath,
      "--candidate",
      candidatePath,
      "--variant",
      "mobile",
      "--out",
      outDir,
      "--root",
      dir,
      "--threshold",
      "strict",
      "--json"
    ]);

    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    const report = readVisualReport(dir, outDir);
    const angles = new Set(report.angleReports.map((entry) => entry.angle));
    for (const angle of [
      "front",
      "left",
      "right",
      "top",
      "three-quarter",
      "close-up-signature",
      "table-distance",
      "mobile-distance"
    ]) {
      assert.equal(angles.has(angle), true, `missing ${angle}`);
    }
    assert.equal(report.status, "passed");
    assert.equal(report.variant, "mobile");
    assert.equal(report.meanSsim >= 0.985, true);
    assert.equal(report.perceptualScore >= 0.98, true);
    assert.equal(report.maxDiffRatio, 0);
    assert.equal(existsSync(join(outDir, "before", "front.png")), true);
    assert.equal(existsSync(join(outDir, "after", "front.png")), true);
    assert.equal(existsSync(join(outDir, "diff", "front.png")), true);
    assert.equal(existsSync(join(outDir, "visual-report.md")), true);
  }));

test("approve-visual only records human approval after valid rendered evidence exists", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vapprove", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    manifest.status = "review";
    manifest.validationStatus = "failed";
    manifest.visualQuality.manualReview = {
      required: true,
      status: "pending",
      approvalType: "human",
      approvedBy: null,
      approvedAt: null
    };
    manifest.quality.manualVisualApproved = false;
    manifest.quality.approvedBy = null;
    manifest.quality.manualReview = {
      status: "pending",
      approvalType: "human",
      approvedBy: null,
      approvedAt: null
    };
    manifest.validation = { warnings: [], fails: ["manual visual approval is pending"] };
    manifest.approvedAt = null;
    manifest.lifecycle.phase = "review";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const approve = await runNode([
      "scripts/3d/approve-visual.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--approved-by",
      "Marc",
      "--write",
      "--json"
    ]);

    assert.equal(approve.code, 0, `${approve.stdout}\n${approve.stderr}`);
    const approved = readJson(manifestPath);
    assert.equal(approved.visualQuality.manualReview.status, "approved");
    assert.equal(approved.visualQuality.manualReview.approvedBy, "Marc");
    assert.equal(approved.quality.manualReview.status, "approved");
    assert.equal(approved.quality.manualVisualApproved, true);
    assert.equal(approved.status, "review");
    assert.equal(approved.validationStatus, "failed");
    assert.equal(approved.approvedAt, null);
    assert.equal(approved.variants.web.sha256, manifest.variants.web.sha256);
    assert.equal(approved.visualQuality.meanSsim, manifest.visualQuality.meanSsim);
  }));

test("approve-visual refuses manifests with invalid rendered evidence", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vbadapprove", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    writeBlankDiffEvidenceFiles(dir, manifest);
    manifest.status = "review";
    manifest.validationStatus = "failed";
    manifest.visualQuality.manualReview.status = "pending";
    manifest.visualQuality.manualReview.approvedBy = null;
    manifest.visualQuality.manualReview.approvedAt = null;
    manifest.quality.manualVisualApproved = false;
    manifest.quality.manualReview.status = "pending";
    manifest.quality.manualReview.approvedBy = null;
    manifest.quality.manualReview.approvedAt = null;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const approve = await runNode([
      "scripts/3d/approve-visual.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--approved-by",
      "Marc",
      "--write",
      "--json"
    ]);

    assert.equal(approve.code, 1);
    assert.match(approve.stdout, /diff image must not be blank/i);
    assert.equal(readJson(manifestPath).visualQuality.manualReview.status, "pending");
  }));

test("approve-visual refuses visual reports bound to the wrong generated variant", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vwrongbinding", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    const reportPath = join(dir, manifest.visualQuality.report.path);
    const report = readJson(reportPath);
    report.variants.mobile.candidate.sha256 = "0".repeat(64);
    const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(reportPath, reportBytes);
    manifest.visualQuality.report.sha256 = sha256(reportBytes);
    manifest.status = "review";
    manifest.validationStatus = "failed";
    manifest.visualQuality.manualReview.status = "pending";
    manifest.visualQuality.manualReview.approvedBy = null;
    manifest.visualQuality.manualReview.approvedAt = null;
    manifest.quality.manualVisualApproved = false;
    manifest.quality.manualReview.status = "pending";
    manifest.quality.manualReview.approvedBy = null;
    manifest.quality.manualReview.approvedAt = null;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const approve = await runNode([
      "scripts/3d/approve-visual.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--approved-by",
      "Marc",
      "--write",
      "--json"
    ]);

    assert.equal(approve.code, 1);
    assert.match(approve.stdout, /mobile.*sha256/i);
    assert.equal(readJson(manifestPath).visualQuality.manualReview.status, "pending");
  }));

test("optimize-dish CDN mode writes staging artifacts and CDN URLs without public binaries", () =>
  withTempDir(async (dir) => {
    const sourcePath = join(dir, "assets", "3d", "source", "maison-elyse", "demo", "plat-final", "source.glb");
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, makeRenderableDishGlb());

    const result = await runNode(
      [
        "scripts/3d/optimize-dish.mjs",
        "--restaurant",
        "maison-elyse",
        "--menu",
        "demo",
        "--dish",
        "plat-final",
        "--version",
        "vcdn",
        "--source",
        sourcePath,
        "--root",
        dir,
        "--write",
        "--cdn-base-url",
        "https://cdn.example.com/vistaire",
        "--json"
      ],
      {
        env: {
          ...process.env,
          VISTAIRE_3D_CDN_ORIGINS: "https://cdn.example.com"
        }
      }
    );

    assert.equal(result.code, 1);
    assert.match(result.stdout, /strict rendered visual identity/i);
    const manifestPath = join(
      dir,
      "public",
      "models",
      "restaurants",
      "maison-elyse",
      "demo",
      "plat-final",
      "vcdn",
      "manifest.json"
    );
    const manifest = readJson(manifestPath);
    assert.equal(manifest.variants.web.url, "https://cdn.example.com/vistaire/maison-elyse/demo/plat-final/vcdn/web/plat-final-web.glb");
    assert.equal(manifest.variants.iosUsdz.url.endsWith(".usdz"), true);
    assert.equal(existsSync(join(dir, "public", "models", "restaurants", "maison-elyse", "demo", "plat-final", "vcdn", "web")), false);
    assert.equal(existsSync(join(dir, "assets", "3d", "work", "maison-elyse", "demo", "plat-final", "vcdn", "web", "plat-final-web.glb")), true);
  }));

test("optimize-dish records adaptive candidates and rejects when all visual gates fail", () =>
  withTempDir(async (dir) => {
    const sourcePath = join(dir, "assets", "3d", "source", "maison-elyse", "demo", "plat-final", "source.glb");
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, makeRenderableDishGlb());

    const result = await runNode([
      "scripts/3d/optimize-dish.mjs",
      "--restaurant",
      "maison-elyse",
      "--menu",
      "demo",
      "--dish",
      "plat-final",
      "--version",
      "vcandidates",
      "--source",
      sourcePath,
      "--root",
      dir,
      "--write",
      "--allow-public-binaries",
      "--json"
    ]);

    assert.equal(result.code, 1);
    const report = readJson(join(dir, "assets", "3d", "reports", "maison-elyse", "demo", "plat-final", "vcandidates", "optimization-report.json"));
    assert.deepEqual(report.candidates.map((candidate) => candidate.name), [
      "conservative",
      "balanced",
      "aggressive"
    ]);
    for (const candidate of report.candidates) {
      assert.equal(candidate.variants.arLite.analysis.externalUris.length, 0);
      assert.equal(candidate.variants.arLite.analysis.extensionsRequired.length, 0);
      assert.equal(candidate.variants.arLite.analysis.bounds.groundedY, true);
      assert.equal(candidate.variants.arLite.analysis.bounds.centeredXZ, true);
    }
    assert.equal(report.selectedCandidate, null);
    assert.match(report.decision.reason, /visual/i);
  }));

test("candidate selection chooses the lightest candidate that passes every gate", () => {
  const { selectedCandidate, decision, rejectedCandidates } = selectOptimizationCandidate([
    {
      name: "conservative",
      totalBytes: 900,
      budgets: { status: "passed" },
      glbValidation: { status: "passed" },
      arLiteValidation: { status: "passed" },
      visualGate: { status: "passed" },
      antiCheat: { status: "passed" }
    },
    {
      name: "balanced",
      totalBytes: 700,
      budgets: { status: "passed" },
      glbValidation: { status: "passed" },
      arLiteValidation: { status: "passed" },
      visualGate: { status: "passed" },
      antiCheat: { status: "passed" }
    },
    {
      name: "aggressive",
      totalBytes: 300,
      budgets: { status: "passed" },
      glbValidation: { status: "passed" },
      arLiteValidation: { status: "passed" },
      visualGate: { status: "failed", reason: "visual drift" },
      antiCheat: { status: "passed" }
    }
  ]);

  assert.equal(selectedCandidate, "balanced");
  assert.match(decision.reason, /lightest/i);
  assert.equal(rejectedCandidates.some((candidate) => candidate.name === "aggressive"), true);
});

test("candidate selection returns null when every visual gate fails", () => {
  const { selectedCandidate, decision } = selectOptimizationCandidate([
    {
      name: "conservative",
      totalBytes: 900,
      budgets: { status: "passed" },
      glbValidation: { status: "passed" },
      arLiteValidation: { status: "passed" },
      visualGate: { status: "failed", reason: "SSIM below threshold" },
      antiCheat: { status: "passed" }
    }
  ]);

  assert.equal(selectedCandidate, null);
  assert.match(decision.reason, /no adaptive candidate/i);
});

test("optimize-dish --run-visual-compare writes per-candidate visual reports", { timeout: 600_000, skip: visualCompareSkip }, () =>
  withTempDir(async (dir) => {
    const sourcePath = join(dir, "assets", "3d", "source", "maison-elyse", "demo", "plat-final", "source.glb");
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, makeRenderableDishGlb());

    const result = await runNode([
      "scripts/3d/optimize-dish.mjs",
      "--restaurant",
      "maison-elyse",
      "--menu",
      "demo",
      "--dish",
      "plat-final",
      "--version",
      "vvisual",
      "--source",
      sourcePath,
      "--root",
      dir,
      "--write",
      "--allow-public-binaries",
      "--run-visual-compare",
      "--visual-threshold",
      "strict",
      "--json"
    ]);

    assert.equal(result.code, 1);
    const reportsRoot = join(dir, "assets", "3d", "reports", "maison-elyse", "demo", "plat-final", "vvisual");
    const candidateReport = readJson(join(reportsRoot, "candidate-report.json"));
    assert.equal(candidateReport.candidates.length, 3);
    for (const candidate of candidateReport.candidates) {
      for (const variantKey of ["web", "mobile", "arLite"]) {
        assert.equal(typeof candidate.visualReports[variantKey].reportJson.path, "string");
        assert.equal(
          existsSync(join(dir, candidate.visualReports[variantKey].reportJson.path)),
          true,
          `${candidate.name} ${variantKey} visual report should exist`
        );
      }
    }
    assert.equal(existsSync(join(reportsRoot, "candidate-report.md")), true);
  }));

test("record-device-qa writes only the requested real-device QA target with evidence", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vdevice", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    setManifestBackToReview(manifest, "device qa pending");
    manifest.quality.realDeviceQa.iphoneQuickLook.status = "not-tested";
    manifest.visualQuality.realDeviceQa.iphoneQuickLook.status = "not-tested";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const evidence = writeEvidenceNote(
      dir,
      "assets/3d/reports/maison-elyse/demo/plat-final/vdevice/device-qa/iphone.md"
    );

    const record = await runNode([
      "scripts/3d/record-device-qa.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--device",
      "iphoneQuickLook",
      "--status",
      "passed",
      "--device-name",
      "iPhone 15 Pro",
      "--os",
      "iOS 18.5",
      "--tested-by",
      "Marc",
      "--tested-at",
      stableIso,
      "--evidence",
      evidence.path,
      "--write",
      "--json"
    ]);

    assert.equal(record.code, 0, `${record.stdout}\n${record.stderr}`);
    const updated = readJson(manifestPath);
    assert.equal(updated.quality.realDeviceQa.iphoneQuickLook.status, "passed");
    assert.equal(updated.quality.realDeviceQa.iphoneQuickLook.evidence.sha256, evidence.sha256);
    assert.equal(updated.visualQuality.realDeviceQa.iphoneQuickLook.device, "iPhone 15 Pro");
    assert.equal(updated.quality.realDeviceQa.androidSceneViewer.status, "passed");
    assert.equal(updated.status, "review");
    assert.equal(updated.validationStatus, "failed");
  }));

test("record-device-qa refuses passed status without local evidence", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vnoevidence", null, { writeVisualEvidence: true });

    const record = await runNode([
      "scripts/3d/record-device-qa.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--device",
      "androidSceneViewer",
      "--status",
      "passed",
      "--device-name",
      "Pixel 8",
      "--os",
      "Android 15",
      "--tested-by",
      "Marc",
      "--tested-at",
      stableIso,
      "--write",
      "--json"
    ]);

    assert.equal(record.code, 1);
    assert.match(record.stdout, /evidence/i);
  }));

test("finalize-manifest refuses without human visual approval", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vnomanual", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    setManifestBackToReview(manifest, "manual approval pending");
    manifest.quality.manualVisualApproved = false;
    manifest.quality.manualReview.status = "pending";
    manifest.visualQuality.manualReview.status = "pending";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const finalize = await runNode([
      "scripts/3d/finalize-manifest.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--write",
      "--json"
    ]);

    assert.equal(finalize.code, 1);
    assert.match(finalize.stdout, /human visual approval/i);
    assert.equal(readJson(manifestPath).status, "review");
  }));

test("finalize-manifest refuses approved review manifests with stale visual report bindings", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vstalereport", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    setManifestBackToReview(manifest, "ready for finalization");
    const reportPath = join(dir, manifest.visualQuality.report.path);
    const report = readJson(reportPath);
    report.variants.mobile.candidate.sha256 = "0".repeat(64);
    const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(reportPath, reportBytes);
    manifest.visualQuality.report.sha256 = sha256(reportBytes);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const finalize = await runNode([
      "scripts/3d/finalize-manifest.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--write",
      "--json"
    ]);

    assert.equal(finalize.code, 1);
    assert.match(finalize.stdout, /mobile.*sha256/i);
    assert.equal(readJson(manifestPath).status, "review");
  }));

test("finalize-manifest approves a fully evidenced review manifest without publishing", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vready", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    setManifestBackToReview(manifest, "ready for finalization");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const finalize = await runNode([
      "scripts/3d/finalize-manifest.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--write",
      "--json"
    ]);

    assert.equal(finalize.code, 0, `${finalize.stdout}\n${finalize.stderr}`);
    const approved = readJson(manifestPath);
    assert.equal(approved.status, "approved");
    assert.equal(approved.validationStatus, "passed");
    assert.deepEqual(approved.validation, { warnings: [], fails: [] });
    assert.equal(typeof approved.approvedAt, "string");
    assert.equal(approved.publishedAt, null);
    assert.equal(approved.lifecycle.phase, "approved");
  }));

test("publish refuses a fully evidenced review manifest until finalize-manifest approves it", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vunfinalized", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    setManifestBackToReview(manifest, "ready for finalization");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const publish = await runNode([
      "scripts/3d/publish.mjs",
      "--manifest",
      manifestPath,
      "--root",
      dir,
      "--write",
      "--quality-approved",
      "--approved-by",
      "QA Bot",
      "--json"
    ]);

    assert.equal(publish.code, 1);
    assert.match(publish.stdout, /pre-approved strict visual identity manifest|manifest status approved/i);
  }));

test("prepare-cdn-upload writes a deterministic upload plan with required headers", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vupload", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    copyManifestPublicAssetsToWork(dir, manifest);
    for (const [variantKey, variant] of Object.entries(manifest.variants)) {
      const directory = variantKey === "arLite" ? "ar-lite" : variantKey === "iosUsdz" ? "ios" : variantKey;
      variant.url = `https://cdn.example.com/vistaire/maison-elyse/demo/plat-final/vupload/${directory}/${variant.url.split("/").pop()}`;
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const outPath = join(dir, "assets", "3d", "reports", "maison-elyse", "demo", "plat-final", "vupload", "upload-plan.json");

    const plan = await runNode(
      [
        "scripts/3d/prepare-cdn-upload.mjs",
        "--manifest",
        manifestPath,
        "--root",
        dir,
        "--out",
        outPath,
        "--write",
        "--json"
      ],
      {
        env: {
          ...process.env,
          VISTAIRE_3D_CDN_ORIGINS: "https://cdn.example.com",
          VISTAIRE_3D_CDN_BASE_URL: "https://cdn.example.com/vistaire"
        }
      }
    );

    assert.equal(plan.code, 0, `${plan.stdout}\n${plan.stderr}`);
    const uploadPlan = readJson(outPath);
    assert.equal(uploadPlan.uploads.length, 5);
    const usdz = uploadPlan.uploads.find((entry) => entry.variant === "iosUsdz");
    assert.equal(usdz.contentType, "model/vnd.usdz+zip");
    assert.equal(usdz.headers["Cache-Control"], "public, max-age=31536000, immutable");
    assert.equal(usdz.headers["Content-Disposition"], "inline");
    assert.equal(usdz.sha256, manifest.variants.iosUsdz.sha256);
  }));

test("prepare-cdn-upload rejects allowlisted origins outside the configured CDN namespace", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vupload", null, { writeVisualEvidence: true });
    const manifest = readJson(manifestPath);
    copyManifestPublicAssetsToWork(dir, manifest);
    for (const [variantKey, variant] of Object.entries(manifest.variants)) {
      const directory = variantKey === "arLite" ? "ar-lite" : variantKey === "iosUsdz" ? "ios" : variantKey;
      variant.url = `https://cdn.example.com/other/maison-elyse/demo/plat-final/vupload/${directory}/${variant.url.split("/").pop()}`;
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const outPath = join(dir, "assets", "3d", "reports", "maison-elyse", "demo", "plat-final", "vupload", "upload-plan.json");

    const plan = await runNode(
      [
        "scripts/3d/prepare-cdn-upload.mjs",
        "--manifest",
        manifestPath,
        "--root",
        dir,
        "--out",
        outPath,
        "--write",
        "--json"
      ],
      {
        env: {
          ...process.env,
          VISTAIRE_3D_CDN_ORIGINS: "https://cdn.example.com",
          VISTAIRE_3D_CDN_BASE_URL: "https://cdn.example.com/vistaire"
        }
      }
    );

    assert.equal(plan.code, 1);
    assert.match(plan.stdout, /must start with/i);
    assert.equal(existsSync(outPath), false);
  }));

test("finalize-manifest refuses external CDN URLs outside the configured namespace", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vbadcdn", null, { writeVisualEvidence: true });
    const manifest = rewriteManifestToCdn(manifestPath, "vbadcdn", "other");
    const reportPath = writePassingNetworkReport(dir, manifest);

    const finalize = await runNode(
      [
        "scripts/3d/finalize-manifest.mjs",
        "--manifest",
        manifestPath,
        "--root",
        dir,
        "--network-validation-report",
        reportPath,
        "--write",
        "--json"
      ],
      {
        env: {
          ...process.env,
          VISTAIRE_3D_CDN_ORIGINS: "https://cdn.example.com",
          VISTAIRE_3D_CDN_BASE_URL: "https://cdn.example.com/vistaire"
        }
      }
    );

    assert.equal(finalize.code, 1);
    assert.match(finalize.stdout, /must start with/i);
  }));

test("publish refuses external CDN URLs outside the configured namespace", () =>
  withTempDir(async (dir) => {
    const manifestPath = writeApprovedManifest(dir, "vbadpublishcdn", null, { writeVisualEvidence: true });
    const manifest = rewriteManifestToCdn(manifestPath, "vbadpublishcdn", "other");
    const reportPath = writePassingNetworkReport(dir, manifest);

    const publish = await runNode(
      [
        "scripts/3d/publish.mjs",
        "--manifest",
        manifestPath,
        "--root",
        dir,
        "--network-validation-report",
        reportPath,
        "--write",
        "--quality-approved",
        "--approved-by",
        "QA Bot",
        "--json"
      ],
      {
        env: {
          ...process.env,
          VISTAIRE_3D_CDN_ORIGINS: "https://cdn.example.com",
          VISTAIRE_3D_CDN_BASE_URL: "https://cdn.example.com/vistaire"
        }
      }
    );

    assert.equal(publish.code, 1);
    assert.match(publish.stdout, /must start with/i);
  }));

test("publish promotes an approved version and rollback restores the previous active version", () =>
  withTempDir(async (dir) => {
    for (const version of ["v1", "v2"]) {
      const manifestPath = writeApprovedManifest(dir, version, version === "v2" ? "v1" : null, {
        writeVisualEvidence: true
      });
      const publish = await runNode([
        "scripts/3d/publish.mjs",
        "--manifest",
        manifestPath,
        "--root",
        dir,
        "--write",
        "--quality-approved",
        "--approved-by",
        "QA Bot",
        "--json"
      ]);
      assert.equal(publish.code, 0, `${publish.stdout}\n${publish.stderr}`);
    }

    const activeManifestPath = join(
      dir,
      "public",
      "models",
      "restaurants",
      "maison-elyse",
      "demo",
      "plat-final",
      "manifest.json"
    );
    assert.equal(readJson(activeManifestPath).activeVersion, "v2");

    const rollback = await runNode([
      "scripts/3d/rollback.mjs",
      "--restaurant",
      "maison-elyse",
      "--menu",
      "demo",
      "--dish",
      "plat-final",
      "--to",
      "v1",
      "--root",
      dir,
      "--write",
      "--approved-by",
      "QA Bot",
      "--json"
    ]);
    assert.equal(rollback.code, 0, rollback.stderr);
    const rolledBack = readJson(activeManifestPath);
    assert.equal(rolledBack.activeVersion, "v1");
    assert.equal(rolledBack.status, "published");
    assert.equal(rolledBack.rollback.fromVersion, "v2");
    assert.equal(rolledBack.rollback.toVersion, "v1");
  }));

test("clean-stale refuses write mode when no active manifest exists", () =>
  withTempDir(async (dir) => {
    const versionOne = join(
      dir,
      "public",
      "models",
      "restaurants",
      "maison-elyse",
      "demo",
      "plat-final",
      "v1"
    );
    const versionTwo = join(dirname(versionOne), "v2");
    mkdirSync(versionOne, { recursive: true });
    mkdirSync(versionTwo, { recursive: true });
    writeFileSync(join(versionOne, "marker.txt"), "keep v1");
    writeFileSync(join(versionTwo, "marker.txt"), "keep v2");

    const result = await runNode([
      "scripts/3d/clean-stale.mjs",
      "--restaurant",
      "maison-elyse",
      "--menu",
      "demo",
      "--dish",
      "plat-final",
      "--root",
      dir,
      "--write",
      "--json"
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /active manifest/i);
    assert.equal(existsSync(versionOne), true);
    assert.equal(existsSync(versionTwo), true);
  }));
