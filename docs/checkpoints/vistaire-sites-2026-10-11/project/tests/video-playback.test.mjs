import test from "node:test";
import assert from "node:assert/strict";
import { createVideoPlaybackController } from "../src/videoPlayback.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function fixture() {
  const requests = [];
  const video = {
    paused: true,
    play() {
      const request = deferred();
      requests.push(request);
      this.paused = false;
      return request.promise;
    },
    pause() {
      this.paused = true;
    },
  };
  const controller = createVideoPlaybackController(video);
  const initial = controller.getState();
  assert.equal(initial.pending, false);
  assert.equal(initial.blocked, false);
  assert.equal(Number.isInteger(initial.generation), true);
  return { video, requests, controller, generation: initial.generation };
}

test("an interrupted play permits a later attempt without resetting the source", async () => {
  const { video, requests, controller, generation } = fixture();
  const first = controller.play();
  assert.ok(first instanceof Promise);
  assert.equal(
    requests.length,
    1,
    "play must call the media element immediately",
  );
  assert.equal(controller.getState().pending, true);

  video.pause();
  requests[0].reject(new DOMException("Playback was paused", "AbortError"));
  await first;
  assert.deepEqual(controller.getState(), {
    pending: false,
    blocked: false,
    generation,
  });

  const retry = controller.play();
  assert.equal(requests.length, 2);
  requests[1].resolve();
  await retry;
  assert.equal(controller.getState().pending, false);
  assert.equal(controller.getState().blocked, false);
});

test("a permission refusal blocks retries only until the source is reset", async () => {
  const { video, requests, controller, generation } = fixture();
  const first = controller.play();
  video.pause();
  requests[0].reject(new DOMException("Autoplay denied", "NotAllowedError"));
  await first;
  assert.deepEqual(controller.getState(), {
    pending: false,
    blocked: true,
    generation,
  });
  assert.equal(controller.play(), undefined);
  assert.equal(requests.length, 1);

  controller.reset();
  assert.deepEqual(controller.getState(), {
    pending: false,
    blocked: false,
    generation: generation + 1,
  });
  const retry = controller.play();
  assert.equal(requests.length, 2);
  requests[1].resolve();
  await retry;
  assert.equal(controller.getState().blocked, false);
});

test("a stale permission rejection cannot block a new source or release its pending play", async () => {
  const { video, requests, controller, generation } = fixture();
  const oldPlay = controller.play();
  controller.reset();
  video.pause();
  const newPlay = controller.play();
  assert.equal(requests.length, 2);

  requests[0].reject(new DOMException("Old source denied", "NotAllowedError"));
  await oldPlay;
  assert.deepEqual(controller.getState(), {
    pending: true,
    blocked: false,
    generation: generation + 1,
  });

  video.pause();
  assert.equal(controller.play(), undefined);
  assert.equal(
    requests.length,
    2,
    "the new pending request must remain exclusive",
  );
  requests[1].resolve();
  await newPlay;
  assert.deepEqual(controller.getState(), {
    pending: false,
    blocked: false,
    generation: generation + 1,
  });
});

test("a stale successful finally cannot clear the newer pending request", async () => {
  const { video, requests, controller, generation } = fixture();
  const oldPlay = controller.play();
  controller.reset();
  video.pause();
  const newPlay = controller.play();

  requests[0].resolve();
  await oldPlay;
  assert.deepEqual(controller.getState(), {
    pending: true,
    blocked: false,
    generation: generation + 1,
  });
  video.pause();
  assert.equal(controller.play(), undefined);
  assert.equal(requests.length, 2);

  requests[1].resolve();
  await newPlay;
  assert.equal(controller.getState().pending, false);
});

test("only one play request may remain pending even if the element is paused again", async () => {
  const { video, requests, controller } = fixture();
  const first = controller.play();
  video.pause();
  assert.equal(controller.play(), undefined);
  assert.equal(controller.play(), undefined);
  assert.equal(requests.length, 1);
  assert.equal(controller.getState().pending, true);

  requests[0].resolve();
  await first;
  const second = controller.play();
  assert.equal(requests.length, 2);
  requests[1].resolve();
  await second;
});

test("an already playing element does not receive a redundant play call", () => {
  const { video, requests, controller, generation } = fixture();
  video.paused = false;
  assert.equal(controller.play(), undefined);
  assert.equal(requests.length, 0);
  assert.deepEqual(controller.getState(), {
    pending: false,
    blocked: false,
    generation,
  });
});

test("errors other than permission refusals do not permanently block playback", async () => {
  const { video, requests, controller } = fixture();
  const first = controller.play();
  video.pause();
  requests[0].reject(
    new DOMException("Source unavailable", "NotSupportedError"),
  );
  await first;
  assert.equal(controller.getState().blocked, false);
  assert.equal(controller.getState().pending, false);

  const retry = controller.play();
  assert.equal(requests.length, 2);
  requests[1].resolve();
  await retry;
});
