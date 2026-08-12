export type AvailabilitySchedulingCapability =
  | { kind: "available"; schemaVersion: 1; workerLastSuccessAt: string }
  | { kind: "unavailable"; reason: "feature-disabled" | "schema-not-deployed" | "rpc-version-mismatch" | "worker-not-active" }
  | { kind: "error"; retryable: boolean };

export type AvailabilityScheduleRequest = Readonly<{
  dishId: string;
  available: boolean;
  scheduledLocalDate: string;
  scheduledLocalTime: string;
  dstDisambiguation?: "earlier" | "later";
  idempotencyKey: string;
}>;

export type AvailabilityCapabilityRow = Readonly<{
  schemaVersion: number;
  workerLastSuccessAt: string | null;
  workerLastAttemptAt?: string | null;
}>;
