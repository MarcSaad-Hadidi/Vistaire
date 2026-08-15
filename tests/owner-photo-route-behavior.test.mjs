import assert from "node:assert/strict";
import test from "node:test";

import { loadOwnerPhotoRoute } from "./helpers/owner-photo-route-runtime.mjs";

const restaurantId = "11111111-2222-4333-8444-555555555555";
const dishId = "22222222-3333-4444-8555-666666666666";
const sourceSha = "a".repeat(64);
const outputs = { thumbnail: "b".repeat(64), card: "c".repeat(64), display: "d".repeat(64) };

function metadata() {
  return {
    keep: "yes",
    photoStatus: "ready",
    photoStorageBucket: "vistaire-media",
    photoStoragePath: `restaurants/${restaurantId}/photos/originals/old.png`,
    photoSha256: "e".repeat(64),
    photoContentType: "image/png",
    photoBytes: 4,
    photoDerivatives: { card: { storagePath: "old-card.webp" } }
  };
}

function fixture({ reserveStatus = "reserved", updateError = false, removeError = false } = {}) {
  const events = [];
  const calls = { updates: [], uploads: [], infos: [], downloads: [], rpc: [] };
  const sourceBytes = Buffer.from("source");
  const derivatives = Object.fromEntries(Object.entries(outputs).map(([variant, outputSha256]) => [
    variant,
    {
      bytes: Buffer.from(variant),
      metadata: {
        schemaVersion: 2,
        recipeId: "dish-photo-v2",
        variant,
        sha256: outputSha256,
        outputSha256,
        contentType: "image/webp",
        format: "webp",
        width: 1,
        height: 1,
        bytes: Buffer.byteLength(variant),
        sourceSha256: sourceSha,
        generatedAt: "2026-08-15T12:00:00.000Z",
        encoder: "test"
      }
    }
  ]));
  const bucket = {
    async info(path) {
      calls.infos.push(path);
      return { data: null, error: { statusCode: 404, message: "not found" } };
    },
    async download(path) {
      calls.downloads.push(path);
      return { data: null, error: { statusCode: 404 } };
    },
    async upload(path, bytes) {
      events.push(`upload:${path}`);
      calls.uploads.push({ path, bytes: bytes.byteLength });
      return { data: { path }, error: null };
    },
    async remove(paths) {
      events.push("remove");
      return removeError
        ? { data: null, error: { message: "remove failed" } }
        : { data: paths, error: null };
    }
  };
  const client = {
    storage: { from: () => bucket },
    async rpc(name, parameters) {
      events.push(name);
      calls.rpc.push({ name, parameters });
      if (name === "reserve_media_capacity") {
        if (reserveStatus === "insufficient") {
          return { data: { status: "insufficient", projectRef: "project-a", quotaBytes: 1000, usedBytes: 750, activeReservedBytes: 0, requestedBytes: parameters.p_requested_bytes, headroomBytes: 100, headroomPercent: 10 }, error: null };
        }
        return { data: { status: "reserved", reservationId: "99999999-9999-4999-8999-999999999999", projectRef: "project-a", quotaBytes: 1000, usedBytes: 100, activeReservedBytes: 0, requestedBytes: parameters.p_requested_bytes, headroomBytes: 800, headroomPercent: 80, expiresAt: "2026-08-15T12:05:00.000Z" }, error: null };
      }
      return { data: { status: name.startsWith("finalize") ? "finalized" : "released" }, error: null };
    },
    from(table) {
      assert.equal(table, "menu_dishes");
      let operation = "select";
      const query = {
        select() { return query; },
        update(value) { operation = "update"; calls.updates.push(value); events.push("db-update"); return query; },
        eq() { return query; },
        neq() { return query; },
        async maybeSingle() {
          if (operation === "update") return updateError
            ? { data: null, error: { message: "update failed" } }
            : { data: { id: dishId }, error: null };
          return { data: { id: dishId, restaurant_id: restaurantId, slug: "dish", name: "Dish", metadata: metadata() }, error: null };
        },
        then(resolve) { resolve({ data: [], error: null }); }
      };
      return query;
    }
  };
  return {
    owner: { ok: true },
    capability: { ok: true, resolved: {} },
    client,
    validated: { ok: true, extension: "png", contentType: "image/png", bytes: sourceBytes, sha256: sourceSha },
    derivatives,
    events,
    calls
  };
}

function requestForPost() {
  const form = new FormData();
  form.set("file", new File([Buffer.from("source")], "photo.png", { type: "image/png" }));
  return {
    headers: new Headers({ "content-length": "100" }),
    async formData() { return form; }
  };
}

test("photo DELETE behavior clears image_url and all photo metadata before cleanup", async () => {
  const route = await loadOwnerPhotoRoute();
  const state = fixture();
  globalThis.__OWNER_PHOTO_TEST__ = state;
  process.env.VISTAIRE_MEDIA_WRITES_ENABLED = "true";
  process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF = "project-a";

  const response = await route.DELETE(
    { headers: new Headers() },
    { params: Promise.resolve({ restaurantId, dishId }) }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(state.calls.updates, [{ image_url: null, metadata: { keep: "yes" } }]);
  assert.ok(state.events.indexOf("db-update") < state.events.indexOf("cleanup"));
  assert.deepEqual(state.cleanupArgs.previousMetadata, metadata());
  assert.deepEqual(state.cleanupArgs.nextMetadata, { keep: "yes" });
});

test("photo DELETE obeys the shared media kill switch before DB mutation", async () => {
  const route = await loadOwnerPhotoRoute();
  delete process.env.VISTAIRE_MEDIA_WRITES_ENABLED;
  process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF = "project-a";
  const state = fixture();
  globalThis.__OWNER_PHOTO_TEST__ = state;

  const response = await route.DELETE(
    { headers: new Headers() },
    { params: Promise.resolve({ restaurantId, dishId }) }
  );
  assert.equal(response.status, 503);
  assert.deepEqual(state.calls.updates, []);
  assert.equal(state.events.includes("cleanup"), false);
});

test("photo upload reserves exact new bytes before the first Storage write and finalizes actual bytes", async () => {
  const route = await loadOwnerPhotoRoute();
  const state = fixture();
  globalThis.__OWNER_PHOTO_TEST__ = state;
  process.env.VISTAIRE_MEDIA_WRITES_ENABLED = "true";
  process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF = "project-a";

  const response = await route.POST(
    requestForPost(),
    { params: Promise.resolve({ restaurantId, dishId }) }
  );
  assert.equal(response.status, 200);
  const reserveIndex = state.events.indexOf("reserve_media_capacity");
  const firstUploadIndex = state.events.findIndex((event) => event.startsWith("upload:"));
  assert.ok(reserveIndex >= 0 && reserveIndex < firstUploadIndex);
  const expectedBytes = Buffer.byteLength("source") + Buffer.byteLength("thumbnail") + Buffer.byteLength("card") + Buffer.byteLength("display");
  assert.equal(state.calls.rpc[0].parameters.p_requested_bytes, expectedBytes);
  assert.equal(state.calls.rpc.at(-1).name, "finalize_media_capacity_reservation");
  assert.equal(state.calls.rpc.at(-1).parameters.p_actual_bytes, expectedBytes);
});

test("disabled writes and insufficient headroom fail before Storage or DB mutations", async () => {
  const route = await loadOwnerPhotoRoute();
  delete process.env.VISTAIRE_MEDIA_WRITES_ENABLED;
  process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF = "project-a";
  const disabled = fixture();
  globalThis.__OWNER_PHOTO_TEST__ = disabled;
  const disabledResponse = await route.POST(requestForPost(), { params: Promise.resolve({ restaurantId, dishId }) });
  assert.equal(disabledResponse.status, 503);
  assert.deepEqual(disabled.calls.uploads, []);
  assert.deepEqual(disabled.calls.updates, []);

  process.env.VISTAIRE_MEDIA_WRITES_ENABLED = "true";
  const insufficient = fixture({ reserveStatus: "insufficient" });
  globalThis.__OWNER_PHOTO_TEST__ = insufficient;
  const capacityResponse = await route.POST(requestForPost(), { params: Promise.resolve({ restaurantId, dishId }) });
  assert.equal(capacityResponse.status, 507);
  assert.deepEqual(insufficient.calls.uploads, []);
  assert.deepEqual(insufficient.calls.updates, []);
});

test("failed upload rollback finalizes retained object bytes instead of releasing capacity", async () => {
  const route = await loadOwnerPhotoRoute();
  process.env.VISTAIRE_MEDIA_WRITES_ENABLED = "true";
  process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF = "project-a";
  const state = fixture({ updateError: true, removeError: true });
  globalThis.__OWNER_PHOTO_TEST__ = state;

  const response = await route.POST(
    requestForPost(),
    { params: Promise.resolve({ restaurantId, dishId }) }
  );
  assert.equal(response.status, 503);
  assert.equal(state.events.includes("remove"), true);
  assert.equal(state.calls.rpc.some((call) => call.name === "release_media_capacity_reservation"), false);
  const expectedBytes = Buffer.byteLength("source") + Buffer.byteLength("thumbnail") + Buffer.byteLength("card") + Buffer.byteLength("display");
  assert.equal(state.calls.rpc.at(-1).name, "finalize_media_capacity_reservation");
  assert.equal(state.calls.rpc.at(-1).parameters.p_actual_bytes, expectedBytes);
});
