import { createHash } from "node:crypto";

export type QrLookupResult = "matched" | "missed" | "error";
export type QrFailureReason =
  | "not-found-or-inactive"
  | "admin-session-secret-missing"
  | "admin-session-creation-failed";

type QrResolutionDiagnosticInput = {
  token: string;
  requestUrl: string;
  environment: string;
  lookupResult: QrLookupResult;
  failureReason: QrFailureReason;
};

export function createQrResolutionDiagnostic(input: QrResolutionDiagnosticInput) {
  let host = "invalid-host";
  try {
    host = new URL(input.requestUrl).host;
  } catch {
    // Keep a normalized sentinel; never include the untrusted URL in logs.
  }

  return {
    tokenFingerprint: createHash("sha256").update(input.token).digest("hex").slice(0, 12),
    tokenLength: input.token.length,
    environment: input.environment || "unknown",
    host,
    lookupResult: input.lookupResult,
    failureReason: input.failureReason
  };
}

export function logQrResolutionFailure(input: QrResolutionDiagnosticInput): void {
  if (process.env.VISTAIRE_QR_DIAGNOSTICS !== "1") return;
  console.warn("[Vistaire QR] resolution failure", createQrResolutionDiagnostic(input));
}
