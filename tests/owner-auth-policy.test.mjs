import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  isOwnerIdentityAllowed,
  parseOwnerAllowlist
} from "../lib/auth/ownerPolicy.ts";
import {
  DEV_OWNER_BYPASS_COOKIE,
  DEV_OWNER_BYPASS_REQUEST_HEADER,
  DEV_OWNER_BYPASS_TRUSTED_HEADER,
  hasTrustedDevOwnerBypass,
  shouldApplyDevOwnerBypass,
  shouldApplyDevOwnerBypassToken
} from "../lib/auth/devOwnerBypass.ts";
import {
  getOwner3dRestaurantAccess,
  ownerCanAccess3dRestaurant
} from "../lib/auth/owner3dAccess.ts";

test("parses owner allowlists without exposing client-side env names", () => {
  assert.deepEqual(parseOwnerAllowlist(" user_1, user_2\nuser_3 "), [
    "user_1",
    "user_2",
    "user_3"
  ]);
  assert.deepEqual(parseOwnerAllowlist("OWNER@VISTAIRE.CA, owner@vistaire.ca"), [
    "owner@vistaire.ca"
  ]);
  assert.deepEqual(parseOwnerAllowlist(""), []);
  assert.deepEqual(parseOwnerAllowlist(undefined), []);
});

test("allows owners by Clerk user id or email allowlist only", () => {
  const env = {
    VISTAIRE_OWNER_USER_IDS: "user_owner,user_backup",
    VISTAIRE_OWNER_EMAILS: "owner@vistaire.ca,ops@vistaire.ca"
  };

  assert.equal(
    isOwnerIdentityAllowed({ userId: "user_owner", emailAddresses: [] }, env),
    true
  );
  assert.equal(
    isOwnerIdentityAllowed(
      { userId: "user_other", emailAddresses: ["OPS@VISTAIRE.CA"] },
      env
    ),
    true
  );
  assert.equal(
    isOwnerIdentityAllowed(
      { userId: "user_other", emailAddresses: ["guest@vistaire.ca"] },
      env
    ),
    false
  );
  assert.equal(
    isOwnerIdentityAllowed({ userId: null, emailAddresses: [] }, env),
    false
  );
});

test("does not fall back to NEXT_PUBLIC owner configuration", () => {
  assert.equal(
    isOwnerIdentityAllowed(
      { userId: "user_public", emailAddresses: ["public@vistaire.ca"] },
      {
        NEXT_PUBLIC_VISTAIRE_OWNER_USER_IDS: "user_public",
        NEXT_PUBLIC_VISTAIRE_OWNER_EMAILS: "public@vistaire.ca"
      }
    ),
    false
  );
});

test("owner e2e bypass requires explicit token and localhost host", () => {
  const env = {
    VISTAIRE_OWNER_E2E_AUTH_BYPASS: "1",
    VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN: "0123456789abcdef"
  };
  const validHeaders = new Map([
    ["host", "localhost:3000"],
    [DEV_OWNER_BYPASS_REQUEST_HEADER, "0123456789abcdef"]
  ]);
  const remoteHeaders = new Map([
    ["host", "vistaire.example.com"],
    [DEV_OWNER_BYPASS_REQUEST_HEADER, "0123456789abcdef"]
  ]);

  assert.equal(shouldApplyDevOwnerBypass(validHeaders, env), true);
  assert.equal(
    shouldApplyDevOwnerBypass(
      new Map([
        ["host", "localhost:3000"],
        ["cookie", `${DEV_OWNER_BYPASS_COOKIE}=0123456789abcdef`]
      ]),
      env
    ),
    true
  );
  assert.equal(shouldApplyDevOwnerBypass(remoteHeaders, env), false);
  assert.equal(
    shouldApplyDevOwnerBypass(validHeaders, {
      VISTAIRE_OWNER_E2E_AUTH_BYPASS: "1",
      VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN: "short"
    }),
    false
  );
  assert.equal(
    hasTrustedDevOwnerBypass(
      new Map([[DEV_OWNER_BYPASS_TRUSTED_HEADER, "1"]]),
      env
    ),
    true
  );
  assert.equal(
    shouldApplyDevOwnerBypassToken(
      new Map([["host", "localhost:3000"]]),
      "0123456789abcdef",
      env
    ),
    true
  );
});

test("owner e2e query bypass persists a localhost cookie for navigation", async () => {
  const proxySource = await readFile("proxy.ts", "utf8");

  assert.match(proxySource, /DEV_OWNER_BYPASS_COOKIE/);
  assert.match(proxySource, /response\.cookies\.set\(DEV_OWNER_BYPASS_COOKIE/);
  assert.match(proxySource, /sameSite:\s*"lax"/);
  assert.match(proxySource, /maxAge:\s*60 \* 60 \* 8/);
});

test("owner 3D restaurant access fails closed unless slugs are configured", () => {
  const owner = {
    userId: "user_owner",
    emailAddresses: ["owner@vistaire.ca"]
  };

  assert.equal(getOwner3dRestaurantAccess(owner, {}).mode, "none");
  assert.equal(ownerCanAccess3dRestaurant(owner, "maison-elyse", {}), false);
  assert.equal(
    ownerCanAccess3dRestaurant(owner, "maison-elyse", {
      VISTAIRE_OWNER_3D_RESTAURANT_SLUGS: "maison-elyse"
    }),
    true
  );
  assert.equal(
    ownerCanAccess3dRestaurant(owner, "other", {
      VISTAIRE_OWNER_3D_RESTAURANT_ACCESS: "owner@vistaire.ca=maison-elyse;user_other=*"
    }),
    false
  );
  assert.equal(
    ownerCanAccess3dRestaurant(owner, "maison-elyse", {
      VISTAIRE_OWNER_3D_RESTAURANT_ACCESS: "owner@vistaire.ca=maison-elyse"
    }),
    true
  );
});
