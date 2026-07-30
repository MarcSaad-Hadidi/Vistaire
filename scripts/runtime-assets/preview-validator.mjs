const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECT_BODY_BYTES = 4_096;
const RANGE_END = 1_023;
const RANGE_HEADER = `bytes=0-${RANGE_END}`;
const FOLLOW_RANGE_HEADER = "bytes=0-0";
const SIGNED_QUERY_KEY =
  /(?:^|[-_])(?:authorization|credential|expires|jwt|key|secret|sig|signature|token|x-amz)(?:$|[-_])/i;

const ASSET_DEFINITIONS = [
  {
    name: "photo",
    versionKey: "photoVersion",
    bucket: "vistaire-media",
    objectSegments: ["photos", "originals"],
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
    path(dishId) {
      return `/api/public/menu-dishes/${encodeURIComponent(dishId)}/photo`;
    },
    contentTypeMatches(value) {
      return value.toLowerCase().startsWith("image/");
    },
    expectedContentType: "image/*"
  },
  {
    name: "glb",
    versionKey: "assetVersion",
    bucket: "vistaire-3d",
    objectSegments: ["models", "web"],
    extensions: [".glb"],
    path(dishId) {
      return `/api/public/menu-dishes/${encodeURIComponent(dishId)}/model/glb`;
    },
    contentTypeMatches(value) {
      return value.toLowerCase().split(";", 1)[0].trim() === "model/gltf-binary";
    },
    expectedContentType: "model/gltf-binary"
  },
  {
    name: "usdz",
    versionKey: "assetVersion",
    bucket: "vistaire-3d",
    objectSegments: ["models", "ar-ios"],
    extensions: [".usdz"],
    path(dishId) {
      return `/api/public/menu-dishes/${encodeURIComponent(dishId)}/model/usdz`;
    },
    contentTypeMatches(value) {
      return value.toLowerCase().split(";", 1)[0].trim() === "model/vnd.usdz+zip";
    },
    expectedContentType: "model/vnd.usdz+zip"
  }
];

function isLoopback(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function requireHttpUrl(value, label) {
  let url;
  try {
    url = new URL(String(value ?? ""));
  } catch {
    throw new TypeError(`${label} must be an absolute HTTP URL`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError(`${label} must be an HTTP URL`);
  }
  if (url.protocol !== "https:" && !isLoopback(url.hostname)) {
    throw new TypeError(`${label} must use HTTPS outside loopback fixtures`);
  }
  if (url.username || url.password) {
    throw new TypeError(`${label} must not include credentials`);
  }
  return url;
}

function normalizeBaseUrl(value) {
  const url = requireHttpUrl(value, "baseUrl");
  if (url.search || url.hash) {
    throw new TypeError("baseUrl must not include a query or hash");
  }
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url;
}

function normalizeExpectedHost(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new TypeError("expectedStorageHost is required");
  if (raw.includes("://")) return requireHttpUrl(raw, "expectedStorageHost").host;
  let parsed;
  try {
    parsed = new URL(`https://${raw}`);
  } catch {
    throw new TypeError("expectedStorageHost must be a hostname with an optional port");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new TypeError("expectedStorageHost must be a hostname with an optional port");
  }
  return parsed.host;
}

function assertIdentifier(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized || !/^[a-zA-Z0-9._-]+$/.test(normalized)) {
    throw new TypeError(`${label} must contain only URL-safe identifier characters`);
  }
  return normalized;
}

function assertPhotoVersion(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[a-f0-9]{64}$/i.test(normalized)) {
    throw new TypeError("photoVersion must be a full SHA-256");
  }
  return normalized.toLowerCase();
}

function isSignedInput(url) {
  if (url.pathname.includes("/storage/v1/object/sign/")) return true;
  return [...url.searchParams.keys()].some((key) => SIGNED_QUERY_KEY.test(key));
}

function normalizePublicAssetUrl(value, baseUrl, label) {
  let url;
  try {
    url = new URL(String(value ?? ""), baseUrl);
  } catch {
    throw new TypeError(`${label} must be an unsigned public URL`);
  }
  if (
    url.origin !== baseUrl.origin ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    isSignedInput(url)
  ) {
    throw new TypeError(`${label} must be an unsigned public URL on the Vistaire origin`);
  }
  return url;
}

function redactedUrl(value) {
  const url = value instanceof URL ? new URL(value) : new URL(String(value));
  const hadQuery = Boolean(url.search);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return `${url.origin}${url.pathname}${hadQuery ? "?<redacted>" : ""}`;
}

function createResult(baseUrl, expectedStorageHost) {
  return {
    ok: true,
    target: {
      baseOrigin: baseUrl.origin,
      expectedStorageHost
    },
    summary: {
      passed: 0,
      failed: 0,
      warnings: 0
    },
    checks: [],
    assets: [],
    negative: {
      wrongVersionStatus: null,
      missingAssetStatus: null
    }
  };
}

function addCheck(result, status, id, message) {
  result.checks.push({ status, id, message });
  if (status === "pass") result.summary.passed += 1;
  if (status === "fail") result.summary.failed += 1;
  if (status === "warn") result.summary.warnings += 1;
  result.ok = result.summary.failed === 0;
}

function timeoutSignal(timeoutMs) {
  return AbortSignal.timeout(timeoutMs);
}

async function fetchResponse(url, options, timeoutMs) {
  return fetch(url, {
    ...options,
    signal: timeoutSignal(timeoutMs)
  });
}

async function readBodyLimited(response, maxBytes) {
  if (!response.body) return { bodyBytes: 0, exceeded: false };
  const reader = response.body.getReader();
  let bodyBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bodyBytes += value.byteLength;
      if (bodyBytes > maxBytes) {
        await reader.cancel();
        return { bodyBytes, exceeded: true };
      }
    }
    return { bodyBytes, exceeded: false };
  } finally {
    reader.releaseLock();
  }
}

async function cancelBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The evidence is based on response headers; cancellation is best effort.
  }
}

function safeStorageLocation(location, expectedStorageHost, asset) {
  let url;
  try {
    url = requireHttpUrl(location, "redirect Location");
  } catch {
    return { ok: false, reason: "redirect Location must be a safe HTTP URL" };
  }
  if (url.host !== expectedStorageHost) {
    return {
      ok: false,
      reason: `Storage host mismatch: expected ${expectedStorageHost}, got ${url.host}`,
      url
    };
  }
  const prefix = `/storage/v1/object/sign/${asset.bucket}/`;
  const objectPath = url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : "";
  const segments = objectPath.split("/");
  const expectedPrefix = [
    "restaurants",
    segments[1] ?? "",
    ...asset.objectSegments
  ];
  const filename = segments.at(-1)?.toLowerCase() ?? "";
  if (
    segments.length !== expectedPrefix.length + 1 ||
    expectedPrefix.some((segment, index) => segments[index] !== segment) ||
    !/^[a-f0-9-]{36}$/i.test(segments[1] ?? "") ||
    !segments.every((segment) => /^[a-z0-9][a-z0-9._-]*$/i.test(segment)) ||
    !asset.extensions.some((extension) => filename.endsWith(extension))
  ) {
    return {
      ok: false,
      reason: "redirect Location does not match the expected signed Storage object path",
      url
    };
  }
  if (!url.searchParams.get("token")) {
    return {
      ok: false,
      reason: "redirect Location is missing its signed Storage token",
      url
    };
  }
  return { ok: true, url };
}

function corsAllowsOrigin(value, baseOrigin) {
  const normalized = value.trim();
  return normalized === "*" || normalized === baseOrigin;
}

function matchesBoundedContentRange(value, maxEnd, bodyBytes) {
  const match = value.match(/^bytes 0-(\d+)\/(?:\d+|\*)$/i);
  if (!match) return false;
  const reportedEnd = Number(match[1]);
  return (
    Number.isSafeInteger(reportedEnd) &&
    reportedEnd <= maxEnd &&
    bodyBytes === reportedEnd + 1
  );
}

async function validateAsset({
  asset,
  publicUrl,
  baseUrl,
  expectedStorageHost,
  timeoutMs,
  result
}) {
  const evidence = {
    name: asset.name,
    publicUrl: redactedUrl(publicUrl),
    redirect: {
      getStatus: null,
      getBodyBytes: 0,
      headStatus: null,
      headBodyBytes: 0,
      locationDiscovered: false,
      locationHost: "",
      locationPath: ""
    },
    followed: {
      host: "",
      path: "",
      status: null,
      contentType: "",
      cors: "",
      bodyBytes: 0
    },
    range: {
      host: "",
      path: "",
      status: null,
      contentType: "",
      cors: "",
      supported: false,
      bodyBytes: 0
    }
  };
  result.assets.push(evidence);

  let getResponse;
  try {
    getResponse = await fetchResponse(
      publicUrl,
      { method: "GET", redirect: "manual" },
      timeoutMs
    );
  } catch {
    addCheck(result, "fail", `${asset.name}.get.network`, `${asset.name}: GET failed`);
    return;
  }

  evidence.redirect.getStatus = getResponse.status;
  const redirectBody = await readBodyLimited(getResponse, MAX_REDIRECT_BODY_BYTES);
  evidence.redirect.getBodyBytes = redirectBody.bodyBytes;
  if (getResponse.status === 307) {
    addCheck(result, "pass", `${asset.name}.get.status`, `${asset.name}: GET returned 307`);
  } else {
    addCheck(
      result,
      "fail",
      `${asset.name}.get.status`,
      `${asset.name}: GET expected 307, got ${getResponse.status}`
    );
  }
  if (!redirectBody.exceeded && redirectBody.bodyBytes === 0) {
    addCheck(
      result,
      "pass",
      `${asset.name}.get.body`,
      `${asset.name}: redirect body is empty`
    );
  } else {
    addCheck(
      result,
      "fail",
      `${asset.name}.get.body`,
      `${asset.name}: redirect body must be empty`
    );
  }

  let headResponse;
  try {
    headResponse = await fetchResponse(
      publicUrl,
      { method: "HEAD", redirect: "manual" },
      timeoutMs
    );
  } catch {
    addCheck(result, "fail", `${asset.name}.head.network`, `${asset.name}: HEAD failed`);
    return;
  }
  evidence.redirect.headStatus = headResponse.status;
  const headBytes = Buffer.from(await headResponse.arrayBuffer()).byteLength;
  evidence.redirect.headBodyBytes = headBytes;
  if (headResponse.status === 307) {
    addCheck(result, "pass", `${asset.name}.head.status`, `${asset.name}: HEAD returned 307`);
  } else {
    addCheck(
      result,
      "fail",
      `${asset.name}.head.status`,
      `${asset.name}: HEAD expected 307, got ${headResponse.status}`
    );
  }
  if (headBytes === 0) {
    addCheck(result, "pass", `${asset.name}.head.body`, `${asset.name}: HEAD has no body`);
  } else {
    addCheck(
      result,
      "fail",
      `${asset.name}.head.body`,
      `${asset.name}: HEAD unexpectedly returned ${headBytes} body bytes`
    );
  }

  const getLocation = getResponse.headers.get("location") ?? "";
  const headLocation = headResponse.headers.get("location") ?? "";
  if (!getLocation || !headLocation) {
    addCheck(
      result,
      "fail",
      `${asset.name}.location`,
      `${asset.name}: GET and HEAD must include Location`
    );
    return;
  }

  const storageLocation = safeStorageLocation(
    getLocation,
    expectedStorageHost,
    asset
  );
  const headStorageLocation = safeStorageLocation(
    headLocation,
    expectedStorageHost,
    asset
  );
  if (!storageLocation.ok || !headStorageLocation.ok) {
    const reason = !storageLocation.ok ? storageLocation.reason : headStorageLocation.reason;
    const discovered = storageLocation.url ?? headStorageLocation.url;
    if (discovered) {
      evidence.redirect.locationDiscovered = true;
      evidence.redirect.locationHost = discovered.host;
      evidence.redirect.locationPath = discovered.pathname;
    }
    addCheck(
      result,
      "fail",
      `${asset.name}.storage.location`,
      `${asset.name}: ${reason}`
    );
    return;
  }

  evidence.redirect.locationDiscovered = true;
  evidence.redirect.locationHost = storageLocation.url.host;
  evidence.redirect.locationPath = storageLocation.url.pathname;
  addCheck(
    result,
    "pass",
    `${asset.name}.storage.host`,
    `${asset.name}: Storage host is ${expectedStorageHost}`
  );
  if (storageLocation.url.pathname === headStorageLocation.url.pathname) {
    addCheck(
      result,
      "pass",
      `${asset.name}.storage.object`,
      `${asset.name}: GET and HEAD target the same Storage object`
    );
  } else {
    addCheck(
      result,
      "fail",
      `${asset.name}.storage.object`,
      `${asset.name}: GET and HEAD target different Storage objects`
    );
    return;
  }

  let followedResponse;
  try {
    followedResponse = await fetchResponse(
      publicUrl,
      {
        method: "GET",
        redirect: "follow",
        headers: {
          Origin: baseUrl.origin,
          Range: FOLLOW_RANGE_HEADER
        }
      },
      timeoutMs
    );
  } catch {
    addCheck(
      result,
      "fail",
      `${asset.name}.follow.network`,
      `${asset.name}: followed bounded GET failed`
    );
    return;
  }

  const followedUrl = requireHttpUrl(followedResponse.url, "followed response URL");
  evidence.followed.host = followedUrl.host;
  evidence.followed.path = followedUrl.pathname;
  evidence.followed.status = followedResponse.status;
  evidence.followed.contentType = followedResponse.headers.get("content-type") ?? "";
  evidence.followed.cors =
    followedResponse.headers.get("access-control-allow-origin") ?? "";

  if (followedUrl.host === expectedStorageHost) {
    addCheck(
      result,
      "pass",
      `${asset.name}.follow.host`,
      `${asset.name}: followed GET ended on ${expectedStorageHost}`
    );
  } else {
    addCheck(
      result,
      "fail",
      `${asset.name}.follow.host`,
      `${asset.name}: followed GET ended on unexpected host ${followedUrl.host}`
    );
  }
  if (asset.contentTypeMatches(evidence.followed.contentType)) {
    addCheck(
      result,
      "pass",
      `${asset.name}.follow.type`,
      `${asset.name}: followed content-type is ${evidence.followed.contentType}`
    );
  } else {
    addCheck(
      result,
      "fail",
      `${asset.name}.follow.type`,
      `${asset.name}: followed GET expected ${asset.expectedContentType}, got ${
        evidence.followed.contentType || "(missing)"
      }`
    );
  }
  if (corsAllowsOrigin(evidence.followed.cors, baseUrl.origin)) {
    addCheck(
      result,
      "pass",
      `${asset.name}.follow.cors`,
      `${asset.name}: followed GET allows Vistaire CORS`
    );
  } else {
    addCheck(
      result,
      "fail",
      `${asset.name}.follow.cors`,
      `${asset.name}: followed GET must allow ${baseUrl.origin} or *`
    );
  }
  if (followedResponse.status === 206) {
    const followedBody = await readBodyLimited(followedResponse, 1);
    evidence.followed.bodyBytes = followedBody.bodyBytes;
    const contentRange = followedResponse.headers.get("content-range") ?? "";
    if (
      !followedBody.exceeded &&
      followedBody.bodyBytes <= 1 &&
      matchesBoundedContentRange(contentRange, 0, followedBody.bodyBytes)
    ) {
      addCheck(
        result,
        "pass",
        `${asset.name}.follow.body`,
        `${asset.name}: followed GET was bounded to ${followedBody.bodyBytes} byte`
      );
    } else {
      addCheck(
        result,
        "fail",
        `${asset.name}.follow.body`,
        `${asset.name}: followed GET exceeded its one-byte bound`
      );
    }
  } else {
    await cancelBody(followedResponse);
    if (followedResponse.status === 200) {
      addCheck(
        result,
        "warn",
        `${asset.name}.follow.body`,
        `${asset.name}: followed GET ignored Range; body was cancelled`
      );
    } else {
      addCheck(
        result,
        "fail",
        `${asset.name}.follow.body`,
        `${asset.name}: followed GET expected 206 or 200, got ${followedResponse.status}`
      );
    }
  }

  let finalResponse;
  try {
    finalResponse = await fetchResponse(
      storageLocation.url,
      {
        method: "GET",
        redirect: "manual",
        headers: {
          Origin: baseUrl.origin,
          Range: RANGE_HEADER
        }
      },
      timeoutMs
    );
  } catch {
    addCheck(
      result,
      "fail",
      `${asset.name}.storage.network`,
      `${asset.name}: bounded Storage GET failed`
    );
    return;
  }

  evidence.range.host = storageLocation.url.host;
  evidence.range.path = storageLocation.url.pathname;
  evidence.range.status = finalResponse.status;
  evidence.range.contentType = finalResponse.headers.get("content-type") ?? "";
  evidence.range.cors = finalResponse.headers.get("access-control-allow-origin") ?? "";

  if (asset.contentTypeMatches(evidence.range.contentType)) {
    addCheck(
      result,
      "pass",
      `${asset.name}.storage.type`,
      `${asset.name}: Range content-type is ${evidence.range.contentType}`
    );
  } else {
    addCheck(
      result,
      "fail",
      `${asset.name}.storage.type`,
      `${asset.name}: expected ${asset.expectedContentType}, got ${
        evidence.range.contentType || "(missing)"
      }`
    );
  }

  if (corsAllowsOrigin(evidence.range.cors, baseUrl.origin)) {
    addCheck(
      result,
      "pass",
      `${asset.name}.storage.cors`,
      `${asset.name}: CORS allows the Vistaire origin`
    );
  } else {
    addCheck(
      result,
      "fail",
      `${asset.name}.storage.cors`,
      `${asset.name}: Storage CORS must allow ${baseUrl.origin} or *`
    );
  }

  if (finalResponse.status === 206) {
    evidence.range.supported = true;
    const body = await readBodyLimited(finalResponse, RANGE_END + 1);
    evidence.range.bodyBytes = body.bodyBytes;
    const contentRange = finalResponse.headers.get("content-range") ?? "";
    if (
      !body.exceeded &&
      body.bodyBytes <= RANGE_END + 1 &&
      matchesBoundedContentRange(contentRange, RANGE_END, body.bodyBytes)
    ) {
      addCheck(
        result,
        "pass",
        `${asset.name}.storage.range`,
        `${asset.name}: bounded range returned ${body.bodyBytes} bytes`
      );
    } else {
      addCheck(
        result,
        "fail",
        `${asset.name}.storage.range`,
        `${asset.name}: 206 response exceeded the 1024-byte range contract`
      );
    }
    return;
  }

  await cancelBody(finalResponse);
  if (finalResponse.status === 200) {
    addCheck(
      result,
      "warn",
      `${asset.name}.storage.range`,
      `${asset.name}: Storage ignored Range; body was cancelled without buffering`
    );
    return;
  }

  addCheck(
    result,
    "fail",
    `${asset.name}.storage.range`,
    `${asset.name}: bounded Storage GET expected 206 or 200, got ${finalResponse.status}`
  );
}

async function validateNegativeStatus({
  id,
  label,
  url,
  expectedStatus,
  timeoutMs,
  result
}) {
  try {
    const response = await fetchResponse(
      url,
      { method: "GET", redirect: "manual" },
      timeoutMs
    );
    await readBodyLimited(response, MAX_REDIRECT_BODY_BYTES);
    if (response.status === expectedStatus) {
      addCheck(result, "pass", id, `${label}: returned ${expectedStatus}`);
    } else {
      addCheck(
        result,
        "fail",
        id,
        `${label}: expected ${expectedStatus}, got ${response.status}`
      );
    }
    return response.status;
  } catch {
    addCheck(result, "fail", id, `${label}: request failed`);
    return null;
  }
}

export async function validateRuntimeAssetPreview({
  baseUrl: baseUrlInput,
  dishId: dishIdInput,
  assetVersion: assetVersionInput,
  photoVersion: photoVersionInput,
  expectedStorageHost: expectedStorageHostInput,
  assetUrls = {},
  missingAssetUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const baseUrl = normalizeBaseUrl(baseUrlInput);
  const dishId = assertIdentifier(dishIdInput, "dishId");
  const assetVersion = assertIdentifier(assetVersionInput, "assetVersion");
  const photoVersion = assertPhotoVersion(photoVersionInput);
  const expectedStorageHost = normalizeExpectedHost(expectedStorageHostInput);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be a positive number");
  }

  const publicAssets = ASSET_DEFINITIONS.map((asset) => {
    const defaultUrl = new URL(asset.path(dishId), baseUrl);
    defaultUrl.searchParams.set(
      "v",
      asset.versionKey === "photoVersion" ? photoVersion : assetVersion
    );
    return {
      asset,
      publicUrl: normalizePublicAssetUrl(
        assetUrls[asset.name] ?? defaultUrl,
        baseUrl,
        `${asset.name} URL`
      )
    };
  });
  const normalizedMissingAssetUrl = missingAssetUrl
    ? normalizePublicAssetUrl(missingAssetUrl, baseUrl, "missing asset URL")
    : null;

  const result = createResult(baseUrl, expectedStorageHost);
  for (const { asset, publicUrl } of publicAssets) {
    await validateAsset({
      asset,
      publicUrl,
      baseUrl,
      expectedStorageHost,
      timeoutMs,
      result
    });
  }

  const wrongVersionUrl = new URL(
    publicAssets.find(({ asset }) => asset.name === "glb").publicUrl
  );
  wrongVersionUrl.searchParams.set("v", `${assetVersion}-missing`);
  result.negative.wrongVersionStatus = await validateNegativeStatus({
    id: "negative.wrong-version",
    label: "wrong asset version",
    url: wrongVersionUrl,
    expectedStatus: 404,
    timeoutMs,
    result
  });

  if (normalizedMissingAssetUrl) {
    result.negative.missingAssetStatus = await validateNegativeStatus({
      id: "negative.missing-asset",
      label: "missing asset",
      url: normalizedMissingAssetUrl,
      expectedStatus: 404,
      timeoutMs,
      result
    });
  }

  result.ok = result.summary.failed === 0;
  return result;
}

export function formatRuntimeAssetReport(result) {
  const lines = [
    `Runtime asset preview validation: ${result.ok ? "PASS" : "FAIL"}`,
    `Target: ${result.target.baseOrigin}`,
    `Expected Storage host: ${result.target.expectedStorageHost}`
  ];
  for (const asset of result.assets) {
    const storage =
      asset.redirect.locationHost && asset.redirect.locationPath
        ? `${asset.redirect.locationHost}${asset.redirect.locationPath}`
        : "(not discovered)";
    lines.push(
      `${asset.name}: GET ${asset.redirect.getStatus ?? "-"} (${
        asset.redirect.getBodyBytes
      } B), HEAD ${asset.redirect.headStatus ?? "-"} (${
        asset.redirect.headBodyBytes
      } B), Storage ${storage}, Followed ${asset.followed.status ?? "-"} (${
        asset.followed.bodyBytes
      } B), Range ${asset.range.status ?? "-"} (${asset.range.bodyBytes} B)`
    );
  }
  for (const check of result.checks) {
    lines.push(`${check.status.toUpperCase()} ${check.message}`);
  }
  lines.push(
    `Summary: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.warnings} warnings`
  );
  return lines.join("\n");
}
