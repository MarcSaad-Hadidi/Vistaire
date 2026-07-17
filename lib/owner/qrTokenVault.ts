import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";

export type QrTokenVaultBinding = {
  qrId: string;
  restaurantId: string;
  targetKind: "menu" | "admin";
  purposeKey: string;
};

export type QrTokenEnvelope = {
  ciphertext: string;
  nonce: string;
  keyVersion: string;
};

export type QrTokenVaultErrorCode =
  | "configuration-missing"
  | "token-unrecoverable"
  | "encryption-failed";

const ERROR_MESSAGES: Record<QrTokenVaultErrorCode, string> = {
  "configuration-missing": "QR token vault configuration is unavailable.",
  "token-unrecoverable": "QR token vault could not recover the token.",
  "encryption-failed": "QR token vault encryption failed."
};

export class QrTokenVaultError extends Error {
  readonly code: QrTokenVaultErrorCode;

  constructor(code: QrTokenVaultErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "QrTokenVaultError";
    this.code = code;
  }
}

const ACTIVE_KEY_VERSION_ENV = "VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION";
const KEY_RING_ENV = "VISTAIRE_QR_TOKEN_KEY_RING";
const KEY_LENGTH_BYTES = 32;
const NONCE_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function fail(code: QrTokenVaultErrorCode): never {
  throw new QrTokenVaultError(code);
}

function rethrowVaultError(
  error: unknown,
  fallbackCode: QrTokenVaultErrorCode
): never {
  if (error instanceof QrTokenVaultError) {
    throw error;
  }
  fail(fallbackCode);
}

function isVersion(value: unknown): value is string {
  return typeof value === "string" && VERSION_PATTERN.test(value);
}

function decodeBase64url(
  value: unknown,
  errorCode: QrTokenVaultErrorCode,
  expectedLength?: number
): Buffer {
  if (typeof value !== "string" || !BASE64URL_PATTERN.test(value)) {
    fail(errorCode);
  }

  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.toString("base64url") !== value ||
    (expectedLength !== undefined && decoded.length !== expectedLength)
  ) {
    fail(errorCode);
  }

  return decoded;
}

function readKeyRing(): {
  activeVersion: string;
  keys: Map<string, Buffer>;
} {
  const activeVersion = process.env[ACTIVE_KEY_VERSION_ENV];
  const serializedKeyRing = process.env[KEY_RING_ENV];
  if (!isVersion(activeVersion) || !serializedKeyRing) {
    fail("configuration-missing");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedKeyRing);
  } catch {
    fail("configuration-missing");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.getPrototypeOf(parsed) !== Object.prototype ||
    JSON.stringify(parsed) !== serializedKeyRing
  ) {
    fail("configuration-missing");
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) {
    fail("configuration-missing");
  }

  const keys = new Map<string, Buffer>();
  for (const [version, encodedKey] of entries) {
    if (!isVersion(version)) {
      fail("configuration-missing");
    }
    keys.set(
      version,
      decodeBase64url(
        encodedKey,
        "configuration-missing",
        KEY_LENGTH_BYTES
      )
    );
  }

  if (!keys.has(activeVersion)) {
    fail("configuration-missing");
  }

  return { activeVersion, keys };
}

function serializeBinding(
  binding: QrTokenVaultBinding,
  errorCode: QrTokenVaultErrorCode
): Buffer {
  if (
    typeof binding !== "object" ||
    binding === null ||
    typeof binding.qrId !== "string" ||
    binding.qrId.length === 0 ||
    typeof binding.restaurantId !== "string" ||
    binding.restaurantId.length === 0 ||
    (binding.targetKind !== "menu" && binding.targetKind !== "admin") ||
    typeof binding.purposeKey !== "string" ||
    binding.purposeKey.length === 0
  ) {
    fail(errorCode);
  }

  return Buffer.from(
    JSON.stringify({
      qrId: binding.qrId,
      restaurantId: binding.restaurantId,
      targetKind: binding.targetKind,
      purposeKey: binding.purposeKey
    }),
    "utf8"
  );
}

export function encryptQrToken(
  token: string,
  binding: QrTokenVaultBinding
): QrTokenEnvelope {
  try {
    if (typeof token !== "string" || token.length === 0) {
      fail("encryption-failed");
    }

    const { activeVersion, keys } = readKeyRing();
    const key = keys.get(activeVersion);
    if (!key) {
      fail("configuration-missing");
    }

    const nonce = randomBytes(NONCE_LENGTH_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, nonce, {
      authTagLength: AUTH_TAG_LENGTH_BYTES
    });
    cipher.setAAD(serializeBinding(binding, "encryption-failed"));

    const encrypted = Buffer.concat([
      cipher.update(token, "utf8"),
      cipher.final()
    ]);
    const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]);

    return {
      ciphertext: ciphertext.toString("base64url"),
      nonce: nonce.toString("base64url"),
      keyVersion: activeVersion
    };
  } catch (error) {
    rethrowVaultError(error, "encryption-failed");
  }
}

export function decryptQrToken(
  envelope: QrTokenEnvelope,
  binding: QrTokenVaultBinding
): string {
  try {
    if (
      typeof envelope !== "object" ||
      envelope === null ||
      !isVersion(envelope.keyVersion)
    ) {
      fail("token-unrecoverable");
    }

    const { keys } = readKeyRing();
    const key = keys.get(envelope.keyVersion);
    if (!key) {
      fail("configuration-missing");
    }

    const nonce = decodeBase64url(
      envelope.nonce,
      "token-unrecoverable",
      NONCE_LENGTH_BYTES
    );
    const encodedCiphertext = decodeBase64url(
      envelope.ciphertext,
      "token-unrecoverable"
    );
    if (encodedCiphertext.length <= AUTH_TAG_LENGTH_BYTES) {
      fail("token-unrecoverable");
    }

    const encrypted = encodedCiphertext.subarray(
      0,
      encodedCiphertext.length - AUTH_TAG_LENGTH_BYTES
    );
    const authTag = encodedCiphertext.subarray(
      encodedCiphertext.length - AUTH_TAG_LENGTH_BYTES
    );
    const decipher = createDecipheriv("aes-256-gcm", key, nonce, {
      authTagLength: AUTH_TAG_LENGTH_BYTES
    });
    decipher.setAAD(serializeBinding(binding, "token-unrecoverable"));
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString("utf8");
  } catch (error) {
    rethrowVaultError(error, "token-unrecoverable");
  }
}
