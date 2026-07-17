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

const ACTIVE_KEY_VERSION_ENV = "VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION";
const KEY_RING_ENV = "VISTAIRE_QR_TOKEN_KEY_RING";
const KEY_LENGTH_BYTES = 32;
const NONCE_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

const CONFIGURATION_ERROR = "QR token vault configuration is invalid.";
const ENCRYPTION_ERROR = "QR token vault encryption failed.";
const DECRYPTION_ERROR = "QR token vault decryption failed.";

function failConfiguration(): never {
  throw new Error(CONFIGURATION_ERROR);
}

function isVersion(value: unknown): value is string {
  return typeof value === "string" && VERSION_PATTERN.test(value);
}

function decodeBase64url(value: unknown, expectedLength?: number): Buffer {
  if (typeof value !== "string" || !BASE64URL_PATTERN.test(value)) {
    failConfiguration();
  }

  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.toString("base64url") !== value ||
    (expectedLength !== undefined && decoded.length !== expectedLength)
  ) {
    failConfiguration();
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
    failConfiguration();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedKeyRing);
  } catch {
    failConfiguration();
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.getPrototypeOf(parsed) !== Object.prototype ||
    JSON.stringify(parsed) !== serializedKeyRing
  ) {
    failConfiguration();
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) {
    failConfiguration();
  }

  const keys = new Map<string, Buffer>();
  for (const [version, encodedKey] of entries) {
    if (!isVersion(version)) {
      failConfiguration();
    }
    keys.set(version, decodeBase64url(encodedKey, KEY_LENGTH_BYTES));
  }

  if (!keys.has(activeVersion)) {
    failConfiguration();
  }

  return { activeVersion, keys };
}

function serializeBinding(binding: QrTokenVaultBinding): Buffer {
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
    failConfiguration();
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
      throw new Error(ENCRYPTION_ERROR);
    }

    const { activeVersion, keys } = readKeyRing();
    const key = keys.get(activeVersion);
    if (!key) {
      throw new Error(ENCRYPTION_ERROR);
    }

    const nonce = randomBytes(NONCE_LENGTH_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, nonce, {
      authTagLength: AUTH_TAG_LENGTH_BYTES
    });
    cipher.setAAD(serializeBinding(binding));

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
  } catch {
    throw new Error(ENCRYPTION_ERROR);
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
      throw new Error(DECRYPTION_ERROR);
    }

    const { keys } = readKeyRing();
    const key = keys.get(envelope.keyVersion);
    if (!key) {
      throw new Error(DECRYPTION_ERROR);
    }

    const nonce = decodeBase64url(envelope.nonce, NONCE_LENGTH_BYTES);
    const encodedCiphertext = decodeBase64url(envelope.ciphertext);
    if (encodedCiphertext.length <= AUTH_TAG_LENGTH_BYTES) {
      throw new Error(DECRYPTION_ERROR);
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
    decipher.setAAD(serializeBinding(binding));
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new Error(DECRYPTION_ERROR);
  }
}
