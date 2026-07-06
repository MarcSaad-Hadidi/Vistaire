import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, normalize, relative, resolve, sep } from "node:path";

import { zipSync } from "fflate";

import { parseArgs, publicUrlToFilePath, readJsonFile, writeStdout } from "./file-utils.mjs";
import { analyzeGeometryFromGltf } from "./geometry-metrics.mjs";
import {
  summarizeRestaurantManifest
} from "./manifest-schema.mjs";
import { encodePngImage } from "./png-image.mjs";
import { collectManifestAssets, validateDishManifestPipeline, validateVisualEvidence } from "../validate-dish.mjs";
import { validateBudgets } from "./validators/budget-checks.mjs";

const HELP = `Vistaire 3D production command

Required identity flags:
  --restaurant <slug>  Restaurant slug
  --menu <slug>        Menu slug
  --dish <slug>        Dish slug
  --version <version>  Asset version

Write safety:
  --write                    Actually write outputs
  --root <path>              Workspace/root directory, defaults to cwd
  --allow-public-binaries    Allow writing runtime GLB/USDZ/poster files under public/models/restaurants
  --approved-by <name>       Required for approved/publish/rollback operations
  --cdn-base-url <url>       Rewrite generated variant URLs to an approved CDN/storage origin
`;

const VARIANT_DIRS = Object.freeze({
  web: "web",
  mobile: "mobile",
  arLite: "ar-lite",
  iosUsdz: "ios",
  poster: "poster"
});

const VARIANT_FILES = Object.freeze({
  web: (slug) => `${slug}-web.glb`,
  mobile: (slug) => `${slug}-mobile.glb`,
  arLite: (slug) => `${slug}-ar-lite.glb`,
  iosUsdz: (slug) => `${slug}.usdz`,
  poster: (slug) => `${slug}.png`
});

const STRICT_VISUAL_PROMISE =
  "visually indistinguishable under deterministic multi-angle mobile dining-distance review within strict thresholds";
const STRICT_VISUAL_THRESHOLDS = Object.freeze({
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
});
const STRICT_VISUAL_REJECTION =
  "Strict rendered visual identity evidence is required before optimization can be approved: source/candidate before-after-diff renders for web, mobile, and arLite, per-angle SSIM/perceptual scores, texture/silhouette/color/material/scale/origin/low-poly/appetite checks, and human approval.";
const CANDIDATE_PROFILES = Object.freeze(["conservative", "balanced", "aggressive"]);
const HEAVY_CANDIDATE_PROFILES = Object.freeze([...CANDIDATE_PROFILES, "emergency-ar"]);
const GLB_VARIANTS = Object.freeze(["web", "mobile", "arLite"]);
const RUNTIME_VARIANTS = Object.freeze(["web", "mobile", "arLite", "iosUsdz", "poster"]);

function pendingRealDeviceQa() {
  return {
    required: true,
    iphoneQuickLook: {
      required: true,
      status: "not-tested",
      device: null,
      os: null,
      testedBy: null,
      testedAt: null
    },
    androidSceneViewer: {
      required: true,
      status: "not-tested",
      device: null,
      os: null,
      testedBy: null,
      testedAt: null
    }
  };
}

function createReviewPosterPng({ analysis }) {
  const width = 512;
  const height = 512;
  const pixels = Buffer.alloc(width * height * 4);
  const plateRadiusX = Math.round(width * 0.34);
  const plateRadiusY = Math.round(height * 0.2);
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height * 0.55);
  const triangleTone = Math.max(64, Math.min(220, 120 + Math.round((analysis.triangles ?? 0) % 80)));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const vignette = Math.round(22 * Math.hypot((x - centerX) / width, (y - centerY) / height));
      pixels[index] = Math.max(8, 24 - vignette);
      pixels[index + 1] = Math.max(8, 23 - vignette);
      pixels[index + 2] = Math.max(7, 20 - vignette);
      pixels[index + 3] = 255;
      const dx = (x - centerX) / plateRadiusX;
      const dy = (y - centerY) / plateRadiusY;
      const plate = dx * dx + dy * dy;
      if (plate <= 1) {
        const rim = plate > 0.78 ? 218 : 188;
        pixels[index] = rim;
        pixels[index + 1] = rim - 8;
        pixels[index + 2] = rim - 28;
      }
      const garnish = ((x - centerX + 35) / (plateRadiusX * 0.48)) ** 2 + ((y - centerY + 18) / (plateRadiusY * 0.42)) ** 2;
      if (garnish <= 1) {
        pixels[index] = triangleTone;
        pixels[index + 1] = Math.max(48, triangleTone - 36);
        pixels[index + 2] = Math.max(32, triangleTone - 72);
      }
    }
  }
  return encodePngImage({ width, height, pixels });
}

function mergeResultInto(target, source) {
  target.warnings.push(...(source.warnings ?? []));
  target.fails.push(...(source.fails ?? []));
  target.evidence.push(...(source.evidence ?? []));
  target.metrics[source.name ?? "validation"] = source.metrics ?? {};
  if (!source.ok) target.ok = false;
  return target;
}

function createResult(name, metrics = {}) {
  return {
    ok: true,
    name,
    warnings: [],
    fails: [],
    metrics,
    evidence: []
  };
}

function failResult(name, error) {
  return {
    ok: false,
    name,
    warnings: [],
    fails: [error instanceof Error ? error.message : String(error)],
    metrics: {},
    evidence: []
  };
}

function cleanSegment(value, label) {
  const segment = String(value ?? "").trim();
  if (!segment) throw new Error(`${label} is required`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(segment)) {
    throw new Error(`${label} must be a slug-like path segment`);
  }
  return segment.toLowerCase();
}

function cleanVersion(value) {
  const version = String(value ?? "").trim();
  if (!version) throw new Error("version is required");
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(version) || version.includes("..")) {
    throw new Error("version must be a stable version path segment");
  }
  return version;
}

function identityFromArgs(args, { requireVersion = true } = {}) {
  return {
    restaurantSlug: cleanSegment(args.restaurant ?? args["restaurant-slug"], "restaurant"),
    menuSlug: cleanSegment(args.menu ?? args["menu-slug"], "menu"),
    dishSlug: cleanSegment(args.dish ?? args["dish-slug"], "dish"),
    version: requireVersion ? cleanVersion(args.version) : String(args.version ?? "").trim()
  };
}

function safeJoin(rootDir, ...segments) {
  const root = normalize(resolve(rootDir));
  const fullPath = normalize(resolve(rootDir, ...segments));
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) {
    throw new Error(`Refusing path outside ${root}`);
  }
  return fullPath;
}

function ensureParent(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeJsonFile(filePath, value) {
  ensureParent(filePath);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fileHash(filePath) {
  return sha256(readFileSync(filePath));
}

function fileReference(filePath, rootDir) {
  const bytes = readFileSync(filePath);
  return {
    path: relative(rootDir, filePath).replaceAll("\\", "/"),
    sha256: sha256(bytes),
    bytes: bytes.length
  };
}

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function assertLocalEvidenceReference(value, rootDir, label) {
  const raw = typeof value === "object" && value ? value.path : value;
  const relativePath = String(raw ?? "").trim().replaceAll("\\", "/");
  if (!relativePath || relativePath.startsWith("/") || /^[a-z]:/i.test(relativePath)) {
    throw new Error(`${label} must be a local relative evidence path`);
  }
  const fullPath = safeJoin(rootDir, relativePath);
  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
    throw new Error(`${label} evidence file is missing: ${relativePath}`);
  }
  return fileReference(fullPath, rootDir);
}

function isLfsPointer(bytes) {
  return bytes
    .subarray(0, 96)
    .toString("utf8")
    .startsWith("version https://git-lfs.github.com/spec");
}

function parseGlb(buffer) {
  if (buffer.length < 20) throw new Error("GLB is too small to contain a header");
  if (buffer.toString("utf8", 0, 4) !== "glTF") throw new Error("GLB magic must be glTF");
  const version = buffer.readUInt32LE(4);
  if (version !== 2) throw new Error(`GLB version must be 2, found ${version}`);
  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength !== buffer.length) {
    throw new Error(`GLB declared length ${declaredLength} does not match file length ${buffer.length}`);
  }

  let offset = 12;
  let json = null;
  let binBuffer = Buffer.alloc(0);
  const chunks = [];
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > buffer.length) throw new Error("GLB chunk length exceeds file size");
    const chunk = buffer.subarray(chunkStart, chunkEnd);
    chunks.push({ type: chunkType, bytes: chunkLength });
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(chunk.toString("utf8").replace(/\0+$/g, "").trim());
    } else if (chunkType === 0x004e4942 && binBuffer.length === 0) {
      binBuffer = chunk;
    }
    offset = chunkEnd;
  }
  if (!json) throw new Error("GLB JSON chunk is required");
  return { json, chunks, binBuffer };
}

function componentSize(componentType) {
  return (
    {
      5120: 1,
      5121: 1,
      5122: 2,
      5123: 2,
      5125: 4,
      5126: 4
    }[componentType] ?? 0
  );
}

function typeCount(type) {
  return ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }[type] ?? 1);
}

function accessorBytes(gltf, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor) return 0;
  return accessor.count * componentSize(accessor.componentType) * typeCount(accessor.type);
}

function imageDimensionsFromBytes(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return {
      format: "png",
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20)
    };
  }
  if (bytes.length >= 10 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          format: "jpeg",
          width: bytes.readUInt16BE(offset + 7),
          height: bytes.readUInt16BE(offset + 5)
        };
      }
      offset += 2 + length;
    }
  }
  if (bytes.length >= 30 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { format: "webp", width: null, height: null };
  }
  return { format: "unknown", width: null, height: null };
}

function embeddedImageBytes(gltf, sourceBuffer, image) {
  if (!Number.isInteger(image?.bufferView)) return Buffer.alloc(0);
  const view = gltf.bufferViews?.[image.bufferView];
  if (!view || view.buffer !== 0) return Buffer.alloc(0);
  const start = (view.byteOffset ?? 0) + (image.byteOffset ?? 0);
  const end = start + view.byteLength;
  return sourceBuffer.subarray(start, end);
}

function externalUris(gltf) {
  const uris = [];
  for (const buffer of gltf.buffers ?? []) {
    if (buffer.uri && !String(buffer.uri).startsWith("data:")) uris.push(buffer.uri);
  }
  for (const image of gltf.images ?? []) {
    if (image.uri && !String(image.uri).startsWith("data:")) uris.push(image.uri);
  }
  return uris;
}

function analyzeGlbFile(sourcePath) {
  const bytes = readFileSync(sourcePath);
  if (isLfsPointer(bytes)) throw new Error("Source GLB is a Git LFS pointer, not a binary asset");
  const { json: gltf, chunks, binBuffer } = parseGlb(bytes);
  let primitives = 0;
  let vertices = 0;
  let triangles = 0;
  const drawCalls = [];

  for (const [meshIndex, mesh] of (gltf.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      primitives += 1;
      const mode = primitive.mode ?? 4;
      const positionAccessor = gltf.accessors?.[primitive.attributes?.POSITION];
      const indexAccessor = gltf.accessors?.[primitive.indices];
      const primitiveVertices = positionAccessor?.count ?? 0;
      const primitiveIndices = indexAccessor?.count ?? 0;
      vertices += primitiveVertices;
      if (mode === 4) triangles += Math.floor((primitiveIndices || primitiveVertices) / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(0, (primitiveIndices || primitiveVertices) - 2);
      drawCalls.push({
        meshIndex,
        primitiveIndex,
        mode,
        material: primitive.material ?? null,
        positionBytes: accessorBytes(gltf, primitive.attributes?.POSITION),
        indexBytes: primitive.indices === undefined ? 0 : accessorBytes(gltf, primitive.indices)
      });
    }
  }

  const imageMetrics = (gltf.images ?? []).map((image, index) => {
    const embedded = embeddedImageBytes(gltf, binBuffer, image);
    const dimensions = embedded.length > 0 ? imageDimensionsFromBytes(embedded) : { format: image.mimeType ?? "external", width: null, height: null };
    return {
      index,
      name: image.name ?? "",
      mimeType: image.mimeType ?? "",
      uri: image.uri ?? "",
      bytes: embedded.length || null,
      ...dimensions
    };
  });

  const geometry = analyzeGeometryFromGltf({ gltf, binBuffer });
  const extUris = externalUris(gltf);
  const metrics = {
    sourcePath,
    fileName: basename(sourcePath),
    bytes: bytes.length,
    sha256: sha256(bytes),
    glbVersion: 2,
    chunks,
    meshes: gltf.meshes?.length ?? 0,
    primitives,
    triangles: geometry.triangles || triangles,
    vertices: geometry.vertices || vertices,
    materials: gltf.materials?.length ?? 0,
    textures: gltf.textures?.length ?? 0,
    images: imageMetrics.length,
    imageMetrics,
    extensionsUsed: gltf.extensionsUsed ?? [],
    extensionsRequired: gltf.extensionsRequired ?? [],
    externalUris: extUris,
    bounds: geometry.bounds,
    geometry,
    drawCallEstimate: primitives,
    drawCalls,
    classification:
      triangles > 150_000 || imageMetrics.length > 12 || bytes.length > 25 * 1024 * 1024
        ? "signature"
        : "simpleDish"
  };
  return metrics;
}

function writeAnalysisMarkdown(path, metrics) {
  const lines = [
    `# 3D Source Analysis: ${metrics.fileName}`,
    "",
    `- Bytes: ${metrics.bytes}`,
    `- SHA-256: ${metrics.sha256}`,
    `- Meshes: ${metrics.meshes}`,
    `- Primitives / draw calls: ${metrics.primitives}`,
    `- Triangles: ${metrics.triangles}`,
    `- Vertices: ${metrics.vertices}`,
    `- Textures: ${metrics.textures}`,
    `- Bounds (m): ${metrics.bounds.dimensionsMeters.join(" x ")}`,
    `- External URIs: ${metrics.externalUris.length ? metrics.externalUris.join(", ") : "none"}`,
    "",
    "Manual review remains required for final plating, scale, material fidelity, iPhone Quick Look, and Android Scene Viewer."
  ];
  ensureParent(path);
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function productionUrl(identity, variantKey) {
  const directory = VARIANT_DIRS[variantKey];
  const fileName = VARIANT_FILES[variantKey](identity.dishSlug);
  return `/models/restaurants/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}/${directory}/${fileName}`;
}

function configuredCdnOrigins() {
  return String(process.env.VISTAIRE_3D_CDN_ORIGINS ?? "")
    .split(/[,\s]+/)
    .map((entry) => entry.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function configuredCdnBaseUrl() {
  return cleanCdnBaseUrl(process.env.VISTAIRE_3D_CDN_BASE_URL ?? "");
}

function cleanCdnBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("--cdn-base-url must be a valid HTTPS URL");
  }
  if (parsed.protocol !== "https:") throw new Error("--cdn-base-url must use HTTPS");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("--cdn-base-url must not include credentials, query, or hash");
  }
  const allowedOrigins = configuredCdnOrigins();
  if (!allowedOrigins.includes(parsed.origin)) {
    throw new Error(`--cdn-base-url origin ${parsed.origin} is not allowlisted by VISTAIRE_3D_CDN_ORIGINS`);
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

function cdnAssetUrl(identity, variantKey, cdnBaseUrl) {
  const directory = VARIANT_DIRS[variantKey];
  const fileName = VARIANT_FILES[variantKey](identity.dishSlug);
  return [
    cdnBaseUrl.replace(/\/+$/, ""),
    identity.restaurantSlug,
    identity.menuSlug,
    identity.dishSlug,
    identity.version,
    directory,
    fileName
  ].join("/");
}

function deliveryUrl(identity, variantKey, cdnBaseUrl = "") {
  return cdnBaseUrl ? cdnAssetUrl(identity, variantKey, cdnBaseUrl) : productionUrl(identity, variantKey);
}

function reportDir(rootDir, identity) {
  return safeJoin(
    rootDir,
    "assets",
    "3d",
    "reports",
    identity.restaurantSlug,
    identity.menuSlug,
    identity.dishSlug,
    identity.version
  );
}

function workDir(rootDir, identity) {
  return safeJoin(
    rootDir,
    "assets",
    "3d",
    "work",
    identity.restaurantSlug,
    identity.menuSlug,
    identity.dishSlug,
    identity.version
  );
}

function workFilePath(rootDir, identity, variantKey) {
  return safeJoin(
    workDir(rootDir, identity),
    VARIANT_DIRS[variantKey],
    VARIANT_FILES[variantKey](identity.dishSlug)
  );
}

function resolveSource(args, identity, rootDir) {
  if (args.source) {
    const source = normalize(resolve(String(args.source)));
    if (!existsSync(source)) throw new Error(`Source GLB is missing: ${source}`);
    return source;
  }
  const sourceRoot = safeJoin(
    rootDir,
    "assets",
    "3d",
    "source",
    identity.restaurantSlug,
    identity.menuSlug,
    identity.dishSlug,
    identity.version
  );
  if (!existsSync(sourceRoot)) throw new Error(`Source directory is missing: ${sourceRoot}`);
  const glbs = readdirSync(sourceRoot).filter((entry) => entry.toLowerCase().endsWith(".glb"));
  if (glbs.length !== 1) {
    throw new Error(`Expected exactly one source GLB in ${sourceRoot}, found ${glbs.length}`);
  }
  return safeJoin(sourceRoot, glbs[0]);
}

function gltfTransformCli(toolchainRoot = process.cwd()) {
  const cliPath = safeJoin(toolchainRoot, "node_modules", "@gltf-transform", "cli", "bin", "cli.js");
  if (!existsSync(cliPath)) {
    throw new Error("@gltf-transform/cli is required before production optimization can run");
  }
  return cliPath;
}

function transformArgsFor({ input, output, profile, candidateName = "balanced" }) {
  const candidateArgs = {
    conservative: {
      web: ["optimize", input, output, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "2048"],
      mobile: ["optimize", input, output, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1536"],
      arLite: [
        "optimize",
        input,
        output,
        "--compress",
        "false",
        "--texture-compress",
        "false",
        "--texture-size",
        "1536",
        "--simplify",
        "true",
        "--simplify-ratio",
        "0.9",
        "--simplify-error",
        "0.00025",
        "--simplify-lock-border",
        "true"
      ]
    },
    balanced: {
      web: ["optimize", input, output, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "2048"],
      mobile: ["optimize", input, output, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1024"],
      arLite: [
        "optimize",
        input,
        output,
        "--compress",
        "false",
        "--texture-compress",
        "false",
        "--texture-size",
        "1024",
        "--simplify",
        "true",
        "--simplify-ratio",
        "0.72",
        "--simplify-error",
        "0.00045",
        "--simplify-lock-border",
        "true"
      ]
    },
    aggressive: {
      web: ["optimize", input, output, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1536"],
      mobile: ["optimize", input, output, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "768"],
      arLite: [
        "optimize",
        input,
        output,
        "--compress",
        "false",
        "--texture-compress",
        "false",
        "--texture-size",
        "768",
        "--simplify",
        "true",
        "--simplify-ratio",
        "0.55",
        "--simplify-error",
        "0.0007",
        "--simplify-lock-border",
        "true"
      ]
    },
    "emergency-ar": {
      web: ["optimize", input, output, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1024"],
      mobile: ["optimize", input, output, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "512"],
      arLite: [
        "optimize",
        input,
        output,
        "--compress",
        "false",
        "--texture-compress",
        "false",
        "--texture-size",
        "512",
        "--simplify",
        "true",
        "--simplify-ratio",
        "0.35",
        "--simplify-error",
        "0.0012",
        "--simplify-lock-border",
        "true"
      ]
    }
  };
  return candidateArgs[candidateName]?.[profile] ?? candidateArgs.balanced.arLite;
}

function runGltfTransform({ input, output, profile, candidateName = "balanced" }) {
  const cli = gltfTransformCli(process.cwd());
  ensureParent(output);
  const args = transformArgsFor({ input, output, profile, candidateName });
  execFileSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true
  });
  return { ok: true, command: `gltf-transform ${args.join(" ")}`, fallback: false, candidateName };
}

function usdIdentifier(value, fallback) {
  const cleaned = String(value ?? "")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^[^A-Za-z_]+/, "");
  return cleaned || fallback;
}

function readAccessor(gltf, binBuffer, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  const view = gltf.bufferViews?.[accessor.bufferView];
  if (!view || view.buffer !== 0) throw new Error(`Accessor ${accessorIndex} must use an embedded GLB bufferView`);
  const componentBytes = componentSize(accessor.componentType);
  const itemSize = typeCount(accessor.type);
  const stride = view.byteStride ?? componentBytes * itemSize;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values = [];
  for (let item = 0; item < accessor.count; item += 1) {
    const itemOffset = start + item * stride;
    const tuple = [];
    for (let component = 0; component < itemSize; component += 1) {
      const offset = itemOffset + component * componentBytes;
      if (accessor.componentType === 5126) tuple.push(binBuffer.readFloatLE(offset));
      else if (accessor.componentType === 5125) tuple.push(binBuffer.readUInt32LE(offset));
      else if (accessor.componentType === 5123) tuple.push(binBuffer.readUInt16LE(offset));
      else if (accessor.componentType === 5121) tuple.push(binBuffer.readUInt8(offset));
      else throw new Error(`Unsupported accessor component type ${accessor.componentType}`);
    }
    values.push(itemSize === 1 ? tuple[0] : tuple);
  }
  return values;
}

function imageExtension(image, bytes) {
  const mimeType = String(image?.mimeType ?? "").toLowerCase();
  if (mimeType.includes("png") || bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg") || bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return "jpg";
  if (mimeType.includes("webp") || (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP")) {
    return "webp";
  }
  return "";
}

function formatUsdNumber(value) {
  return Number(value.toFixed(6)).toString();
}

function createUsdzPackageFromGlb({ glbPath, identity }) {
  const { json: gltf, binBuffer } = parseGlb(readFileSync(glbPath));
  const entries = {};
  const textureEntries = [];
  for (const [index, image] of (gltf.images ?? []).entries()) {
    const bytes = embeddedImageBytes(gltf, binBuffer, image);
    const extension = imageExtension(image, bytes);
    if (!extension || bytes.length === 0) continue;
    const name = `textures/image-${index}.${extension}`;
    entries[name] = bytes;
    textureEntries.push(name);
  }

  const lines = [
    "#usda 1.0",
    "(",
    `  defaultPrim = "${usdIdentifier(identity.dishSlug, "Dish")}"`,
    ")",
    "",
    `def Xform "${usdIdentifier(identity.dishSlug, "Dish")}" {`
  ];

  let meshCount = 0;
  for (const [meshIndex, mesh] of (gltf.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      if ((primitive.mode ?? 4) !== 4) {
        throw new Error("USDZ export supports triangle-list GLB primitives only");
      }
      const positionAccessor = primitive.attributes?.POSITION;
      if (!Number.isInteger(positionAccessor)) throw new Error("USDZ export requires POSITION accessors");
      const points = readAccessor(gltf, binBuffer, positionAccessor);
      const indices = Number.isInteger(primitive.indices)
        ? readAccessor(gltf, binBuffer, primitive.indices)
        : points.map((_, index) => index);
      if (indices.length < 3 || indices.length % 3 !== 0) {
        throw new Error("USDZ export requires triangle indices");
      }
      const meshName = usdIdentifier(mesh.name, `Mesh_${meshIndex}_${primitiveIndex}`);
      lines.push(`  def Mesh "${meshName}" {`);
      lines.push(
        `    point3f[] points = [${points
          .map((point) => `(${point.map(formatUsdNumber).join(", ")})`)
          .join(", ")}]`
      );
      lines.push(`    int[] faceVertexCounts = [${Array(indices.length / 3).fill(3).join(", ")}]`);
      lines.push(`    int[] faceVertexIndices = [${indices.join(", ")}]`);
      lines.push("  }");
      meshCount += 1;
    }
  }

  if (meshCount === 0) throw new Error("USDZ export requires at least one renderable mesh");

  for (const [index, material] of (gltf.materials ?? []).entries()) {
    const materialName = usdIdentifier(material.name, `Material_${index}`);
    lines.push(`  def Material "${materialName}" {}`);
  }
  for (const textureName of textureEntries) {
    lines.push(`  asset vistaireTexture_${usdIdentifier(textureName, "Texture")} = @${textureName}@`);
  }
  lines.push("}");
  entries["model.usda"] = Buffer.from(`${lines.join("\n")}\n`);
  return Buffer.from(zipSync(entries, { level: 0 }));
}

function makeVisualQualityReport({ identity, analysis, variants, approvedBy }) {
  return {
    status: "failed",
    score: 0,
    promise: STRICT_VISUAL_PROMISE,
    method: "missing-deterministic-render-comparison",
    thresholds: STRICT_VISUAL_THRESHOLDS,
    report: null,
    reportArtifacts: {},
    angleReports: [],
    metrics: {},
    deterministicViews: ["front", "left", "right", "top", "three-quarter"],
    checks: {
      textureSharpness: { status: "failed", reason: "Rendered texture sharpness comparison is missing" },
      silhouette: { status: "failed", reason: "Rendered silhouette diff is missing" },
      color: { status: "failed", reason: "Rendered color drift comparison is missing" },
      material: { status: "failed", reason: "Rendered material drift review is missing" },
      scaleOrigin: { status: "failed", reason: "Scale/origin comparison is missing" },
      lowPoly: { status: "failed", reason: "Low-poly visibility review is missing" },
      appetite: { status: "failed", reason: "Human appetite appeal review is missing" }
    },
    variants: Object.fromEntries(
      Object.entries(variants).map(([key, variant]) => [key, { bytes: variant.bytes, sha256: variant.sha256 }])
    ),
    sourceSummary: {
      bytes: analysis.bytes,
      sha256: analysis.sha256,
      triangles: analysis.triangles,
      vertices: analysis.vertices,
      materials: analysis.materials,
      textures: analysis.textures
    },
    fails: [STRICT_VISUAL_REJECTION],
    manualReview: {
      required: true,
      status: "pending",
      approvalType: "human",
      approvedBy: null,
      approvedAt: null,
      requestedBy: approvedBy || null
    },
    realDeviceQa: {
      ...pendingRealDeviceQa()
    },
    identity
  };
}

function variantMetadata(filePath, url, extra = {}) {
  const bytes = statSync(filePath).size;
  return {
    url,
    bytes,
    sha256: fileHash(filePath),
    validationStatus: "passed",
    ...extra
  };
}

function buildManifest({ identity, analysis, variants, visualQuality, approvedBy }) {
  const now = new Date().toISOString();
  const visualApproved =
    visualQuality?.status === "passed" &&
    visualQuality?.manualReview?.status === "approved" &&
    visualQuality?.manualReview?.approvalType === "human" &&
    Boolean(visualQuality?.manualReview?.approvedBy);
  const status = visualApproved ? "approved" : "review";
  const totalBytes = Object.values(variants).reduce((sum, variant) => sum + variant.bytes, 0);
  const validationFails = visualApproved ? [] : [STRICT_VISUAL_REJECTION];
  return {
    schemaVersion: 2,
    kind: "vistaire.dish-3d-manifest",
    restaurantSlug: identity.restaurantSlug,
    menuSlug: identity.menuSlug,
    dishSlug: identity.dishSlug,
    activeVersion: identity.version,
    status,
    validationStatus: visualApproved ? "passed" : "failed",
    variants,
    bytes: { total: totalBytes },
    physicalScaleMeters: {
      width: Math.max(analysis.bounds.dimensionsMeters[0], 0.001),
      height: Math.max(analysis.bounds.dimensionsMeters[1], 0.001),
      depth: Math.max(analysis.bounds.dimensionsMeters[2], 0.001)
    },
    bounds: {
      min: analysis.bounds.min,
      max: analysis.bounds.max,
      centeredXZ: analysis.bounds.centeredXZ,
      groundedY: analysis.bounds.groundedY
    },
    budgets: {
      profile: analysis.classification === "signature" ? "signature" : "simpleDish",
      policy: "docs/repo-asset-policy.md"
    },
    sourceAnalysis: {
      bytes: analysis.bytes,
      sha256: analysis.sha256,
      meshes: analysis.meshes,
      primitives: analysis.primitives,
      triangles: analysis.triangles,
      vertices: analysis.vertices,
      materials: analysis.materials,
      textures: analysis.textures,
      images: analysis.images,
      externalUris: analysis.externalUris,
      classification: analysis.classification
    },
    visualQuality,
    quality: {
      manualVisualApprovalRequired: true,
      manualVisualApproved: visualApproved,
      approvedBy: visualApproved ? visualQuality.manualReview.approvedBy : null,
      requestedBy: approvedBy || null,
      manualReview: {
        status: visualApproved ? "approved" : "pending",
        approvalType: "human",
        approvedBy: visualApproved ? visualQuality.manualReview.approvedBy : null,
        approvedAt: visualApproved ? visualQuality.manualReview.approvedAt ?? now : null
      },
      realDeviceQa: {
        ...pendingRealDeviceQa()
      }
    },
    lifecycle: {
      phase: status,
      generatedBy: "scripts/3d/optimize-dish.mjs",
      generatedAt: now
    },
    rollback: {
      previousVersion: null,
      fromVersion: null,
      toVersion: null
    },
    validation: {
      warnings: [],
      fails: validationFails
    },
    generatedAt: now,
    approvedAt: visualApproved ? now : null,
    publishedAt: null
  };
}

function candidateWorkFilePath(rootDir, identity, candidateName, variantKey) {
  return safeJoin(
    workDir(rootDir, identity),
    "candidates",
    candidateName,
    VARIANT_DIRS[variantKey],
    VARIANT_FILES[variantKey](identity.dishSlug)
  );
}

function candidateFilePath(rootDir, identity, candidateName, variantKey) {
  return candidateName === "balanced"
    ? workFilePath(rootDir, identity, variantKey)
    : candidateWorkFilePath(rootDir, identity, candidateName, variantKey);
}

function candidateVariantSummary(candidateAnalysis) {
  return {
    triangles: candidateAnalysis.triangles,
    vertices: candidateAnalysis.vertices,
    meshes: candidateAnalysis.meshes,
    primitives: candidateAnalysis.primitives,
    materials: candidateAnalysis.materials,
    textures: candidateAnalysis.textures,
    images: candidateAnalysis.images,
    imageMetrics: candidateAnalysis.imageMetrics,
    drawCallEstimate: candidateAnalysis.drawCallEstimate,
    extensionsUsed: candidateAnalysis.extensionsUsed,
    extensionsRequired: candidateAnalysis.extensionsRequired,
    externalUris: candidateAnalysis.externalUris,
    bounds: candidateAnalysis.bounds
  };
}

function glbValidationForCandidate(candidateVariants) {
  const fails = [];
  for (const key of GLB_VARIANTS) {
    const variant = candidateVariants[key];
    if (!variant) {
      fails.push(`${key}: missing generated GLB`);
      continue;
    }
    if ((variant.analysis?.externalUris?.length ?? 0) > 0) {
      fails.push(`${key}: external URIs are not allowed`);
    }
    if (key === "arLite" && (variant.analysis?.extensionsRequired?.length ?? 0) > 0) {
      fails.push("arLite: required extensions are not allowed");
    }
  }
  return fails.length > 0
    ? { status: "failed", fails }
    : { status: "passed", fails: [] };
}

function antiCheatForCandidate({ sourceAnalysis, candidateVariants, transformEvidence }) {
  const fails = [];
  const arLite = candidateVariants.arLite;
  if (!arLite) fails.push("arLite: missing anti-cheat target");
  if (arLite?.sha256 && arLite.sha256 === sourceAnalysis.sha256) {
    fails.push("arLite must not copy the source GLB");
  }
  if (arLite?.sha256 && arLite.sha256 === candidateVariants.web?.sha256) {
    fails.push("arLite must not copy the web GLB");
  }
  if (arLite?.sha256 && arLite.sha256 === candidateVariants.mobile?.sha256) {
    fails.push("arLite must not copy the mobile GLB");
  }
  if (/\bcopy\b/i.test(String(transformEvidence?.arLite?.command ?? ""))) {
    fails.push("arLite optimizer command must not be a copy operation");
  }
  return fails.length > 0
    ? { status: "failed", fails }
    : { status: "passed", fails: [] };
}

function budgetValidationForCandidate({ identity, candidateVariants, profile }) {
  const manifest = {
    restaurantSlug: identity.restaurantSlug,
    menuSlug: identity.menuSlug,
    dishSlug: identity.dishSlug,
    activeVersion: identity.version,
    variants: candidateVariants
  };
  const budgets = validateBudgets({ manifest, profile });
  return {
    status: budgets.ok ? "passed" : "failed",
    warnings: budgets.warnings,
    fails: budgets.fails,
    metrics: budgets.metrics
  };
}

function visualReportPath(rootDir, identity, candidateName, variantKey) {
  return safeJoin(reportDir(rootDir, identity), "visual", "candidates", candidateName, variantKey);
}

function parseVisualCompareOutput(stdout) {
  const raw = String(stdout ?? "").trim();
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  return JSON.parse(raw.slice(start, end + 1));
}

function runVisualCompareForCandidate({ source, candidatePath, variantKey, outDir, rootDir, threshold }) {
  const args = [
    "scripts/3d/visual-compare.mjs",
    "--source",
    source,
    "--candidate",
    candidatePath,
    "--variant",
    variantKey,
    "--out",
    outDir,
    "--root",
    rootDir,
    "--threshold",
    threshold,
    "--json"
  ];
  try {
    return parseVisualCompareOutput(
      execFileSync(process.execPath, args, {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
        windowsHide: true
      })
    );
  } catch (error) {
    const parsed = parseVisualCompareOutput(error.stdout);
    if (parsed) return parsed;
    return {
      status: "failed",
      ok: false,
      variant: variantKey,
      fails: [error instanceof Error ? error.message : String(error)]
    };
  }
}

function runCandidateVisualReports({ source, rootDir, identity, candidateName, candidateFiles, threshold }) {
  const visualReports = {};
  for (const variantKey of GLB_VARIANTS) {
    visualReports[variantKey] = runVisualCompareForCandidate({
      source,
      candidatePath: candidateFiles[variantKey],
      variantKey,
      outDir: visualReportPath(rootDir, identity, candidateName, variantKey),
      rootDir,
      threshold
    });
  }
  const failed = Object.entries(visualReports)
    .filter(([, report]) => report?.status !== "passed")
    .map(([variantKey, report]) => `${variantKey}: ${report?.fails?.join("; ") || report?.status || "failed"}`);
  return {
    visualReports,
    visualGate: failed.length > 0
      ? { status: "failed", fails: failed }
      : { status: "passed", fails: [] }
  };
}

function missingVisualGate() {
  return {
    visualReports: {},
    visualGate: {
      status: "failed",
      reason: STRICT_VISUAL_REJECTION,
      fails: [STRICT_VISUAL_REJECTION]
    }
  };
}

function candidatePasses(candidate) {
  return (
    candidate.budgets?.status === "passed" &&
    candidate.glbValidation?.status === "passed" &&
    candidate.arLiteValidation?.status === "passed" &&
    candidate.visualGate?.status === "passed" &&
    candidate.antiCheat?.status === "passed"
  );
}

function candidateRejectionReasons(candidate) {
  const reasons = [];
  for (const [field, label] of [
    ["budgets", "budget validation"],
    ["glbValidation", "GLB validation"],
    ["arLiteValidation", "AR-lite constraints"],
    ["visualGate", "strict visual compare"],
    ["antiCheat", "anti-cheat"]
  ]) {
    const gate = candidate[field];
    if (gate?.status !== "passed") {
      reasons.push({
        gate: field,
        reason: gate?.reason ?? gate?.fails?.join("; ") ?? `${label} did not pass`
      });
    }
  }
  return reasons;
}

export function selectOptimizationCandidate(candidateReports = []) {
  const passingCandidates = candidateReports
    .filter(candidatePasses)
    .sort((a, b) => a.totalBytes - b.totalBytes);
  const selected = passingCandidates[0] ?? null;
  const rejectedCandidates = candidateReports
    .filter((candidate) => candidate.name !== selected?.name)
    .map((candidate) => ({
      name: candidate.name,
      totalBytes: candidate.totalBytes,
      reasons: candidateRejectionReasons(candidate)
    }));

  if (!selected) {
    return {
      selectedCandidate: null,
      decision: {
        status: "rejected",
        reason: "No adaptive candidate passed every budget, GLB, AR-lite, visual, and anti-cheat gate."
      },
      rejectedCandidates
    };
  }

  return {
    selectedCandidate: selected.name,
    decision: {
      status: "selected",
      selectedCandidate: selected.name,
      reason: `Selected ${selected.name} as the lightest candidate that passed every gate.`
    },
    rejectedCandidates
  };
}

function markdownCandidateReport(report) {
  const lines = [
    "# Vistaire 3D Candidate Report",
    "",
    `- Selected candidate: ${report.selectedCandidate ?? "none"}`,
    `- Decision: ${report.decision.reason}`,
    "",
    "| Candidate | Total bytes | Visual | Budgets | GLB | AR-lite | Anti-cheat |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...report.candidates.map((candidate) =>
      `| ${candidate.name} | ${candidate.totalBytes} | ${candidate.visualGate?.status ?? "unknown"} | ${candidate.budgets?.status ?? "unknown"} | ${candidate.glbValidation?.status ?? "unknown"} | ${candidate.arLiteValidation?.status ?? "unknown"} | ${candidate.antiCheat?.status ?? "unknown"} |`
    ),
    "",
    "Human approval, CDN validation, and real-device iPhone/Android QA remain separate gates."
  ];
  return `${lines.join("\n")}\n`;
}

function combineVisualReports({ identity, analysis, variants, visualReports, approvedBy, rootDir, reports }) {
  const reportsByVariant = Object.fromEntries(
    GLB_VARIANTS.map((variantKey) => [variantKey, visualReports?.[variantKey]])
  );
  if (Object.values(reportsByVariant).some((report) => report?.status !== "passed")) {
    return makeVisualQualityReport({ identity, analysis, variants, approvedBy });
  }

  const allAngleReports = GLB_VARIANTS.flatMap((variantKey) => reportsByVariant[variantKey].angleReports ?? []);
  const minMetric = (key) => Math.min(...GLB_VARIANTS.map((variantKey) => reportsByVariant[variantKey][key]));
  const maxMetric = (key) => Math.max(...GLB_VARIANTS.map((variantKey) => reportsByVariant[variantKey][key]));
  const checks = {};
  for (const checkKey of ["textureSharpness", "silhouette", "color", "material", "scaleOrigin", "lowPoly", "appetite"]) {
    const failed = GLB_VARIANTS
      .map((variantKey) => reportsByVariant[variantKey].checks?.[checkKey])
      .find((check) => check?.status !== "passed");
    checks[checkKey] = failed ?? { status: "passed" };
  }

  const combinedReport = {
    status: "passed",
    promise: STRICT_VISUAL_PROMISE,
    method: "deterministic-render-comparison",
    threshold: "strict",
    thresholds: STRICT_VISUAL_THRESHOLDS,
    identity,
    source: {
      sha256: analysis.sha256,
      bytes: analysis.bytes
    },
    variants: Object.fromEntries(
      GLB_VARIANTS.map((variantKey) => [
        variantKey,
        {
          candidate: {
            sha256: variants[variantKey].sha256,
            bytes: variants[variantKey].bytes
          },
          reportJson: reportsByVariant[variantKey].reportJson,
          reportArtifacts: reportsByVariant[variantKey].reportArtifacts?.[variantKey]
        }
      ])
    ),
    reportArtifacts: Object.fromEntries(
      GLB_VARIANTS.map((variantKey) => [variantKey, reportsByVariant[variantKey].reportArtifacts[variantKey]])
    ),
    angleReports: allAngleReports,
    meanSsim: minMetric("meanSsim"),
    perceptualScore: minMetric("perceptualScore"),
    maxDiffRatio: maxMetric("maxDiffRatio"),
    maxSilhouetteDiff: maxMetric("maxSilhouetteDiff"),
    maxColorDelta: maxMetric("maxColorDelta"),
    maxTextureBlurDelta: maxMetric("maxTextureBlurDelta"),
    maxMaterialDrift: maxMetric("maxMaterialDrift"),
    maxScaleDriftMeters: maxMetric("maxScaleDriftMeters"),
    maxOriginDriftMeters: maxMetric("maxOriginDriftMeters"),
    lowPolyVisibilityScore: maxMetric("lowPolyVisibilityScore"),
    appetitePreservationScore: minMetric("appetitePreservationScore"),
    checks
  };
  const combinedPath = join(reports, "visual-report.json");
  writeJsonFile(combinedPath, combinedReport);
  const visualQuality = {
    ...combinedReport,
    score: combinedReport.perceptualScore,
    report: fileReference(combinedPath, rootDir),
    manualReview: {
      required: true,
      status: "pending",
      approvalType: "human",
      approvedBy: null,
      approvedAt: null,
      requestedBy: approvedBy || null
    },
    realDeviceQa: {
      ...pendingRealDeviceQa()
    }
  };
  return visualQuality;
}

function validateVisualApprovalReadiness({ manifest, rootDir }) {
  const result = createResult("visual-approval-readiness");
  const visualQuality = manifest?.visualQuality ?? {};
  if (visualQuality.status !== "passed") {
    result.ok = false;
    result.fails.push("visualQuality.status must be passed before human visual approval");
  }
  if (visualQuality.promise !== STRICT_VISUAL_PROMISE) {
    result.ok = false;
    result.fails.push("visualQuality.promise must match the strict Vistaire visual equivalence wording");
  }
  if (!/render/i.test(String(visualQuality.method ?? "")) || !/comparison/i.test(String(visualQuality.method ?? ""))) {
    result.ok = false;
    result.fails.push("visualQuality.method must describe deterministic rendered comparison");
  }
  if (!visualQuality.report) {
    result.ok = false;
    result.fails.push("visualQuality.report is required before approval");
  }
  for (const variantKey of ["web", "mobile", "arLite"]) {
    const triplet = visualQuality.reportArtifacts?.[variantKey];
    if (!triplet?.before || !triplet?.after || !triplet?.diff) {
      result.ok = false;
      result.fails.push(`visualQuality.reportArtifacts.${variantKey} before/after/diff evidence is required`);
    }
    const angleCount = (visualQuality.angleReports ?? []).filter((entry) => entry?.variant === variantKey).length;
    if (angleCount < 4) {
      result.ok = false;
      result.fails.push(`visualQuality.angleReports.${variantKey} must include at least four deterministic angles`);
    }
  }
  const thresholdChecks = [
    ["meanSsim", ">=", STRICT_VISUAL_THRESHOLDS.meanSsim],
    ["perceptualScore", ">=", STRICT_VISUAL_THRESHOLDS.perceptualScore],
    ["maxDiffRatio", "<=", STRICT_VISUAL_THRESHOLDS.maxDiffRatio],
    ["maxSilhouetteDiff", "<=", STRICT_VISUAL_THRESHOLDS.maxSilhouetteDiff],
    ["maxColorDelta", "<=", STRICT_VISUAL_THRESHOLDS.maxColorDelta],
    ["maxTextureBlurDelta", "<=", STRICT_VISUAL_THRESHOLDS.maxTextureBlurDelta],
    ["maxMaterialDrift", "<=", STRICT_VISUAL_THRESHOLDS.maxMaterialDrift],
    ["maxScaleDriftMeters", "<=", STRICT_VISUAL_THRESHOLDS.maxScaleDriftMeters],
    ["maxOriginDriftMeters", "<=", STRICT_VISUAL_THRESHOLDS.maxOriginDriftMeters],
    ["lowPolyVisibilityScore", "<=", STRICT_VISUAL_THRESHOLDS.maxLowPolyVisibility],
    ["appetitePreservationScore", ">=", STRICT_VISUAL_THRESHOLDS.minAppetitePreservation]
  ];
  for (const [metric, operator, threshold] of thresholdChecks) {
    const value = Number(visualQuality[metric]);
    const ok = operator === ">=" ? value >= threshold : value <= threshold;
    if (!Number.isFinite(value) || !ok) {
      result.ok = false;
      result.fails.push(`visualQuality.${metric} does not satisfy strict threshold ${operator} ${threshold}`);
    }
  }
  for (const [key, check] of Object.entries(visualQuality.checks ?? {})) {
    if (check?.status !== "passed") {
      result.ok = false;
      result.fails.push(`visualQuality.checks.${key}.status must be passed`);
    }
  }
  const evidence = validateVisualEvidence({ manifest, rootDir });
  mergeResultInto(result, evidence);
  return result;
}

function runApproveVisual(args) {
  const result = createResult("3d:approve-visual");
  const rootDir = normalize(resolve(args.root ?? process.cwd()));
  const manifestPath = args.manifest ? normalize(resolve(String(args.manifest))) : "";
  if (!manifestPath || !existsSync(manifestPath)) throw new Error("--manifest must point to an existing dish manifest");
  if (!args.write) throw new Error("Visual approval requires --write");
  const approvedBy = String(args["approved-by"] ?? "").trim();
  if (!approvedBy) throw new Error("Visual approval requires --approved-by");

  const manifest = readJsonFile(manifestPath);
  const readiness = validateVisualApprovalReadiness({ manifest, rootDir });
  mergeResultInto(result, readiness);
  if (!readiness.ok) return result;

  const now = new Date().toISOString();
  const approved = {
    ...manifest,
    visualQuality: {
      ...manifest.visualQuality,
      manualReview: {
        ...(manifest.visualQuality?.manualReview ?? {}),
        required: true,
        status: "approved",
        approvalType: "human",
        approvedBy,
        approvedAt: now
      }
    },
    quality: {
      ...(manifest.quality ?? {}),
      manualVisualApprovalRequired: true,
      manualVisualApproved: true,
      approvedBy,
      manualReview: {
        ...(manifest.quality?.manualReview ?? {}),
        status: "approved",
        approvalType: "human",
        approvedBy,
        approvedAt: now
      }
    }
  };

  writeJsonFile(manifestPath, approved);
  result.metrics.manifestPath = manifestPath;
  result.metrics.manualReview = approved.visualQuality.manualReview;
  result.warnings.push("Visual approval recorded; production publish remains blocked until strict manifest validation and real-device iPhone and Android QA pass.");
  return result;
}

function manifestUsesExternalDelivery(manifest) {
  return Object.values(manifest?.variants ?? {}).some((variant) => /^https:\/\//i.test(String(variant?.url ?? "")));
}

function validateNetworkValidationReport({ manifest, reportPath }) {
  const result = createResult("cdn-network-validation-report");
  if (!reportPath) {
    result.ok = false;
    result.fails.push("CDN publish requires --network-validation-report from npm run 3d:validate-network -- --strict");
    return result;
  }
  const fullPath = normalize(resolve(String(reportPath)));
  if (!existsSync(fullPath)) {
    result.ok = false;
    result.fails.push(`Network validation report is missing: ${fullPath}`);
    return result;
  }
  const report = readJsonFile(fullPath);
  if (report.ok !== true || report.name !== "network-headers") {
    result.ok = false;
    result.fails.push("Network validation report must be a passing network-headers result");
  }
  if (!Array.isArray(report.metrics?.assets) || report.metrics.assets.length === 0) {
    result.ok = false;
    result.fails.push("Network validation report must include strict asset metrics");
  }
  const metricsByUrl = new Map((report.metrics?.assets ?? []).map((asset) => [asset.url, asset]));
  for (const asset of collectManifestAssets(manifest)) {
    if (!/^https:\/\//i.test(asset.url)) continue;
    try {
      validateCdnTargetUrl(manifest, asset.role, asset.url);
    } catch (error) {
      result.ok = false;
      result.fails.push(`${asset.label}: ${error.message}`);
      continue;
    }
    const metric = metricsByUrl.get(asset.url);
    if (!metric) {
      result.ok = false;
      result.fails.push(`${asset.label}: network validation report is missing ${asset.url}`);
      continue;
    }
    if (metric.status < 200 || metric.status >= 300 || metric.getStatus < 200 || metric.getStatus >= 300) {
      result.ok = false;
      result.fails.push(`${asset.label}: network validation did not prove successful HEAD and GET requests`);
    }
    const expectedContentType = contentTypeForVariant(asset.role, asset.url);
    const actualContentType = String(metric.contentType ?? "").split(";")[0].trim().toLowerCase();
    if (!actualContentType) {
      result.ok = false;
      result.fails.push(`${asset.label}: network validation is missing content-type evidence`);
    } else if (actualContentType !== expectedContentType) {
      result.ok = false;
      result.fails.push(`${asset.label}: network validation content-type must be ${expectedContentType}`);
    }
    const cacheControl = String(metric.cacheControl ?? "").toLowerCase();
    if (
      !cacheControl.includes("public") ||
      !cacheControl.includes("max-age=31536000") ||
      !cacheControl.includes("immutable")
    ) {
      result.ok = false;
      result.fails.push(`${asset.label}: network validation is missing public, max-age=31536000, immutable cache-control evidence`);
    }
    if (asset.role === "iosUsdz" && !String(metric.contentDisposition ?? "").toLowerCase().includes("inline")) {
      result.ok = false;
      result.fails.push(`${asset.label}: network validation is missing inline USDZ content-disposition evidence`);
    }
    if (["web", "mobile", "arLite", "poster"].includes(asset.role)) {
      const cors = String(metric.accessControlAllowOrigin ?? "");
      const appOrigin = String(process.env.VISTAIRE_APP_ORIGIN ?? "").replace(/\/+$/, "");
      if (cors !== "*" && (!appOrigin || cors !== appOrigin)) {
        result.ok = false;
        result.fails.push(`${asset.label}: network validation CORS must be * or VISTAIRE_APP_ORIGIN`);
      }
    }
    if (Number.isFinite(asset.bytes) && Number(metric.contentLength) !== asset.bytes) {
      result.ok = false;
      result.fails.push(`${asset.label}: network validation contentLength does not match manifest bytes`);
    }
    if (Number.isFinite(asset.bytes) && metric.fetchedBytes !== asset.bytes) {
      result.ok = false;
      result.fails.push(`${asset.label}: network validation fetchedBytes does not match manifest bytes`);
    }
    if (asset.sha256 && metric.fetchedSha256 !== asset.sha256) {
      result.ok = false;
      result.fails.push(`${asset.label}: network validation fetchedSha256 does not match manifest sha256`);
    }
  }
  result.metrics.reportPath = fullPath;
  return result;
}

function validateLocalVariantFiles({ manifest, rootDir }) {
  const result = createResult("local-variant-files");
  for (const [key, variant] of Object.entries(manifest?.variants ?? {})) {
    if (/^https:\/\//i.test(String(variant?.url ?? ""))) continue;
    const filePath = publicUrlToFilePath(variant?.url, rootDir);
    if (!filePath || !existsSync(filePath)) {
      result.ok = false;
      result.fails.push(`variants.${key}: local runtime file is required but missing`);
      continue;
    }
    const bytes = statSync(filePath).size;
    const actualSha256 = fileHash(filePath);
    if (bytes !== variant.bytes) {
      result.ok = false;
      result.fails.push(`variants.${key}: local file bytes do not match manifest`);
    }
    if (actualSha256 !== variant.sha256) {
      result.ok = false;
      result.fails.push(`variants.${key}: local file sha256 does not match manifest`);
    }
    result.evidence.push({ variant: key, filePath, bytes, sha256: actualSha256 });
  }
  return result;
}

function contentTypeForVariant(variantKey, url) {
  const lower = String(url ?? "").toLowerCase();
  if (variantKey === "iosUsdz" || lower.endsWith(".usdz")) return "model/vnd.usdz+zip";
  if (["web", "mobile", "arLite"].includes(variantKey) || lower.endsWith(".glb")) return "model/gltf-binary";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  return "application/octet-stream";
}

function expectedCdnPathSuffix(manifest, variantKey) {
  return `/${manifest.restaurantSlug}/${manifest.menuSlug}/${manifest.dishSlug}/${manifest.activeVersion}/${VARIANT_DIRS[variantKey]}/`;
}

function expectedCdnPathPrefix(manifest, variantKey) {
  const suffix = expectedCdnPathSuffix(manifest, variantKey);
  const baseUrl = configuredCdnBaseUrl();
  if (!baseUrl) return suffix;
  const basePath = new URL(baseUrl).pathname.replace(/\/+$/, "");
  return `${basePath}${suffix}`;
}

function validateCdnTargetUrl(manifest, variantKey, url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`variants.${variantKey}.url must be a valid HTTPS CDN URL`);
  }
  if (parsed.protocol !== "https:") throw new Error(`variants.${variantKey}.url must use HTTPS`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`variants.${variantKey}.url must not include credentials, query, or hash`);
  }
  if (parsed.pathname.includes("\\") || parsed.pathname.includes("..")) {
    throw new Error(`variants.${variantKey}.url must not include traversal or backslashes`);
  }
  const allowedOrigins = configuredCdnOrigins();
  if (!allowedOrigins.includes(parsed.origin)) {
    throw new Error(`variants.${variantKey}.url origin ${parsed.origin} is not allowlisted by VISTAIRE_3D_CDN_ORIGINS`);
  }
  const expectedPrefix = expectedCdnPathPrefix(manifest, variantKey);
  if (!parsed.pathname.startsWith(expectedPrefix)) {
    throw new Error(`variants.${variantKey}.url must start with ${expectedPrefix}`);
  }
  return parsed;
}

function stagingFileForVariant(rootDir, manifest, variantKey) {
  const url = manifest.variants?.[variantKey]?.url ?? "";
  const fileName = basename(new URL(url, "https://local.invalid").pathname);
  return safeJoin(
    workDir(rootDir, {
      restaurantSlug: manifest.restaurantSlug,
      menuSlug: manifest.menuSlug,
      dishSlug: manifest.dishSlug,
      version: manifest.activeVersion
    }),
    VARIANT_DIRS[variantKey],
    fileName
  );
}

function activeManifestPath(rootDir, identity) {
  return safeJoin(
    rootDir,
    "public",
    "models",
    "restaurants",
    identity.restaurantSlug,
    identity.menuSlug,
    identity.dishSlug,
    "manifest.json"
  );
}

function versionManifestPath(rootDir, identity) {
  return safeJoin(
    rootDir,
    "public",
    "models",
    "restaurants",
    identity.restaurantSlug,
    identity.menuSlug,
    identity.dishSlug,
    identity.version,
    "manifest.json"
  );
}

function restaurantManifestPath(rootDir, restaurantSlug) {
  return safeJoin(rootDir, "public", "models", "restaurants", restaurantSlug, "manifest.json");
}

function collectActiveDishManifests(rootDir, restaurantSlug) {
  const restaurantRoot = safeJoin(rootDir, "public", "models", "restaurants", restaurantSlug);
  if (!existsSync(restaurantRoot)) return [];
  const manifests = [];
  function visit(dir, depth = 0) {
    if (depth > 4) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const filePath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(filePath, depth + 1);
      } else if (entry.name === "manifest.json") {
        const rel = relative(restaurantRoot, filePath).replaceAll("\\", "/");
        if (/^[^/]+\/[^/]+\/manifest\.json$/.test(rel)) {
          manifests.push(readJsonFile(filePath));
        }
      }
    }
  }
  visit(restaurantRoot);
  return manifests;
}

function writeRestaurantManifest(rootDir, restaurantSlug) {
  const activeManifests = collectActiveDishManifests(rootDir, restaurantSlug);
  if (activeManifests.length === 0) return null;
  const summary = summarizeRestaurantManifest(restaurantSlug, activeManifests, {
    generatedAt: new Date().toISOString()
  });
  writeJsonFile(restaurantManifestPath(rootDir, restaurantSlug), summary);
  return summary;
}

function runAnalyzeSource(args) {
  const result = createResult("3d:analyze-source");
  const source = normalize(resolve(String(args.source ?? "")));
  if (!source || !existsSync(source)) throw new Error("--source must point to an existing GLB");
  const analysis = analyzeGlbFile(source);
  result.metrics = analysis;
  result.evidence.push({ source, sha256: analysis.sha256, bytes: analysis.bytes });
  if (analysis.externalUris.length > 0) {
    result.ok = false;
    result.fails.push("Source GLB must not depend on external URIs");
  }
  if (args.out) writeJsonFile(String(args.out), result);
  if (args.markdown) writeAnalysisMarkdown(String(args.markdown), analysis);
  return result;
}

function runOptimizeDish(args) {
  const result = createResult("3d:optimize-dish");
  const rootDir = normalize(resolve(args.root ?? process.cwd()));
  const identity = identityFromArgs(args);
  const source = resolveSource(args, identity, rootDir);
  const dryRun = !args.write || Boolean(args["dry-run"]);
  const allowPublicBinaries = Boolean(args["allow-public-binaries"]);
  const approvedBy = String(args["approved-by"] ?? "").trim();
  const cdnBaseUrl = cleanCdnBaseUrl(args["cdn-base-url"] ?? "");
  const heavyAsset = Boolean(args["heavy-asset"]);
  const candidateProfiles = heavyAsset ? HEAVY_CANDIDATE_PROFILES : CANDIDATE_PROFILES;
  const reports = reportDir(rootDir, identity);
  const work = workDir(rootDir, identity);
  const analysis = analyzeGlbFile(source);

  result.metrics.identity = identity;
  result.metrics.source = source;
  result.metrics.rootDir = rootDir;
  result.metrics.dryRun = dryRun;
  result.metrics.heavyAsset = heavyAsset;
  result.metrics.candidateProfiles = candidateProfiles;
  result.evidence.push({ stage: "source-analysis", ...analysis });

  if (analysis.externalUris.length > 0) {
    throw new Error("Source GLB must embed buffers/images before optimization");
  }
  gltfTransformCli(process.cwd());

  if (dryRun) {
    result.warnings.push("Dry run only; pass --write to generate variants and manifests.");
    result.metrics.plannedOutputs = {
      reports,
      work,
      cdnBaseUrl: cdnBaseUrl || null,
      publicBase: `/models/restaurants/${identity.restaurantSlug}/${identity.menuSlug}/${identity.dishSlug}/${identity.version}`
    };
    return result;
  }
  if (!allowPublicBinaries && !cdnBaseUrl) {
    throw new Error(
      "Writing runtime binaries requires --allow-public-binaries or an allowlisted --cdn-base-url for CDN/storage mode."
    );
  }

  mkdirSync(reports, { recursive: true });
  mkdirSync(work, { recursive: true });

  const analysisResult = { ok: true, name: "3d:analyze-source", warnings: [], fails: [], metrics: analysis, evidence: [] };
  writeJsonFile(join(reports, "source-analysis.json"), analysisResult);
  writeAnalysisMarkdown(join(reports, "source-analysis.md"), analysis);

  const candidateReports = [];
  let generatedFiles = {};
  let transformEvidence = {};
  let generatedAnalysis = {};
  const runVisualCompareGate = Boolean(args["run-visual-compare"]);
  const visualThreshold = String(args["visual-threshold"] ?? "strict");
  if (visualThreshold !== "strict") {
    throw new Error("--visual-threshold currently supports strict only");
  }
  for (const candidateName of candidateProfiles) {
    const candidateFiles = {};
    const candidateEvidence = {};
    const candidateAnalysis = {};
    for (const key of GLB_VARIANTS) {
      const filePath = candidateFilePath(rootDir, identity, candidateName, key);
      const command = runGltfTransform({ input: source, output: filePath, profile: key, candidateName });
      const variantAnalysis = analyzeGlbFile(filePath);
      candidateFiles[key] = filePath;
      candidateEvidence[key] = command;
      candidateAnalysis[key] = variantAnalysis;
    }
    const candidateUsdzPath = candidateFilePath(rootDir, identity, candidateName, "iosUsdz");
    ensureParent(candidateUsdzPath);
    writeFileSync(candidateUsdzPath, createUsdzPackageFromGlb({ glbPath: candidateFiles.arLite, identity }));
    candidateFiles.iosUsdz = candidateUsdzPath;

    const candidatePosterPath = candidateFilePath(rootDir, identity, candidateName, "poster");
    ensureParent(candidatePosterPath);
    writeFileSync(candidatePosterPath, createReviewPosterPng({ analysis }));
    candidateFiles.poster = candidatePosterPath;

    const candidateVariants = Object.fromEntries(
      RUNTIME_VARIANTS.map((key) => [
        key,
        {
          filePath: candidateFiles[key],
          bytes: statSync(candidateFiles[key]).size,
          sha256: fileHash(candidateFiles[key]),
          url: deliveryUrl(identity, key, cdnBaseUrl),
          analysis: candidateAnalysis[key] ? candidateVariantSummary(candidateAnalysis[key]) : {}
        }
      ])
    );
    const totalBytes = Object.values(candidateVariants).reduce((sum, variant) => sum + variant.bytes, 0);
    const glbValidation = glbValidationForCandidate(candidateVariants);
    const arLiteValidation = candidateVariants.arLite.analysis?.extensionsRequired?.length === 0 &&
      candidateVariants.arLite.analysis?.externalUris?.length === 0 &&
      candidateVariants.arLite.analysis?.bounds?.groundedY === true &&
      candidateVariants.arLite.analysis?.bounds?.centeredXZ === true
      ? { status: "passed", fails: [] }
      : { status: "failed", fails: ["AR-lite must be embedded, extension-light, grounded, and centered"] };
    const antiCheat = antiCheatForCandidate({ sourceAnalysis: analysis, candidateVariants, transformEvidence: candidateEvidence });
    const budgets = budgetValidationForCandidate({
      identity,
      candidateVariants,
      profile: analysis.classification === "signature" ? "signature" : "simpleDish"
    });
    const visual = runVisualCompareGate
      ? runCandidateVisualReports({
          source,
          rootDir,
          identity,
          candidateName,
          candidateFiles,
          threshold: visualThreshold
        })
      : missingVisualGate();
    candidateReports.push({
      name: candidateName,
      variants: candidateVariants,
      transformEvidence: candidateEvidence,
      totalBytes,
      bytes: Object.fromEntries(Object.entries(candidateVariants).map(([key, variant]) => [key, variant.bytes])),
      triangles: Object.fromEntries(GLB_VARIANTS.map((key) => [key, candidateAnalysis[key].triangles])),
      textures: Object.fromEntries(GLB_VARIANTS.map((key) => [key, candidateAnalysis[key].textures])),
      materials: Object.fromEntries(GLB_VARIANTS.map((key) => [key, candidateAnalysis[key].materials])),
      budgets,
      glbValidation,
      arLiteValidation,
      antiCheat,
      visualReports: visual.visualReports,
      visualGate: visual.visualGate,
      decision: {
        status: "rejected",
        reason: "Candidate has not yet been selected."
      }
    });
  }
  const { selectedCandidate, decision, rejectedCandidates } = selectOptimizationCandidate(candidateReports);
  for (const candidate of candidateReports) {
    if (candidate.name === selectedCandidate) {
      candidate.decision = decision;
    } else {
      const rejected = rejectedCandidates.find((entry) => entry.name === candidate.name);
      candidate.decision = {
        status: "rejected",
        reason: rejected?.reasons?.map((entry) => entry.reason).join("; ") || "A lighter passing candidate was selected."
      };
    }
  }

  const selectedReport =
    candidateReports.find((candidate) => candidate.name === selectedCandidate) ??
    candidateReports.find((candidate) => candidate.name === "balanced");
  for (const key of RUNTIME_VARIANTS) {
    const selectedPath = selectedReport.variants[key].filePath;
    const finalPath = workFilePath(rootDir, identity, key);
    if (normalize(resolve(selectedPath)) !== normalize(resolve(finalPath))) {
      ensureParent(finalPath);
      writeFileSync(finalPath, readFileSync(selectedPath));
    }
    generatedFiles[key] = finalPath;
    if (GLB_VARIANTS.includes(key)) {
      transformEvidence[key] = selectedReport.transformEvidence[key];
      generatedAnalysis[key] = analyzeGlbFile(finalPath);
    }
  }

  const variants = {
    web: variantMetadata(generatedFiles.web, deliveryUrl(identity, "web", cdnBaseUrl), {
      profile: "web",
      optimizer: transformEvidence.web
    }),
    mobile: variantMetadata(generatedFiles.mobile, deliveryUrl(identity, "mobile", cdnBaseUrl), {
      profile: "mobile",
      optimizer: transformEvidence.mobile
    }),
    arLite: variantMetadata(generatedFiles.arLite, deliveryUrl(identity, "arLite", cdnBaseUrl), {
      profile: "arLite",
      optimizationMethod: "mesh-simplification-ar-lite",
      optimizer: transformEvidence.arLite,
      triangleCount: generatedAnalysis.arLite.triangles,
      vertexCount: generatedAnalysis.arLite.vertices,
      materialCount: generatedAnalysis.arLite.materials,
      textureCount: generatedAnalysis.arLite.textures,
      maxTextureSize: Math.max(
        0,
        ...generatedAnalysis.arLite.imageMetrics.map((image) => Math.max(image.width ?? 0, image.height ?? 0))
      ),
      extensionsUsed: generatedAnalysis.arLite.extensionsUsed,
      extensionsRequired: generatedAnalysis.arLite.extensionsRequired,
      arPlacement: "floor",
      arScale: "fixed"
    }),
    iosUsdz: variantMetadata(generatedFiles.iosUsdz, deliveryUrl(identity, "iosUsdz", cdnBaseUrl), {
      profile: "ios-quicklook",
      productionFaithful: false,
      faithfulnessStatus: "unproven-until-real-device-qa",
      proxy: false,
      conversionMethod: "glb-usdz-geometry-texture-export",
      sourceVariant: "arLite"
    }),
    poster: variantMetadata(generatedFiles.poster, deliveryUrl(identity, "poster", cdnBaseUrl), {
      profile: "poster",
      placeholder: true,
      productionPoster: false
    })
  };

  const visualQuality = selectedCandidate
    ? combineVisualReports({
        identity,
        analysis,
        variants,
        visualReports: selectedReport.visualReports,
        approvedBy,
        rootDir,
        reports
      })
    : makeVisualQualityReport({ identity, analysis, variants, approvedBy });
  writeJsonFile(join(reports, "visual-quality.json"), visualQuality);
  const candidateReport = {
    identity,
    source,
    candidates: candidateReports,
    selectedCandidate,
    decision,
    rejectedCandidates
  };
  writeJsonFile(join(reports, "candidate-report.json"), candidateReport);
  writeFileSync(join(reports, "candidate-report.md"), markdownCandidateReport(candidateReport));

  const manifest = buildManifest({ identity, analysis, variants, visualQuality, approvedBy });
  const validation = validateDishManifestPipeline({
    manifest,
    manifestPath: versionManifestPath(rootDir, identity),
    context: "production",
    requireFiles: allowPublicBinaries && !cdnBaseUrl,
    rootDir,
    strict: true
  });
  if (!validation.ok) {
    manifest.validationStatus = "failed";
    manifest.validation.fails = validation.fails;
  }
  const optimizationOk = validation.ok && visualQuality.status === "passed";
  if (!optimizationOk) {
    manifest.validationStatus = "failed";
  }
  writeJsonFile(join(reports, "optimization-report.json"), {
    ok: optimizationOk,
    identity,
    source,
    generatedFiles,
    transformEvidence,
    candidates: candidateReports,
    selectedCandidate,
    decision,
    rejectedCandidates,
    delivery: {
      mode: cdnBaseUrl ? "cdn" : "public",
      cdnBaseUrl: cdnBaseUrl || null,
      publicBinariesWritten: false,
      networkValidationRequiredBeforePublish: Boolean(cdnBaseUrl)
    },
    validation
  });
  writeJsonFile(versionManifestPath(rootDir, identity), manifest);

  if (visualQuality.status !== "passed") {
    result.ok = false;
    result.fails.push(STRICT_VISUAL_REJECTION);
  } else {
    result.ok = validation.ok;
  }
  result.fails.push(...validation.fails);
  result.warnings.push(...validation.warnings);
  result.metrics.manifestPath = versionManifestPath(rootDir, identity);
  result.metrics.variants = variants;
  result.metrics.visualQuality = visualQuality;
  result.evidence.push({ stage: "optimization", generatedFiles, transformEvidence });
  return result;
}

function approvedCandidateForFinalize(manifest) {
  const now = new Date().toISOString();
  return {
    ...manifest,
    status: "approved",
    validationStatus: "passed",
    validation: { warnings: [], fails: [] },
    approvedAt: manifest.approvedAt ?? now,
    publishedAt: null,
    lifecycle: {
      ...(manifest.lifecycle ?? {}),
      phase: "approved",
      finalizedAt: now
    }
  };
}

function validateFinalizeReadiness({ manifest, rootDir, manifestPath, networkValidationReport }) {
  const result = createResult("finalize-manifest-readiness");
  if (manifest.status === "published" || manifest.status === "archived") {
    result.ok = false;
    result.fails.push("Finalize refuses published or archived manifests");
  }
  if (manifest.publishedAt !== null || manifest.lifecycle?.publishedAt || manifest.lifecycle?.publishedBy || manifest.quality?.publishedBy) {
    result.ok = false;
    result.fails.push("Finalize refuses manifests with existing publish lifecycle fields");
  }
  if (manifest.schemaVersion !== 2) {
    result.ok = false;
    result.fails.push("Finalize requires schemaVersion 2");
  }
  if (manifest.visualQuality?.status !== "passed") {
    result.ok = false;
    result.fails.push("Finalize requires visualQuality.status passed");
  }
  if (manifest.quality?.manualVisualApproved !== true || manifest.quality?.manualReview?.status !== "approved") {
    result.ok = false;
    result.fails.push("Finalize requires human visual approval in quality.manualReview");
  }
  if (manifest.visualQuality?.manualReview?.status !== "approved") {
    result.ok = false;
    result.fails.push("Finalize requires human visual approval in visualQuality.manualReview");
  }

  mergeResultInto(result, validateVisualApprovalReadiness({ manifest, rootDir }));

  const candidate = approvedCandidateForFinalize(manifest);
  const externalDelivery = manifestUsesExternalDelivery(candidate);
  if (externalDelivery) {
    mergeResultInto(result, validateNetworkValidationReport({
      manifest: candidate,
      reportPath: networkValidationReport
    }));
  }
  mergeResultInto(result, validateLocalVariantFiles({ manifest: candidate, rootDir }));

  const validation = validateDishManifestPipeline({
    manifest: candidate,
    manifestPath,
    context: "production",
    requireFiles: !externalDelivery,
    rootDir,
    strict: true
  });
  mergeResultInto(result, validation);
  result.metrics.candidate = candidate;
  return result;
}

function runFinalizeManifest(args) {
  const result = createResult("3d:finalize-manifest");
  const rootDir = normalize(resolve(args.root ?? process.cwd()));
  const manifestPath = args.manifest ? normalize(resolve(String(args.manifest))) : "";
  if (!manifestPath || !existsSync(manifestPath)) throw new Error("--manifest must point to an existing dish manifest");
  if (!args.write) throw new Error("Finalize requires --write");
  const manifest = readJsonFile(manifestPath);
  const readiness = validateFinalizeReadiness({
    manifest,
    rootDir,
    manifestPath,
    networkValidationReport: args["network-validation-report"]
  });
  mergeResultInto(result, readiness);
  if (!readiness.ok) return result;

  const approved = readiness.metrics.candidate;
  writeJsonFile(manifestPath, approved);
  result.metrics.manifestPath = manifestPath;
  result.metrics.status = approved.status;
  result.metrics.validationStatus = approved.validationStatus;
  result.evidence.push({ finalizedAt: approved.lifecycle.finalizedAt, publishedAt: approved.publishedAt });
  return result;
}

function runRecordDeviceQa(args) {
  const result = createResult("3d:record-device-qa");
  const rootDir = normalize(resolve(args.root ?? process.cwd()));
  const manifestPath = args.manifest ? normalize(resolve(String(args.manifest))) : "";
  if (!manifestPath || !existsSync(manifestPath)) throw new Error("--manifest must point to an existing dish manifest");
  if (!args.write) throw new Error("Device QA recording requires --write");
  const target = String(args.device ?? "").trim();
  if (!["iphoneQuickLook", "androidSceneViewer"].includes(target)) {
    throw new Error("--device must be iphoneQuickLook or androidSceneViewer");
  }
  const status = String(args.status ?? "").trim();
  if (!["passed", "failed", "not-tested"].includes(status)) {
    throw new Error("--status must be passed, failed, or not-tested");
  }
  const manifest = readJsonFile(manifestPath);
  const previousQualityQa = manifest.quality?.realDeviceQa ?? pendingRealDeviceQa();
  const previousVisualQa = manifest.visualQuality?.realDeviceQa ?? pendingRealDeviceQa();
  const entry = {
    ...(previousQualityQa[target] ?? {}),
    required: true,
    status
  };
  if (status === "passed") {
    const deviceName = String(args["device-name"] ?? "").trim();
    const os = String(args.os ?? "").trim();
    const testedBy = String(args["tested-by"] ?? "").trim();
    const testedAt = String(args["tested-at"] ?? args.date ?? "").trim();
    if (!deviceName) throw new Error("--device-name is required when status is passed");
    if (!os) throw new Error("--os is required when status is passed");
    if (!testedBy) throw new Error("--tested-by is required when status is passed");
    if (!isIsoDate(testedAt)) throw new Error("--tested-at must be an ISO date when status is passed");
    entry.device = deviceName;
    entry.os = os;
    entry.testedBy = testedBy;
    entry.testedAt = new Date(testedAt).toISOString();
    entry.evidence = assertLocalEvidenceReference(args.evidence, rootDir, "--evidence");
    for (const [cliKey, entryKey] of [
      ["browser-version", "browserVersion"],
      ["network", "network"],
      ["manifest-version", "manifestVersion"],
      ["asset-url", "assetUrl"],
      ["arcore", "arcore"],
      ["notes", "notes"]
    ]) {
      if (args[cliKey]) entry[entryKey] = String(args[cliKey]);
    }
  } else {
    const notes = String(args.notes ?? "").trim();
    if (status === "failed" && notes.length < 8) {
      throw new Error("--notes is required when status is failed");
    }
    if (notes) entry.notes = notes;
    if (args.evidence) {
      entry.evidence = assertLocalEvidenceReference(args.evidence, rootDir, "--evidence");
    }
  }

  const updatedQa = {
    ...pendingRealDeviceQa(),
    ...previousQualityQa,
    required: true,
    [target]: entry
  };
  const updatedVisualQa = {
    ...pendingRealDeviceQa(),
    ...previousVisualQa,
    required: true,
    [target]: entry
  };
  const updated = {
    ...manifest,
    quality: {
      ...(manifest.quality ?? {}),
      realDeviceQa: updatedQa
    },
    visualQuality: {
      ...(manifest.visualQuality ?? {}),
      realDeviceQa: updatedVisualQa
    }
  };
  writeJsonFile(manifestPath, updated);
  result.metrics.manifestPath = manifestPath;
  result.metrics.device = target;
  result.metrics.status = status;
  result.evidence.push({ device: target, status, evidence: entry.evidence ?? null });
  result.warnings.push("Device QA evidence was recorded only; manifest lifecycle and publish status were not changed.");
  return result;
}

function runPrepareCdnUpload(args) {
  const result = createResult("3d:prepare-cdn-upload");
  const rootDir = normalize(resolve(args.root ?? process.cwd()));
  const manifestPath = args.manifest ? normalize(resolve(String(args.manifest))) : "";
  if (!manifestPath || !existsSync(manifestPath)) throw new Error("--manifest must point to an existing dish manifest");
  const outPath = args.out ? safeJoin(rootDir, String(args.out)) : "";
  if (!outPath) throw new Error("--out is required");
  const manifest = readJsonFile(manifestPath);
  const uploads = [];
  for (const variantKey of RUNTIME_VARIANTS) {
    const variant = manifest.variants?.[variantKey];
    if (!variant?.url) throw new Error(`variants.${variantKey}.url is required`);
    const parsed = validateCdnTargetUrl(manifest, variantKey, variant.url);
    const localPath = stagingFileForVariant(rootDir, manifest, variantKey);
    if (!existsSync(localPath) || !statSync(localPath).isFile()) {
      throw new Error(`Staging file is missing for variants.${variantKey}: ${localPath}`);
    }
    const bytes = statSync(localPath).size;
    const actualSha256 = fileHash(localPath);
    if (bytes !== variant.bytes) throw new Error(`variants.${variantKey}: staging bytes do not match manifest`);
    if (actualSha256 !== variant.sha256) throw new Error(`variants.${variantKey}: staging sha256 does not match manifest`);
    const contentType = contentTypeForVariant(variantKey, variant.url);
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable"
    };
    if (variantKey === "iosUsdz") headers["Content-Disposition"] = "inline";
    if (["web", "mobile", "arLite", "poster"].includes(variantKey)) {
      headers["Access-Control-Allow-Origin"] = String(process.env.VISTAIRE_APP_ORIGIN ?? "*").replace(/\/+$/, "") || "*";
    }
    uploads.push({
      variant: variantKey,
      role: variantKey,
      localPath: localPath.replaceAll("\\", "/"),
      url: parsed.toString(),
      targetPath: parsed.pathname,
      bytes,
      sha256: actualSha256,
      contentType,
      cacheControl: headers["Cache-Control"],
      headers
    });
  }
  const plan = {
    ok: true,
    name: "3d:prepare-cdn-upload",
    manifestPath: manifestPath.replaceAll("\\", "/"),
    generatedAt: new Date().toISOString(),
    uploads,
    note: "This is a local upload plan only. Run 3d:validate-network after uploading; no storage upload was performed."
  };
  if (args.write) {
    writeJsonFile(outPath, plan);
  } else {
    result.warnings.push("Dry run only; pass --write to write the upload plan.");
  }
  result.metrics.out = outPath;
  result.metrics.uploadCount = uploads.length;
  result.uploads = uploads;
  result.evidence.push({ uploadPlan: plan });
  return result;
}

function runPublish(args) {
  const result = createResult("3d:publish");
  const rootDir = normalize(resolve(args.root ?? process.cwd()));
  const manifestPath = args.manifest ? normalize(resolve(String(args.manifest))) : "";
  if (!manifestPath || !existsSync(manifestPath)) throw new Error("--manifest must point to an existing dish manifest");
  if (!args.write) throw new Error("Publish requires --write");
  if (!args["quality-approved"]) throw new Error("Publish requires --quality-approved");
  const approvedBy = String(args["approved-by"] ?? "").trim();
  if (!approvedBy) throw new Error("Publish requires --approved-by");

  const manifest = readJsonFile(manifestPath);
  const externalDelivery = manifestUsesExternalDelivery(manifest);
  if (externalDelivery) {
    const networkReport = validateNetworkValidationReport({
      manifest,
      reportPath: args["network-validation-report"]
    });
    mergeResultInto(result, networkReport);
    if (!networkReport.ok) return result;
  }
  const identity = {
    restaurantSlug: cleanSegment(manifest.restaurantSlug, "restaurantSlug"),
    menuSlug: cleanSegment(manifest.menuSlug, "menuSlug"),
    dishSlug: cleanSegment(manifest.dishSlug, "dishSlug"),
    version: cleanVersion(manifest.activeVersion)
  };
  const preflight = validateDishManifestPipeline({
    manifest,
    manifestPath,
    context: "production",
    requireFiles: !externalDelivery,
    rootDir,
    strict: true
  });
  if (!preflight.ok) {
    result.ok = false;
    result.fails.push("Publish requires a pre-approved strict visual identity manifest before promotion");
    result.fails.push(...preflight.fails);
    result.warnings.push(...preflight.warnings);
    result.evidence.push({ preflight });
    return result;
  }
  const localFiles = validateLocalVariantFiles({ manifest, rootDir });
  mergeResultInto(result, localFiles);
  if (!localFiles.ok) return result;
  if (manifest.status !== "approved") {
    throw new Error("Publish requires a pre-approved strict visual identity manifest before promotion: manifest status approved");
  }
  if (manifest.validationStatus !== "passed") {
    throw new Error("Publish requires a pre-approved strict visual identity manifest before promotion: validationStatus passed");
  }
  if (manifest.visualQuality?.status !== "passed") {
    throw new Error("Publish requires a pre-approved strict visual identity manifest before promotion: visualQuality.status passed");
  }
  if (manifest.quality?.manualVisualApproved !== true) {
    throw new Error("Publish requires a pre-approved strict visual identity manifest before promotion: existing manual visual approval");
  }
  if (manifest.visualQuality?.manualReview?.status !== "approved") {
    throw new Error("Publish requires a pre-approved strict visual identity manifest before promotion: human visual report approval");
  }
  if ((manifest.validation?.warnings?.length ?? 0) > 0 || (manifest.validation?.fails?.length ?? 0) > 0) {
    throw new Error("Publish requires a pre-approved strict visual identity manifest before promotion: no warnings or fails");
  }
  const activePath = activeManifestPath(rootDir, identity);
  const previous = existsSync(activePath) ? readJsonFile(activePath) : null;
  const now = new Date().toISOString();
  const published = {
    ...manifest,
    status: "published",
    validationStatus: "passed",
    quality: {
      ...manifest.quality,
      manualVisualApprovalRequired: true,
      manualVisualApproved: manifest.quality.manualVisualApproved,
      approvedBy: manifest.quality.approvedBy,
      publishedBy: approvedBy,
      manualReview: {
        ...(manifest.quality?.manualReview ?? {}),
        status: manifest.quality?.manualReview?.status,
        approvedBy: manifest.quality?.manualReview?.approvedBy,
        approvedAt: manifest.quality?.manualReview?.approvedAt
      }
    },
    visualQuality: {
      ...manifest.visualQuality
    },
    rollback: {
      ...(manifest.rollback ?? {}),
      previousVersion: previous?.activeVersion ?? null,
      fromVersion: null,
      toVersion: null
    },
    validation: { warnings: [], fails: [] },
    approvedAt: manifest.approvedAt,
    publishedAt: now,
    lifecycle: {
      ...(manifest.lifecycle ?? {}),
      phase: "published",
      publishedBy: approvedBy,
      publishedAt: now
    }
  };

  const validation = validateDishManifestPipeline({
    manifest: published,
    manifestPath,
    context: "production",
    requireFiles: !externalDelivery,
    rootDir,
    strict: true
  });
  if (!validation.ok) {
    result.ok = false;
    result.fails.push(...validation.fails);
    result.warnings.push(...validation.warnings);
    return result;
  }

  writeJsonFile(manifestPath, published);
  writeJsonFile(activePath, published);
  const restaurantManifest = writeRestaurantManifest(rootDir, identity.restaurantSlug);
  result.metrics = {
    manifestPath,
    activeManifestPath: activePath,
    previousVersion: previous?.activeVersion ?? null,
    publishedVersion: identity.version,
    restaurantManifestPath: restaurantManifest ? restaurantManifestPath(rootDir, identity.restaurantSlug) : null
  };
  result.evidence.push({ validation });
  return result;
}

function runRollback(args) {
  const result = createResult("3d:rollback");
  const rootDir = normalize(resolve(args.root ?? process.cwd()));
  const identity = identityFromArgs(args, { requireVersion: false });
  const toVersion = cleanVersion(args.to);
  if (!args.write) throw new Error("Rollback requires --write");
  const approvedBy = String(args["approved-by"] ?? "").trim();
  if (!approvedBy) throw new Error("Rollback requires --approved-by");

  const activePath = activeManifestPath(rootDir, { ...identity, version: toVersion });
  if (!existsSync(activePath)) throw new Error(`Active manifest is missing: ${activePath}`);
  const current = readJsonFile(activePath);
  const targetPath = versionManifestPath(rootDir, { ...identity, version: toVersion });
  if (!existsSync(targetPath)) throw new Error(`Rollback target manifest is missing: ${targetPath}`);
  const target = readJsonFile(targetPath);
  const now = new Date().toISOString();
  const rolledBack = {
    ...target,
    status: "published",
    validationStatus: "passed",
    validation: { warnings: [], fails: [] },
    publishedAt: now,
    rollback: {
      ...(target.rollback ?? {}),
      previousVersion: current.activeVersion,
      fromVersion: current.activeVersion,
      toVersion
    },
    lifecycle: {
      ...(target.lifecycle ?? {}),
      phase: "published",
      rollbackBy: approvedBy,
      rollbackAt: now
    }
  };
  const validation = validateDishManifestPipeline({
    manifest: rolledBack,
    manifestPath: targetPath,
    context: "production",
    requireFiles: !manifestUsesExternalDelivery(rolledBack),
    rootDir,
    strict: true
  });
  if (!validation.ok) {
    result.ok = false;
    result.fails.push(...validation.fails);
    result.warnings.push(...validation.warnings);
    return result;
  }

  writeJsonFile(activePath, rolledBack);
  writeRestaurantManifest(rootDir, identity.restaurantSlug);
  result.metrics = {
    activeManifestPath: activePath,
    fromVersion: current.activeVersion,
    toVersion
  };
  result.evidence.push({ validation });
  return result;
}

function runCleanStale(args) {
  const result = createResult("3d:clean-stale");
  const rootDir = normalize(resolve(args.root ?? process.cwd()));
  const identity = identityFromArgs(args, { requireVersion: false });
  const dishRoot = safeJoin(
    rootDir,
    "public",
    "models",
    "restaurants",
    identity.restaurantSlug,
    identity.menuSlug,
    identity.dishSlug
  );
  if (!existsSync(dishRoot)) {
    result.warnings.push(`Dish asset root does not exist: ${dishRoot}`);
    return result;
  }
  const activePath = activeManifestPath(rootDir, { ...identity, version: "" });
  const active = existsSync(activePath)
    ? readJsonFile(activePath)
    : null;
  const activeVersion = active?.activeVersion ?? "";
  if (!activeVersion) {
    result.metrics.activeManifestPath = activePath;
    result.metrics.activeVersion = "";
    result.metrics.stale = [];
    result.warnings.push(
      "No active manifest exists; stale versions cannot be identified safely."
    );
    if (args.write) {
      result.ok = false;
      result.fails.push(
        "Refusing clean-stale --write without an active manifest to preserve."
      );
    }
    return result;
  }
  const stale = readdirSync(dishRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== activeVersion)
    .map((entry) => safeJoin(dishRoot, entry.name));
  result.metrics.activeVersion = activeVersion;
  result.metrics.stale = stale;
  if (args.write) {
    for (const staleDir of stale) {
      rmSync(staleDir, { recursive: true, force: true });
    }
    result.evidence.push({ removed: stale });
  } else {
    result.warnings.push("Dry run only; pass --write after reviewing stale paths.");
  }
  return result;
}

function runPreview(args) {
  const result = createResult("3d:preview");
  const identity = identityFromArgs(args, { requireVersion: false });
  result.metrics.route = `/menu/${identity.restaurantSlug}/dishes/${identity.dishSlug}`;
  result.metrics.demoRoute = "/demo";
  result.metrics.manifest = args.manifest ?? "";
  result.warnings.push("Preview does not replace browser QA or real-device AR checks.");
  return result;
}

export function runPipelineCommand(commandName, argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    writeStdout(HELP);
    return { ok: true, name: commandName };
  }

  let output;
  try {
    if (commandName === "3d:analyze-source") output = runAnalyzeSource(args);
    else if (commandName === "3d:optimize-dish") output = runOptimizeDish(args);
    else if (commandName === "3d:optimize" || commandName === "3d:optimize-menu") output = runOptimizeDish(args);
    else if (commandName === "3d:approve-visual") output = runApproveVisual(args);
    else if (commandName === "3d:finalize-manifest") output = runFinalizeManifest(args);
    else if (commandName === "3d:record-device-qa") output = runRecordDeviceQa(args);
    else if (commandName === "3d:prepare-cdn-upload") output = runPrepareCdnUpload(args);
    else if (commandName === "3d:publish") output = runPublish(args);
    else if (commandName === "3d:rollback") output = runRollback(args);
    else if (commandName === "3d:clean-stale") output = runCleanStale(args);
    else if (commandName === "3d:preview") output = runPreview(args);
    else throw new Error(`Unknown 3D pipeline command: ${commandName}`);
  } catch (error) {
    output = failResult(commandName, error);
  }

  process.exitCode = output.ok ? 0 : 1;
  writeStdout(output, true);
  return output;
}
