import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const loadInputCore = () => import("../lib/admin/qrAccessInputCore.ts");
const loadSessionCore = () => import("../lib/admin/accessSessionCore.ts");

function accessRequest({
  url = "https://vistaire.ca/admin/access",
  origin = "https://vistaire.ca",
  fetchSite = "same-origin",
  body = "qrAccess=opaque-token",
  contentLength
} = {}) {
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
    "sec-fetch-site": fetchSite
  });
  if (origin !== null) headers.set("origin", origin);
  if (contentLength !== undefined) {
    headers.set("content-length", String(contentLength));
  }
  return new Request(url, { method: "POST", headers, body });
}

test("admin access POST accepts one bounded same-origin QR field", async () => {
  const {
    MAX_ADMIN_ACCESS_BODY_BYTES,
    parseAdminQrAccessRequest
  } = await loadInputCore();

  assert.equal(MAX_ADMIN_ACCESS_BODY_BYTES, 8_192);
  assert.equal(
    await parseAdminQrAccessRequest(accessRequest(), "https://vistaire.ca"),
    "opaque-token"
  );
  assert.equal(
    await parseAdminQrAccessRequest(
      accessRequest({
        url: "https://vistaire.ca/admin/access?restaurantId=restaurant-b",
        body: "qrAccess=opaque-token",
        contentLength: 27
      }),
      "https://vistaire.ca"
    ),
    "opaque-token"
  );
});

test("admin access POST rejects cross-origin, ambiguous, and oversized bodies", async () => {
  const { MAX_ADMIN_ACCESS_BODY_BYTES, parseAdminQrAccessRequest } =
    await loadInputCore();

  const rejected = [
    accessRequest({ origin: null }),
    accessRequest({ origin: "https://evil.example" }),
    accessRequest({ fetchSite: "cross-site" }),
    accessRequest({ body: "qrAccess=opaque-token&restaurantId=restaurant-b" }),
    accessRequest({ body: "qrAccess=one&qrAccess=two" }),
    accessRequest({
      body: `qrAccess=${"x".repeat(MAX_ADMIN_ACCESS_BODY_BYTES)}`,
      contentLength: 1
    }),
    accessRequest({
      body: "qrAccess=opaque-token",
      contentLength: MAX_ADMIN_ACCESS_BODY_BYTES + 1
    })
  ];

  for (const request of rejected) {
    assert.equal(
      await parseAdminQrAccessRequest(request, "https://vistaire.ca"),
      null
    );
  }

  const jsonRequest = new Request("https://vistaire.ca/admin/access", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://vistaire.ca",
      "sec-fetch-site": "same-origin"
    },
    body: JSON.stringify({ qrAccess: "opaque-token" })
  });
  assert.equal(
    await parseAdminQrAccessRequest(jsonRequest, "https://vistaire.ca"),
    null
  );
});

test("admin mutation guard rejects logout CSRF origins", async () => {
  const { isSameOriginAdminMutation } = await loadInputCore();
  const base = {
    origin: "https://vistaire.ca",
    fetchSite: "same-origin",
    requestOrigin: "https://vistaire.ca"
  };

  assert.equal(isSameOriginAdminMutation(base), true);
  assert.equal(isSameOriginAdminMutation({ ...base, fetchSite: null }), true);
  assert.equal(isSameOriginAdminMutation({ ...base, origin: null }), false);
  assert.equal(
    isSameOriginAdminMutation({ ...base, origin: "https://evil.example" }),
    false
  );
  assert.equal(
    isSameOriginAdminMutation({ ...base, fetchSite: "cross-site" }),
    false
  );
});

test("admin session cookie is eight-hour, admin-scoped, and explicitly expirable", async () => {
  const {
    ADMIN_ACCESS_COOKIE_NAME,
    getAdminAccessCookieOptions,
    getExpiredAdminAccessCookieOptions
  } = await loadSessionCore();

  assert.equal(ADMIN_ACCESS_COOKIE_NAME, "vistaire_admin_access");
  assert.deepEqual(getAdminAccessCookieOptions("production"), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 28_800
  });
  assert.deepEqual(getAdminAccessCookieOptions("development"), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/admin",
    maxAge: 28_800
  });
  assert.deepEqual(getExpiredAdminAccessCookieOptions("production"), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 0,
    expires: new Date(0)
  });
});

test("live admin authorization requires an explicit stored admin target kind", async () => {
  const access = await readFile("lib/admin/access.ts", "utf8");

  assert.doesNotMatch(access, /inferOwnerQrTargetKind/);
  assert.match(access, /storedKind === "admin"/);
});

test("admin routes use the hardened exchange, scoped cookie, API auth helper, and POST logout", async () => {
  const [accessRoute, qrRoute, logoutRoute, apiAuth, access] =
    await Promise.all([
      readFile("app/admin/access/route.ts", "utf8"),
      readFile("app/q/[token]/route.ts", "utf8"),
      readFile("app/admin/logout/route.ts", "utf8"),
      readFile("lib/admin/apiAuth.ts", "utf8"),
      readFile("lib/admin/access.ts", "utf8")
    ]);

  assert.match(accessRoute, /parseAdminQrAccessRequest/);
  assert.doesNotMatch(accessRoute, /request\.formData\(\)/);
  assert.match(qrRoute, /ADMIN_ACCESS_COOKIE_NAME/);
  assert.match(qrRoute, /getAdminAccessCookieOptions/);

  assert.match(logoutRoute, /export async function POST/);
  assert.doesNotMatch(logoutRoute, /export (?:async )?function GET/);
  assert.match(logoutRoute, /isSameOriginAdminMutation/);
  assert.match(logoutRoute, /status:\s*403/);
  assert.match(logoutRoute, /getExpiredAdminAccessCookieOptions/);
  assert.match(logoutRoute, /LOCAL_ADMIN_PREVIEW_COOKIE/);
  assert.match(logoutRoute, /status:\s*303/);
  assert.ok(
    logoutRoute.indexOf("if (!isSameOriginAdminMutation") <
      logoutRoute.indexOf("response.cookies.set")
  );

  assert.match(apiAuth, /^import "server-only";/);
  assert.match(apiAuth, /requireAdminRestaurantAccess\(capability\)/);
  assert.match(apiAuth, /["']Cache-Control["']:\s*["']no-store["']/);
  assert.doesNotMatch(apiAuth, /searchParams|request\.headers|request\.json|formData/);
  assert.match(access, /ADMIN_ACCESS_COOKIE_NAME/);
});
