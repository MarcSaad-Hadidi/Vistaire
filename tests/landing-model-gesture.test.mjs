import assert from 'node:assert/strict';
import test from 'node:test';
import { createModelGestureController } from '../components/immersive/useModelGesture.js';

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
