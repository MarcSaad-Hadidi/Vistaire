export type AvailabilitySchedulingCapability =
  | { kind: "available"; schemaVersion: 1; workerLastSuccessAt: string }
  | { kind: "unavailable"; reason: "feature-disabled" | "schema-not-deployed" | "rpc-version-mismatch" | "worker-not-active" | "write-access-required" }
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

export type AvailabilityScheduleItem = Readonly<{
  id: string;
  dishId: string;
  finalAvailable: boolean;
  scheduledFor: string;
  timezone: string;
  status: "pending" | "cancelled" | "applied" | "failed";
}>;

export type AvailabilityHistoryItem = Readonly<{
  id: string;
  dishId: string;
  previousAvailable: boolean;
  finalAvailable: boolean;
  actorKind: "admin_qr" | "schedule_worker";
  createdAt: string;
}>;

export type AvailabilityOperationsState =
  | Readonly<{ kind: "available"; schedules: readonly AvailabilityScheduleItem[]; history: readonly AvailabilityHistoryItem[] }>
  | Readonly<{ kind: "unavailable"; reason: "schema-not-deployed" | "feature-disabled" }>
  | Readonly<{ kind: "error"; retryable: boolean }>;
