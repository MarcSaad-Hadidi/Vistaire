import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const loadPreviewCore = () => import("../lib/admin/localPreviewCore.ts");
const SECRET = "local-preview-test-secret-with-at-least-32-bytes";
const OTHER_SECRET = "another-local-preview-secret-at-least-32-bytes";

test("development preview grants a signed short-lived path-scoped cookie", async () => {
  const {
    LOCAL_ADMIN_PREVIEW_COOKIE,
    LOCAL_ADMIN_PREVIEW_TTL_SECONDS,
    createLocalAdminPreviewAccess,
    createLocalAdminPreviewGrant
  } = await loadPreviewCore();
  const grant = createLocalAdminPreviewGrant({
    nodeEnv: "development",
    origin: "http://localhost:3000",
    requestOrigin: "http://localhost:3000",
    secret: SECRET,
    now: 1_000
  });

  assert.equal(LOCAL_ADMIN_PREVIEW_TTL_SECONDS, 3_600);
  assert.equal(grant.ok, true);
  assert.equal(grant.redirectPath, "/admin");
  assert.equal(grant.redirectOrigin, "http://localhost:3000");
  assert.equal(grant.cookie.name, LOCAL_ADMIN_PREVIEW_COOKIE);
  assert.notEqual(grant.cookie.value, "vistaire-local-admin-preview-v1");
  assert.deepEqual(grant.cookie.options, {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 3_600
  });
  assert.deepEqual(
    createLocalAdminPreviewAccess({
      nodeEnv: "development",
      hostname: "localhost:3000",
      capability: "dashboard:read",
      cookieValue: grant.cookie.value,
      restaurantId: "demo-rest",
      secret: SECRET,
      now: 1_001
    }),
    {
      ok: true,
      sessionKind: "local-preview",
      assurance: "signed-loopback-preview",
      qrId: null,
      restaurantId: "demo-rest",
      expiresAt: 4_600,
      capabilities: ["dashboard:read"]
    }
  );
});

test("preview grants reject production, remote, missing, cross-origin, and alias origins", async () => {
  const { createLocalAdminPreviewGrant } = await loadPreviewCore();
  const base = {
    nodeEnv: "development",
    origin: "http://localhost:3000",
    requestOrigin: "http://localhost:3000",
    secret: SECRET,
    now: 1_000
  };

  assert.deepEqual(createLocalAdminPreviewGrant({ ...base, nodeEnv: "production" }), {
    ok: false
  });
  assert.deepEqual(createLocalAdminPreviewGrant({ ...base, origin: null }), {
    ok: false
  });
  assert.deepEqual(
    createLocalAdminPreviewGrant({ ...base, origin: "https://evil.example" }),
    { ok: false }
  );
  assert.deepEqual(
    createLocalAdminPreviewGrant({
      ...base,
      origin: "http://127.0.0.1:3000"
    }),
    { ok: false }
  );
  assert.deepEqual(
    createLocalAdminPreviewGrant({
      ...base,
      origin: "http://192.168.1.40:3000",
      requestOrigin: "http://192.168.1.40:3000"
    }),
    { ok: false }
  );
});

test("request origin is derived from the actual loopback Host", async () => {
  const { deriveLocalPreviewRequestOrigin } = await loadPreviewCore();

  assert.equal(
    deriveLocalPreviewRequestOrigin({
      nodeEnv: "development",
      host: "127.0.0.1:3000",
      requestProtocol: "http:"
    }),
    "http://127.0.0.1:3000"
  );
  assert.equal(
    deriveLocalPreviewRequestOrigin({
      nodeEnv: "development",
      host: "localhost:3000",
      requestProtocol: "http:"
    }),
    "http://localhost:3000"
  );
  assert.equal(
    deriveLocalPreviewRequestOrigin({
      nodeEnv: "development",
      host: "[::1]:3000",
      requestProtocol: "http:"
    }),
    "http://[::1]:3000"
  );
  assert.equal(
    deriveLocalPreviewRequestOrigin({
      nodeEnv: "development",
      host: "remote.internal:3000",
      requestProtocol: "http:"
    }),
    null
  );
  assert.equal(
    deriveLocalPreviewRequestOrigin({
      nodeEnv: "production",
      host: "localhost:3000",
      requestProtocol: "http:"
    }),
    null
  );
});

test("preview access rejects forged, expired, and wrong-secret grants", async () => {
  const { createLocalAdminPreviewAccess, createLocalAdminPreviewGrant } =
    await loadPreviewCore();
  const grant = createLocalAdminPreviewGrant({
    nodeEnv: "development",
    origin: "http://localhost:3000",
    requestOrigin: "http://localhost:3000",
    secret: SECRET,
    now: 1_000
  });
  assert.equal(grant.ok, true);
  const base = {
    nodeEnv: "development",
    hostname: "localhost:3000",
    capability: "dashboard:read",
    cookieValue: grant.cookie.value,
    restaurantId: "demo-rest",
    secret: SECRET
  };

  assert.equal(createLocalAdminPreviewAccess({ ...base, now: 4_600 }), null);
  assert.equal(
    createLocalAdminPreviewAccess({
      ...base,
      cookieValue: `${grant.cookie.value.slice(0, -1)}x`,
      now: 1_001
    }),
    null
  );
  assert.equal(
    createLocalAdminPreviewAccess({ ...base, secret: OTHER_SECRET, now: 1_001 }),
    null
  );
  assert.equal(
    createLocalAdminPreviewAccess({ ...base, nodeEnv: "production", now: 1_001 }),
    null
  );
  assert.equal(
    createLocalAdminPreviewAccess({ ...base, hostname: "remote.internal", now: 1_001 }),
    null
  );
  assert.deepEqual(
    createLocalAdminPreviewAccess({ ...base, hostname: "[::1]:3000", now: 1_001 }),
    {
      ok: true,
      sessionKind: "local-preview",
      assurance: "signed-loopback-preview",
      qrId: null,
      restaurantId: "demo-rest",
      expiresAt: 4_600,
      capabilities: ["dashboard:read"]
    }
  );
  assert.equal(
    createLocalAdminPreviewAccess({
      ...base,
      capability: "dish:availability:write",
      now: 1_001
    }),
    null
  );
});

test("admin preview route derives origin from Host and uses a server-only secret", async () => {
  const route = await readFile("app/admin/preview/route.ts", "utf8");
  const page = await readFile("app/admin/page.tsx", "utf8");
  const access = await readFile("lib/admin/access.ts", "utf8");
  const secret = await readFile("lib/admin/localPreviewSecret.ts", "utf8");

  assert.match(route, /export async function POST/);
  assert.match(route, /deriveLocalPreviewRequestOrigin/);
  assert.match(route, /headers\.get\("host"\)/);
  assert.match(route, /headers\.get\("origin"\)/);
  assert.doesNotMatch(route, /x-forwarded-proto/);
  assert.match(route, /getLocalAdminPreviewSecret/);
  assert.match(route, /status:\s*404/);
  assert.match(route, /response\.cookies\.set/);
  assert.match(route, /status:\s*303/);
  assert.match(page, /process\.env\.NODE_ENV !== "production"/);
  assert.match(page, /action="\/admin\/preview"/);
  assert.match(page, /method="post"/);
  assert.match(page, /Ouvrir la prévisualisation locale/);
  assert.match(access, /createLocalAdminPreviewAccess/);
  assert.match(access, /getLocalAdminPreviewSecret/);
  assert.match(access, /getDemoRestaurantId\(\)/);
  assert.match(secret, /import "server-only"/);
  assert.match(secret, /randomBytes/);
  assert.match(secret, /globalThis/);
});
