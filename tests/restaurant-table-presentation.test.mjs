import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { arrangePresentationTable } from '../components/immersive/TablePresentationLayout.js';

test('the presentation table omits fixed place settings without hiding the showcased dish', () => {
  const group = new THREE.Group();
  const surface = new THREE.Group();
  const dish = new THREE.Group();
  const accessories = Object.fromEntries(['placeSetting', 'glass', 'lamp'].map(id => [id, new THREE.Group()]));
  group.add(surface, ...Object.values(accessories));
  const before = surface.matrix.clone();
  arrangePresentationTable({ group, accessories, metadata: { surfaceY: -0.02 } });
  for (const [id, object] of Object.entries(accessories)) assert.equal(object.visible, false, id);
  assert.equal(group.visible, true);
  assert.equal(surface.visible, true);
  assert.equal(dish.visible, true);
  assert.deepEqual(surface.matrix, before);
});
