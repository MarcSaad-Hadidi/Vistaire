import test from "node:test";
import assert from "node:assert/strict";
import * as gestures from "../src/useModelGesture.js";

function fixture() {
  assert.equal(typeof gestures.createNativeModelGestureController, "function");
  const values = { angle: 0.5, zoom: 1 };
  const calls = [];
  let prevented = 0;
  const view = { scrollY: 1000 };
  const controller = gestures.createNativeModelGestureController(() => ({
    ...values,
    zoomEnabled: true,
    onAngle: (a) => {
      values.angle = a;
      calls.push(["angle", a]);
    },
    onZoom: (z) => {
      values.zoom = z;
      calls.push(["zoom", z]);
    },
  }));
  const event = (points, timeStamp = 100) => ({
    currentTarget: { clientWidth: 320, ownerDocument: { defaultView: view } },
    touches: points.map(([x, y], i) => ({
      identifier: i,
      clientX: x,
      clientY: y,
    })),
    cancelable: true,
    timeStamp,
    preventDefault: () => prevented++,
  });
  return {
    ...controller.touchHandlers,
    controller,
    values,
    calls,
    view,
    event,
    prevented: () => prevented,
  };
}

test("dish rotation then a vertical reversal never cancels a single-finger native scroll", () => {
  const g = fixture();
  g.touchstart(g.event([[100, 100]]));
  g.touchmove(g.event([[180, 100]], 150));
  assert.equal(g.values.angle, 0.75);
  for (const y of [180, 30, 250, 40]) g.touchmove(g.event([[180, y]], 200));
  assert.equal(g.values.angle, 0.75);
  assert.equal(g.prevented(), 0);
});

test("two-finger dish pinch zooms the model and yields after one finger lifts", () => {
  const g = fixture();
  g.touchstart(
    g.event([
      [100, 100],
      [200, 100],
    ]),
  );
  g.touchmove(
    g.event(
      [
        [20, 100],
        [320, 100],
      ],
      150,
    ),
  );
  assert.equal(g.values.zoom, 3);
  g.touchmove(
    g.event(
      [
        [0, 100],
        [500, 100],
      ],
      160,
    ),
  );
  assert.equal(g.values.zoom, 4);
  assert.equal(g.values.angle, 0.5);
  assert.equal(g.prevented(), 0);
  const prevented = g.prevented();
  g.touchend(g.event([[0, 100]], 180));
  g.touchmove(g.event([[0, 300]], 200));
  assert.equal(g.prevented(), prevented);
  g.touchend(g.event([]));
  g.touchstart(g.event([[100, 100]], 300));
  g.touchmove(g.event([[180, 100]], 350));
  assert.equal(g.values.angle, 0.75);
});

test("adding a second finger after a native pan cannot hijack an ongoing scroll", () => {
  const g = fixture();
  g.touchstart(g.event([[100, 100]]));
  g.view.scrollY = 1100;
  g.touchstart(
    g.event(
      [
        [100, 200],
        [200, 200],
      ],
      150,
    ),
  );
  g.touchmove(
    g.event(
      [
        [20, 200],
        [300, 200],
      ],
      180,
    ),
  );
  assert.equal(g.values.zoom, 1);
  assert.equal(g.prevented(), 0);
});
