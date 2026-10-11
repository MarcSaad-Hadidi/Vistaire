import test from "node:test";
import assert from "node:assert/strict";
import { createVideoSurfaceController } from "../src/videoSurface.js";

function fixture({ frameCallbacks = true, denied = false } = {}) {
  const events = new Map(),
    frames = new Map();
  let frameId = 0,
    loads = 0,
    plays = 0,
    shown = 0,
    posters = 0,
    blocks = 0;
  const video = {
    paused: true,
    readyState: 0,
    setAttribute() {},
    removeAttribute() {},
    addEventListener(name, fn) {
      events.set(name, fn);
    },
    removeEventListener(name) {
      events.delete(name);
    },
    load() {
      loads++;
    },
    play() {
      plays++;
      if (denied)
        return Promise.reject(new DOMException("Denied", "NotAllowedError"));
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
      events.get("pause")?.();
    },
  };
  if (frameCallbacks)
    Object.assign(video, {
      requestVideoFrameCallback(fn) {
        frames.set(++frameId, fn);
        return frameId;
      },
      cancelVideoFrameCallback(id) {
        frames.delete(id);
      },
    });
  const controller = createVideoSurfaceController(video, {
    onFrame() {
      shown++;
    },
    onPoster() {
      posters++;
    },
    onBlocked() {
      blocks++;
    },
  });
  return {
    video,
    controller,
    events,
    frames,
    tick() {
      const [id, fn] = frames.entries().next().value;
      frames.delete(id);
      fn();
    },
    allow() {
      denied = false;
    },
    counts: () => ({ loads, plays, shown, posters, blocks }),
  };
}

test("inactive surfaces do not fetch; only decoded frames reveal the video", async () => {
  const f = fixture();
  f.controller.update(false, "/menu.mp4");
  assert.equal(f.video.src, undefined);
  assert.equal(f.counts().loads, 0);
  f.controller.update(true, "/menu.mp4");
  assert.equal(f.video.muted, true);
  assert.equal(f.video.playsInline, true);
  assert.equal(f.video.playbackRate, 1);
  f.tick();
  assert.equal(f.counts().shown, 0);
  f.video.readyState = 2;
  f.tick();
  assert.equal(f.counts().shown, 1);
  assert.equal(f.frames.size, 1);
  await Promise.resolve();
  f.controller.dispose();
});

test("hiding pauses the decoder, cancels frame work and resumes without reloading", async () => {
  const f = fixture();
  f.controller.update(true, "/menu.mp4");
  await Promise.resolve();
  f.video.readyState = 2;
  f.tick();
  f.controller.update(false, "/menu.mp4");
  assert.equal(f.video.paused, true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.controller.getState().decoded, false);
  assert.equal(f.controller.getState().active, false);
  const loads = f.counts().loads;
  f.controller.update(true, "/menu.mp4");
  assert.equal(f.counts().loads, loads);
  assert.equal(f.video.paused, false);
  f.controller.dispose();
});

test("a callback from the previous menu cannot reveal a stale frame", async () => {
  const f = fixture();
  f.controller.update(true, "/first.mp4");
  const oldFrame = f.frames.values().next().value;
  await Promise.resolve();
  f.controller.update(true, "/second.mp4");
  f.video.readyState = 2;
  oldFrame();
  assert.equal(f.counts().shown, 0);
  assert.equal(f.video.src, "/second.mp4");
  assert.equal(f.frames.size, 1);
  f.tick();
  assert.equal(f.counts().shown, 1);
  f.events.get("waiting")();
  assert.equal(f.controller.getState().decoded, false);
  f.controller.dispose();
});

test("autoplay refusal offers a user retry and can resume after a gesture", async () => {
  const f = fixture({ denied: true });
  f.controller.update(true, "/menu.mp4");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.counts().blocks, 1);
  f.controller.update(true, "/menu.mp4");
  assert.equal(f.counts().plays, 1);
  f.allow();
  f.controller.retry();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.counts().plays, 2);
  assert.equal(f.video.paused, false);
  f.controller.dispose();
});

test("browsers without frame callbacks wake from media events and stop on cleanup", async () => {
  const f = fixture({ frameCallbacks: false });
  f.controller.update(true, "/menu.mp4");
  f.video.readyState = 2;
  f.events.get("playing")();
  f.events.get("timeupdate")();
  assert.equal(f.counts().shown, 2);
  f.controller.dispose();
  assert.equal(f.events.size, 0);
  assert.equal(f.video.paused, true);
  f.controller.update(true, "/new.mp4");
  assert.equal(f.video.src, "/menu.mp4");
});
