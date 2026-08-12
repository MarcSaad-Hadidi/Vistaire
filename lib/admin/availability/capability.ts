import type { AvailabilityCapabilityRow, AvailabilitySchedulingCapability } from "./contracts.ts";

export const AVAILABILITY_WORKER_TTL_MS = 10 * 60 * 1000;

export async function detectAvailabilitySchedulingCapability(input: {
  enabled: boolean;
  now?: () => Date;
  ttlMs?: number;
  readCapability: () => Promise<AvailabilityCapabilityRow | null>;
}): Promise<AvailabilitySchedulingCapability> {
  if (!input.enabled) return { kind: "unavailable", reason: "feature-disabled" };
  try {
    const row = await input.readCapability();
    if (!row) return { kind: "unavailable", reason: "schema-not-deployed" };
    if (row.schemaVersion !== 1) return { kind: "unavailable", reason: "rpc-version-mismatch" };
    const value = row.workerLastSuccessAt;
    const successMs = typeof value === "string" ? Date.parse(value) : Number.NaN;
    const nowMs = (input.now?.() ?? new Date()).getTime();
    const age = nowMs - successMs;
    if (!Number.isFinite(successMs) || age < 0 || age > (input.ttlMs ?? AVAILABILITY_WORKER_TTL_MS)) {
      return { kind: "unavailable", reason: "worker-not-active" };
    }
    return { kind: "available", schemaVersion: 1, workerLastSuccessAt: value as string };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    return { kind: "error", retryable: code !== "42501" };
  }
}
