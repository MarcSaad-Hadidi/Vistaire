import test from "node:test";
import assert from "node:assert/strict";

import {
  createNextRequest,
  loadAdminPhotoRoute,
  loadPhotoRoute
} from "./helpers/public-dish-asset-route-runtime.mjs";

const SUPABASE_ORIGIN = "https://bkpewsjvxswqruwqljcy.supabase.co";
const RESTAURANT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_RESTAURANT_ID = "99999999-8888-4777-8666-555555555555";
const DISH_ID = "11111111-2222-4333-8444-555555555555";
const PHOTO_SHA256 = "a".repeat(64);
const PHOTO_PATH = `restaurants/${RESTAURANT_ID}/photos/originals/tartare-saumon.webp`;

const [adminRoute, publicRoute] = await Promise.all([
  loadAdminPhotoRoute(),
  loadPhotoRoute()
]);

function signedUrl(bucket, storagePath) {
  return `${SUPABASE_ORIGIN}/storage/v1/object/sign/${bucket}/${storagePath}?token=signed-token`;
}

function metadata(overrides = {}) {
  return {
    photoStorageBucket: "vistaire-media",
    photoStoragePath: PHOTO_PATH,
    photoContentType: "image/webp",
    photoSha256: PHOTO_SHA256,
    ...overrides
  };
}

function createFixture({
  dishRestaurantId = RESTAURANT_ID,
  dishExists = true,
  dishError = null,
  isAvailable = true,
  photoMetadata = metadata(),
  objectExists = true,
  infoError = null,
  signedUrlOverride,
  signError = null
} = {}) {
  const calls = {
    eq: [],
    storageFrom: [],
    info: [],
    signed: []
  };
  const storageApi = {
    async info(storagePath) {
      calls.info.push(storagePath);
      return {
        data: objectExists ? { id: "storage-object" } : null,
        error: infoError
      };
    },
    async createSignedUrl(storagePath, expiresIn) {
      calls.signed.push({ storagePath, expiresIn });
      const effectiveError = signError || (objectExists ? null : { status: 404, message: "Object not found" });
      return {
        data: effectiveError
          ? null
          : {
              signedUrl:
                signedUrlOverride === undefined
                  ? signedUrl("vistaire-media", storagePath)
                  : signedUrlOverride
            },
        error: effectiveError
      };
    }
  };
  for (const forbidden of ["download", "upload", "getPublicUrl"]) {
    Object.defineProperty(storageApi, forbidden, {
      get() {
        throw new Error(`Unexpected Storage body API: ${forbidden}`);
      }
    });
  }

  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      calls.eq.push([column, value]);
      return this;
    },
    async maybeSingle() {
      return {
        data:
          dishError || !dishExists
            ? null
            : {
                id: DISH_ID,
                restaurant_id: dishRestaurantId,
                is_available: isAvailable,
                metadata: photoMetadata
              },
        error: dishError
      };
    }
  };

  return {
    admin: {
      ok: true,
      client: {
        from() {
          return query;
        },
        storage: {
          from(bucket) {
            calls.storageFrom.push(bucket);
            return storageApi;
          }
        }
      }
    },
    calls
  };
}

function setAccess(access = {}) {
  globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN_ACCESS__ = {
    ok: true,
    restaurantId: RESTAURANT_ID,
    ...access
  };
}

function installFixture(fixture) {
  globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN__ = fixture.admin;
  setAccess();
}

async function invoke(route, method = "GET", query = "") {
  const request = await createNextRequest(
    `https://vistaire.example${query}`,
    { method }
  );
  return route[method](request, {
    params: Promise.resolve({ dishId: DISH_ID })
  });
}

async function assertError(response, status, message) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { ok: false, error: message });
}

test("authorized admin GET and HEAD redirect available and unavailable photos", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  for (const isAvailable of [true, false]) {
    for (const method of ["GET", "HEAD"]) {
      const fixture = createFixture({ isAvailable });
      installFixture(fixture);
      const response = await invoke(
        adminRoute,
        method,
        `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
      );
      assert.equal(response.status, 307);
      assert.equal(
        response.headers.get("location"),
        signedUrl("vistaire-media", PHOTO_PATH)
      );
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("cdn-cache-control"), "private, no-store");
      assert.equal(
        response.headers.get("vercel-cdn-cache-control"),
        "private, no-store"
      );
      assert.deepEqual(fixture.calls.signed, [
        { storagePath: PHOTO_PATH, expiresIn: 600 }
      ]);
      assert.deepEqual(fixture.calls.storageFrom, ["vistaire-media"]);
      assert.ok(fixture.calls.eq.some(([column, value]) => column === "restaurant_id" && value === RESTAURANT_ID));
    }
  }
});

test("authorized admin keeps legacy photos working without a SHA version", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  const fixture = createFixture({
    photoMetadata: metadata({ photoSha256: "" })
  });
  installFixture(fixture);
  const response = await invoke(
    adminRoute,
    "GET",
    `/admin/api/menu-dishes/${DISH_ID}/photo`
  );
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(fixture.calls.signed, [
    { storagePath: PHOTO_PATH, expiresIn: 600 }
  ]);
});

test("public route still hides an unavailable dish photo", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  const fixture = createFixture({ isAvailable: false });
  globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN__ = fixture.admin;
  const response = await invoke(
    publicRoute,
    "GET",
    `/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
  );
  await assertError(response, 404, "Photo introuvable.");
  assert.deepEqual(fixture.calls.storageFrom, []);
});

test("admin access is fail-closed and never trusts a cross-restaurant dish", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  const fixture = createFixture({ dishRestaurantId: OTHER_RESTAURANT_ID });
  installFixture(fixture);
  const response = await invoke(
    adminRoute,
    "GET",
    `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
  );
  await assertError(response, 404, "Photo introuvable.");
  assert.deepEqual(fixture.calls.storageFrom, []);

  globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN_ACCESS__ = {
    ok: false,
    response: new Response(
      JSON.stringify({ ok: false, error: "Admin access required." }),
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  };
  const unauthorized = await invoke(
    adminRoute,
    "GET",
    `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
  );
  assert.equal(unauthorized.status, 401);

  globalThis.__PUBLIC_DISH_ASSET_TEST_ADMIN_ACCESS__ = {
    ok: false,
    response: new Response(
      JSON.stringify({ ok: false, error: "Capability refused." }),
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  };
  const forbidden = await invoke(
    adminRoute,
    "GET",
    `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
  );
  assert.equal(forbidden.status, 403);
});

test("admin route rejects stale, malformed, missing, or unsafe photo assets", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  const cases = [
    { label: "missing dish", options: { dishExists: false } },
    { label: "wrong bucket", options: { photoMetadata: metadata({ photoStorageBucket: "vistaire-3d" }) } },
    { label: "other restaurant path", options: { photoMetadata: metadata({ photoStoragePath: `restaurants/${OTHER_RESTAURANT_ID}/photos/originals/other.webp` }) } },
    { label: "traversal", options: { photoMetadata: metadata({ photoStoragePath: `${PHOTO_PATH}/../other.webp` }) } },
    { label: "wrong extension", options: { photoMetadata: metadata({ photoStoragePath: PHOTO_PATH.replace(".webp", ".svg") }) } },
    { label: "missing version", options: { photoMetadata: metadata(), query: "" } },
    { label: "stale version", options: { photoMetadata: metadata(), query: `?v=${"b".repeat(64)}` } }
  ];

  for (const entry of cases) {
    const fixture = createFixture(entry.options);
    installFixture(fixture);
    const query = entry.options.query ?? `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`;
    const response = await invoke(adminRoute, "GET", `/admin/api/menu-dishes/${DISH_ID}/photo${query.startsWith("?") ? query : query.includes("/photo") ? query.split("/photo")[1] ?? "" : ""}`);
    await assertError(response, 404, "Photo introuvable.");
    assert.deepEqual(fixture.calls.storageFrom, [], entry.label);
  }
});

test("admin route maps Storage outages, missing objects, and bad origins safely", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_ORIGIN;
  const unavailable = createFixture({ signError: { status: 500 } });
  installFixture(unavailable);
  await assertError(
    await invoke(adminRoute, "GET", `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`),
    503,
    "Photo indisponible."
  );

  const queryUnavailable = createFixture({ dishError: { code: "PGRST000" } });
  installFixture(queryUnavailable);
  await assertError(
    await invoke(adminRoute, "GET", `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`),
    503,
    "Photo indisponible."
  );

  const missing = createFixture({ objectExists: false, infoError: { status: 404 } });
  installFixture(missing);
  await assertError(
    await invoke(adminRoute, "GET", `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`),
    404,
    "Photo introuvable."
  );

  const foreignSignedUrl = createFixture({
    signedUrlOverride: `https://evil.example/storage/v1/object/sign/vistaire-media/${PHOTO_PATH}?token=signed-token`
  });
  installFixture(foreignSignedUrl);
  await assertError(
    await invoke(adminRoute, "GET", `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`),
    503,
    "Photo indisponible."
  );
});

test("admin photo URL boundary rewrites only canonical public photo routes", async () => {
  const {
    buildAdminDishPhotoPath,
    buildAdminDishPhotoUrl,
    isAdminDishPhotoUrl
  } = await import(
    "../lib/admin/dishPhotoUrl.ts"
  );
  assert.equal(
    buildAdminDishPhotoPath(DISH_ID, { assetVersion: PHOTO_SHA256 }),
    `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
  );
  assert.equal(
    buildAdminDishPhotoPath(DISH_ID, {
      assetVersion: PHOTO_SHA256,
      variant: "card"
    }),
    `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}&variant=card`
  );
  assert.equal(
    buildAdminDishPhotoUrl(
      `/api/public/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
    ),
    `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}&variant=thumbnail`
  );
  assert.equal(
    isAdminDishPhotoUrl(
      `/admin/api/menu-dishes/${DISH_ID}/photo?v=${PHOTO_SHA256}`
    ),
    true
  );
  assert.equal(
    buildAdminDishPhotoUrl("https://cdn.example.test/photo.webp"),
    "https://cdn.example.test/photo.webp"
  );
});
