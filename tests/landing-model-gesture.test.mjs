import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { createModelGestureController, createNativeModelGestureController } = await import(pathToFileURL(resolve(process.env.VISTAIRE_GESTURE_SOURCE || 'components/immersive/useModelGesture.js')));

test('mouse and pen rotate only yaw without emitting pitch or zoom', () => {
  for (const pointerType of ['mouse', 'pen']) {
    const angles = [], pitches = [], zooms = [];
    const controller = createModelGestureController(() => ({
      angle: 0.5, pitch: 0, zoom: 1,
      onAngle: value => angles.push(value),
      onPitch: value => pitches.push(value),
      onZoom: value => zooms.push(value),
    }));
    const target = { clientWidth: 200, clientHeight: 200 };
    const event = { pointerId: 1, pointerType, button: 0, buttons: 1, currentTarget: target, timeStamp: 0, clientX: 50, clientY: 50 };
    controller.handlers.onPointerDown(event);
    controller.handlers.onPointerMove({ ...event, clientX: 100, clientY: 120 });
    controller.handlers.onPointerMove({ ...event, clientX: 100, clientY: 170 });
    assert.deepEqual(angles, [0.75]);
    assert.deepEqual(pitches, [], 'vertical drag must not tilt the dish');
    assert.deepEqual(zooms, [], 'rotation must not write zoom');
  }
});

for (const native of [false, true]) test(`${native ? 'native touch' : 'pointer'} pinch uses the current camera-derived maximum above 400%`, () => {
  const zooms = [];
  const options = { angle: 0.5, zoom: 5, maxZoom: 8.4, zoomEnabled: true, onZoom: value => zooms.push(value) };
  const controller = (native ? createNativeModelGestureController : createModelGestureController)(() => options);
  const target = { clientWidth: 390, ownerDocument: { defaultView: { scrollY: 0 } } };
  const pointer = (pointerId, clientX) => ({ pointerId, clientX, clientY: 50, pointerType: 'touch', currentTarget: target, timeStamp: 0 });
  const touch = (identifier, clientX) => ({ identifier, clientX, clientY: 50 });
  if (native) controller.touchHandlers.touchstart({ currentTarget: target, touches: [touch(1, 0), touch(2, 100)], timeStamp: 0 });
  else {
    controller.handlers.onPointerDown(pointer(1, 0));
    controller.handlers.onPointerDown(pointer(2, 100));
  }
  const move = x => native
    ? controller.touchHandlers.touchmove({ touches: [touch(1, 0), touch(2, x)] })
    : controller.handlers.onPointerMove(pointer(2, x));
  move(200);
  assert.equal(zooms.at(-1), 8.4, 'pinch reaches the actual near-plane cap rather than a hard-coded 400%');
  move(150);
  assert.equal(zooms.at(-1), 7.5, 'a new pinch retains its existing zoom above 400%');
  options.maxZoom = 6.2;
  move(200);
  assert.equal(zooms.at(-1), 6.2, 'a geometry change updates the cap without recreating the controller');
  move(1);
  assert.equal(zooms.at(-1), 0.6, 'the established minimum zoom is unchanged');
  controller.reset();
});
