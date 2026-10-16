import "server-only";

import { randomBytes } from "node:crypto";

const RUNTIME_SECRET_PROPERTY = "__vistaireLocalAdminPreviewSecret" as const;
const RUNTIME_SECRET_ENV = "VISTAIRE_LOCAL_PREVIEW_RUNTIME_SECRET" as const;
type SecretHolder = { [RUNTIME_SECRET_PROPERTY]?: string };

export function getLocalAdminPreviewSecret(): string | null {
  if (process.env.NODE_ENV === "production") return null;

  const configured = process.env.VISTAIRE_LOCAL_PREVIEW_SECRET;
  if (configured && Buffer.byteLength(configured, "utf8") >= 32) return configured;

  const existingRuntimeSecret = process.env[RUNTIME_SECRET_ENV];
  if (existingRuntimeSecret && Buffer.byteLength(existingRuntimeSecret, "utf8") >= 32) {
    return existingRuntimeSecret;
  }

  // Turbopack can evaluate server modules in separate global contexts. Keep
  // the process environment as the authority shared by those contexts.
  const sharedProcess = process as NodeJS.Process & SecretHolder;
  sharedProcess[RUNTIME_SECRET_PROPERTY] ??= randomBytes(32).toString("base64url");
  process.env[RUNTIME_SECRET_ENV] = sharedProcess[RUNTIME_SECRET_PROPERTY];
  (globalThis as typeof globalThis & SecretHolder)[RUNTIME_SECRET_PROPERTY] =
    sharedProcess[RUNTIME_SECRET_PROPERTY];
  return sharedProcess[RUNTIME_SECRET_PROPERTY];
}
