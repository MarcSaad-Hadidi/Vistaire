import test from "node:test";
import assert from "node:assert/strict";
import * as gestures from "../src/useModelGesture.js";

function fixture() {
  assert.equal(
    typeof gestures.createSupportGestureController,
    "function",
    "QR needs a passive touch path independent of dish capture",
  );
  const calls = [];
  let options = { angle: 0, onAngle: (a) => calls.push(a) };
  const view = { scrollY: 1000 };
  const target = {
    clientWidth: 320,
    ownerDocument: { defaultView: view },
    setPointerCapture() {
      throw new Error("touch must not capture");
    },
  };
  const controller = gestures.createSupportGestureController(() => options);
  const touch = (points, timeStamp = 100) => ({
    currentTarget: target,
    timeStamp,
    touches: points.map(([x, y], i) => ({
      identifier: i,
      clientX: x,
      clientY: y,
    })),
    preventDefault() {
      throw new Error("touch must stay passive");
    },
  });
  return {
    controller,
    ...controller.touchHandlers,
    calls,
    view,
    touch,
    replace(next) {
      options = { ...options, ...next };
    },
  };
}

test("QR horizontal touch rotates in both directions without suppressing native behavior", () => {
  const g = fixture();
  g.touchstart(g.touch([[100, 100]]));
  for (const x of [115, 140, 180]) g.touchmove(g.touch([[x, 100]], 150));
  assert.equal(g.calls.at(-1), 0.25);
  g.touchend(g.touch([]));
  g.touchstart(g.touch([[200, 100]]));
  g.touchmove(g.touch([[160, 100]], 150));
  assert.equal(g.calls.at(-1), -0.125);
});

test("QR diagonal turn after rotation stops further model movement for the whole contact", () => {
  const g = fixture();
  g.touchstart(g.touch([[100, 100]]));
  g.touchmove(g.touch([[130, 100]], 150));
  const angle = g.calls.at(-1);
  for (let i = 1; i <= 10; i++)
    g.touchmove(g.touch([[130 + i * 10, 100 + i * 10]], 180));
  for (const y of [20, 220, 50, 250]) g.touchmove(g.touch([[260, y]], 200));
  g.touchmove(g.touch([[350, 250]], 220));
  assert.equal(g.calls.at(-1), angle);
  assert.equal(g.calls.length, 1);
});

test("QR vertical intention and long hold never rotate", () => {
  for (const held of [false, true]) {
    const g = fixture();
    g.touchstart(g.touch([[100, 100]]));
    g.touchmove(
      g.touch([[held ? 160 : 104, held ? 100 : 120]], held ? 700 : 150),
    );
    for (const y of [30, 220, 10, 240]) g.touchmove(g.touch([[250, y]], 800));
    assert.deepEqual(g.calls, []);
  }
});

test("QR rotation stops when native document scrolling starts", () => {
  const g = fixture();
  g.touchstart(g.touch([[100, 100]]));
  g.touchmove(g.touch([[140, 100]], 150));
  g.view.scrollY = 1010;
  g.touchmove(g.touch([[180, 100]], 170));
  assert.equal(g.calls.length, 1);
});

test("QR multiple fingers yield to native pinch until every finger lifts", () => {
  const g = fixture();
  g.touchstart(g.touch([[100, 100]]));
  g.touchmove(g.touch([[140, 100]], 150));
  g.touchstart(
    g.touch(
      [
        [140, 100],
        [240, 100],
      ],
      160,
    ),
  );
  g.touchmove(
    g.touch(
      [
        [140, 100],
        [300, 100],
      ],
      180,
    ),
  );
  g.touchend(g.touch([[140, 100]], 190));
  g.touchmove(g.touch([[240, 100]], 200));
  assert.equal(g.calls.length, 1);
  g.touchend(g.touch([]));
  g.touchstart(g.touch([[100, 100]], 300));
  g.touchmove(g.touch([[140, 100]], 350));
  assert.equal(g.calls.length, 2);
});

test("QR touch ignores pointer cancellation and uses the latest callback", () => {
  const g = fixture();
  g.touchstart(g.touch([[100, 100]]));
  g.controller.pointerHandlers.onPointerCancel({
    pointerType: "touch",
    pointerId: 1,
  });
  const latest = [];
  g.replace({ onAngle: (a) => latest.push(a) });
  g.touchmove(g.touch([[180, 100]], 150));
  assert.deepEqual(g.calls, []);
  assert.deepEqual(latest, [0.25]);
  g.controller.reset();
  g.touchmove(g.touch([[200, 100]], 180));
  assert.deepEqual(latest, [0.25]);
});

test("a new single-finger contact resets a yield whose last touch ended outside the control", () => {
  const g = fixture();
  g.touchstart(g.touch([[100, 100]]));
  g.touchmove(g.touch([[100, 140]], 150));
  // A second finger started elsewhere. The original touch ends on this control
  // while the remaining finger ends elsewhere, so no zero-touch end arrives.
  g.touchend(g.touch([[220, 100]], 200));
  g.touchstart(g.touch([[100, 100]], 300));
  g.touchmove(g.touch([[180, 100]], 350));
  assert.deepEqual(g.calls, [0.25]);
});
