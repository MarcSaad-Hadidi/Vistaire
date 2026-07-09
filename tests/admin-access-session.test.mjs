import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const now = 1_783_631_200;
const secret = "test-secret-with-at-least-thirty-two-bytes";
const loadAccessSessionCore = () => import("../lib/admin/accessSessionCore.ts");

test("admin access tokens contain only the scoped eight-hour session fields", async () => {
  const {
    ADMIN_ACCESS_TTL_SECONDS,
    createAdminAccessToken,
    verifyAdminAccessToken
  } = await loadAccessSessionCore();
  const token = createAdminAccessToken(
    { qrId: "qr-1", restaurantId: "rest-1", now },
    secret
  );

  assert.equal(ADMIN_ACCESS_TTL_SECONDS, 28_800);
  assert.deepEqual(verifyAdminAccessToken(token, secret, now + 60), {
    v: 1,
    qrId: "qr-1",
    restaurantId: "rest-1",
    exp: now + 28_800
  });
});

test("admin access tokens reject tampering and expiration", async () => {
  const { createAdminAccessToken, verifyAdminAccessToken } =
    await loadAccessSessionCore();
  const token = createAdminAccessToken(
    { qrId: "qr-1", restaurantId: "rest-1", now },
    secret
  );

  assert.equal(verifyAdminAccessToken(`${token}x`, secret, now + 60), null);
  assert.deepEqual(verifyAdminAccessToken(token, secret, now + 28_799), {
    v: 1,
    qrId: "qr-1",
    restaurantId: "rest-1",
    exp: now + 28_800
  });
  assert.equal(verifyAdminAccessToken(token, secret, now + 28_800), null);
});

test("failed persistence never signs an admin QR while menu QR may use signed fallback", async () => {
  const { createOwnerQrCodeWithDependencies } = await import(
    "../lib/owner/qrCreationCore.ts"
  );
  const signedTargets = [];
  const dependencies = {
    persistQrCode: async () => ({ ok: false, error: "storage unavailable" }),
    createSignedMenuFallback: ({ targetPath }) => {
      signedTargets.push(targetPath);
      return "signed-menu-token";
    }
  };

  const admin = await createOwnerQrCodeWithDependencies(
    {
      restaurantId: "rest-a",
      targetKind: "admin",
      targetPath: "/admin",
      label: "QR dashboard restaurant"
    },
    dependencies
  );
  assert.equal(admin.ok, false);
  assert.deepEqual(signedTargets, []);

  const menu = await createOwnerQrCodeWithDependencies(
    {
      restaurantId: "rest-a",
      targetKind: "menu",
      targetPath: "/menu/restaurant-a",
      label: "QR menu"
    },
    dependencies
  );
  assert.equal(menu.ok, true);
  assert.equal(menu.persisted, false);
  assert.equal(menu.token, "signed-menu-token");
  assert.deepEqual(signedTargets, ["/menu/restaurant-a"]);
});

test("admin access tokens fail closed for weak secrets and malformed identity", async () => {
  const { createAdminAccessToken, verifyAdminAccessToken } =
    await loadAccessSessionCore();
  assert.throws(
    () => createAdminAccessToken({ qrId: "qr-1", restaurantId: "rest-1", now }, "short"),
    /secret/i
  );
  assert.throws(
    () => createAdminAccessToken({ qrId: "", restaurantId: "rest-1", now }, secret),
    /qr/i
  );
  assert.equal(verifyAdminAccessToken("not-a-token", secret, now), null);
  assert.equal(verifyAdminAccessToken("not-a-token", "short", now), null);
});

test("admin authorization derives restaurant scope from the cookie only", async () => {
  const access = await readFile("lib/admin/access.ts", "utf8");
  const adminPage = await readFile("app/admin/page.tsx", "utf8");

  assert.match(access, /vistaire_admin_access/);
  assert.match(access, /VISTAIRE_ADMIN_SESSION_SECRET/);
  assert.match(access, /target_kind|targetKind/);
  assert.match(access, /status/);
  assert.match(access, /active/);
  assert.doesNotMatch(adminPage, /searchParams/);
  assert.doesNotMatch(adminPage, /restaurantId.*search|search.*restaurantId/is);
});
