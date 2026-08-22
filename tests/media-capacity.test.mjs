import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
      const response = await handler(name, parameters);
      if (
        name === "reserve_media_capacity" &&
        response?.data?.status === "reserved"
      ) {
        response.data = {
          operationId: parameters.p_operation_id,
          restaurantId: parameters.p_restaurant_id,
          dishId: parameters.p_dish_id,
          recipeId: parameters.p_recipe_id,
          ...response.data
        };
      }
      return response;
    }
  };
}

const DEFAULT_CAPACITY_CONTEXT = Object.freeze({
  operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  restaurantId: "11111111-1111-4111-8111-111111111111",
  dishId: "22222222-2222-4222-8222-222222222222",
  recipeId: "dish-photo-v2"
});

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
    ...DEFAULT_CAPACITY_CONTEXT,
    requestedBytes: 100
  });

  assert.equal(reservation.reservationId, "11111111-2222-4333-8444-555555555555");
  assert.deepEqual(client.calls, [{
    name: "reserve_media_capacity",
    parameters: {
      p_project_ref: "project-a",
      p_reservation_key: "upload:dish-1:source-sha",
      p_operation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      p_restaurant_id: "11111111-1111-4111-8111-111111111111",
      p_dish_id: "22222222-2222-4222-8222-222222222222",
      p_recipe_id: "dish-photo-v2",
      p_requested_bytes: 100,
      p_min_headroom_percent: 20
    }
  }]);
});

test("capacity accepts storage-safe legacy database ids while keeping operation ids strict", async () => {
  const { MediaCapacityError, reserveMediaCapacity } = await loadCapacityModule();
  const client = rpcClient(async (_name, parameters) => ({
    data: {
      status: "reserved",
      reservationId: "11111111-2222-4333-8444-555555555555",
      projectRef: "project-a",
      quotaBytes: 1_000,
      usedBytes: 100,
      activeReservedBytes: 0,
      requestedBytes: parameters.p_requested_bytes,
      headroomBytes: 890,
      headroomPercent: 89,
      expiresAt: "2026-08-15T12:05:00.000Z"
    },
    error: null
  }));
  const cases = [
    {
      restaurantId: "11111111-1111-1111-1111-111111111111",
      dishId: "22222222-2222-8222-8222-222222222222"
    },
    {
      restaurantId: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
      dishId: "FFFFFFFF-EEEE-8DDD-CCCC-BBBBBBBBBBBB"
    }
  ];

  for (const databaseIds of cases) {
    const operationId = randomUUID();
    const reservation = await reserveMediaCapacity({
      client,
      projectRef: "project-a",
      reservationKey: `upload:${databaseIds.dishId}`,
      operationId,
      ...databaseIds,
      recipeId: "dish-photo-v2",
      requestedBytes: 10
    });
    assert.equal(reservation.operationId, operationId.toLowerCase());
    assert.equal(reservation.restaurantId, databaseIds.restaurantId.toLowerCase());
    assert.equal(reservation.dishId, databaseIds.dishId.toLowerCase());
  }

  await assert.rejects(
    reserveMediaCapacity({
      client,
      projectRef: "project-a",
      reservationKey: "upload:strict-operation",
      ...DEFAULT_CAPACITY_CONTEXT,
      operationId: "11111111-1111-1111-1111-111111111111",
      requestedBytes: 10
    }),
    (error) =>
      error instanceof MediaCapacityError &&
      error.reason === "invalid-capacity-context"
  );
});

test("capacity context is required and invalid values fail before the RPC", async () => {
  const { MediaCapacityError, reserveMediaCapacity } = await loadCapacityModule();
  const client = rpcClient(async () => assert.fail("invalid context must not reach the RPC"));

  const unsafeDatabaseIds = [
    "not-a-uuid",
    "11111111-1111-1111-1111",
    "11111111-1111-1111-1111-111111111111/path",
    "..",
    " 11111111-1111-1111-1111-111111111111",
    "11111111-1111-1111-1111-111111111111 ",
    "11111111-1111-1111-1111-111111111111%2Fpath",
    "https://example.test/11111111-1111-1111-1111-111111111111"
  ];
  for (const context of [
    {},
    { ...DEFAULT_CAPACITY_CONTEXT, operationId: "not-a-uuid" },
    ...unsafeDatabaseIds.map((restaurantId) => ({
      ...DEFAULT_CAPACITY_CONTEXT,
      restaurantId
    })),
    ...unsafeDatabaseIds.map((dishId) => ({
      ...DEFAULT_CAPACITY_CONTEXT,
      dishId
    })),
    { ...DEFAULT_CAPACITY_CONTEXT, recipeId: " dish-photo-v2" }
  ]) {
    await assert.rejects(
      reserveMediaCapacity({
        client,
        projectRef: "project-a",
        reservationKey: "upload:invalid-context",
        requestedBytes: 1,
        ...context
      }),
      (error) => error instanceof MediaCapacityError && error.reason === "invalid-capacity-context"
    );
  }
  assert.equal(client.calls.length, 0);
});

test("capacity fails closed when the persisted reservation context differs", async () => {
  const { MediaCapacityError, reserveMediaCapacity } = await loadCapacityModule();
  const client = rpcClient(async () => ({
    data: {
      status: "reserved",
      reservationId: "11111111-2222-4333-8444-555555555555",
      projectRef: "project-a",
      operationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      quotaBytes: 1_000,
      usedBytes: 100,
      activeReservedBytes: 0,
      requestedBytes: 10,
      headroomBytes: 890,
      headroomPercent: 89,
      expiresAt: "2026-08-15T12:05:00.000Z"
    },
    error: null
  }));

  await assert.rejects(
    reserveMediaCapacity({
      client,
      projectRef: "project-a",
      reservationKey: "upload:context-mismatch",
      ...DEFAULT_CAPACITY_CONTEXT,
      requestedBytes: 10
    }),
    (error) =>
      error instanceof MediaCapacityError &&
      error.reason === "invalid-reservation-response"
  );
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
      ...DEFAULT_CAPACITY_CONTEXT,
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
        ...DEFAULT_CAPACITY_CONTEXT,
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
    ...DEFAULT_CAPACITY_CONTEXT,
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
      ...DEFAULT_CAPACITY_CONTEXT,
      requestedBytes: 90,
      work: async () => { throw new Error("storage failed"); }
    }),
    /storage failed/
  );
  assert.equal(client.calls.at(-1).name, "release_media_capacity_reservation");
});

test("each capacity attempt owns a unique reservation key, including retry after finalization", async () => {
  const { withMediaCapacityReservation } = await loadCapacityModule();
  let reservationSequence = 0;
  const client = rpcClient(async (name, parameters) => {
    if (name === "reserve_media_capacity") {
      reservationSequence += 1;
      return { data: {
        status: "reserved",
        reservationId: `11111111-2222-4333-8444-${String(reservationSequence).padStart(12, "0")}`,
        projectRef: "project-a",
        quotaBytes: 1_000,
        usedBytes: 100,
        activeReservedBytes: 0,
        requestedBytes: parameters.p_requested_bytes,
        headroomBytes: 890,
        headroomPercent: 89,
        expiresAt: "2026-08-15T12:05:00.000Z"
      }, error: null };
    }
    return { data: { status: name.startsWith("finalize") ? "finalized" : "released" }, error: null };
  });

  const run = (operationId) => withMediaCapacityReservation({
    client,
    projectRef: "project-a",
    reservationKey: "upload:same-logical-operation",
    ...DEFAULT_CAPACITY_CONTEXT,
    operationId,
    requestedBytes: 10,
    work: async () => ({ value: "ok", newlyCreatedBytes: 0 })
  });
  await Promise.all([run("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), run("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")]);
  await run("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

  const keys = client.calls
    .filter((call) => call.name === "reserve_media_capacity")
    .map((call) => call.parameters.p_reservation_key);
  assert.equal(new Set(keys).size, 3);
  assert.deepEqual(keys, [
    "upload:same-logical-operation:attempt:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "upload:same-logical-operation:attempt:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "upload:same-logical-operation:attempt:cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  ]);
});

test("long-running work renews its lease and an expired lease can still finalize fail-closed", async () => {
  const { withMediaCapacityReservation } = await loadCapacityModule();
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
        expiresAt: "2000-01-01T00:00:00.000Z"
      }, error: null };
    }
    if (name === "renew_media_capacity_reservation") {
      return { data: { status: "renewed", expiresAt: "2099-01-01T00:00:00.000Z" }, error: null };
    }
    return { data: { status: "finalized" }, error: null };
  });

  await withMediaCapacityReservation({
    client,
    projectRef: "project-a",
    reservationKey: "upload:heartbeat",
    ...DEFAULT_CAPACITY_CONTEXT,
    requestedBytes: 10,
    heartbeatIntervalMs: 5,
    work: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { value: "ok", newlyCreatedBytes: 10 };
    }
  });

  assert.ok(client.calls.some((call) => call.name === "renew_media_capacity_reservation"));
  assert.equal(client.calls.at(-1).name, "finalize_media_capacity_reservation");
});

test("retained objects are finalized durably while confirmed rollback releases", async () => {
  const { MediaCapacityWorkError, withMediaCapacityReservation } = await loadCapacityModule();
  const client = rpcClient(async (name) => {
    if (name === "reserve_media_capacity") {
      return { data: {
        status: "reserved",
        reservationId: "11111111-2222-4333-8444-555555555555",
        projectRef: "project-a",
        quotaBytes: 1_000,
        usedBytes: 100,
        activeReservedBytes: 0,
        requestedBytes: 30,
        headroomBytes: 870,
        headroomPercent: 87,
        expiresAt: "2026-08-15T12:05:00.000Z"
      }, error: null };
    }
    return { data: { status: name.startsWith("finalize") ? "finalized" : "released" }, error: null };
  });

  await assert.rejects(withMediaCapacityReservation({
    client,
    projectRef: "project-a",
    reservationKey: "upload:retained",
    ...DEFAULT_CAPACITY_CONTEXT,
    requestedBytes: 30,
    work: async () => { throw new MediaCapacityWorkError("metadata failed", 17); }
  }), /metadata failed/);

  assert.equal(client.calls.some((call) => call.name === "release_media_capacity_reservation"), false);
  assert.deepEqual(client.calls.at(-1), {
    name: "finalize_media_capacity_reservation",
    parameters: {
      p_project_ref: "project-a",
      p_reservation_id: "11111111-2222-4333-8444-555555555555",
      p_actual_bytes: 17
    }
  });
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
    ...DEFAULT_CAPACITY_CONTEXT,
    requestedBytes: 10,
    work: async () => ({ value: "committed", newlyCreatedBytes: 10 })
  });
  assert.equal(value, "committed");
  assert.equal(finalizeAttempts, 2);
  assert.equal(client.calls.some((call) => call.name === "release_media_capacity_reservation"), false);
});

test("ambiguous finalization remains reserved and is never compensated by release", async () => {
  const { withMediaCapacityReservation } = await loadCapacityModule();
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
        expiresAt: "2000-01-01T00:00:00.000Z"
      }, error: null };
    }
    if (name === "finalize_media_capacity_reservation") {
      return { data: null, error: { message: "ambiguous" } };
    }
    return { data: { status: "released" }, error: null };
  });

  await assert.rejects(withMediaCapacityReservation({
    client,
    projectRef: "project-a",
    reservationKey: "upload:ambiguous-finalize",
    ...DEFAULT_CAPACITY_CONTEXT,
    requestedBytes: 10,
    work: async () => ({ value: "written", newlyCreatedBytes: 10 })
  }), /Capacité média indisponible/);
  assert.equal(client.calls.filter((call) => call.name === "finalize_media_capacity_reservation").length, 2);
  assert.equal(client.calls.some((call) => call.name === "release_media_capacity_reservation"), false);
});
