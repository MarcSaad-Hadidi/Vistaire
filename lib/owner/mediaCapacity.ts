import { randomUUID } from "node:crypto";

const MIN_HEADROOM_PERCENT = 20;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 60_000;
const SHA_OR_KEY_PATTERN = /^[a-z0-9][a-z0-9:._/-]{0,511}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RpcClient = {
  rpc: (
    name: string,
    parameters: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

export type MediaCapacityReservation = {
  reservationId: string;
  projectRef: string;
  quotaBytes: number;
  usedBytes: number;
  activeReservedBytes: number;
  requestedBytes: number;
  headroomBytes: number;
  headroomPercent: number;
  expiresAt: string;
};

export class MediaCapacityError extends Error {
  readonly status: 503 | 507;
  readonly reason: string;

  constructor(status: 503 | 507, reason: string, message: string) {
    super(message);
    this.name = "MediaCapacityError";
    this.status = status;
    this.reason = reason;
  }
}

export class MediaCapacityWorkError extends Error {
  readonly retainedBytes: number;

  constructor(message: string, retainedBytes: number) {
    super(message);
    this.name = "MediaCapacityWorkError";
    if (!Number.isSafeInteger(retainedBytes) || retainedBytes < 0) {
      throw new TypeError("retainedBytes must be a non-negative safe integer");
    }
    this.retainedBytes = retainedBytes;
  }
}

export function mediaWritesEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.VISTAIRE_MEDIA_WRITES_ENABLED === "true";
}

function recordFromRpc(data: unknown): Record<string, unknown> | null {
  const value = Array.isArray(data) ? data[0] : data;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteInteger(value: unknown, minimum = 0): number | null {
  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue >= minimum
    ? numberValue
    : null;
}

function finitePercent(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 && numberValue <= 100
    ? numberValue
    : null;
}

function unavailable(reason: string): MediaCapacityError {
  return new MediaCapacityError(
    503,
    reason,
    "Capacité média indisponible; aucune écriture n'a été effectuée."
  );
}

export async function reserveMediaCapacity(args: {
  client: RpcClient;
  projectRef: string;
  reservationKey: string;
  requestedBytes: number;
  minHeadroomPercent?: number;
}): Promise<MediaCapacityReservation> {
  const projectRef = args.projectRef.trim().toLowerCase();
  const reservationKey = args.reservationKey.trim();
  const requestedBytes = finiteInteger(args.requestedBytes);
  const minHeadroomPercent = args.minHeadroomPercent ?? MIN_HEADROOM_PERCENT;
  if (
    !projectRef ||
    !SHA_OR_KEY_PATTERN.test(projectRef) ||
    !SHA_OR_KEY_PATTERN.test(reservationKey) ||
    requestedBytes === null ||
    !Number.isFinite(minHeadroomPercent) ||
    minHeadroomPercent < MIN_HEADROOM_PERCENT ||
    minHeadroomPercent >= 100
  ) {
    throw unavailable("invalid-capacity-request");
  }

  let response: Awaited<ReturnType<RpcClient["rpc"]>>;
  try {
    response = await args.client.rpc("reserve_media_capacity", {
      p_project_ref: projectRef,
      p_reservation_key: reservationKey,
      p_requested_bytes: requestedBytes,
      p_min_headroom_percent: minHeadroomPercent
    });
  } catch {
    throw unavailable("reservation-rpc-unavailable");
  }
  if (response.error) throw unavailable("reservation-rpc-error");
  const value = recordFromRpc(response.data);
  if (!value) throw unavailable("reservation-response-missing");
  const status = String(value.status ?? "");
  if (status === "insufficient") {
    throw new MediaCapacityError(
      507,
      "insufficient-headroom",
      "Capacité média insuffisante: au moins 20 % de marge doit rester disponible."
    );
  }
  if (status !== "reserved") {
    throw unavailable(String(value.reason ?? "capacity-state-unavailable"));
  }

  const reservationId = String(value.reservationId ?? "");
  const responseProjectRef = String(value.projectRef ?? "").toLowerCase();
  const quotaBytes = finiteInteger(value.quotaBytes, 1);
  const usedBytes = finiteInteger(value.usedBytes);
  const activeReservedBytes = finiteInteger(value.activeReservedBytes);
  const responseRequestedBytes = finiteInteger(value.requestedBytes);
  const headroomBytes = finiteInteger(value.headroomBytes);
  const headroomPercent = finitePercent(value.headroomPercent);
  const expiresAt = String(value.expiresAt ?? "");
  if (
    !UUID_PATTERN.test(reservationId) ||
    responseProjectRef !== projectRef ||
    quotaBytes === null ||
    usedBytes === null ||
    activeReservedBytes === null ||
    responseRequestedBytes !== requestedBytes ||
    headroomBytes === null ||
    headroomPercent === null ||
    !Number.isFinite(Date.parse(expiresAt))
  ) {
    throw unavailable("invalid-reservation-response");
  }

  return {
    reservationId,
    projectRef: responseProjectRef,
    quotaBytes,
    usedBytes,
    activeReservedBytes,
    requestedBytes: responseRequestedBytes,
    headroomBytes,
    headroomPercent,
    expiresAt
  };
}

async function settleReservation(args: {
  client: RpcClient;
  rpc: "finalize_media_capacity_reservation" | "release_media_capacity_reservation";
  projectRef: string;
  reservationId: string;
  actualBytes?: number;
}): Promise<void> {
  const parameters: Record<string, unknown> = {
    p_project_ref: args.projectRef,
    p_reservation_id: args.reservationId
  };
  if (args.rpc === "finalize_media_capacity_reservation") {
    const actualBytes = finiteInteger(args.actualBytes);
    if (actualBytes === null) throw unavailable("invalid-finalize-bytes");
    parameters.p_actual_bytes = actualBytes;
  }
  let response: Awaited<ReturnType<RpcClient["rpc"]>>;
  try {
    response = await args.client.rpc(args.rpc, parameters);
  } catch {
    throw unavailable("reservation-settlement-unavailable");
  }
  const value = recordFromRpc(response.data);
  const expected = args.rpc.startsWith("finalize") ? "finalized" : "released";
  if (response.error || !value || value.status !== expected) {
    throw unavailable("reservation-settlement-failed");
  }
}

export function finalizeMediaCapacityReservation(args: {
  client: RpcClient;
  projectRef: string;
  reservationId: string;
  actualBytes: number;
}): Promise<void> {
  return settleReservation({ ...args, rpc: "finalize_media_capacity_reservation" });
}

export function releaseMediaCapacityReservation(args: {
  client: RpcClient;
  projectRef: string;
  reservationId: string;
}): Promise<void> {
  return settleReservation({ ...args, rpc: "release_media_capacity_reservation" });
}

export async function renewMediaCapacityReservation(args: {
  client: RpcClient;
  projectRef: string;
  reservationId: string;
}): Promise<string> {
  let response: Awaited<ReturnType<RpcClient["rpc"]>>;
  try {
    response = await args.client.rpc("renew_media_capacity_reservation", {
      p_project_ref: args.projectRef,
      p_reservation_id: args.reservationId
    });
  } catch {
    throw unavailable("reservation-renewal-unavailable");
  }
  const value = recordFromRpc(response.data);
  const expiresAt = String(value?.expiresAt ?? "");
  if (
    response.error ||
    !value ||
    value.status !== "renewed" ||
    !Number.isFinite(Date.parse(expiresAt))
  ) {
    throw unavailable("reservation-renewal-failed");
  }
  return expiresAt;
}

export function createMediaCapacityReservationAttemptKey(
  reservationKey: string,
  attemptId: string = randomUUID()
): string {
  const baseKey = reservationKey.trim();
  const normalizedAttemptId = attemptId.trim().toLowerCase();
  const ownedKey = `${baseKey}:attempt:${normalizedAttemptId}`;
  if (
    !SHA_OR_KEY_PATTERN.test(baseKey) ||
    !UUID_PATTERN.test(normalizedAttemptId) ||
    !SHA_OR_KEY_PATTERN.test(ownedKey)
  ) {
    throw unavailable("invalid-capacity-attempt-key");
  }
  return ownedKey;
}

async function finalizeRetainedBytes(args: {
  client: RpcClient;
  projectRef: string;
  reservationId: string;
  actualBytes: number;
}): Promise<void> {
  try {
    await finalizeMediaCapacityReservation(args);
  } catch {
    // The first response may have been lost after PostgreSQL committed. A
    // second identical call is safe; if it is also ambiguous the reservation
    // remains active and counted until explicit reconciliation.
    await finalizeMediaCapacityReservation(args);
  }
}

export async function withMediaCapacityReservation<T>(args: {
  client: RpcClient;
  projectRef: string;
  reservationKey: string;
  reservationAttemptId?: string;
  requestedBytes: number;
  heartbeatIntervalMs?: number;
  work: (reservation: MediaCapacityReservation) => Promise<{
    value: T;
    newlyCreatedBytes: number;
  }>;
}): Promise<T> {
  const heartbeatIntervalMs = args.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  if (
    !Number.isSafeInteger(heartbeatIntervalMs) ||
    heartbeatIntervalMs < 1 ||
    heartbeatIntervalMs > 240_000
  ) {
    throw unavailable("invalid-heartbeat-interval");
  }
  const reservation = await reserveMediaCapacity({
    ...args,
    reservationKey: createMediaCapacityReservationAttemptKey(
      args.reservationKey,
      args.reservationAttemptId
    )
  });
  let heartbeatPromise: Promise<void> | null = null;
  let heartbeatError: unknown;
  const heartbeat = () => {
    if (heartbeatPromise || heartbeatError) return;
    heartbeatPromise = renewMediaCapacityReservation({
      client: args.client,
      projectRef: reservation.projectRef,
      reservationId: reservation.reservationId
    }).then(() => undefined).catch((error) => {
      heartbeatError = error;
    }).finally(() => {
      heartbeatPromise = null;
    });
  };
  const heartbeatTimer = setInterval(heartbeat, heartbeatIntervalMs);
  heartbeatTimer.unref?.();
  let result: { value: T; newlyCreatedBytes: number };
  try {
    result = await args.work(reservation);
  } catch (error) {
    clearInterval(heartbeatTimer);
    if (heartbeatPromise) await heartbeatPromise;
    const retainedBytes = error instanceof MediaCapacityWorkError
      ? error.retainedBytes
      : 0;
    try {
      if (retainedBytes > 0) {
        await finalizeRetainedBytes({
          client: args.client,
          projectRef: reservation.projectRef,
          reservationId: reservation.reservationId,
          actualBytes: retainedBytes
        });
      } else {
        await releaseMediaCapacityReservation({
          client: args.client,
          projectRef: reservation.projectRef,
          reservationId: reservation.reservationId
        });
      }
    } catch (settlementError) {
      if (error instanceof Error) {
        error.message = `${error.message} (capacity settlement failed)`;
      } else {
        throw settlementError;
      }
    }
    throw error;
  }
  clearInterval(heartbeatTimer);
  if (heartbeatPromise) await heartbeatPromise;

  const finalizeArgs = {
    client: args.client,
    projectRef: reservation.projectRef,
    reservationId: reservation.reservationId,
    actualBytes: result.newlyCreatedBytes
  };
  await finalizeRetainedBytes(finalizeArgs);
  return result.value;
}

export const MEDIA_CAPACITY_MIN_HEADROOM_PERCENT = MIN_HEADROOM_PERCENT;
