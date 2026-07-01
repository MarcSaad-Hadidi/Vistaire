import test from "node:test";
import assert from "node:assert/strict";

import { createOwnerDishModelUploadQueue } from "../lib/owner/ownerDishModelUploadQueue.ts";

function controlledTask() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

test("owner dish model upload queue runs one pipeline at a time in FIFO order", async () => {
  const queue = createOwnerDishModelUploadQueue();
  const events = [];
  const first = controlledTask();
  const second = controlledTask();

  const firstPromise = queue.enqueue({
    dishId: "dish-a",
    run: () => {
      events.push("start:a");
      return first.promise;
    },
    onQueued: () => events.push("queued:a"),
    onStart: () => events.push("running:a"),
    onSuccess: () => events.push("success:a")
  });
  const secondPromise = queue.enqueue({
    dishId: "dish-b",
    run: () => {
      events.push("start:b");
      return second.promise;
    },
    onQueued: () => events.push("queued:b"),
    onStart: () => events.push("running:b"),
    onSuccess: () => events.push("success:b")
  });

  await flushMicrotasks();
  assert.deepEqual(events, ["queued:a", "running:a", "start:a", "queued:b"]);
  assert.equal(queue.getSnapshot().activeDishId, "dish-a");

  first.resolve("ok-a");
  assert.equal(await firstPromise, "ok-a");
  await flushMicrotasks();
  assert.deepEqual(events.slice(-2), ["running:b", "start:b"]);
  assert.equal(queue.getSnapshot().activeDishId, "dish-b");

  second.resolve("ok-b");
  assert.equal(await secondPromise, "ok-b");
  await flushMicrotasks();
  assert.equal(queue.getSnapshot().activeDishId, "");
});

test("owner dish model upload queue continues after a failed upload", async () => {
  const queue = createOwnerDishModelUploadQueue();
  const events = [];
  const first = controlledTask();
  const second = controlledTask();

  const firstPromise = queue.enqueue({
    dishId: "dish-a",
    run: () => {
      events.push("start:a");
      return first.promise;
    },
    onError: () => events.push("error:a")
  });
  const secondPromise = queue.enqueue({
    dishId: "dish-b",
    run: () => {
      events.push("start:b");
      return second.promise;
    },
    onSuccess: () => events.push("success:b")
  });

  await flushMicrotasks();
  first.reject(new Error("pipeline failed"));
  await assert.rejects(firstPromise, /pipeline failed/);
  await flushMicrotasks();
  assert.deepEqual(events, ["start:a", "error:a", "start:b"]);

  second.resolve("ok-b");
  assert.equal(await secondPromise, "ok-b");
  await flushMicrotasks();
  assert.deepEqual(events.slice(-1), ["success:b"]);
});
