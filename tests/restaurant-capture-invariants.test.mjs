import assert from 'node:assert/strict';
import test from 'node:test';

const { zeroScaleEquivalentPoses } = await import('../e2e/support/restaurant-capture-invariants.mjs')
  .catch(error => {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    return {};
  });

test('only two exact zero-scale roots may differ in an unrendered quaternion', () => {
  assert.equal(typeof zeroScaleEquivalentPoses, 'function');
  const left = { phoneScale: '0,0,0', phonePosition: '0,0.8,0', phoneQuaternion: '0,0,0.002497917360987117,1', cameraFov: '40' };
  const right = { ...left, phoneQuaternion: '0,0,0.0024979173609871175,1' };
  const [a, b] = zeroScaleEquivalentPoses(left, right);
  assert.deepEqual(a, b);
  assert.equal(left.phoneQuaternion, '0,0,0.002497917360987117,1');
  assert.equal(right.phoneQuaternion, '0,0,0.0024979173609871175,1');
  assert.notDeepEqual(...zeroScaleEquivalentPoses(left, { ...right, phonePosition: '0,0.9,0' }));
  assert.notDeepEqual(...zeroScaleEquivalentPoses(left, { ...right, cameraFov: '41' }));
});

test('visible, partially collapsed and malformed scales retain exact quaternions', () => {
  assert.equal(typeof zeroScaleEquivalentPoses, 'function');
  for (const scale of ['1,1,1', '0,1,0', '0,0,1e-12', '0,0', '', 'NaN,0,0']) {
    const left = { phoneScale: scale, phonePosition: '0,0,0', phoneQuaternion: '0,0,0,1' };
    const right = { ...left, phoneQuaternion: '0,0,1e-16,1' };
    assert.notDeepEqual(...zeroScaleEquivalentPoses(left, right), scale);
  }
  const zero = { phoneScale: '0,0,0', phoneQuaternion: '0,0,0,1' };
  assert.notDeepEqual(...zeroScaleEquivalentPoses(zero, { ...zero, phoneScale: '0,0,1e-12', phoneQuaternion: '0,0,1e-16,1' }));
});

test('quaternions outside the bounded Scene domain keep exact raw comparison', () => {
  const left = { phoneScale: '0,0,0', phonePosition: '0,0,0', phoneQuaternion: '1e308,0,0,1' };
  const right = { ...left, phoneQuaternion: '1e307,0,0,1' };
  assert.notDeepEqual(...zeroScaleEquivalentPoses(left, right));
});
