import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createNextRequest,
  loadGlbRoute,
  loadPhotoRoute,
  loadPublicDishAssetRedirect,
  loadUsdzRoute
} from "./helpers/public-dish-asset-route-runtime.mjs";

const SUPABASE_ORIGIN = "https://bkpewsjvxswqruwqljcy.supabase.co";
const DISH_ID = "11111111-2222-4333-8444-555555555555";
const RESTAURANT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_RESTAURANT_ID = "99999999-8888-4777-8666-555555555555";
const ASSET_VERSION = "meshy-20260729-abcdef123456";
const PHOTO_SHA256 = "a".repeat(64);

const PHOTO_PATH = `restaurants/${RESTAURANT_ID}/photos/originals/tartare-saumon.webp`;
const WEB_GLB_PATH = `restaurants/${RESTAURANT_ID}/models/web/tartare-saumon.glb`;
const AR_LITE_GLB_PATH = `restaurants/${RESTAURANT_ID}/models/ar-lite/tartare-saumon.glb`;
const USDZ_PATH = `restaurants/${RESTAURANT_ID}/models/ar-ios/tartare-saumon.usdz`;

const [photoRoute, glbRoute, usdzRoute, redirectHelper] = await Promise.all([
  loadPhotoRoute(),
  loadGlbRoute(),
  loadUsdzRoute(),
  loadPublicDishAssetRedirect()
]);

function signedUrl(bucket, storagePath) {
  return `${SUPABASE_ORIGIN}/storage/v1/object/sign/${bucket}/${storagePath}?token=signed-token`;
}

function assetMetadata(kind, overrides = {}) {
  const byKind = {
    photo: {
      photoStorageBucket: "vistaire-media",
      photoStoragePath: PHOTO_PATH,
      photoContentType: "image/webp",
      photoSha256: PHOTO_SHA256
    },
    web: {
      webModel3dStorageBucket: "vistaire-3d",
      webModel3dStoragePath: WEB_GLB_PATH,
      modelAssetVersion: ASSET_VERSION
    },
    arLite: {
      arModel3dStorageBucket: "vistaire-3d",
      arModel3dStoragePath: AR_LITE_GLB_PATH,
      modelAssetVersion: ASSET_VERSION
    },
    usdz: {
      arUsdzStorageBucket: "vistaire-3d",
      arUsdzStoragePath: USDZ_PATH,
      modelAssetVersion: ASSET_VERSION
    }
  };
  return { ...byKind[kind], ...overrides };
}

function createAdminFixture({
  metadata = assetMetadata("photo"),
  isAvailable = true,
  queryError = null,
  objectExists = true,
  infoError = null,
  signedUrlOverride,
  signError = null
} = {}) {
  const calls = {
    table: [],
    select: [],
    eq: [],
    storageFrom: [],
    info: [],
    signed: [],
    operationOrder: [],
    forbiddenBodyReads: 0
  };

  const bucketApi = {
    async info(storagePath) {
      calls.info.push(storagePath);
      calls.operationOrder.push("info");
      return {
        data: objectExists ? { id: "storage-object-fixture" } : null,
        error: infoError
      };
    },
    async createSignedUrl(storagePath, expiresIn) {
      calls.signed.push({ storagePath, expiresIn });
      calls.operationOrder.push("sign");
      const bucket = calls.storageFrom.at(-1);
      return {
        data: signError
          ? null
          : {
              signedUrl:
                signedUrlOverride === undefined
                  ? signedUrl(bucket, storagePath)
                  : signedUrlOverride
            },
        error: signError
      };
    }
  };
  for (const forbidden of ["download", "upload", "getPublicUrl"]) {
    Object.defineProperty(bucketApi, forbidden, {
      get() {
        calls.forbiddenBodyReads += 1;
        throw new Error(`Forbidden Storage body API accessed: ${forbidden}`);
      }
    });
  }

  const query = {
    select(columns) {
      calls.select.push(columns);
      return this;
    },
    eq(column, value) {
      calls.eq.push([column, value]);
      return this;
    },
    async maybeSingle() {
      return {
        data: queryError
          ? null
          : {
              id: DISH_ID,
              restaurant_id: RESTAURANT_ID,
              is_available: isAvailable,
              metadata
            },
        error: queryError
      };
    }
  };

  const client = {
    from(table) {
      calls.table.push(table);
      return query;
    },
    storage: {
      from(bucket) {
        calls.storageFrom.push(bucket);
        return bucketApi;
      }
    }
  };

  return {
    admin: { ok: true, client },
    calls
  };
}

function installAdmin(fixture) {
  globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN__ = fixture.admin;
}

async function invokeRoute({ route, method, url }) {
  const request = await createNextRequest(url, {
    method,
    headers: { Range: "bytes=0-1023" }
  });
  return route[method](request, {
    params: Promise.resolve({ dishId: DISH_ID })
  });
}

async function assertJsonError(response, status, error) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("cdn-cache-control"), "private, no-store");
  assert.equal(
    response.headers.get("vercel-cdn-cache-control"),
    "private, no-store"
  );
  assert.deepEqual(await response.json(), { ok: false, error });
}

test("GET and HEAD redirect all public dish asset variants with a signed 307 and no body", async () => {
  const cases = [
    {
      label: "photo",
      route: photoRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`,
      metadata: assetMetadata("photo"),
      bucket: "vistaire-media",
      storagePath: PHOTO_PATH
    },
    {
      label: "web GLB",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb?v=${ASSET_VERSION}`,
      metadata: assetMetadata("web"),
      bucket: "vistaire-3d",
      storagePath: WEB_GLB_PATH
    },
    {
      label: "AR-lite GLB",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb?variant=ar-lite&v=${ASSET_VERSION}`,
      metadata: assetMetadata("arLite"),
      bucket: "vistaire-3d",
      storagePath: AR_LITE_GLB_PATH
    },
    {
      label: "USDZ",
      route: usdzRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/usdz?v=${ASSET_VERSION}`,
      metadata: assetMetadata("usdz"),
      bucket: "vistaire-3d",
      storagePath: USDZ_PATH
    }
  ];

  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  try {
    for (const entry of cases) {
      for (const method of ["GET", "HEAD"]) {
        const fixture = createAdminFixture({ metadata: entry.metadata });
        installAdmin(fixture);

        const response = await invokeRoute({
          route: entry.route,
          method,
          url: entry.url
        });

        assert.equal(response.status, 307, `${method} ${entry.label}`);
        assert.equal(
          response.headers.get("location"),
          signedUrl(entry.bucket, entry.storagePath),
          `${method} ${entry.label}`
        );
        assert.equal(
          response.headers.get("cache-control"),
          "public, max-age=120, must-revalidate"
        );
        assert.equal(
          response.headers.get("cdn-cache-control"),
          "public, s-maxage=2700"
        );
        assert.equal(
          response.headers.get("vercel-cdn-cache-control"),
          "public, s-maxage=2700"
        );
        assert.equal(response.headers.get("content-length"), null);
        assert.equal(response.headers.get("content-type"), null);
        assert.equal(response.body, null);
        assert.equal(await response.text(), "");
        assert.deepEqual(fixture.calls.storageFrom, [entry.bucket]);
        assert.deepEqual(fixture.calls.info, [entry.storagePath]);
        assert.deepEqual(fixture.calls.signed, [
          { storagePath: entry.storagePath, expiresIn: 3600 }
        ]);
        assert.deepEqual(fixture.calls.operationOrder, ["info", "sign"]);
        assert.equal(fixture.calls.forbiddenBodyReads, 0);
        assert.match(fixture.calls.select[0], /restaurant_id/);
      }
    }
  } finally {
    if (previousSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }
  }
});

test("only true legacy photos redirect without a version while modern photos require their photoSha256", async () => {
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  try {
    const legacyFixture = createAdminFixture({
      metadata: assetMetadata("photo", { photoSha256: "" })
    });
    installAdmin(legacyFixture);
    const legacyResponse = await invokeRoute({
      route: photoRoute,
      method: "GET",
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo`
    });
    assert.equal(legacyResponse.status, 307);
    assert.equal(legacyResponse.headers.get("cache-control"), "private, no-store");
    assert.equal(legacyResponse.headers.get("cdn-cache-control"), "private, no-store");
    assert.equal(
      legacyResponse.headers.get("vercel-cdn-cache-control"),
      "private, no-store"
    );

    const missingVersionFixture = createAdminFixture({
      metadata: assetMetadata("photo")
    });
    installAdmin(missingVersionFixture);
    const missingVersionResponse = await invokeRoute({
      route: photoRoute,
      method: "GET",
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo`
    });
    await assertJsonError(missingVersionResponse, 404, "Photo introuvable.");
    assert.deepEqual(missingVersionFixture.calls.storageFrom, []);

    for (const version of ["b".repeat(64), "not-a-sha"]) {
      const fixture = createAdminFixture({
        metadata: assetMetadata("photo")
      });
      installAdmin(fixture);
      const response = await invokeRoute({
        route: photoRoute,
        method: "GET",
        url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo?v=${version}`
      });
      await assertJsonError(response, 404, "Photo introuvable.");
      assert.deepEqual(fixture.calls.storageFrom, []);
    }
  } finally {
    if (previousSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }
  }
});

test("photo versions accept the persisted SHA-256 regardless of letter case", async () => {
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  try {
    const fixture = createAdminFixture({
      metadata: assetMetadata("photo")
    });
    installAdmin(fixture);

    const response = await invokeRoute({
      route: photoRoute,
      method: "GET",
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256.toUpperCase()}`
    });

    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      signedUrl("vistaire-media", PHOTO_PATH)
    );
    assert.deepEqual(fixture.calls.storageFrom, ["vistaire-media"]);
  } finally {
    if (previousSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }
  }
});

test("Preview 307 exposes bounded phase timings without asset data", async () => {
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  try {
    for (const vercelEnv of ["preview", "production"]) {
      process.env.VERCEL_ENV = vercelEnv;
      const fixture = createAdminFixture({
        metadata: assetMetadata("photo")
      });
      installAdmin(fixture);
      const response = await invokeRoute({
        route: photoRoute,
        method: "GET",
        url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
      });

      assert.equal(response.status, 307);
      const serverTiming = response.headers.get("server-timing");
      if (vercelEnv === "preview") {
        assert.match(
          serverTiming ?? "",
          /^db;dur=\d+(?:\.\d)?, storage-info;dur=\d+(?:\.\d)?, storage-sign;dur=\d+(?:\.\d)?$/
        );
        assert.doesNotMatch(
          serverTiming ?? "",
          /11111111|restaurants|supabase|https?|token|signed/i
        );
      } else {
        assert.equal(serverTiming, null);
      }
    }
  } finally {
    if (previousSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }
    if (previousVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnv;
    }
  }
});

test("route storage allowlists reject untrusted buckets, paths, prefixes, and extensions", async () => {
  const cases = [
    {
      label: "photo bucket",
      route: photoRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo`,
      metadata: assetMetadata("photo", { photoStorageBucket: "vistaire-3d" }),
      error: "Photo introuvable."
    },
    {
      label: "source bucket",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb`,
      metadata: assetMetadata("web", { webModel3dStorageBucket: "vistaire-3d-sources" }),
      error: "Modele introuvable."
    },
    {
      label: "QA bucket",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb`,
      metadata: assetMetadata("web", { webModel3dStorageBucket: "vistaire-3d-qa" }),
      error: "Modele introuvable."
    },
    {
      label: "other restaurant",
      route: photoRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo`,
      metadata: assetMetadata("photo", {
        photoStoragePath: `restaurants/${OTHER_RESTAURANT_ID}/photos/originals/tartare.webp`
      }),
      error: "Photo introuvable."
    },
    {
      label: "source model prefix",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb`,
      metadata: assetMetadata("web", {
        webModel3dStoragePath: `restaurants/${RESTAURANT_ID}/models/source/tartare.glb`
      }),
      error: "Modele introuvable."
    },
    {
      label: "manifest prefix",
      route: usdzRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/usdz`,
      metadata: assetMetadata("usdz", {
        arUsdzStoragePath: `restaurants/${RESTAURANT_ID}/models/manifests/report.usdz`
      }),
      error: "USDZ introuvable."
    },
    {
      label: "wrong AR-lite prefix",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb?variant=ar-lite`,
      metadata: assetMetadata("arLite", { arModel3dStoragePath: WEB_GLB_PATH }),
      error: "Modele introuvable."
    },
    {
      label: "traversal segment",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb`,
      metadata: assetMetadata("web", {
        webModel3dStoragePath: `restaurants/${RESTAURANT_ID}/models/web/../source.glb`
      }),
      error: "Modele introuvable."
    },
    {
      label: "backslash",
      route: usdzRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/usdz`,
      metadata: assetMetadata("usdz", {
        arUsdzStoragePath: `restaurants/${RESTAURANT_ID}/models/ar-ios/bad\\file.usdz`
      }),
      error: "USDZ introuvable."
    },
    {
      label: "query",
      route: photoRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo`,
      metadata: assetMetadata("photo", { photoStoragePath: `${PHOTO_PATH}?download=1` }),
      error: "Photo introuvable."
    },
    {
      label: "hash",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb`,
      metadata: assetMetadata("web", { webModel3dStoragePath: `${WEB_GLB_PATH}#fragment` }),
      error: "Modele introuvable."
    },
    {
      label: "absolute URL",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb`,
      metadata: assetMetadata("web", {
        webModel3dStoragePath: `https://evil.example/${WEB_GLB_PATH}`,
        webModel3dUrl: signedUrl("vistaire-3d", WEB_GLB_PATH)
      }),
      error: "Modele introuvable."
    },
    {
      label: "URL scheme",
      route: usdzRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/usdz`,
      metadata: assetMetadata("usdz", { arUsdzStoragePath: `s3://${USDZ_PATH}` }),
      error: "USDZ introuvable."
    },
    {
      label: "empty path",
      route: photoRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo`,
      metadata: assetMetadata("photo", { photoStoragePath: "" }),
      error: "Photo introuvable."
    },
    {
      label: "photo extension",
      route: photoRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo`,
      metadata: assetMetadata("photo", {
        photoStoragePath: `restaurants/${RESTAURANT_ID}/photos/originals/tartare.svg`
      }),
      error: "Photo introuvable."
    },
    {
      label: "GLB extension",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb`,
      metadata: assetMetadata("web", {
        webModel3dStoragePath: `restaurants/${RESTAURANT_ID}/models/web/tartare.usdz`
      }),
      error: "Modele introuvable."
    },
    {
      label: "USDZ extension",
      route: usdzRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/usdz`,
      metadata: assetMetadata("usdz", {
        arUsdzStoragePath: `restaurants/${RESTAURANT_ID}/models/ar-ios/tartare.glb`
      }),
      error: "USDZ introuvable."
    }
  ];

  for (const entry of cases) {
    const fixture = createAdminFixture({ metadata: entry.metadata });
    installAdmin(fixture);
    const response = await invokeRoute({
      route: entry.route,
      method: "GET",
      url: entry.url
    });
    await assertJsonError(response, 404, entry.error);
    assert.deepEqual(fixture.calls.storageFrom, [], entry.label);
    assert.deepEqual(fixture.calls.signed, [], entry.label);
  }
});

test("model routes reject invalid, stale, and unversioned active-version mismatches", async () => {
  const cases = [
    {
      label: "stale GLB version",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb?v=meshy-20260728-stale123456`,
      metadata: assetMetadata("web")
    },
    {
      label: "version supplied but metadata has no active version",
      route: usdzRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/usdz?v=${ASSET_VERSION}`,
      metadata: assetMetadata("usdz", { modelAssetVersion: "" })
    },
    {
      label: "syntactically invalid version",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb?v=..%2Fsource`,
      metadata: assetMetadata("web")
    }
  ];

  for (const entry of cases) {
    const fixture = createAdminFixture({ metadata: entry.metadata });
    installAdmin(fixture);
    const response = await invokeRoute({
      route: entry.route,
      method: "GET",
      url: entry.url
    });
    const expected = entry.route === usdzRoute ? "USDZ introuvable." : "Modele introuvable.";
    await assertJsonError(response, 404, expected);
    assert.deepEqual(fixture.calls.storageFrom, [], entry.label);
  }
});

test("invalid GLB variants are rejected before Supabase access", async () => {
  const fixture = createAdminFixture({ metadata: assetMetadata("web") });
  installAdmin(fixture);

  const response = await invokeRoute({
    route: glbRoute,
    method: "GET",
    url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb?variant=source`
  });

  await assertJsonError(response, 404, "Variante modele introuvable.");
  assert.deepEqual(fixture.calls.table, []);
});

test("the shared helper rejects an invalid dish id before querying Supabase", async () => {
  const fixture = createAdminFixture({ metadata: assetMetadata("photo") });

  const response = await redirectHelper.redirectPublicDishAsset({
    admin: fixture.admin,
    dishId: "../other-dish",
    kind: "photo",
    supabaseUrl: SUPABASE_ORIGIN,
    notFoundMessage: "Photo introuvable.",
    unavailableMessage: "Photo indisponible."
  });

  await assertJsonError(response, 404, "Photo introuvable.");
  assert.deepEqual(fixture.calls.table, []);
});

test("unavailable dishes and missing storage objects keep public 404 responses", async () => {
  const cases = [
    {
      label: "unavailable photo",
      route: photoRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo`,
      options: { metadata: assetMetadata("photo"), isAvailable: false },
      error: "Photo introuvable."
    },
    {
      label: "dish query error",
      route: photoRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo`,
      options: {
        metadata: assetMetadata("photo"),
        queryError: { code: "PGRST116" }
      },
      error: "Photo introuvable."
    },
    {
      label: "missing historical AR-lite object",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb?variant=ar-lite`,
      options: { metadata: assetMetadata("arLite"), objectExists: false },
      error: "Modele introuvable."
    },
    {
      label: "missing USDZ object",
      route: usdzRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/usdz`,
      options: {
        metadata: assetMetadata("usdz"),
        objectExists: false,
        infoError: { status: 404 }
      },
      error: "USDZ introuvable."
    }
  ];

  for (const entry of cases) {
    const fixture = createAdminFixture(entry.options);
    installAdmin(fixture);
    const response = await invokeRoute({
      route: entry.route,
      method: "GET",
      url: entry.url
    });
    await assertJsonError(response, 404, entry.error);
    assert.deepEqual(fixture.calls.signed, [], entry.label);
  }
});

test("signed URL validation rejects remote HTTP while permitting local Supabase development", async () => {
  const remoteOrigin = "http://storage.example.test";
  const remoteFixture = createAdminFixture({
    metadata: assetMetadata("web"),
    signedUrlOverride: `${remoteOrigin}/storage/v1/object/sign/vistaire-3d/${WEB_GLB_PATH}?token=signed-token`
  });
  const remoteResponse = await redirectHelper.redirectPublicDishAsset({
    admin: remoteFixture.admin,
    dishId: DISH_ID,
    kind: "web-glb",
    supabaseUrl: remoteOrigin,
    notFoundMessage: "Modele introuvable.",
    unavailableMessage: "Modele indisponible."
  });
  await assertJsonError(remoteResponse, 503, "Modele indisponible.");
  assert.equal(remoteResponse.headers.get("location"), null);

  const localOrigin = "http://127.0.0.1:54321";
  const localFixture = createAdminFixture({
    metadata: assetMetadata("web"),
    signedUrlOverride: `${localOrigin}/storage/v1/object/sign/vistaire-3d/${WEB_GLB_PATH}?token=signed-token`
  });
  const localResponse = await redirectHelper.redirectPublicDishAsset({
    admin: localFixture.admin,
    dishId: DISH_ID,
    kind: "web-glb",
    supabaseUrl: localOrigin,
    notFoundMessage: "Modele introuvable.",
    unavailableMessage: "Modele indisponible."
  });
  assert.equal(localResponse.status, 307);
  assert.equal(
    localResponse.headers.get("location"),
    `${localOrigin}/storage/v1/object/sign/vistaire-3d/${WEB_GLB_PATH}?token=signed-token`
  );
});

test("signed redirect URLs must match the configured Supabase origin, exact object path, and token", async () => {
  const validPathname = `/storage/v1/object/sign/vistaire-3d/${WEB_GLB_PATH}`;
  const cases = [
    {
      label: "foreign origin",
      signedUrlOverride: `https://evil.example${validPathname}?token=signed-token`
    },
    {
      label: "public instead of signed path",
      signedUrlOverride: `${SUPABASE_ORIGIN}/storage/v1/object/public/vistaire-3d/${WEB_GLB_PATH}?token=signed-token`
    },
    {
      label: "different signed object",
      signedUrlOverride: `${SUPABASE_ORIGIN}/storage/v1/object/sign/vistaire-3d/restaurants/${RESTAURANT_ID}/models/web/other.glb?token=signed-token`
    },
    {
      label: "missing signed token",
      signedUrlOverride: `${SUPABASE_ORIGIN}${validPathname}`
    }
  ];

  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  try {
    for (const entry of cases) {
      const fixture = createAdminFixture({
        metadata: assetMetadata("web"),
        signedUrlOverride: entry.signedUrlOverride
      });
      installAdmin(fixture);
      const response = await invokeRoute({
        route: glbRoute,
        method: "GET",
        url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb`
      });
      await assertJsonError(response, 503, "Modele indisponible.");
      assert.equal(response.headers.get("location"), null, entry.label);
    }
  } finally {
    if (previousSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }
  }
});

test("Supabase configuration and signing failures preserve route-specific unavailable errors", async () => {
  const cases = [
    {
      label: "photo admin unavailable",
      route: photoRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo`,
      admin: { ok: false, reason: "missing config" },
      error: "Photo indisponible."
    },
    {
      label: "GLB signing unavailable",
      route: glbRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/glb`,
      fixture: createAdminFixture({
        metadata: assetMetadata("web"),
        signError: { status: 500 }
      }),
      error: "Modele indisponible."
    },
    {
      label: "USDZ admin unavailable",
      route: usdzRoute,
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/model/usdz`,
      admin: { ok: false, reason: "missing config" },
      error: "USDZ indisponible."
    }
  ];

  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  try {
    for (const entry of cases) {
      globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN__ = entry.admin ?? entry.fixture.admin;
      const response = await invokeRoute({
        route: entry.route,
        method: "GET",
        url: entry.url
      });
      await assertJsonError(response, 503, entry.error);
    }
  } finally {
    if (previousSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }
  }
});

test("public asset egress implementation contains no binary body proxy primitive", async () => {
  const files = [
    "app/api/public/menu-dishes/[dishId]/photo/route.ts",
    "app/api/public/menu-dishes/[dishId]/model/glb/route.ts",
    "app/api/public/menu-dishes/[dishId]/model/usdz/route.ts",
    "lib/publicDishAssetRedirect.ts"
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(file, "utf8").catch(() => ""))
  );

  assert.notEqual(sources.at(-1), "", "the shared server-only redirect helper must exist");
  for (let index = 0; index < files.length; index += 1) {
    assert.doesNotMatch(
      sources[index],
      /\.download\s*\(|\.arrayBuffer\s*\(|\bfetch\s*\(|\bBuffer\b/,
      files[index]
    );
  }
});
