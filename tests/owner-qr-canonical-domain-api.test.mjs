import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical store consumes the planned vault and RPC interfaces without secret upserts", () => {
  const store = source("lib/owner/qrStore.ts");

  assert.match(store, /\bencryptQrToken\b/);
  assert.match(store, /\bdecryptQrToken\b/);
  assert.match(store, /configuration-missing/);
  assert.match(store, /token-unrecoverable/);
  assert.match(store, /owner_get_or_create_canonical_qr/);
  assert.match(store, /owner_rotate_canonical_qr/);
  assert.doesNotMatch(store, /\.upsert\s*\(/);
  assert.match(store, /canonical-unrecoverable/);
});

test("RPC winners are explicitly mapped as canonical before vault recovery", () => {
  const store = source("lib/owner/qrStore.ts");

  assert.match(
    store,
    /recoverCanonicalRecord\(\{\s*\.\.\.row,\s*is_canonical:\s*true\s*\}\)/
  );
  assert.match(
    store,
    /recoverCanonicalRecord\(\{\s*\.\.\.\(currentRow as unknown as AnyRow\),\s*is_canonical:\s*true\s*\}\)/
  );
});

test("owner collection route provides read-only GET and stable POST status semantics", () => {
  const route = source("app/api/owner/qr-codes/route.ts");

  assert.match(route, /export async function GET/);
  assert.match(route, /private,\s*no-store,\s*max-age=0/);
  assert.match(route, /created\.created\s*\?\s*201\s*:\s*200/);
  assert.doesNotMatch(route, /\btoken\s*:/);
  assert.match(route, /!restaurantId[\s\S]{0,120}!targetKind/);
});

test("owner PATCH rejects unknown or empty payloads and only forwards label/style", () => {
  const route = source("app/api/owner/qr-codes/[id]/route.ts");
  const store = source("lib/owner/qrStore.ts");

  assert.match(route, /PATCH_ALLOWED_KEYS/);
  assert.match(route, /Object\.keys\(candidate\)\.length\s*===\s*0/);
  assert.match(route, /Object\.keys\(candidate\.style\)\.length\s*===\s*0/);
  assert.doesNotMatch(route, /\bcandidate\.status\b/);
  assert.match(route, /\{\s*\.\.\.\(candidate\.style/);
  assert.match(route, /\.\.\.\(typeof candidate\.label/);
  const recoveryIndex = store.indexOf("const current = await recoverCanonicalRecord");
  const updateIndex = store.indexOf(".update(update)", recoveryIndex);
  assert.ok(recoveryIndex >= 0 && updateIndex > recoveryIndex);
  assert.match(
    store.slice(updateIndex, updateIndex + 300),
    /\.eq\("is_canonical", true\)/
  );
});

test("owner rotation is a distinct confirmed mutation", () => {
  const route = source("app/api/owner/qr-codes/[id]/rotate/route.ts");
  const store = source("lib/owner/qrStore.ts");

  assert.match(route, /candidate\.confirmed\s*!==\s*true/);
  assert.match(route, /rotateOwnerQrCode/);
  assert.doesNotMatch(route, /\btoken\s*:/);
  assert.match(store, /delete previousResponse\.redirectUrl/);
});

test("canonical public types expose recovery and never expose a raw token result", () => {
  const types = source("lib/owner/types.ts");
  const core = source("lib/owner/qrCreationCore.ts");

  assert.match(types, /type OwnerQrCanonicalRead/);
  assert.match(types, /recoverable:\s*boolean/);
  assert.match(types, /purposeKey:\s*string/);
  assert.match(types, /isCanonical:\s*boolean/);
  assert.doesNotMatch(types, /\n\s*token:\s*string;/);
  assert.match(core, /token_ciphertext\|token_nonce\|token_key_version/);
});
