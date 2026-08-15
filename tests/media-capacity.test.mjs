import assert from "node:assert/strict";
import test from "node:test";

async function loadCapacityModule() {
  try {
    return await import("../lib/owner/mediaCapacity.ts");
  } catch (error) {
    assert.fail(`media capacity module must load: ${error instanceof Error ? error.message : error}`);
  }
}

function rpcClient(handler) {
  return {
    calls: [],
    async rpc(name, parameters) {
      this.calls.push({ name, parameters });
      return handler(name, parameters);
    }
  };
}

test("media writes are disabled unless the explicit kill switch is enabled", async () => {
  const { mediaWritesEnabled } = await loadCapacityModule();

  assert.equal(mediaWritesEnabled({}), false);
  assert.equal(mediaWritesEnabled({ VISTAIRE_MEDIA_WRITES_ENABLED: "false" }), false);
  assert.equal(mediaWritesEnabled({ VISTAIRE_MEDIA_WRITES_ENABLED: "1" }), false);
  assert.equal(mediaWritesEnabled({ VISTAIRE_MEDIA_WRITES_ENABLED: "true" }), true);
});

test("capacity reservation delegates atomically to the project-scoped RPC", async () => {
  const { reserveMediaCapacity } = await loadCapacityModule();
  const client = rpcClient(async () => ({
    data: {
      status: "reserved",
      reservationId: "11111111-2222-4333-8444-555555555555",
      projectRef: "project-a",
      quotaBytes: 1_000,
      usedBytes: 500,
      activeReservedBytes: 50,
      requestedBytes: 100,
      headroomBytes: 350,
      headroomPercent: 35,
      expiresAt: "2026-08-15T12:05:00.000Z"
    },
    error: null
  }));

  const reservation = await reserveMediaCapacity({
    client,
    projectRef: "project-a",
    reservationKey: "upload:dish-1:source-sha",
    requestedBytes: 100
  });

  assert.equal(reservation.reservationId, "11111111-2222-4333-8444-555555555555");
  assert.deepEqual(client.calls, [{
    name: "reserve_media_capacity",
    parameters: {
      p_project_ref: "project-a",
      p_reservation_key: "upload:dish-1:source-sha",
      p_requested_bytes: 100,
      p_min_headroom_percent: 20
    }
  }]);
});

test("capacity fails closed with 507 for headroom and 503 for unavailable state", async () => {
  const { MediaCapacityError, reserveMediaCapacity } = await loadCapacityModule();
  const insufficient = rpcClient(async () => ({
    data: {
      status: "insufficient",
      projectRef: "project-a",
      quotaBytes: 1_000,
      usedBytes: 750,
      activeReservedBytes: 0,
      requestedBytes: 100,
      headroomBytes: 150,
      headroomPercent: 15
    },
    error: null
  }));
  await assert.rejects(
    reserveMediaCapacity({
      client: insufficient,
      projectRef: "project-a",
      reservationKey: "upload:1",
      requestedBytes: 100
    }),
    (error) => error instanceof MediaCapacityError && error.status === 507
  );

  const unavailableCases = [
    { data: null, error: null },
    { data: { status: "unavailable", reason: "state-missing" }, error: null },
    { data: { status: "reserved", reservationId: "bad" }, error: null },
    { data: null, error: { message: "function missing" } }
  ];
  for (const response of unavailableCases) {
    const client = rpcClient(async () => response);
    await assert.rejects(
      reserveMediaCapacity({
        client,
        projectRef: "project-a",
        reservationKey: "upload:2",
        requestedBytes: 1
      }),
      (error) => error instanceof MediaCapacityError && error.status === 503
    );
  }
});

test("reservation finalization records only newly-created bytes and failures release", async () => {
  const {
    withMediaCapacityReservation
  } = await loadCapacityModule();
  const client = rpcClient(async (name) => {
    if (name === "reserve_media_capacity") {
      return {
        data: {
          status: "reserved",
          reservationId: "11111111-2222-4333-8444-555555555555",
          projectRef: "project-a",
          quotaBytes: 1_000,
          usedBytes: 100,
          activeReservedBytes: 0,
          requestedBytes: 90,
          headroomBytes: 810,
          headroomPercent: 81,
          expiresAt: "2026-08-15T12:05:00.000Z"
        },
        error: null
      };
    }
    return { data: { status: name.startsWith("finalize") ? "finalized" : "released" }, error: null };
  });

  const result = await withMediaCapacityReservation({
    client,
    projectRef: "project-a",
    reservationKey: "upload:3",
    requestedBytes: 90,
    work: async () => ({ value: "ok", newlyCreatedBytes: 40 })
  });
  assert.equal(result, "ok");
  assert.deepEqual(client.calls.at(-1), {
    name: "finalize_media_capacity_reservation",
    parameters: {
      p_project_ref: "project-a",
      p_reservation_id: "11111111-2222-4333-8444-555555555555",
      p_actual_bytes: 40
    }
  });

  client.calls.length = 0;
  await assert.rejects(
    withMediaCapacityReservation({
      client,
      projectRef: "project-a",
      reservationKey: "upload:4",
      requestedBytes: 90,
      work: async () => { throw new Error("storage failed"); }
    }),
    /storage failed/
  );
  assert.equal(client.calls.at(-1).name, "release_media_capacity_reservation");
});

test("a transient finalize response is retried idempotently and never released after writes succeeded", async () => {
  const { withMediaCapacityReservation } = await loadCapacityModule();
  let finalizeAttempts = 0;
  const client = rpcClient(async (name) => {
    if (name === "reserve_media_capacity") {
      return { data: {
        status: "reserved",
        reservationId: "11111111-2222-4333-8444-555555555555",
        projectRef: "project-a",
        quotaBytes: 1_000,
        usedBytes: 100,
        activeReservedBytes: 0,
        requestedBytes: 10,
        headroomBytes: 890,
        headroomPercent: 89,
        expiresAt: "2026-08-15T12:05:00.000Z"
      }, error: null };
    }
    if (name === "finalize_media_capacity_reservation") {
      finalizeAttempts += 1;
      return finalizeAttempts === 1
        ? { data: null, error: { message: "ambiguous network response" } }
        : { data: { status: "finalized" }, error: null };
    }
    return { data: { status: "released" }, error: null };
  });

  const value = await withMediaCapacityReservation({
    client,
    projectRef: "project-a",
    reservationKey: "upload:retry-finalize",
    requestedBytes: 10,
    work: async () => ({ value: "committed", newlyCreatedBytes: 10 })
  });
  assert.equal(value, "committed");
  assert.equal(finalizeAttempts, 2);
  assert.equal(client.calls.some((call) => call.name === "release_media_capacity_reservation"), false);
});
