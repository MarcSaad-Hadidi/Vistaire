import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import path from "node:path";

function dependencyRequire() {
  const localRequire = createRequire(import.meta.url);
  try {
    localRequire.resolve("typescript");
    return localRequire;
  } catch {
    const commonGitDir = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: process.cwd(), encoding: "utf8" }
    ).trim();
    return createRequire(path.join(path.dirname(commonGitDir), "package.json"));
  }
}

const requireDependency = dependencyRequire();
const ts = requireDependency("typescript");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export%20default%20%7B%7D",
        shortCircuit: true
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      const source = readFileSync(new URL(url), "utf8");
      return {
        format: "module",
        source: ts.transpileModule(source, {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022
          }
        }).outputText,
        shortCircuit: true
      };
    }
    return nextLoad(url, context);
  }
});

const ACTIVE_VERSION_ENV = "VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION";
const KEY_RING_ENV = "VISTAIRE_QR_TOKEN_KEY_RING";
const originalActiveVersion = process.env[ACTIVE_VERSION_ENV];
const originalKeyRing = process.env[KEY_RING_ENV];

const binding = {
  qrId: "11111111-1111-4111-8111-111111111111",
  restaurantId: "22222222-2222-4222-8222-222222222222",
  targetKind: "menu",
  purposeKey: "default"
};

function encodedKey(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

function setKeyRing(activeVersion, entries) {
  process.env[ACTIVE_VERSION_ENV] = activeVersion;
  process.env[KEY_RING_ENV] = JSON.stringify(entries);
}

function restoreEnvironment() {
  if (originalActiveVersion === undefined) {
    delete process.env[ACTIVE_VERSION_ENV];
  } else {
    process.env[ACTIVE_VERSION_ENV] = originalActiveVersion;
  }

  if (originalKeyRing === undefined) {
    delete process.env[KEY_RING_ENV];
  } else {
    process.env[KEY_RING_ENV] = originalKeyRing;
  }
}

function captureError(operation) {
  try {
    operation();
  } catch (error) {
    return error;
  }
  assert.fail("Expected operation to throw");
}

function assertVaultError(error, expectedCode) {
  assert.equal(error?.name, "QrTokenVaultError");
  assert.equal(error?.code, expectedCode);
  assert.equal(typeof error?.message, "string");
  assert.match(error.message, /vault/i);
  assert.equal("cause" in error, false);
}

test.after(restoreEnvironment);

const loadVault = () => import("../lib/owner/qrTokenVault.ts");

test("encrypts and decrypts a token with an explicit key version", async () => {
  const { decryptQrToken, encryptQrToken } = await loadVault();
  setKeyRing("v1", { v1: encodedKey() });

  const token = "owner-qr-token-round-trip";
  const envelope = encryptQrToken(token, binding);

  assert.equal(envelope.keyVersion, "v1");
  assert.equal(decryptQrToken(envelope, binding), token);
});

test("uses a fresh 12-byte nonce for every encryption", async () => {
  const { encryptQrToken } = await loadVault();
  setKeyRing("v1", { v1: encodedKey() });

  const first = encryptQrToken("same-token", binding);
  const second = encryptQrToken("same-token", binding);

  assert.notEqual(first.nonce, second.nonce);
  assert.equal(Buffer.from(first.nonce, "base64url").length, 12);
  assert.equal(Buffer.from(second.nonce, "base64url").length, 12);
});

test("rejects altered ciphertext and authentication tags", async () => {
  const { decryptQrToken, encryptQrToken } = await loadVault();
  setKeyRing("v1", { v1: encodedKey() });
  const envelope = encryptQrToken("authenticated-token", binding);
  const encoded = Buffer.from(envelope.ciphertext, "base64url");

  for (const index of [0, encoded.length - 1]) {
    const altered = Buffer.from(encoded);
    altered[index] ^= 0x01;
    assert.throws(
      () =>
        decryptQrToken(
          { ...envelope, ciphertext: altered.toString("base64url") },
          binding
        ),
      /vault/i
    );
  }
});

test("rejects the wrong key and every altered AAD binding field", async () => {
  const { decryptQrToken, encryptQrToken } = await loadVault();
  const originalKey = encodedKey();
  setKeyRing("v1", { v1: originalKey });
  const envelope = encryptQrToken("binding-protected-token", binding);

  setKeyRing("v1", { v1: encodedKey() });
  assert.throws(() => decryptQrToken(envelope, binding), /vault/i);

  setKeyRing("v1", { v1: originalKey });
  for (const alteredBinding of [
    { ...binding, qrId: `${binding.qrId}-other` },
    { ...binding, restaurantId: `${binding.restaurantId}-other` },
    { ...binding, targetKind: "admin" },
    { ...binding, purposeKey: "other" }
  ]) {
    assert.throws(
      () => decryptQrToken(envelope, alteredBinding),
      /vault/i
    );
  }
});

test("rejects nonce encodings that are not exactly 12 bytes", async () => {
  const { decryptQrToken, encryptQrToken } = await loadVault();
  setKeyRing("v1", { v1: encodedKey() });
  const envelope = encryptQrToken("nonce-protected-token", binding);

  for (const byteLength of [11, 13]) {
    assert.throws(
      () =>
        decryptQrToken(
          { ...envelope, nonce: randomBytes(byteLength).toString("base64url") },
          binding
        ),
      /vault/i
    );
  }
});

test("rejects unknown key versions and non-32-byte keys without fallback", async () => {
  const { decryptQrToken, encryptQrToken } = await loadVault();
  setKeyRing("v1", { v1: encodedKey() });
  const envelope = encryptQrToken("strict-key-token", binding);

  assert.throws(
    () => decryptQrToken({ ...envelope, keyVersion: "unknown" }, binding),
    /vault/i
  );

  for (const byteLength of [31, 33]) {
    setKeyRing("v1", { v1: encodedKey(byteLength) });
    assert.throws(() => encryptQrToken("strict-key-token", binding), /vault/i);
  }
});

test("decrypts historical envelopes after the active key rotates", async () => {
  const { decryptQrToken, encryptQrToken } = await loadVault();
  const v1Key = encodedKey();
  const v2Key = encodedKey();

  setKeyRing("v1", { v1: v1Key });
  const historicalEnvelope = encryptQrToken("historical-token", binding);

  setKeyRing("v2", { v1: v1Key, v2: v2Key });
  const currentEnvelope = encryptQrToken("current-token", binding);

  assert.equal(currentEnvelope.keyVersion, "v2");
  assert.equal(
    decryptQrToken(historicalEnvelope, binding),
    "historical-token"
  );
  assert.equal(decryptQrToken(currentEnvelope, binding), "current-token");
});

test("strictly rejects malformed configuration and envelope encodings", async () => {
  const { decryptQrToken, encryptQrToken } = await loadVault();
  const canonicalKey = encodedKey();

  for (const invalidConfig of [
    { active: "", ring: JSON.stringify({ v1: canonicalKey }) },
    { active: "v1", ring: "" },
    { active: "v1", ring: "not-json" },
    { active: "v1", ring: JSON.stringify({ v2: canonicalKey }) },
    {
      active: "v1",
      ring: `{"v1":"${canonicalKey}","v1":"${encodedKey()}"}`
    },
    { active: "v1", ring: JSON.stringify({ v1: `${canonicalKey}=` }) }
  ]) {
    process.env[ACTIVE_VERSION_ENV] = invalidConfig.active;
    process.env[KEY_RING_ENV] = invalidConfig.ring;
    assert.throws(() => encryptQrToken("strict-config-token", binding), /vault/i);
  }

  setKeyRing("v1", { v1: canonicalKey });
  const envelope = encryptQrToken("strict-envelope-token", binding);
  assert.throws(
    () => decryptQrToken({ ...envelope, nonce: `${envelope.nonce}=` }, binding),
    /vault/i
  );
  assert.throws(
    () =>
      decryptQrToken(
        { ...envelope, ciphertext: `${envelope.ciphertext}=` },
        binding
      ),
    /vault/i
  );
});

test("exposes configuration-missing for unavailable or unusable key material", async () => {
  const {
    QrTokenVaultError,
    decryptQrToken,
    encryptQrToken
  } = await loadVault();
  assert.equal(typeof QrTokenVaultError, "function");

  const key = encodedKey();
  setKeyRing("v1", { v1: key });
  const envelope = encryptQrToken("configuration-classification-token", binding);

  delete process.env[ACTIVE_VERSION_ENV];
  assertVaultError(
    captureError(() => encryptQrToken("new-token", binding)),
    "configuration-missing"
  );
  assertVaultError(
    captureError(() => decryptQrToken(envelope, binding)),
    "configuration-missing"
  );

  process.env[ACTIVE_VERSION_ENV] = "v1";
  process.env[KEY_RING_ENV] = "not-json";
  assertVaultError(
    captureError(() => decryptQrToken(envelope, binding)),
    "configuration-missing"
  );

  setKeyRing("v2", { v2: encodedKey() });
  assertVaultError(
    captureError(() => decryptQrToken(envelope, binding)),
    "configuration-missing"
  );
});

test("exposes token-unrecoverable for invalid authenticated envelopes", async () => {
  const { decryptQrToken, encryptQrToken } = await loadVault();
  const key = encodedKey();
  setKeyRing("v1", { v1: key });
  const envelope = encryptQrToken("unrecoverable-token", binding);
  const alteredCiphertext = Buffer.from(envelope.ciphertext, "base64url");
  alteredCiphertext[0] ^= 0x01;

  for (const operation of [
    () =>
      decryptQrToken(
        { ...envelope, ciphertext: alteredCiphertext.toString("base64url") },
        binding
      ),
    () => decryptQrToken(envelope, { ...binding, purposeKey: "wrong" }),
    () =>
      decryptQrToken(
        { ...envelope, nonce: randomBytes(11).toString("base64url") },
        binding
      )
  ]) {
    assertVaultError(captureError(operation), "token-unrecoverable");
  }

  setKeyRing("v1", { v1: encodedKey() });
  assertVaultError(
    captureError(() => decryptQrToken(envelope, binding)),
    "token-unrecoverable"
  );
});

test("exposes encryption-failed for invalid encryption inputs", async () => {
  const { encryptQrToken } = await loadVault();
  setKeyRing("v1", { v1: encodedKey() });

  assertVaultError(
    captureError(() => encryptQrToken("", binding)),
    "encryption-failed"
  );
  assertVaultError(
    captureError(() =>
      encryptQrToken("token", { ...binding, purposeKey: "" })
    ),
    "encryption-failed"
  );
});

test("errors and logs never expose token, binding, key, nonce, or ciphertext", async () => {
  const { decryptQrToken, encryptQrToken } = await loadVault();
  const key = encodedKey();
  const token = "token-that-must-never-leak";
  setKeyRing("v1", { v1: key });
  const envelope = encryptQrToken(token, binding);
  const logged = [];
  const originalMethods = new Map();

  for (const method of ["debug", "error", "info", "log", "warn"]) {
    originalMethods.set(method, console[method]);
    console[method] = (...values) => logged.push(values.join(" "));
  }

  let thrown;
  try {
    decryptQrToken(envelope, { ...binding, purposeKey: "wrong-purpose" });
  } catch (error) {
    thrown = error;
  } finally {
    for (const [method, original] of originalMethods) {
      console[method] = original;
    }
  }

  assert.ok(thrown instanceof Error);
  const exposedText = [thrown.message, ...logged].join("\n");
  for (const secret of [
    token,
    key,
    envelope.nonce,
    envelope.ciphertext,
    binding.qrId,
    binding.restaurantId,
    binding.purposeKey
  ]) {
    assert.doesNotMatch(exposedText, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.deepEqual(logged, []);
});
