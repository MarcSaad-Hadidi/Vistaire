import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

const DISH_ID = "dish-123";
const ASSET_VERSION = "20260722-test";
const PHOTO_VERSION = "a".repeat(64);
const REDIRECT_SECRET = "fixture-super-secret-token";
const RANGE_HEADER = "bytes=0-1023";
const RESTAURANT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const ASSETS = {
  photo: {
    route: `/api/public/menu-dishes/${DISH_ID}/photo`,
    storagePath:
      `/storage/v1/object/sign/vistaire-media/restaurants/${RESTAURANT_ID}` +
      "/photos/originals/dish.jpg",
    contentType: "image/jpeg"
  },
  glb: {
    route: `/api/public/menu-dishes/${DISH_ID}/model/glb`,
    storagePath:
      `/storage/v1/object/sign/vistaire-3d/restaurants/${RESTAURANT_ID}` +
      "/models/web/dish.glb",
    contentType: "model/gltf-binary"
  },
  usdz: {
    route: `/api/public/menu-dishes/${DISH_ID}/model/usdz`,
    storagePath:
      `/storage/v1/object/sign/vistaire-3d/restaurants/${RESTAURANT_ID}` +
      "/models/ar-ios/dish.usdz",
    contentType: "model/vnd.usdz+zip"
  }
};

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  server.close();
  await once(server, "close");
}

function runCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/validate-runtime-asset-preview.mjs", ...args],
      {
        cwd: process.cwd(),
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr, stdout }));
  });
}

function assetForStoragePath(pathname) {
  return Object.entries(ASSETS).find(([, asset]) => asset.storagePath === pathname);
}

async function startFixture({
  contentTypeByAsset = {},
  corsOrigin,
  rangeSupported = true,
  reportedRangeEnd,
  redirectBody = "",
  headUsesDifferentObject = false,
  omitRedirectToken = false
} = {}) {
  const originRequests = [];
  const storageRequests = [];
  const payload = Buffer.alloc(4_096, 0x61);

  const storageServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://fixture.invalid");
    const entry = assetForStoragePath(url.pathname);
    storageRequests.push({
      method: request.method,
      pathname: url.pathname,
      range: request.headers.range ?? "",
      origin: request.headers.origin ?? ""
    });

    if (!entry) {
      response.writeHead(404).end();
      return;
    }

    const [assetName, asset] = entry;
    const commonHeaders = {
      "Access-Control-Allow-Origin":
        corsOrigin ?? request.headers.origin ?? "*",
      "Accept-Ranges": "bytes",
      "Content-Type": contentTypeByAsset[assetName] ?? asset.contentType
    };

    const rangeMatch = String(request.headers.range ?? "").match(/^bytes=0-(\d+)$/);
    if (rangeSupported && rangeMatch) {
      const rangeEnd = Number(rangeMatch[1]);
      const body = payload.subarray(0, rangeEnd + 1);
      const contentRangeEnd = reportedRangeEnd ?? rangeEnd;
      response.writeHead(206, {
        ...commonHeaders,
        "Content-Length": String(body.byteLength),
        "Content-Range": `bytes 0-${contentRangeEnd}/${payload.byteLength}`
      });
      response.end(body);
      return;
    }

    response.writeHead(200, {
      ...commonHeaders,
      "Content-Length": String(payload.byteLength)
    });
    response.end(payload);
  });
  const storageBaseUrl = await listen(storageServer);

  const originServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://fixture.invalid");
    originRequests.push({
      method: request.method,
      pathname: url.pathname,
      version: url.searchParams.get("v")
    });

    if (url.pathname === "/api/public/menu-dishes/missing/photo") {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end('{"ok":false}');
      return;
    }

    const entry = Object.entries(ASSETS).find(([, asset]) => asset.route === url.pathname);
    const expectedVersion =
      entry?.[0] === "photo" ? PHOTO_VERSION : ASSET_VERSION;
    if (!entry || url.searchParams.get("v") !== expectedVersion) {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end('{"ok":false}');
      return;
    }

    const [, asset] = entry;
    const storagePath =
      headUsesDifferentObject && request.method === "HEAD"
        ? asset.storagePath.replace(/(\.[a-z0-9]+)$/i, "-head$1")
        : asset.storagePath;
    const location =
      `${storageBaseUrl}${storagePath}` +
      `${omitRedirectToken ? "?" : `?token=${REDIRECT_SECRET}&`}download=asset`;
    response.writeHead(307, {
      "Content-Type": "text/plain; charset=utf-8",
      Location: location
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    response.end(redirectBody);
  });
  const baseUrl = await listen(originServer);

  return {
    baseUrl,
    originRequests,
    storageBaseUrl,
    storageRequests,
    async stop() {
      await Promise.all([close(originServer), close(storageServer)]);
    }
  };
}

async function loadValidator() {
  try {
    return await import("../scripts/runtime-assets/preview-validator.mjs");
  } catch (error) {
    assert.fail(
      `runtime asset preview validator must be implemented: ${
        error instanceof Error ? error.code ?? error.message : String(error)
      }`
    );
  }
}

function baseOptions(fixture) {
  return {
    baseUrl: fixture.baseUrl,
    dishId: DISH_ID,
    assetVersion: ASSET_VERSION,
    photoVersion: PHOTO_VERSION,
    expectedStorageHost: new URL(fixture.storageBaseUrl).host,
    expectedRestaurantId: RESTAURANT_ID,
    missingAssetUrl: "/api/public/menu-dishes/missing/photo"
  };
}

test("validates redirect, range, type, CORS, version, and missing-asset contracts without full binary downloads", async () => {
  const fixture = await startFixture();
  try {
    const { formatRuntimeAssetReport, validateRuntimeAssetPreview } =
      await loadValidator();
    const result = await validateRuntimeAssetPreview(baseOptions(fixture));

    assert.equal(result.ok, true, formatRuntimeAssetReport(result));
    assert.deepEqual(
      result.assets.map((asset) => asset.name),
      ["photo", "glb", "usdz"]
    );
    for (const asset of result.assets) {
      assert.equal(asset.redirect.getStatus, 307, asset.name);
      assert.equal(asset.redirect.getBodyBytes, 0, asset.name);
      assert.equal(asset.redirect.headStatus, 307, asset.name);
      assert.equal(asset.redirect.headBodyBytes, 0, asset.name);
      assert.equal(asset.redirect.locationDiscovered, true, asset.name);
      assert.equal(asset.redirect.locationHost, new URL(fixture.storageBaseUrl).host);
      assert.equal(asset.followed.host, new URL(fixture.storageBaseUrl).host, asset.name);
      assert.equal(asset.followed.status, 206, asset.name);
      assert.equal(asset.followed.bodyBytes, 1, asset.name);
      assert.equal(asset.followed.cors, fixture.baseUrl, asset.name);
      assert.equal(asset.range.host, new URL(fixture.storageBaseUrl).host, asset.name);
      assert.equal(asset.range.status, 206, asset.name);
      assert.equal(asset.range.supported, true, asset.name);
      assert.ok(asset.range.bodyBytes <= 1_024, asset.name);
      assert.equal(asset.range.cors, fixture.baseUrl, asset.name);
    }
    assert.equal(result.negative.wrongVersionStatus, 404);
    assert.equal(result.negative.wrongUsdzVersionStatus, 404);
    assert.equal(result.negative.wrongPhotoVersionStatus, 404);
    assert.equal(result.negative.missingAssetStatus, 404);

    assert.equal(fixture.storageRequests.length, 6);
    assert.ok(
      fixture.storageRequests.every((request) =>
        ["bytes=0-0", RANGE_HEADER].includes(request.range)
      ),
      "every followed or direct Storage request must be bounded by Range"
    );
    assert.equal(
      fixture.storageRequests.filter((request) => request.range === "bytes=0-0")
        .length,
      3
    );
    assert.equal(
      fixture.storageRequests.filter((request) => request.range === RANGE_HEADER)
        .length,
      3
    );
    assert.ok(
      fixture.storageRequests.every((request) => request.origin === fixture.baseUrl),
      "Storage CORS checks must send the Vistaire origin"
    );

    const serialized = JSON.stringify(result);
    const rendered = formatRuntimeAssetReport(result);
    for (const output of [serialized, rendered]) {
      assert.doesNotMatch(output, new RegExp(REDIRECT_SECRET));
      assert.doesNotMatch(output, /[?&](?:token|signature|sig|jwt)=/i);
      assert.doesNotMatch(output, /download=asset/);
    }
  } finally {
    await fixture.stop();
  }
});

test("fails non-empty 307 bodies, unsigned Locations, and GET/HEAD object mismatches", async () => {
  for (const fixtureOptions of [
    { redirectBody: "Temporary redirect", failedId: "photo.get.body" },
    { omitRedirectToken: true, failedId: "photo.storage.location" },
    { headUsesDifferentObject: true, failedId: "photo.storage.object" }
  ]) {
    const fixture = await startFixture(fixtureOptions);
    try {
      const { validateRuntimeAssetPreview } = await loadValidator();
      const result = await validateRuntimeAssetPreview(baseOptions(fixture));
      assert.equal(result.ok, false);
      assert.ok(
        result.checks.some(
          (check) =>
            check.id === fixtureOptions.failedId && check.status === "fail"
        ),
        fixtureOptions.failedId
      );
      assert.doesNotMatch(JSON.stringify(result), new RegExp(REDIRECT_SECRET));
    } finally {
      await fixture.stop();
    }
  }
});

test("warns and cancels the body when Storage ignores the bounded range request", async () => {
  const fixture = await startFixture({ rangeSupported: false });
  try {
    const { formatRuntimeAssetReport, validateRuntimeAssetPreview } =
      await loadValidator();
    const result = await validateRuntimeAssetPreview(baseOptions(fixture));

    assert.equal(result.ok, true, formatRuntimeAssetReport(result));
    assert.equal(result.summary.warnings, 6);
    for (const asset of result.assets) {
      assert.equal(asset.followed.status, 200);
      assert.equal(asset.followed.bodyBytes, 0);
      assert.equal(asset.range.status, 200);
      assert.equal(asset.range.supported, false);
      assert.equal(asset.range.bodyBytes, 0);
    }
    assert.ok(
      fixture.storageRequests.every((request) => request.range)
    );
  } finally {
    await fixture.stop();
  }
});

test("fails a mismatched Storage host without exposing the discovered signed Location", async () => {
  const fixture = await startFixture();
  try {
    const { formatRuntimeAssetReport, validateRuntimeAssetPreview } =
      await loadValidator();
    const result = await validateRuntimeAssetPreview({
      ...baseOptions(fixture),
      expectedStorageHost: "wrong-storage.example.test"
    });

    assert.equal(result.ok, false);
    assert.ok(result.summary.failed >= 3);
    const output = formatRuntimeAssetReport(result);
    assert.match(output, /Storage host/i);
    assert.doesNotMatch(output, new RegExp(REDIRECT_SECRET));
    assert.doesNotMatch(output, /[?&](?:token|signature|sig|jwt)=/i);
  } finally {
    await fixture.stop();
  }
});

test("fails when a signed Storage object belongs to another restaurant", async () => {
  const fixture = await startFixture();
  try {
    const { validateRuntimeAssetPreview } = await loadValidator();
    const result = await validateRuntimeAssetPreview({
      ...baseOptions(fixture),
      expectedRestaurantId: "ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb"
    });

    assert.equal(result.ok, false);
    assert.ok(
      result.checks.some(
        (check) =>
          check.id === "photo.storage.location" && check.status === "fail"
      )
    );
  } finally {
    await fixture.stop();
  }
});

test("rejects signed input URLs because the validator must discover private Locations itself", async () => {
  const fixture = await startFixture();
  try {
    const { validateRuntimeAssetPreview } = await loadValidator();
    await assert.rejects(
      validateRuntimeAssetPreview({
        ...baseOptions(fixture),
        assetUrls: {
          photo:
            `${fixture.baseUrl}${ASSETS.photo.route}` +
            `?v=${ASSET_VERSION}&token=input-secret`
        }
      }),
      /unsigned public URL/i
    );
  } finally {
    await fixture.stop();
  }
});

test("CLI runs the reusable Preview contract and never prints a discovered token", async () => {
  const fixture = await startFixture();
  try {
    const args = [
      "--base-url",
      fixture.baseUrl,
      "--dish-id",
      DISH_ID,
      "--asset-version",
      ASSET_VERSION,
      "--photo-version",
      PHOTO_VERSION,
      "--expected-storage-host",
      new URL(fixture.storageBaseUrl).host,
      "--expected-restaurant-id",
      RESTAURANT_ID,
      "--missing-asset-url",
      "/api/public/menu-dishes/missing/photo"
    ];
    const success = await runCli(args);

    assert.equal(success.code, 0, success.stderr);
    assert.match(success.stdout, /Runtime asset preview validation: PASS/);
    assert.match(success.stdout, /Followed 206 \(1 B\), Range 206 \(1024 B\)/);
    assert.equal(success.stderr, "");
    assert.doesNotMatch(success.stdout, new RegExp(REDIRECT_SECRET));
    assert.doesNotMatch(success.stdout, /[?&](?:token|signature|sig|jwt)=/i);

    const failureArgs = [...args];
    failureArgs[9] = "wrong-storage.example.test";
    const failure = await runCli(failureArgs);
    assert.equal(failure.code, 1);
    assert.match(failure.stdout, /Runtime asset preview validation: FAIL/);
    assert.doesNotMatch(failure.stdout + failure.stderr, new RegExp(REDIRECT_SECRET));
    assert.doesNotMatch(
      failure.stdout + failure.stderr,
      /[?&](?:token|signature|sig|jwt)=/i
    );
  } finally {
    await fixture.stop();
  }
});

test("CLI argument errors do not echo unknown secret-bearing input", async () => {
  const secret = "cli-argument-super-secret";
  const result = await runCli([`--token=${secret}`]);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /unknown option/i);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret));
});

test("rejects a 206 response that claims bytes beyond the requested range", async () => {
  const fixture = await startFixture({ reportedRangeEnd: 4_095 });
  try {
    const { validateRuntimeAssetPreview } = await loadValidator();
    const result = await validateRuntimeAssetPreview(baseOptions(fixture));

    assert.equal(result.ok, false);
    assert.ok(
      result.checks.some(
        (check) =>
          check.id === "photo.storage.range" && check.status === "fail"
      )
    );
  } finally {
    await fixture.stop();
  }
});

test("fails wrong media types and CORS origins at the followed and direct Range boundaries", async () => {
  const fixture = await startFixture({
    contentTypeByAsset: { glb: "application/octet-stream" },
    corsOrigin: "https://wrong-origin.example.test"
  });
  try {
    const { validateRuntimeAssetPreview } = await loadValidator();
    const result = await validateRuntimeAssetPreview(baseOptions(fixture));
    const failedIds = new Set(
      result.checks
        .filter((check) => check.status === "fail")
        .map((check) => check.id)
    );

    assert.equal(result.ok, false);
    assert.ok(failedIds.has("glb.follow.type"));
    assert.ok(failedIds.has("glb.storage.type"));
    assert.ok(failedIds.has("photo.follow.cors"));
    assert.ok(failedIds.has("photo.storage.cors"));
  } finally {
    await fixture.stop();
  }
});
