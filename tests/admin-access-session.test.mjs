import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const now = 1_783_631_200;
const secret = "test-secret-with-at-least-thirty-two-bytes";
const loadAccessSessionCore = () => import("../lib/admin/accessSessionCore.ts");
const loadAdminAccess = () => import("../lib/admin/accessCore.ts");

async function createAccessFixture(overrides = {}) {
  const { createAdminAccessToken } = await loadAccessSessionCore();
  const token = createAdminAccessToken(
    { qrId: "qr-1", restaurantId: "rest-1", now },
    secret
  );
  return {
    secret,
    now: now + 60,
    getCookieValue: () => token,
    readQrCode: async () => ({
      id: "qr-1",
      restaurantId: "rest-1",
      targetKind: "admin",
      targetPath: "/admin",
      status: "active"
    }),
    ...overrides
  };
}

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
    persistQrCode: async () => ({
      ok: false,
      error: "storage unavailable",
      fallbackEligible: true
    }),
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

test("ordinary QR persistence failures never invoke the signed menu fallback", async () => {
  const { createOwnerQrCodeWithDependencies } = await import(
    "../lib/owner/qrCreationCore.ts"
  );
  let signed = false;
  const failure = { ok: false, error: "insert failed" };
  const result = await createOwnerQrCodeWithDependencies(
    {
      restaurantId: "rest-a",
      targetKind: "menu",
      targetPath: "/menu/restaurant-a",
      label: "QR menu"
    },
    {
      persistQrCode: async () => failure,
      createSignedMenuFallback: () => {
        signed = true;
        return "must-not-be-signed";
      }
    }
  );

  assert.deepEqual(result, failure);
  assert.equal(signed, false);
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
  const accessCore = await readFile("lib/admin/accessCore.ts", "utf8");
  const adminPage = await readFile("app/(fr)/admin/page.tsx", "utf8");

  assert.match(access, /ADMIN_ACCESS_COOKIE_NAME/);
  assert.match(access, /VISTAIRE_ADMIN_SESSION_SECRET/);
  assert.match(access, /target_kind|targetKind/);
  assert.match(access, /status/);
  assert.match(accessCore, /active/);
  assert.match(adminPage, /requireAdminRestaurantAccess\("dashboard:read"\)/);
  assert.match(adminPage, /Accès dashboard restaurant requis/);
  assert.match(adminPage, /Scannez le QR admin interne de votre restaurant\./);
  assert.match(adminPage, /loadAdminDashboardData\(access\.restaurantId, range\)/);
  assert.ok(
    adminPage.indexOf('requireAdminRestaurantAccess("dashboard:read")') <
      adminPage.indexOf("loadAdminDashboardData(access.restaurantId, range)")
  );
  assert.match(adminPage, /parseAdminPageSearchParams\(await searchParams\)/);
  assert.doesNotMatch(adminPage, /searchParams\?\.|searchParams\[/);
  assert.doesNotMatch(adminPage, /getDemoRestaurantId/);
});

test("admin access wrapper preserves the server-only boundary", async () => {
  const access = await readFile("lib/admin/access.ts", "utf8");
  const core = await readFile("lib/admin/accessCore.ts", "utf8");

  assert.match(access, /^import "server-only";/);
  assert.match(access, /import \{ cookies, headers \} from "next\/headers"/);
  assert.match(access, /getSupabaseAdminClient/);
  assert.match(access, /requireAdminRestaurantAccessCore/);
  assert.doesNotMatch(core, /server-only|next\/headers|supabase/i);
});

test("admin authorization gives write capability only to canonical admin QR targets", async () => {
  const { requireAdminRestaurantAccess } = await loadAdminAccess();
  for (const targetPath of [
    "/admin",
    "/owner",
    "/owner/restaurants/rest-1",
    "/owner/restaurants?restaurantId=rest-1"
  ]) {
    const dependencies = await createAccessFixture({
      readQrCode: async () => ({
        id: "qr-1",
        restaurantId: "rest-1",
        targetKind: "admin",
        targetPath,
        status: "active"
      })
    });
    const capabilities = targetPath === "/admin"
      ? ["dashboard:read", "dish:availability:write"]
      : ["dashboard:read"];
    assert.deepEqual(await requireAdminRestaurantAccess("dashboard:read", dependencies), {
        ok: true,
        sessionKind: "qr",
        assurance: "live-admin-qr",
        qrId: "qr-1",
        restaurantId: "rest-1",
        expiresAt: now + 28_800,
        capabilities
    });
    assert.deepEqual(
      await requireAdminRestaurantAccess("dish:availability:write", dependencies),
      targetPath === "/admin"
        ? { ok: true, sessionKind: "qr", assurance: "live-admin-qr", qrId: "qr-1", restaurantId: "rest-1", expiresAt: now + 28_800, capabilities }
        : { ok: false, reason: "capability" }
    );
  }
});

test("admin authorization rejects mismatched QR and restaurant identity", async () => {
  const { requireAdminRestaurantAccess } = await loadAdminAccess();
  for (const row of [
    {
      id: "qr-other",
      restaurantId: "rest-1",
      targetKind: "admin",
      targetPath: "/admin",
      status: "active"
    },
    {
      id: "qr-1",
      restaurantId: "rest-other",
      targetKind: "admin",
      targetPath: "/admin",
      status: "active"
    }
  ]) {
    const dependencies = await createAccessFixture({ readQrCode: async () => row });
    assert.deepEqual(
      await requireAdminRestaurantAccess("dashboard:read", dependencies),
      { ok: false, reason: "revoked" }
    );
  }
});

test("admin authorization rejects menu, inactive, and incoherent paths", async () => {
  const { requireAdminRestaurantAccess } = await loadAdminAccess();
  const rows = [
    { targetKind: "menu", targetPath: "/menu/rest-1", status: "active" },
    { targetKind: "admin", targetPath: "/admin", status: "paused" },
    { targetKind: "admin", targetPath: "/admin", status: "archived" },
    { targetKind: "admin", targetPath: "/menu/rest-1", status: "active" },
    { targetKind: "admin", targetPath: "https://evil.example", status: "active" }
  ];
  for (const row of rows) {
    const dependencies = await createAccessFixture({
      readQrCode: async () => ({
        id: "qr-1",
        restaurantId: "rest-1",
        ...row
      })
    });
    assert.deepEqual(
      await requireAdminRestaurantAccess("dashboard:read", dependencies),
      { ok: false, reason: "revoked" }
    );
  }
});

test("admin authorization fails closed for reader, secret, and expiry errors", async () => {
  const { requireAdminRestaurantAccess } = await loadAdminAccess();
  const readerError = await createAccessFixture({
    readQrCode: async () => {
      throw new Error("database unavailable");
    }
  });
  assert.deepEqual(
    await requireAdminRestaurantAccess("dashboard:read", readerError),
    { ok: false, reason: "configuration" }
  );

  const missingSecret = await createAccessFixture({ secret: "" });
  assert.deepEqual(
    await requireAdminRestaurantAccess("dashboard:read", missingSecret),
    { ok: false, reason: "configuration" }
  );

  const weakSecret = await createAccessFixture({ secret: "short" });
  assert.deepEqual(
    await requireAdminRestaurantAccess("dashboard:read", weakSecret),
    { ok: false, reason: "session" }
  );

  const expired = await createAccessFixture({ now: now + 28_800 });
  assert.deepEqual(
    await requireAdminRestaurantAccess("dashboard:read", expired),
    { ok: false, reason: "session" }
  );
});

test("admin authorization allowlists capabilities before reading session state", async () => {
  const { ADMIN_CAPABILITIES, requireAdminRestaurantAccess } =
    await loadAdminAccess();
  const dependencies = await createAccessFixture();
  const readCookieValue = dependencies.getCookieValue;
  let cookieReads = 0;
  dependencies.getCookieValue = () => {
    cookieReads += 1;
    return readCookieValue();
  };

  assert.deepEqual(ADMIN_CAPABILITIES, [
    "dashboard:read",
    "dish:availability:write"
  ]);
  assert.deepEqual(
    await requireAdminRestaurantAccess("unlisted:write", dependencies),
    { ok: false, reason: "capability" }
  );
  assert.equal(cookieReads, 0);
});

test("admin session secret enforces the 32-byte boundary", async () => {
  const { createAdminAccessToken, verifyAdminAccessToken } =
    await loadAccessSessionCore();
  const input = { qrId: "qr-1", restaurantId: "rest-1", now };
  const thirtyTwoBytes = "x".repeat(32);
  const utf8Secret = "é".repeat(16);

  assert.throws(() => createAdminAccessToken(input, "x".repeat(31)), /secret/i);
  assert.ok(createAdminAccessToken(input, thirtyTwoBytes));
  const utf8Token = createAdminAccessToken(input, utf8Secret);
  assert.deepEqual(verifyAdminAccessToken(utf8Token, utf8Secret, now + 1), {
    v: 1,
    qrId: "qr-1",
    restaurantId: "rest-1",
    exp: now + 28_800
  });
});

test("admin authorization revalidates the live QR on every access", async () => {
  const { requireAdminRestaurantAccess } = await loadAdminAccess();
  let reads = 0;
  const dependencies = await createAccessFixture({
    readQrCode: async () => {
      reads += 1;
      return {
        id: "qr-1",
        restaurantId: "rest-1",
        targetKind: "admin",
        targetPath: "/admin",
        status: reads === 1 ? "active" : "paused"
      };
    }
  });

  assert.equal(
    (await requireAdminRestaurantAccess("dashboard:read", dependencies)).ok,
    true
  );
  assert.deepEqual(
    await requireAdminRestaurantAccess("dashboard:read", dependencies),
    { ok: false, reason: "revoked" }
  );
  assert.equal(reads, 2);
});
