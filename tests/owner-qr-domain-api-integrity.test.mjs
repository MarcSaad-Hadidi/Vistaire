import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical recovery validates the opaque token and storage hash before returning a URL", () => {
  const store = source("lib/owner/qrStore.ts");
  const tokens = source("lib/owner/qrTokens.ts");
  assert.match(store, /"token_hash"/);
  assert.match(store, /isValidOpaqueQrToken\(token\)/);
  assert.match(store, /qrTokenMatchesStorageHash/);
  assert.match(tokens, /timingSafeEqual\(calculated, stored\)/);
  assert.match(tokens, /\^\[A-Za-z0-9_-\]\{32\}\$/);
  assert.ok(store.indexOf("qrTokenMatchesStorageHash") < store.indexOf("record.redirectUrl ="));
});

test("new vault envelopes are v2 and bind hash plus stable row context with explicit v1 compatibility", () => {
  const vault = source("lib/owner/qrTokenVault.ts");
  assert.match(vault, /CURRENT_ENVELOPE_PREFIX = "v2\."/);
  assert.match(vault, /envelopeVersion:\s*2/);
  assert.match(vault, /tokenHash:\s*binding\.tokenHash/);
  for (const field of ["qrId", "restaurantId", "targetKind", "purposeKey"]) {
    assert.match(vault, new RegExp(`${field}: binding\\.${field}`));
  }
  assert.match(vault, /isCurrentEnvelope \? 2 : 1/);
  assert.doesNotMatch(vault, /catch[\s\S]{0,120}serializeBinding\([\s\S]{0,80},\s*1\)/);
});

test("creation derives target paths server-side and only accepts the default purpose", () => {
  const route = source("app/api/owner/qr-codes/route.ts");
  const store = source("lib/owner/qrStore.ts");
  assert.doesNotMatch(route, /candidate\.targetPath/);
  assert.doesNotMatch(route, /"targetPath"/);
  assert.match(route, /purposeKey !== "default"/);
  assert.match(store, /\.from\("restaurants"\)[\s\S]*\.select\("id, slug"\)/);
  assert.match(store, /targetKind === "admin" \? "\/admin" : buildPublicMenuPath\(restaurantSlug\)/);
  assert.doesNotMatch(store, /const targetPath = sanitizeOwnerQrTargetPath\(args\.targetPath\)/);
});

test("retarget derives the current slug server-side and updates only path plus config version", () => {
  const store = source("lib/owner/qrStore.ts");
  const route = source("app/api/owner/qr-codes/[id]/retarget/route.ts");
  assert.match(route, /expectedConfigVersion/);
  assert.match(store, /export async function retargetOwnerQrCode/);
  assert.match(store, /current\.record\.targetKind === "admin"[\s\S]*"\/admin"[\s\S]*buildPublicMenuPath\(restaurantSlug\)/);
  assert.match(store, /\.update\(\{[\s\S]*target_path:\s*targetPath,[\s\S]*config_version:\s*args\.expectedConfigVersion \+ 1[\s\S]*\}\)/);
  assert.match(store, /\.eq\("config_version", args\.expectedConfigVersion\)/);
  assert.doesNotMatch(route, /targetPath|slug/);
  assert.match(route, /\{ current: result\.current \}/);
});

test("config updates use config_version CAS and routes map stale writes to 409", () => {
  const store = source("lib/owner/qrStore.ts");
  const route = source("app/api/owner/qr-codes/[id]/route.ts");
  assert.match(store, /config_version:\s*patch\.expectedConfigVersion \+ 1/);
  assert.match(store, /\.eq\("config_version", patch\.expectedConfigVersion\)/);
  assert.match(route, /expectedConfigVersion/);
  assert.match(route, /updated\.code === "config-version-conflict"[\s\S]*\? 409/);
  assert.match(route, /\{ current: updated\.current \}/);
  assert.match(store, /current:\s*mapInventoryRow/);
});

test("rotation requires UUID idempotency, explicit previousDisposition, confirmation, and expected version", () => {
  const store = source("lib/owner/qrStore.ts");
  const route = source("app/api/owner/qr-codes/[id]/rotate/route.ts");
  for (const field of ["confirmed", "idempotencyKey", "previousDisposition", "expectedConfigVersion"]) {
    assert.match(route, new RegExp(field));
  }
  assert.match(store, /p_rotation_request_id:\s*args\.idempotencyKey/);
  assert.match(store, /p_disposition:\s*args\.previousDisposition/);
  assert.doesNotMatch(route, /candidate\.disposition/);
  assert.match(store, /recoverCompletedRotation/);
  assert.match(store, /"idempotency-conflict"/);
  assert.match(route, /rotated\.code === "idempotency-conflict"/);
});

test("the allowlisted status endpoint aligns lifecycle actions with DB RPCs and never deletes history", () => {
  const store = source("lib/owner/qrStore.ts");
  const route = source("app/api/owner/qr-codes/[id]/status/route.ts");
  const handler = source("app/api/owner/qr-codes/[id]/lifecycleRoute.ts");
  for (const action of ["pause", "resume", "archive", "revoke"]) {
    assert.match(handler, new RegExp(`"${action}"`));
  }
  assert.match(route, /handleQrLifecycleMutation/);
  assert.match(handler, /ACTIONS\.has/);
  assert.match(store, /owner_set_canonical_qr_lifecycle/);
  assert.match(store, /owner_clear_canonical_qr/);
  assert.doesNotMatch(store, /\.delete\s*\(/);
});

test("historical inventory is metadata-only and excludes every token/vault field", () => {
  const store = source("lib/owner/qrStore.ts");
  const inventory = source("app/api/owner/qr-codes/inventory/route.ts");
  const columns = store.match(/const INVENTORY_COLUMNS = \[([\s\S]*?)\]\.join/)?.[1] ?? "";
  for (const secret of ["token_hash", "token_preview", "token_ciphertext", "token_nonce", "token_key_version"]) {
    assert.doesNotMatch(columns, new RegExp(secret));
  }
  assert.doesNotMatch(inventory, /redirectUrl|tokenPreview|token_hash|ciphertext|nonce/i);
});

test("every owner QR route applies private no-store and structured errors", () => {
  const paths = [
    "app/api/owner/qr-codes/route.ts",
    "app/api/owner/qr-codes/[id]/route.ts",
    "app/api/owner/qr-codes/[id]/rotate/route.ts",
    "app/api/owner/qr-codes/[id]/retarget/route.ts",
    "app/api/owner/qr-codes/[id]/lifecycleRoute.ts",
    "app/api/owner/qr-codes/inventory/route.ts"
  ];
  for (const path of paths) {
    const route = source(path);
    assert.match(route, /private, no-store, max-age=0/, path);
    assert.match(route, /code:/, path);
    assert.doesNotMatch(route, /error\.message|error\.details|error\.hint/, path);
  }
});
