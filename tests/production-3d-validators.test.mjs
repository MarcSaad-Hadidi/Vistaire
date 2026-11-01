import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { zipSync } from "fflate";

import { validateBudgets } from "../scripts/3d/shared/validators/budget-checks.mjs";
import { validateFileSignature } from "../scripts/3d/shared/validators/file-signature.mjs";
import { validateGlbBasic } from "../scripts/3d/shared/validators/glb-basic.mjs";
import { validateNetworkHeaders } from "../scripts/3d/shared/validators/network-headers.mjs";
import { validateSha256 } from "../scripts/3d/shared/validators/sha256.mjs";
import { validateUsdzBasic } from "../scripts/3d/shared/validators/usdz-basic.mjs";
import { validateDishManifestPipeline } from "../scripts/3d/validate-dish.mjs";

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "vistaire-production-3d-"));
  try {
    return fn(dir);
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

function makeGlb(gltf, bin = Buffer.from([0, 0, 0, 0])) {
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

function validGltf(overrides = {}) {
  return {
    asset: { version: "2.0", generator: "vistaire-test" },
    buffers: [{ byteLength: 4 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ name: "premium-material" }],
    textures: [{ source: 0 }],
    images: [{ bufferView: 0, mimeType: "image/png" }],
    ...overrides
  };
}

function makeUsdz(entries = {}) {
  return Buffer.from(
    zipSync({
      "model.usda": Buffer.from(
        [
          "#usda 1.0",
          "def Mesh \"Dish\" {",
          "  point3f[] points = [(0, 0, 0), (1, 0, 0), (0, 1, 0)]",
          "  int[] faceVertexIndices = [0, 1, 2]",
          "}",
          "def Material \"Mat\" {}"
        ].join("\n")
      ),
      "textures/albedo.png": Buffer.from("89504e470d0a1a0a", "hex"),
      ...entries
    })
  );
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function runNode(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      ...options
    });
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

function headerFixtureServer() {
  const server = createServer((request, response) => {
    const url = request.url ?? "";
    const headers = {
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": "208984",
      "content-type": "application/octet-stream"
    };
    if (url.endsWith(".glb")) headers["content-type"] = "model/gltf-binary";
    if (url.endsWith(".usdz")) {
      headers["content-disposition"] = "inline";
      headers["content-type"] = "model/vnd.usdz+zip";
    }
    response.writeHead(200, headers);
    response.end();
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function baseManifest(overrides = {}) {
  return {
    status: "review",
    variants: {
      web: {
        url: "/models/restaurants/maison-elyse/demo/dish/v1/web/dish.glb",
        bytes: 5_000_000
      },
      mobile: {
        url: "/models/restaurants/maison-elyse/demo/dish/v1/mobile/dish.glb",
        bytes: 1_000_000
      },
      arLite: {
        url: "/models/restaurants/maison-elyse/demo/dish/v1/ar-lite/dish.glb",
        bytes: 1_000_000
      },
      iosUsdz: {
        url: "/models/restaurants/maison-elyse/demo/dish/v1/ios/dish.usdz",
        bytes: 1_000_000
      },
      poster: {
        url: "/models/restaurants/maison-elyse/demo/dish/v1/poster/dish.webp",
        bytes: 180_000
      }
    },
    ...overrides
  };
}

test("file signature and sha256 validators return structured evidence", () =>
  withTempDir((dir) => {
    const filePath = join(dir, "dish.glb");
    writeFileSync(filePath, Buffer.from("glTF-test"));

    const signature = validateFileSignature({
      filePath,
      expectedMagic: "glTF",
      label: "fixture GLB"
    });
    const hash = validateSha256({
      filePath,
      expectedSha256: "a".repeat(64),
      label: "fixture GLB"
    });

    assert.equal(signature.ok, true);
    assert.equal(signature.metrics.magic, "glTF");
    assert.equal(hash.ok, false);
    assert.match(hash.fails.join("\n"), /sha256/i);
    assert.ok(hash.evidence.some((item) => item.actualSha256));
  }));

test("budget validator fails AR-lite over the hard triangle ceiling", () => {
  const manifest = baseManifest({
    variants: {
      ...baseManifest().variants,
      arLite: {
        url: "/models/restaurants/maison-elyse/demo/dish/v1/ar-lite/dish.glb",
        bytes: 1_000_000,
        triangleCount: 151_000
      }
    }
  });

  const result = validateBudgets({ manifest, profile: "signature" });

  assert.equal(result.ok, false);
  assert.match(result.fails.join("\n"), /arLite.*151000 triangles.*150000/);
});

test("basic GLB validator accepts a minimal valid GLB and reports scene metrics", () =>
  withTempDir((dir) => {
    const glbPath = join(dir, "dish.glb");
    writeFileSync(glbPath, makeGlb(validGltf()));

    const result = validateGlbBasic({ filePath: glbPath, role: "arLite" });

    assert.equal(result.ok, true);
    assert.equal(result.metrics.magic, "glTF");
    assert.equal(result.metrics.version, 2);
    assert.equal(result.metrics.meshCount, 1);
    assert.equal(result.metrics.primitiveCount, 1);
    assert.equal(result.metrics.materialCount, 1);
    assert.equal(result.metrics.textureCount, 1);
  }));

test("basic GLB validator fails malformed GLB headers", () =>
  withTempDir((dir) => {
    const glbPath = join(dir, "dish.glb");
    writeFileSync(glbPath, Buffer.from("nope"));

    const result = validateGlbBasic({ filePath: glbPath });

    assert.equal(result.ok, false);
    assert.match(result.fails.join("\n"), /GLB header|magic/i);
  }));

test("basic USDZ validator accepts a minimal ZIP package with USD, material, geometry, and texture resources", () =>
  withTempDir((dir) => {
    const usdzPath = join(dir, "dish.usdz");
    writeFileSync(usdzPath, makeUsdz());

    const result = validateUsdzBasic({
      filePath: usdzPath,
      url: "/models/restaurants/maison-elyse/demo/dish/v1/ios/dish.usdz",
      productionUrl: true
    });

    assert.equal(result.ok, true);
    assert.equal(result.metrics.magic, "PK");
    assert.equal(result.metrics.usdLayerCount, 1);
    assert.equal(result.metrics.geometryLayerCount, 1);
    assert.equal(result.metrics.textureCount, 1);
    assert.equal(result.metrics.materialCount, 1);
  }));

test("basic USDZ validator fails unstable production Quick Look URLs and unsafe ZIP entries", () =>
  withTempDir((dir) => {
    const usdzPath = join(dir, "dish.usdz");
    writeFileSync(usdzPath, makeUsdz({ "../escape.usda": Buffer.from("#usda 1.0") }));

    const result = validateUsdzBasic({
      filePath: usdzPath,
      url: "/models/restaurants/maison-elyse/demo/dish/v1/ios/dish.usdz?v=1",
      productionUrl: true
    });

    assert.equal(result.ok, false);
    assert.match(result.fails.join("\n"), /query.*hash/i);
    assert.match(result.fails.join("\n"), /unsafe/i);
  }));

test("budget validator separates target advisories, warning bands, and fail-budget failures", () => {
  const advisory = validateBudgets({
    manifest: baseManifest({
      variants: {
        ...baseManifest().variants,
        web: { ...baseManifest().variants.web, bytes: 7_000_000 }
      }
    })
  });
  const warning = validateBudgets({
    manifest: baseManifest({
      variants: {
        ...baseManifest().variants,
        web: { ...baseManifest().variants.web, bytes: 8_000_001 }
      }
    })
  });
  const failing = validateBudgets({
    manifest: baseManifest({
      variants: {
        ...baseManifest().variants,
        iosUsdz: { ...baseManifest().variants.iosUsdz, bytes: 5 * 1024 * 1024 + 1 }
      }
    })
  });

  assert.equal(advisory.ok, true);
  assert.deepEqual(advisory.warnings, []);
  assert.equal(warning.ok, true);
  assert.match(warning.warnings.join("\n"), /web.*warning/i);
  assert.equal(failing.ok, false);
  assert.match(failing.fails.join("\n"), /iosUsdz.*fail budget/i);
});

test("require-files validates manifest sha256 and byte metadata against local files", () =>
  withTempDir((dir) => {
    const glbBytes = makeGlb(validGltf());
    const usdzBytes = makeUsdz();
    const posterBytes = Buffer.from("poster");
    const paths = {
      web: join(dir, "public/models/restaurants/maison-elyse/demo/dish/v1/web/dish.glb"),
      mobile: join(dir, "public/models/restaurants/maison-elyse/demo/dish/v1/mobile/dish.glb"),
      arLite: join(dir, "public/models/restaurants/maison-elyse/demo/dish/v1/ar-lite/dish.glb"),
      iosUsdz: join(dir, "public/models/restaurants/maison-elyse/demo/dish/v1/ios/dish.usdz"),
      poster: join(dir, "public/models/restaurants/maison-elyse/demo/dish/v1/poster/dish.webp")
    };
    for (const filePath of Object.values(paths)) mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(paths.web, glbBytes);
    writeFileSync(paths.mobile, glbBytes);
    writeFileSync(paths.arLite, glbBytes);
    writeFileSync(paths.iosUsdz, usdzBytes);
    writeFileSync(paths.poster, posterBytes);

    const manifest = {
      schemaVersion: 1,
      restaurantSlug: "maison-elyse",
      menuSlug: "demo",
      dishSlug: "dish",
      activeVersion: "v1",
      status: "review",
      validationStatus: "passed",
      variants: {
        web: {
          url: "/models/restaurants/maison-elyse/demo/dish/v1/web/dish.glb",
          bytes: glbBytes.length,
          sha256: "0".repeat(64)
        },
        mobile: {
          url: "/models/restaurants/maison-elyse/demo/dish/v1/mobile/dish.glb",
          bytes: glbBytes.length + 1,
          sha256: sha256(glbBytes)
        },
        arLite: {
          url: "/models/restaurants/maison-elyse/demo/dish/v1/ar-lite/dish.glb",
          bytes: glbBytes.length,
          sha256: sha256(glbBytes)
        },
        iosUsdz: {
          url: "/models/restaurants/maison-elyse/demo/dish/v1/ios/dish.usdz",
          bytes: usdzBytes.length,
          sha256: sha256(usdzBytes)
        },
        poster: {
          url: "/models/restaurants/maison-elyse/demo/dish/v1/poster/dish.webp",
          bytes: posterBytes.length + 1,
          sha256: sha256(posterBytes)
        }
      },
      bytes: { total: glbBytes.length * 3 + usdzBytes.length + posterBytes.length },
      validation: { warnings: [], fails: [] },
      generatedAt: "2026-05-24T00:00:00.000Z",
      approvedAt: null,
      publishedAt: null
    };

    const result = validateDishManifestPipeline({
      manifest,
      context: "production",
      requireFiles: true,
      rootDir: dir
    });

    assert.equal(result.ok, false);
    assert.match(result.fails.join("\n"), /web.*sha256/i);
    assert.match(result.fails.join("\n"), /mobile.*bytes/i);
    assert.match(result.fails.join("\n"), /poster.*bytes/i);
  }));

test("require-files fails production GLB files that depend on external resources", () =>
  withTempDir((dir) => {
    const glbBytes = makeGlb(
      validGltf({
        buffers: [{ uri: "external.bin", byteLength: 4 }],
        images: [{ uri: "texture.png" }]
      })
    );
    const filePath = join(dir, "public/models/restaurants/maison-elyse/demo/dish/v1/web/dish.glb");
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, glbBytes);

    const manifest = {
      schemaVersion: 1,
      restaurantSlug: "maison-elyse",
      menuSlug: "demo",
      dishSlug: "dish",
      activeVersion: "v1",
      status: "review",
      validationStatus: "passed",
      variants: {
        ...baseManifest().variants,
        web: {
          url: "/models/restaurants/maison-elyse/demo/dish/v1/web/dish.glb",
          bytes: glbBytes.length,
          sha256: sha256(glbBytes)
        }
      },
      bytes: { total: 1_000_000 },
      validation: { warnings: [], fails: [] },
      generatedAt: "2026-05-24T00:00:00.000Z",
      approvedAt: null,
      publishedAt: null
    };

    const result = validateDishManifestPipeline({
      manifest,
      context: "production",
      requireFiles: true,
      rootDir: dir
    });

    assert.equal(result.ok, false);
    assert.match(result.fails.join("\n"), /external URI/i);
  }));

test("network header validator falls back from HEAD to GET Range and reads Content-Range totals", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method, range: options.headers?.Range });
    if (options.method === "HEAD") {
      return new Response(null, { status: 405 });
    }
    return new Response("", {
      status: 206,
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-disposition": "inline",
        "content-range": "bytes 0-0/5239742",
        "content-type": "model/vnd.usdz+zip"
      }
    });
  };

  const result = await validateNetworkHeaders({
    baseUrl: "http://localhost:3000",
    assets: [
      {
        url: "/models/restaurants/maison-elyse/demo/dish/v1/ios/dish.usdz",
        label: "dish ios USDZ",
        role: "iosUsdz",
        productionQuickLook: true
      }
    ],
    fetchImpl
  });

  assert.equal(result.ok, true);
  assert.equal(result.metrics.assets[0].contentLength, 5_239_742);
  assert.deepEqual(
    calls.map((call) => [call.method, call.range ?? ""]),
    [
      ["HEAD", ""],
      ["GET", "bytes=0-0"]
    ]
  );
});

test("network header validator rejects CDN byte and sha256 mismatches in strict mode", async () => {
  const expectedBytes = Buffer.from("vistaire-cdn-object");
  const wrongBytes = Buffer.from("wrong-object");
  const previousOrigins = process.env.VISTAIRE_3D_CDN_ORIGINS;
  const previousBaseUrl = process.env.VISTAIRE_3D_CDN_BASE_URL;
  process.env.VISTAIRE_3D_CDN_ORIGINS = "https://cdn.example.com";
  process.env.VISTAIRE_3D_CDN_BASE_URL = "https://cdn.example.com/vistaire";
  try {
    const result = await validateNetworkHeaders({
      baseUrl: "https://vistaire.example",
      strict: true,
      assets: [
        {
          url: "https://cdn.example.com/vistaire/maison-elyse/demo/dish/v1/web/dish-web.glb",
          label: "dish web GLB",
          role: "web",
          bytes: expectedBytes.length,
          sha256: sha256(expectedBytes)
        }
      ],
      fetchImpl: async (url, options = {}) => {
        if (options.method === "HEAD") {
          return new Response(null, {
            status: 200,
            headers: {
              "access-control-allow-origin": "*",
              "cache-control": "public, max-age=31536000, immutable",
              "content-length": String(wrongBytes.length),
              "content-type": "model/gltf-binary"
            }
          });
        }
        return new Response(wrongBytes, {
          status: 200,
          headers: {
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=31536000, immutable",
            "content-length": String(wrongBytes.length),
            "content-type": "model/gltf-binary"
          }
        });
      }
    });

    assert.equal(result.ok, false);
    assert.match(result.fails.join("\n"), /Content-Length/i);
    assert.match(result.fails.join("\n"), /sha256/i);
  } finally {
    if (previousOrigins === undefined) delete process.env.VISTAIRE_3D_CDN_ORIGINS;
    else process.env.VISTAIRE_3D_CDN_ORIGINS = previousOrigins;
    if (previousBaseUrl === undefined) delete process.env.VISTAIRE_3D_CDN_BASE_URL;
    else process.env.VISTAIRE_3D_CDN_BASE_URL = previousBaseUrl;
  }
});

test("network header validator fails when Range fallback is ignored in strict mode", async () => {
  const result = await validateNetworkHeaders({
    baseUrl: "http://localhost:3000",
    strict: true,
    assets: [
      {
        url: "/models/restaurants/maison-elyse/demo/dish/v1/ios/dish.usdz",
        label: "dish ios USDZ",
        role: "iosUsdz",
        productionQuickLook: true
      }
    ],
    fetchImpl: async (url, options = {}) => {
      if (options.method === "HEAD") return new Response(null, { status: 405 });
      return new Response("", {
        status: 200,
        headers: {
          "cache-control": "public, max-age=31536000, immutable",
          "content-disposition": "inline",
          "content-length": "208984",
          "content-type": "model/vnd.usdz+zip"
        }
      });
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.fails.join("\n"), /ignored Range/i);
});

test("network header validator rejects unsafe asset URLs before fetch", async () => {
  const calls = [];
  const result = await validateNetworkHeaders({
    baseUrl: "http://localhost:3000",
    assets: [
      {
        url: "https://evil.example/dish.glb",
        label: "external GLB",
        role: "web"
      }
    ],
    fetchImpl: async (url) => {
      calls.push(String(url));
      return new Response("", { status: 200 });
    }
  });

  assert.equal(result.ok, false);
  assert.deepEqual(calls, []);
  assert.match(result.fails.join("\n"), /unsafe/i);
});

test("network header validator uses Range fallback when HEAD omits Quick Look content length", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method, range: options.headers?.Range });
    if (options.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: {
          "cache-control": "public, max-age=31536000, immutable",
          "content-disposition": "inline",
          "content-type": "model/vnd.usdz+zip"
        }
      });
    }
    return new Response("", {
      status: 206,
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-disposition": "inline",
        "content-range": "bytes 0-0/208984",
        "content-type": "model/vnd.usdz+zip"
      }
    });
  };

  const result = await validateNetworkHeaders({
    baseUrl: "http://localhost:3000",
    assets: [
      {
        url: "/models/restaurants/maison-elyse/demo/dish/v1/ios/dish.usdz",
        label: "dish ios USDZ",
        role: "iosUsdz",
        productionQuickLook: true
      }
    ],
    fetchImpl
  });

  assert.equal(result.ok, true);
  assert.equal(result.metrics.assets[0].contentLength, 208_984);
  assert.deepEqual(
    calls.map((call) => [call.method, call.range ?? ""]),
    [
      ["HEAD", ""],
      ["GET", "bytes=0-0"]
    ]
  );
});

test("validate-network CLI serializes diagnostic JSON by default", async () => {
  const server = await headerFixtureServer();
  try {
    const { port } = server.address();
    const result = await runNode([
      "scripts/3d/validate-network.mjs",
      "--base-url",
      `http://127.0.0.1:${port}`
    ]);

    assert.equal(result.code, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /^\[object Object\]\s*$/);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.name, "network-headers");
    assert.equal(parsed.ok, true);
    assert.ok(parsed.metrics.assets.length >= 5);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("3D pipeline branch does not add public media binaries or wildcard LFS rules", () => {
  const allowedPublicVideoExceptions = new Set(["public/videos/Vistaire2.mp4", "public/videos/demo/dashboard-studio.mp4"]);
  const status = execFileSync(
    "git",
    ["-c", "core.quotepath=false", "status", "--porcelain", "--untracked-files=all"],
    { encoding: "utf8" }
  );
  const changedPaths = status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replaceAll("\\", "/"));
  const allowedScaffoldFiles = new Set([
    "assets/3d/reports/.gitkeep",
    "public/models/restaurants/.gitkeep"
  ]);
  const forbidden = changedPaths.filter((filePath) => {
    if (allowedScaffoldFiles.has(filePath)) return false;
    return (
      /^public\/models\/.*\.(glb|usdz)$/i.test(filePath) ||
      (/^public\/videos\//i.test(filePath) &&
        !allowedPublicVideoExceptions.has(filePath)) ||
      /^public\/frames\//i.test(filePath) ||
      /^3D Plat\//i.test(filePath) ||
      /^3D photo\//i.test(filePath) ||
      /^assets\/3d\/source\//i.test(filePath) ||
      /^assets\/3d\/work\//i.test(filePath) ||
      /^asset-review\//i.test(filePath)
    );
  });

  assert.deepEqual(forbidden, []);

  const attributes = readFileSync(".gitattributes", "utf8");
  assert.doesNotMatch(attributes, /^\s*\*\.(glb|usdz|mp4|webm|mov|zip)\s+.*filter=lfs/im);
});
