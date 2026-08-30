import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createNextRequest,
  loadAdminPhotoRoute,
  loadGlbRoute,
  loadMenuMutationRevalidation,
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
const PHOTO_DERIVATIVE_PATH = `restaurants/${RESTAURANT_ID}/photos/derivatives/${PHOTO_SHA256}/thumbnail.webp`;
const PHOTO_DERIVATIVE_CARD_V1_PATH = `restaurants/${RESTAURANT_ID}/photos/derivatives/${PHOTO_SHA256}/card.webp`;
const PHOTO_DERIVATIVE_V2_OUTPUT_SHA256 = "b".repeat(64);
const PHOTO_DERIVATIVE_V2_PATH = `restaurants/${RESTAURANT_ID}/photos/derivatives/${PHOTO_SHA256}/dish-photo-v2/card-${PHOTO_DERIVATIVE_V2_OUTPUT_SHA256}.webp`;
const WEB_GLB_PATH = `restaurants/${RESTAURANT_ID}/models/web/tartare-saumon.glb`;
const AR_LITE_GLB_PATH = `restaurants/${RESTAURANT_ID}/models/ar-lite/tartare-saumon.glb`;
const USDZ_PATH = `restaurants/${RESTAURANT_ID}/models/ar-ios/tartare-saumon.usdz`;

const [photoRoute, adminPhotoRoute, glbRoute, usdzRoute, redirectHelper, mutationRevalidation] = await Promise.all([
  loadPhotoRoute(),
  loadAdminPhotoRoute(),
  loadGlbRoute(),
  loadUsdzRoute(),
  loadPublicDishAssetRedirect(),
  loadMenuMutationRevalidation()
]);

const DEFAULT_SIGNED_TOKEN_EXP_SECONDS = Math.floor(Date.now() / 1_000) + 270;

function jwtToken(expSeconds, claims = {}) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ exp: expSeconds, ...claims })}.test-signature`;
}

function signedUrl(
  bucket,
  storagePath,
  { expSeconds = DEFAULT_SIGNED_TOKEN_EXP_SECONDS, claims } = {}
) {
  const token = jwtToken(expSeconds, claims);
  return `${SUPABASE_ORIGIN}/storage/v1/object/sign/${bucket}/${storagePath}?token=${token}`;
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
  signError = null,
  signErrorForPath,
  onSign,
  onLookup,
  tokenNow,
  tokenExpiresAt,
  tokenId
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
      onSign?.({ storagePath, expiresIn });
      const bucket = calls.storageFrom.at(-1);
      const pathError = signErrorForPath?.(storagePath) ?? false;
      const missingObject = !objectExists;
      const effectiveError = signError || pathError || (missingObject ? { status: 404, message: "Object not found" } : null);
      return {
        data: effectiveError
          ? null
          : {
              signedUrl: signedUrlOverride === undefined
                ? signedUrl(bucket, storagePath, {
                    expSeconds: tokenExpiresAt
                      ? Math.floor(tokenExpiresAt({ storagePath, expiresIn }) / 1_000)
                      : tokenNow
                        ? Math.floor(tokenNow() / 1_000) + expiresIn
                        : DEFAULT_SIGNED_TOKEN_EXP_SECONDS,
                    ...(tokenId ? { claims: { jti: tokenId } } : {})
                  })
                : typeof signedUrlOverride === "function"
                  ? signedUrlOverride({ bucket, storagePath, expiresIn })
                  : signedUrlOverride
            },
        error: effectiveError
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
      onLookup?.();
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
          "no-store"
        );
        assert.equal(
          response.headers.get("cdn-cache-control"),
          "public, s-maxage=120, must-revalidate"
        );
        assert.equal(
          response.headers.get("vercel-cdn-cache-control"),
          "public, s-maxage=120, must-revalidate"
        );
        assert.equal(response.headers.get("content-length"), null);
        assert.equal(response.headers.get("content-type"), null);
        assert.equal(response.body, null);
        assert.equal(await response.text(), "");
        assert.deepEqual(fixture.calls.storageFrom, [entry.bucket]);
        assert.deepEqual(fixture.calls.info, []);
        assert.deepEqual(fixture.calls.signed, [
          { storagePath: entry.storagePath, expiresIn: 270 }
        ]);
        assert.deepEqual(fixture.calls.operationOrder, ["sign"]);
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

test("production public redirects reuse a versioned signed URL while admin stays no-store", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  redirectHelper.resetPublicDishAssetCachesForTests();
  try {
    const first = createAdminFixture({ metadata: assetMetadata("photo") });
    installAdmin(first);
    const firstResponse = await invokeRoute({
      route: photoRoute,
      method: "GET",
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
    });
    assert.equal(firstResponse.status, 307);
    assert.equal(first.calls.signed.length, 1);
    assert.equal(
      firstResponse.headers.get("surrogate-control"),
      "public, max-age=120"
    );
    assert.equal(firstResponse.headers.get("x-vistaire-asset-revocation-sla"), "300");

    const second = createAdminFixture({ metadata: assetMetadata("photo") });
    installAdmin(second);
    const secondResponse = await invokeRoute({
      route: photoRoute,
      method: "GET",
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
    });
    assert.equal(secondResponse.status, 307);
    assert.equal(secondResponse.headers.get("location"), firstResponse.headers.get("location"));
    assert.deepEqual(second.calls.table, [], "public metadata cache should avoid a second DB read");
    assert.deepEqual(second.calls.signed, []);

    const adminFirst = createAdminFixture({ metadata: assetMetadata("photo") });
    globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN__ = adminFirst.admin;
    globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN_ACCESS__ = {
      ok: true,
      restaurantId: RESTAURANT_ID
    };
    const adminFirstResponse = await invokeRoute({
      route: adminPhotoRoute,
      method: "GET",
      url: `https://vistaire.example/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}&variant=thumbnail`
    });
    assert.equal(adminFirstResponse.status, 307);
    assert.equal(adminFirst.calls.signed.length, 1);
    assert.equal(adminFirstResponse.headers.get("cache-control"), "private, no-store");

    const adminSecond = createAdminFixture({ metadata: assetMetadata("photo") });
    globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN__ = adminSecond.admin;
    const adminSecondResponse = await invokeRoute({
      route: adminPhotoRoute,
      method: "GET",
      url: `https://vistaire.example/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}&variant=thumbnail`
    });
    assert.equal(adminSecondResponse.status, 307);
    assert.equal(adminSecond.calls.signed.length, 1);
  } finally {
    redirectHelper.resetPublicDishAssetCachesForTests();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    delete globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN_ACCESS__;
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
    assert.equal(legacyResponse.headers.get("cache-control"), "no-store");
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
    assert.deepEqual(fixture.calls.info, []);
  } finally {
    if (previousSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }
  }
});

test("photo derivatives are source-bound, skip info on a hit, and fall back safely", async () => {
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  try {
    const derivativeMetadata = assetMetadata("photo", {
      photoDerivatives: {
        thumbnail: {
          storagePath: PHOTO_DERIVATIVE_PATH,
          sha256: "b".repeat(64),
          contentType: "image/webp",
          bytes: 321,
          sourceSha256: PHOTO_SHA256
        }
      }
    });
    const derivativeFixture = createAdminFixture({ metadata: derivativeMetadata });
    installAdmin(derivativeFixture);
    const derivativeResponse = await invokeRoute({
      route: photoRoute,
      method: "GET",
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}&variant=thumbnail`
    });
    assert.equal(derivativeResponse.status, 307);
    assert.equal(
      derivativeResponse.headers.get("location"),
      signedUrl("vistaire-media", PHOTO_DERIVATIVE_PATH)
    );
    assert.deepEqual(derivativeFixture.calls.info, []);
    assert.deepEqual(derivativeFixture.calls.operationOrder, ["sign"]);

    const staleFixture = createAdminFixture({
      metadata: assetMetadata("photo", {
        photoDerivatives: {
          thumbnail: {
            storagePath: PHOTO_DERIVATIVE_PATH,
            sha256: "b".repeat(64),
            contentType: "image/webp",
            bytes: 321,
            sourceSha256: "c".repeat(64)
          }
        }
      })
    });
    installAdmin(staleFixture);
    const staleResponse = await invokeRoute({
      route: photoRoute,
      method: "GET",
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}&variant=thumbnail`
    });
    assert.equal(staleResponse.status, 307);
    assert.equal(staleResponse.headers.get("location"), signedUrl("vistaire-media", PHOTO_PATH));
    assert.deepEqual(staleFixture.calls.info, []);
    assert.deepEqual(staleFixture.calls.operationOrder, ["sign"]);

    const missingDerivativeFixture = createAdminFixture({
      metadata: derivativeMetadata,
      signErrorForPath: (storagePath) => storagePath === PHOTO_DERIVATIVE_PATH
    });
    installAdmin(missingDerivativeFixture);
    const missingDerivativeResponse = await invokeRoute({
      route: photoRoute,
      method: "GET",
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}&variant=thumbnail`
    });
    assert.equal(missingDerivativeResponse.status, 307);
    assert.equal(
      missingDerivativeResponse.headers.get("location"),
      signedUrl("vistaire-media", PHOTO_PATH)
    );
    assert.deepEqual(missingDerivativeFixture.calls.info, []);
    assert.deepEqual(missingDerivativeFixture.calls.operationOrder, ["sign", "sign"]);
  } finally {
    if (previousSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    }
  }
});

test("V2 card derivatives validate recipe, source/output hashes, and immutable path", async () => {
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  try {
    const fixture = createAdminFixture({
      metadata: assetMetadata("photo", {
        photoDerivatives: {
          card: {
            schemaVersion: 2,
            recipeId: "dish-photo-v2",
            variant: "card",
            storagePath: PHOTO_DERIVATIVE_V2_PATH,
            sha256: PHOTO_DERIVATIVE_V2_OUTPUT_SHA256,
            outputSha256: PHOTO_DERIVATIVE_V2_OUTPUT_SHA256,
            contentType: "image/webp",
            format: "webp",
            width: 768,
            height: 512,
            bytes: 120_000,
            sourceSha256: PHOTO_SHA256,
            generatedAt: "2026-08-13T00:00:00.000Z",
            encoder: "sharp-webp-effort-4"
          }
        }
      })
    });
    installAdmin(fixture);
    const response = await invokeRoute({
      route: photoRoute,
      method: "GET",
      url: `https://vistaire.example/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}&variant=card`
    });
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      signedUrl("vistaire-media", PHOTO_DERIVATIVE_V2_PATH)
    );
    assert.deepEqual(fixture.calls.info, []);
  } finally {
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
  }
});

test("V2 derivatives use only the byte-exact canonical path derived from active metadata", async () => {
  const canonicalDerivative = {
    schemaVersion: 2,
    recipeId: "dish-photo-v2",
    variant: "card",
    storagePath: PHOTO_DERIVATIVE_V2_PATH,
    sha256: PHOTO_DERIVATIVE_V2_OUTPUT_SHA256,
    outputSha256: PHOTO_DERIVATIVE_V2_OUTPUT_SHA256,
    contentType: "image/webp",
    format: "webp",
    width: 768,
    height: 512,
    bytes: 120_000,
    sourceSha256: PHOTO_SHA256,
    generatedAt: "2026-08-13T00:00:00.000Z",
    encoder: "sharp-webp-effort-4"
  };
  const wrongSource = "c".repeat(64);
  const wrongOutput = "d".repeat(64);
  const cases = [
    {
      label: "restaurant segment",
      patch: { storagePath: PHOTO_DERIVATIVE_V2_PATH.replace(RESTAURANT_ID, OTHER_RESTAURANT_ID) }
    },
    {
      label: "source segment",
      patch: { storagePath: PHOTO_DERIVATIVE_V2_PATH.replace(PHOTO_SHA256, wrongSource) }
    },
    {
      label: "recipe segment",
      patch: { storagePath: PHOTO_DERIVATIVE_V2_PATH.replace("dish-photo-v2", "dish-photo-v1") }
    },
    {
      label: "variant segment",
      patch: { storagePath: PHOTO_DERIVATIVE_V2_PATH.replace("/card-", "/display-") }
    },
    {
      label: "output filename",
      patch: { storagePath: PHOTO_DERIVATIVE_V2_PATH.replace(PHOTO_DERIVATIVE_V2_OUTPUT_SHA256, wrongOutput) }
    },
    {
      label: "legacy path declared as V2",
      patch: { storagePath: PHOTO_DERIVATIVE_CARD_V1_PATH }
    },
    {
      label: "legacy path with a numeric V2 schema marker",
      patch: {
        storagePath: PHOTO_DERIVATIVE_CARD_V1_PATH,
        recipeId: "",
        variant: ""
      }
    },
    {
      label: "encoded segment",
      patch: { storagePath: PHOTO_DERIVATIVE_V2_PATH.replace("/dish-photo-v2/", "/dish-photo-v2%2f/") }
    },
    {
      label: "encoded segment with alternate hex case",
      patch: { storagePath: PHOTO_DERIVATIVE_V2_PATH.replace("/dish-photo-v2/", "/dish-photo-v2%2F/") }
    },
    {
      label: "leading ASCII whitespace",
      patch: { storagePath: ` ${PHOTO_DERIVATIVE_V2_PATH}` }
    },
    {
      label: "trailing Unicode no-break space",
      patch: { storagePath: `${PHOTO_DERIVATIVE_V2_PATH}\u00a0` }
    },
    {
      label: "leading Unicode byte-order mark",
      patch: { storagePath: `\ufeff${PHOTO_DERIVATIVE_V2_PATH}` }
    },
    {
      label: "path case differs from canonical bytes",
      patch: { storagePath: PHOTO_DERIVATIVE_V2_PATH.replace("dish-photo-v2", "DISH-PHOTO-V2") }
    },
    {
      label: "traversal segment",
      patch: { storagePath: PHOTO_DERIVATIVE_V2_PATH.replace("/dish-photo-v2/", "/../dish-photo-v2/") }
    },
    {
      label: "metadata/path source mismatch",
      patch: {
        sourceSha256: wrongSource,
        storagePath: PHOTO_DERIVATIVE_V2_PATH.replace(PHOTO_SHA256, wrongSource)
      }
    },
    {
      label: "metadata/path output mismatch",
      patch: { outputSha256: wrongOutput, sha256: wrongOutput }
    }
  ];

  for (const entry of cases) {
    const rejectedPath = entry.patch.storagePath ?? PHOTO_DERIVATIVE_V2_PATH;
    const fixture = createAdminFixture({
      metadata: assetMetadata("photo", {
        photoDerivatives: {
          card: { ...canonicalDerivative, ...entry.patch }
        }
      })
    });
    const response = await redirectHelper.redirectPublicDishAsset({
      admin: fixture.admin,
      dishId: DISH_ID,
      kind: "photo",
      requestedAssetVersion: PHOTO_SHA256,
      supabaseUrl: SUPABASE_ORIGIN,
      notFoundMessage: "Photo introuvable.",
      unavailableMessage: "Photo indisponible.",
      photoVariant: "card"
    });

    assert.equal(response.status, 307, entry.label);
    assert.equal(response.headers.get("location"), signedUrl("vistaire-media", PHOTO_PATH), entry.label);
    assert.equal(
      fixture.calls.signed.some((call) => call.storagePath === rejectedPath),
      false,
      entry.label
    );
  }
});

test("public redirect cache refreshes on controlled TTL boundaries without outliving its token", async () => {
  redirectHelper.resetPublicDishAssetCachesForTests();
  let nowMs = Date.parse("2026-08-15T12:00:00.000Z");
  const runtime = {
    now: () => nowMs,
    performanceNow: () => nowMs,
    cachePublicAssets: true
  };
  const invoke = (fixture) => redirectHelper.redirectPublicDishAsset({
    admin: fixture.admin,
    dishId: DISH_ID,
    kind: "photo",
    requestedAssetVersion: PHOTO_SHA256,
    supabaseUrl: SUPABASE_ORIGIN,
    notFoundMessage: "Photo introuvable.",
    unavailableMessage: "Photo indisponible.",
    runtime
  });

  try {
    const first = createAdminFixture({
      metadata: assetMetadata("photo"),
      tokenNow: () => nowMs,
      tokenId: "first"
    });
    const firstResponse = await invoke(first);
    assert.equal(firstResponse.status, 307);
    assert.deepEqual(first.calls.signed, [{ storagePath: PHOTO_PATH, expiresIn: 270 }]);
    assert.equal(firstResponse.headers.get("cache-control"), "no-store");
    assert.equal(firstResponse.headers.get("cdn-cache-control"), "public, s-maxage=120, must-revalidate");
    assert.equal(firstResponse.headers.get("x-vistaire-signed-url-remaining"), "270");
    assert.equal(firstResponse.headers.get("x-vistaire-asset-revocation-sla"), "300");

    nowMs += 29_999;
    const beforeMetadataExpiry = createAdminFixture({
      metadata: assetMetadata("photo"),
      tokenNow: () => nowMs,
      tokenId: "unexpected"
    });
    const beforeMetadataExpiryResponse = await invoke(beforeMetadataExpiry);
    assert.equal(beforeMetadataExpiryResponse.headers.get("location"), firstResponse.headers.get("location"));
    assert.deepEqual(beforeMetadataExpiry.calls.table, []);
    assert.deepEqual(beforeMetadataExpiry.calls.signed, []);

    nowMs += 1;
    const atMetadataExpiry = createAdminFixture({
      metadata: assetMetadata("photo"),
      tokenNow: () => nowMs,
      tokenId: "unexpected"
    });
    const atMetadataExpiryResponse = await invoke(atMetadataExpiry);
    assert.equal(atMetadataExpiryResponse.headers.get("location"), firstResponse.headers.get("location"));
    assert.deepEqual(atMetadataExpiry.calls.table, ["menu_dishes"]);
    assert.deepEqual(atMetadataExpiry.calls.signed, []);

    nowMs += 89_999;
    const beforeReuseExpiry = createAdminFixture({
      metadata: assetMetadata("photo"),
      tokenNow: () => nowMs
    });
    const beforeReuseExpiryResponse = await invoke(beforeReuseExpiry);
    assert.equal(beforeReuseExpiryResponse.headers.get("location"), firstResponse.headers.get("location"));
    assert.equal(beforeReuseExpiryResponse.headers.get("x-vistaire-signed-url-remaining"), "150");
    assert.equal(beforeReuseExpiryResponse.headers.get("cdn-cache-control"), "public, s-maxage=120, must-revalidate");
    assert.deepEqual(beforeReuseExpiry.calls.signed, []);

    nowMs += 1;
    const atReuseExpiry = createAdminFixture({
      metadata: assetMetadata("photo"),
      tokenNow: () => nowMs,
      tokenId: "second"
    });
    const atReuseExpiryResponse = await invoke(atReuseExpiry);
    assert.notEqual(atReuseExpiryResponse.headers.get("location"), firstResponse.headers.get("location"));
    assert.deepEqual(atReuseExpiry.calls.signed, [{ storagePath: PHOTO_PATH, expiresIn: 270 }]);
    assert.equal(atReuseExpiryResponse.headers.get("x-vistaire-signed-url-remaining"), "270");
  } finally {
    redirectHelper.resetPublicDishAssetCachesForTests();
  }
});

test("a stale instance cannot mint public access beyond the truthful 300 second composed SLA", async () => {
  redirectHelper.resetPublicDishAssetCachesForTests();
  let nowMs = Date.parse("2026-08-15T12:00:00.000Z");
  const runtime = {
    now: () => nowMs,
    performanceNow: () => nowMs,
    cachePublicAssets: true
  };
  const derivative = {
    schemaVersion: 2,
    recipeId: "dish-photo-v2",
    variant: "card",
    storagePath: PHOTO_DERIVATIVE_V2_PATH,
    sha256: PHOTO_DERIVATIVE_V2_OUTPUT_SHA256,
    outputSha256: PHOTO_DERIVATIVE_V2_OUTPUT_SHA256,
    contentType: "image/webp",
    format: "webp",
    width: 768,
    height: 512,
    bytes: 120_000,
    sourceSha256: PHOTO_SHA256,
    generatedAt: "2026-08-13T00:00:00.000Z",
    encoder: "sharp-webp-effort-4"
  };
  const metadata = assetMetadata("photo", {
    photoDerivatives: { card: derivative }
  });
  const redirect = (fixture, photoVariant) => redirectHelper.redirectPublicDishAsset({
    admin: fixture.admin,
    dishId: DISH_ID,
    kind: "photo",
    requestedAssetVersion: PHOTO_SHA256,
    supabaseUrl: SUPABASE_ORIGIN,
    notFoundMessage: "Photo introuvable.",
    unavailableMessage: "Photo indisponible.",
    ...(photoVariant ? { photoVariant } : {}),
    runtime
  });

  try {
    const beforeMutation = createAdminFixture({ metadata, tokenNow: () => nowMs });
    assert.equal((await redirect(beforeMutation)).status, 307);

    nowMs += 29_999;
    const staleInstance = createAdminFixture({
      metadata,
      isAvailable: false,
      tokenNow: () => nowMs
    });
    const staleResponse = await redirect(staleInstance, "card");
    assert.equal(staleResponse.status, 307);
    assert.deepEqual(staleInstance.calls.table, [], "the remote instance still has pre-mutation metadata");
    assert.deepEqual(staleInstance.calls.signed, [{
      storagePath: PHOTO_DERIVATIVE_V2_PATH,
      expiresIn: 270
    }]);
    assert.equal(staleResponse.headers.get("x-vistaire-asset-revocation-sla"), "300");
    assert.equal(staleResponse.headers.get("x-vistaire-signed-url-remaining"), "269");

    nowMs += 1;
    const afterMetadataBoundary = createAdminFixture({
      metadata,
      isAvailable: false,
      tokenNow: () => nowMs
    });
    const unavailableResponse = await redirect(afterMetadataBoundary, "thumbnail");
    await assertJsonError(unavailableResponse, 404, "Photo introuvable.");
    assert.deepEqual(afterMetadataBoundary.calls.table, ["menu_dishes"]);
    assert.deepEqual(afterMetadataBoundary.calls.signed, []);
  } finally {
    redirectHelper.resetPublicDishAssetCachesForTests();
  }
});

test("a provider token below the CDN plus safety boundary is refused", async () => {
  redirectHelper.resetPublicDishAssetCachesForTests();
  const startedAt = Date.parse("2026-08-15T12:00:00.000Z");
  let nowMs = startedAt;
  const runtime = {
    now: () => nowMs,
    performanceNow: () => nowMs,
    cachePublicAssets: true
  };

  try {
    const fixture = createAdminFixture({
      metadata: assetMetadata("photo"),
      tokenExpiresAt: () => startedAt + 270_000,
      onSign: () => { nowMs = startedAt + 121_000; }
    });
    const response = await redirectHelper.redirectPublicDishAsset({
      admin: fixture.admin,
      dishId: DISH_ID,
      kind: "photo",
      requestedAssetVersion: PHOTO_SHA256,
      supabaseUrl: SUPABASE_ORIGIN,
      notFoundMessage: "Photo introuvable.",
      unavailableMessage: "Photo indisponible.",
      runtime
    });

    await assertJsonError(response, 503, "Photo indisponible.");
    assert.equal(fixture.calls.signed.length, 1);
  } finally {
    redirectHelper.resetPublicDishAssetCachesForTests();
  }
});

test("metadata lookup started before mutation keeps that origin when it resolves after commit", async () => {
  redirectHelper.resetPublicDishAssetCachesForTests();
  const startedAt = Date.parse("2026-08-15T12:00:00.000Z");
  let nowMs = startedAt;
  let mutationCommittedAt = 0;
  const fixture = createAdminFixture({
    metadata: assetMetadata("photo"),
    onLookup: () => {
      mutationCommittedAt = startedAt + 1_000;
      nowMs = startedAt + 40_000;
    },
    tokenNow: () => nowMs
  });
  try {
    const response = await redirectHelper.redirectPublicDishAsset({
      admin: fixture.admin,
      dishId: DISH_ID,
      kind: "photo",
      requestedAssetVersion: PHOTO_SHA256,
      supabaseUrl: SUPABASE_ORIGIN,
      notFoundMessage: "Photo introuvable.",
      unavailableMessage: "Photo indisponible.",
      runtime: {
        now: () => nowMs,
        performanceNow: () => nowMs,
        cachePublicAssets: true
      }
    });
    assert.equal(mutationCommittedAt, startedAt + 1_000);
    assert.equal(response.status, 307);
    assert.deepEqual(fixture.calls.signed, [{ storagePath: PHOTO_PATH, expiresIn: 260 }]);
    assert.equal(response.headers.get("x-vistaire-signed-url-remaining"), "260");
  } finally {
    redirectHelper.resetPublicDishAssetCachesForTests();
  }
});

test("warm metadata keeps lookup-start origin and expires 30 seconds from that start", async () => {
  redirectHelper.resetPublicDishAssetCachesForTests();
  const startedAt = Date.parse("2026-08-15T12:00:00.000Z");
  let nowMs = startedAt;
  const runtime = {
    now: () => nowMs,
    performanceNow: () => nowMs,
    cachePublicAssets: true
  };
  const invoke = (fixture) => redirectHelper.redirectPublicDishAsset({
    admin: fixture.admin,
    dishId: DISH_ID,
    kind: "photo",
    requestedAssetVersion: PHOTO_SHA256,
    supabaseUrl: SUPABASE_ORIGIN,
    notFoundMessage: "Photo introuvable.",
    unavailableMessage: "Photo indisponible.",
    runtime
  });
  try {
    const delayed = createAdminFixture({
      metadata: assetMetadata("photo"),
      onLookup: () => { nowMs = startedAt + 10_000; },
      tokenNow: () => nowMs
    });
    assert.equal((await invoke(delayed)).status, 307);

    nowMs = startedAt + 29_999;
    const warm = createAdminFixture({ metadata: assetMetadata("photo"), tokenNow: () => nowMs });
    assert.equal((await invoke(warm)).status, 307);
    assert.deepEqual(warm.calls.table, []);

    nowMs = startedAt + 30_000;
    const expired = createAdminFixture({ metadata: assetMetadata("photo"), tokenNow: () => nowMs });
    assert.equal((await invoke(expired)).status, 307);
    assert.deepEqual(expired.calls.table, ["menu_dishes"]);
  } finally {
    redirectHelper.resetPublicDishAssetCachesForTests();
  }
});

test("a provider signature delayed beyond the snapshot deadline is refused", async () => {
  redirectHelper.resetPublicDishAssetCachesForTests();
  const startedAt = Date.parse("2026-08-15T12:00:00.000Z");
  let nowMs = startedAt;
  const fixture = createAdminFixture({
    metadata: assetMetadata("photo"),
    tokenNow: () => nowMs,
    onSign: () => { nowMs = startedAt + 40_000; }
  });
  try {
    const response = await redirectHelper.redirectPublicDishAsset({
      admin: fixture.admin,
      dishId: DISH_ID,
      kind: "photo",
      requestedAssetVersion: PHOTO_SHA256,
      supabaseUrl: SUPABASE_ORIGIN,
      notFoundMessage: "Photo introuvable.",
      unavailableMessage: "Photo indisponible.",
      runtime: {
        now: () => nowMs,
        performanceNow: () => nowMs,
        cachePublicAssets: true
      }
    });
    await assertJsonError(response, 503, "Photo indisponible.");
    assert.equal(fixture.calls.signed[0].expiresIn, 270);
  } finally {
    redirectHelper.resetPublicDishAssetCachesForTests();
  }
});

test("JWT exp is authoritative at exact CDN plus safety boundaries", async () => {
  const cases = [
    { label: "exact 150 seconds accepted", remaining: 150, status: 307 },
    { label: "149 seconds refused", remaining: 149, status: 503 },
    { label: "one second beyond snapshot deadline refused", remaining: 301, status: 503 }
  ];
  for (const entry of cases) {
    redirectHelper.resetPublicDishAssetCachesForTests();
    const startedAt = Date.parse("2026-08-15T12:00:00.000Z");
    let nowMs = startedAt;
    const fixture = createAdminFixture({
      metadata: assetMetadata("photo"),
      tokenExpiresAt: () => startedAt + entry.remaining * 1_000
    });
    const response = await redirectHelper.redirectPublicDishAsset({
      admin: fixture.admin,
      dishId: DISH_ID,
      kind: "photo",
      requestedAssetVersion: PHOTO_SHA256,
      supabaseUrl: SUPABASE_ORIGIN,
      notFoundMessage: "Photo introuvable.",
      unavailableMessage: "Photo indisponible.",
      runtime: {
        now: () => nowMs,
        performanceNow: () => nowMs,
        cachePublicAssets: true
      }
    });
    assert.equal(response.status, entry.status, entry.label);
    if (entry.status === 307) {
      assert.equal(response.headers.get("cdn-cache-control"), "public, s-maxage=120, must-revalidate");
      assert.equal(response.headers.get("x-vistaire-signed-url-remaining"), "150");
    }
  }
  redirectHelper.resetPublicDishAssetCachesForTests();
});

test("committed availability invalidation evicts asset metadata so the next redirect observes unavailable", async () => {
  redirectHelper.resetPublicDishAssetCachesForTests();
  const runtime = {
    now: () => Date.parse("2026-08-15T12:00:00.000Z"),
    performanceNow: () => 1,
    cachePublicAssets: true
  };
  const redirect = (fixture) => redirectHelper.redirectPublicDishAsset({
    admin: fixture.admin,
    dishId: DISH_ID,
    kind: "photo",
    requestedAssetVersion: PHOTO_SHA256,
    supabaseUrl: SUPABASE_ORIGIN,
    notFoundMessage: "Photo introuvable.",
    unavailableMessage: "Photo indisponible.",
    runtime
  });

  try {
    const available = createAdminFixture({
      metadata: assetMetadata("photo"),
      tokenNow: runtime.now
    });
    assert.equal((await redirect(available)).status, 307);

    const restaurantQuery = {
      select() { return this; },
      eq() { return this; },
      async maybeSingle() {
        return { data: { slug: "bistro-assets", name: "Bistro Assets" }, error: null };
      }
    };
    const invalidation = await mutationRevalidation.revalidateOwnerMenuMutationPaths(
      {
        client: { from: () => restaurantQuery },
        restaurantId: RESTAURANT_ID,
        dishId: DISH_ID,
        dishSlug: "plat-test"
      },
      {
        revalidateMenuCache: async () => ({
          ok: true,
          invalidatedTags: ["tag"],
          failedTags: []
        }),
        revalidatePath: () => {}
      }
    );
    assert.equal(invalidation.ok, true);
    assert.equal(invalidation.invalidatedAssetMetadataEntries, 1);

    const unavailable = createAdminFixture({
      metadata: assetMetadata("photo"),
      isAvailable: false
    });
    const response = await redirect(unavailable);
    await assertJsonError(response, 404, "Photo introuvable.");
    assert.deepEqual(unavailable.calls.table, ["menu_dishes"]);
    assert.deepEqual(unavailable.calls.signed, []);
  } finally {
    redirectHelper.resetPublicDishAssetCachesForTests();
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
    if (entry.options?.objectExists === false) {
      assert.equal(fixture.calls.signed.length, 1, entry.label);
    } else {
      assert.deepEqual(fixture.calls.signed, [], entry.label);
    }
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
  const localSignedUrl = `${localOrigin}/storage/v1/object/sign/vistaire-3d/${WEB_GLB_PATH}?token=${jwtToken(DEFAULT_SIGNED_TOKEN_EXP_SECONDS)}`;
  const localFixture = createAdminFixture({
    metadata: assetMetadata("web"),
    signedUrlOverride: localSignedUrl
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
    localSignedUrl
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
