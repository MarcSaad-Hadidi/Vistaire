import test from "node:test";
import assert from "node:assert/strict";
import { createModelGestureController } from "../src/useModelGesture.js";

function fixture(overrides = {}) {
  const calls = { angle: [], pitch: [], zoom: [] };
  let options = {
    angle: 0.5,
    pitch: 0,
    zoom: 1,
    onAngle: (value) => calls.angle.push(value),
    onPitch: (value) => calls.pitch.push(value),
    onZoom: (value) => calls.zoom.push(value),
    ...overrides,
  };
  const held = new Set();
  const target = {
    clientWidth: 320,
    clientHeight: 400,
    setPointerCapture: (id) => held.add(id),
    releasePointerCapture: (id) => held.delete(id),
    hasPointerCapture: (id) => held.has(id),
  };
  const controller = createModelGestureController(() => options);
  function event(id, x, y, extra = {}) {
    return {
      pointerId: id,
      pointerType: "touch",
      isPrimary: id === 1,
      clientX: x,
      clientY: y,
      currentTarget: target,
      button: 0,
      buttons: 1,
      timeStamp: 100,
      cancelable: true,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...extra,
    };
  }
  return {
    controller,
    ...controller.handlers,
    calls,
    held,
    event,
    replaceOptions(next) {
      options = { ...options, ...next };
    },
  };
}

test("one touch claims only a clear 12px horizontal move, with no pitch", () => {
  const g = fixture();
  const down = g.event(1, 100, 100);
  g.onPointerDown(down);
  const jitter = g.event(1, 111, 103);
  g.onPointerMove(jitter);
  assert.equal(down.defaultPrevented, false);
  assert.equal(jitter.defaultPrevented, false);
  assert.deepEqual(g.calls.angle, []);
  assert.equal(g.held.size, 0);
  const horizontal = g.event(1, 148, 104);
  g.onPointerMove(horizontal);
  assert.equal(g.calls.angle.at(-1), 0.65);
  assert.deepEqual(g.calls.pitch, []);
  assert.equal(horizontal.defaultPrevented, true);
  assert.deepEqual([...g.held], [1]);
});

test("vertical scroll and reversals never become model rotation", () => {
  const g = fixture();
  g.onPointerDown(g.event(1, 100, 100));
  const vertical = g.event(1, 108, 125);
  g.onPointerMove(vertical);
  g.onPointerMove(g.event(1, 250, 60));
  assert.equal(g.controller.getState().mode, "native");
  assert.equal(vertical.defaultPrevented, false);
  assert.equal(g.held.size, 0);
  assert.deepEqual(g.calls.angle, []);
});

test("holding before movement preserves native scrolling even if first movement is horizontal", () => {
  const g = fixture();
  g.onPointerDown(g.event(1, 100, 100));
  const afterHold = g.event(1, 150, 100, { timeStamp: 700 });
  g.onPointerMove(afterHold);
  assert.equal(g.controller.getState().mode, "native");
  assert.equal(afterHold.defaultPrevented, false);
  assert.deepEqual(g.calls.angle, []);
});

test("a vertical change after horizontal rotation releases capture permanently", () => {
  const g = fixture();
  g.onPointerDown(g.event(1, 100, 100));
  g.onPointerMove(g.event(1, 130, 100));
  for (const y of [104, 108, 112]) g.onPointerMove(g.event(1, 130, y));
  assert.equal(g.controller.getState().mode, "native");
  assert.equal(g.held.size, 0);
  const angleCalls = g.calls.angle.length;
  g.onLostPointerCapture(g.event(1, 130, 112));
  g.onPointerMove(g.event(1, 220, 100));
  assert.equal(g.calls.angle.length, angleCalls);
  assert.equal(g.controller.getState().pointerCount, 1);
});

test("two touches including non-primary pinch by distance ratio and clamp 0.6–4", () => {
  const g = fixture({ zoom: 1.2 });
  g.onPointerDown(g.event(1, 100, 100));
  g.onPointerDown(g.event(2, 200, 100));
  g.onPointerMove(g.event(2, 250, 100));
  assert.ok(Math.abs(g.calls.zoom.at(-1) - 1.8) < 1e-12);
  g.onPointerMove(g.event(2, 900, 100));
  assert.equal(g.calls.zoom.at(-1), 4);
  g.onPointerMove(g.event(2, 101, 100));
  assert.equal(g.calls.zoom.at(-1), 0.6);
  assert.deepEqual([...g.held], [1, 2]);
  assert.deepEqual(g.calls.angle, []);
  assert.deepEqual(g.calls.pitch, []);
});

test("remaining finger after pinch stays available for native scrolling", () => {
  const g = fixture();
  g.onPointerDown(g.event(1, 100, 100));
  g.onPointerDown(g.event(2, 200, 100));
  g.onPointerUp(g.event(2, 200, 100));
  assert.equal(g.controller.getState().mode, "native");
  assert.equal(g.held.size, 0);
  g.onLostPointerCapture(g.event(1, 100, 100));
  const vertical = g.event(1, 100, 220);
  g.onPointerMove(vertical);
  assert.equal(vertical.defaultPrevented, false);
  assert.equal(g.controller.getState().pointerCount, 1);
  g.onPointerUp(vertical);
  assert.equal(g.controller.getState().pointerCount, 0);
});

test("mouse updates yaw and pitch, bounded to normalized angle and ±0.7 radians", () => {
  const g = fixture();
  g.onPointerDown(g.event(1, 100, 100, { pointerType: "mouse" }));
  g.onPointerMove(g.event(1, 148, 200, { pointerType: "mouse" }));
  assert.equal(g.calls.angle.at(-1), 0.65);
  assert.equal(g.calls.pitch.at(-1), 0.35);
  g.onPointerMove(g.event(1, 800, 900, { pointerType: "mouse" }));
  assert.equal(g.calls.angle.at(-1), 1);
  assert.equal(g.calls.pitch.at(-1), 0.7);
  g.onPointerMove(g.event(1, 10, 10, { pointerType: "mouse", buttons: 0 }));
  assert.equal(g.controller.getState().mode, "idle");
  assert.equal(g.held.size, 0);
});

test("callbacks stay current and consecutive pinch events never use stale React values", () => {
  const g = fixture();
  g.onPointerDown(g.event(1, 100, 100));
  g.onPointerDown(g.event(2, 200, 100));
  const latest = [];
  g.replaceOptions({ onZoom: (value) => latest.push(value) });
  g.onPointerMove(g.event(2, 300, 100));
  g.onPointerMove(g.event(2, 400, 100));
  assert.deepEqual(latest, [2, 3]);
  assert.deepEqual(g.calls.zoom, []);
});

test("cancel, unexpected capture loss and unmount cleanup release every pointer", () => {
  for (const finish of ["onPointerCancel", "onLostPointerCapture", "reset"]) {
    const g = fixture();
    g.onPointerDown(g.event(1, 100, 100));
    g.onPointerDown(g.event(2, 200, 100));
    if (finish === "reset") g.controller.reset();
    else g[finish](g.event(1, 100, 100));
    assert.equal(g.held.size, 0);
    assert.equal(g.controller.getState().pointerCount, 0);
    g.onPointerMove(g.event(2, 500, 100));
    assert.deepEqual(g.calls.zoom, []);
    // Effect cleanup may run once during React Strict Mode's mount probe.
    g.onPointerDown(g.event(1, 100, 100));
    g.onPointerMove(g.event(1, 140, 100));
    assert.ok(g.calls.angle.length > 0);
  }
});

test("a third touch can replace a pinch finger without discontinuous scale", () => {
  const g = fixture();
  g.onPointerDown(g.event(1, 100, 100));
  g.onPointerDown(g.event(2, 200, 100));
  g.onPointerMove(g.event(2, 300, 100));
  g.onPointerDown(g.event(3, 400, 100));
  g.onPointerUp(g.event(2, 300, 100));
  g.onPointerMove(g.event(3, 400, 100));
  assert.deepEqual(g.calls.zoom, [2]);
  g.onPointerMove(g.event(3, 550, 100));
  assert.equal(g.calls.zoom.at(-1), 3);
});

test("disabled model zoom yields every touch to native pinch without preventing defaults", () => {
  const g = fixture({ zoomEnabled: false });
  g.onPointerDown(g.event(1, 100, 100));
  g.onPointerMove(g.event(1, 130, 100));
  assert.equal(g.held.size, 1);
  const second = g.event(2, 230, 100);
  g.onPointerDown(second);
  assert.equal(second.defaultPrevented, false);
  assert.equal(g.controller.getState().mode, "native");
  assert.equal(g.held.size, 0);
  g.onLostPointerCapture(g.event(1, 130, 100));
  const angleCount = g.calls.angle.length;
  const pinchMove = g.event(2, 330, 100);
  g.onPointerMove(pinchMove);
  assert.equal(pinchMove.defaultPrevented, false);
  assert.deepEqual(g.calls.zoom, []);
  g.onPointerUp(g.event(2, 330, 100));
  const remaining = g.event(1, 200, 180);
  g.onPointerMove(remaining);
  assert.equal(remaining.defaultPrevented, false);
  assert.equal(g.calls.angle.length, angleCount);
  g.onPointerUp(remaining);
  assert.equal(g.controller.getState().mode, "idle");
});

test("disabling zoom during an active pinch immediately relinquishes both captures", () => {
  const g = fixture();
  g.onPointerDown(g.event(1, 100, 100));
  g.onPointerDown(g.event(2, 200, 100));
  g.replaceOptions({ zoomEnabled: false });
  const move = g.event(2, 300, 100);
  g.onPointerMove(move);
  assert.equal(move.defaultPrevented, false);
  assert.equal(g.held.size, 0);
  assert.equal(g.controller.getState().mode, "native");
  assert.deepEqual(g.calls.zoom, []);
});
