import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const loadPreviewCore = () => import("../lib/admin/localPreviewCore.ts");

test("development preview grants a short path-scoped HttpOnly cookie", async () => {
  const {
    LOCAL_ADMIN_PREVIEW_COOKIE,
    LOCAL_ADMIN_PREVIEW_TTL_SECONDS,
    createLocalAdminPreviewGrant
  } = await loadPreviewCore();
  const grant = createLocalAdminPreviewGrant({
    nodeEnv: "development",
    hostname: "localhost",
    origin: "http://localhost:3000",
    requestOrigin: "http://localhost:3000"
  });

  assert.equal(LOCAL_ADMIN_PREVIEW_TTL_SECONDS, 3_600);
  assert.deepEqual(grant, {
    ok: true,
    redirectPath: "/admin",
    redirectOrigin: "http://localhost:3000",
    cookie: {
      name: LOCAL_ADMIN_PREVIEW_COOKIE,
      value: "vistaire-local-admin-preview-v1",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/admin",
        maxAge: 3_600
      }
    }
  });
});

test("production and cross-origin preview requests fail before issuing a cookie", async () => {
  const { createLocalAdminPreviewGrant } = await loadPreviewCore();
  assert.deepEqual(
    createLocalAdminPreviewGrant({
      nodeEnv: "production",
      hostname: "vistaire.ca",
      origin: "https://vistaire.ca",
      requestOrigin: "https://vistaire.ca"
    }),
    { ok: false }
  );
  assert.deepEqual(
    createLocalAdminPreviewGrant({
      nodeEnv: "development",
      hostname: "localhost",
      origin: "https://evil.example",
      requestOrigin: "http://localhost:3000"
    }),
    { ok: false }
  );
  assert.deepEqual(
    createLocalAdminPreviewGrant({
      nodeEnv: "development",
      hostname: "192.168.1.40",
      origin: null,
      requestOrigin: "http://192.168.1.40:3000"
    }),
    { ok: false }
  );
});

test("loopback aliases with the same protocol and port are same-origin locally", async () => {
  const { createLocalAdminPreviewGrant } = await loadPreviewCore();
  assert.deepEqual(
    createLocalAdminPreviewGrant({
      nodeEnv: "development",
      hostname: "localhost",
      origin: "http://127.0.0.1:3000",
      requestOrigin: "http://localhost:3000"
    }),
    {
      ok: true,
      redirectPath: "/admin",
      redirectOrigin: "http://127.0.0.1:3000",
      cookie: {
        name: "vistaire_admin_local_preview",
        value: "vistaire-local-admin-preview-v1",
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/admin",
          maxAge: 3_600
        }
      }
    }
  );
});

test("local preview access exists only outside production for the demo restaurant", async () => {
  const { createLocalAdminPreviewAccess } = await loadPreviewCore();
  assert.deepEqual(
    createLocalAdminPreviewAccess({
      nodeEnv: "development",
      hostname: "127.0.0.1",
      capability: "dashboard:read",
      cookieValue: "vistaire-local-admin-preview-v1",
      restaurantId: "demo-rest",
      now: 1_000
    }),
    {
      ok: true,
      qrId: "local-preview",
      restaurantId: "demo-rest",
      expiresAt: 4_600
    }
  );
  assert.equal(
    createLocalAdminPreviewAccess({
      nodeEnv: "production",
      hostname: "localhost",
      capability: "dashboard:read",
      cookieValue: "vistaire-local-admin-preview-v1",
      restaurantId: "demo-rest",
      now: 1_000
    }),
    null
  );
  assert.equal(
    createLocalAdminPreviewAccess({
      nodeEnv: "development",
      hostname: "localhost",
      capability: "dashboard:read",
      cookieValue: "forged",
      restaurantId: "demo-rest",
      now: 1_000
    }),
    null
  );
  assert.equal(
    createLocalAdminPreviewAccess({
      nodeEnv: "development",
      hostname: "remote.internal",
      capability: "dashboard:read",
      cookieValue: "vistaire-local-admin-preview-v1",
      restaurantId: "demo-rest",
      now: 1_000
    }),
    null
  );
  assert.equal(
    createLocalAdminPreviewAccess({
      nodeEnv: "development",
      hostname: "localhost",
      capability: "dish:availability:write",
      cookieValue: "vistaire-local-admin-preview-v1",
      restaurantId: "demo-rest",
      now: 1_000
    }),
    null
  );
});

test("admin preview route and locked page keep the local path visibly dev-only", async () => {
  const route = await readFile("app/admin/preview/route.ts", "utf8");
  const page = await readFile("app/admin/page.tsx", "utf8");
  const access = await readFile("lib/admin/access.ts", "utf8");

  assert.match(route, /export async function POST/);
  assert.match(route, /createLocalAdminPreviewGrant/);
  assert.match(route, /status:\s*404/);
  assert.match(route, /response\.cookies\.set/);
  assert.match(route, /status:\s*303/);
  assert.match(page, /process\.env\.NODE_ENV !== "production"/);
  assert.match(page, /action="\/admin\/preview"/);
  assert.match(page, /method="post"/);
  assert.match(page, /Ouvrir la prévisualisation locale/);
  assert.match(access, /createLocalAdminPreviewAccess/);
  assert.match(access, /getDemoRestaurantId\(\)/);
});
