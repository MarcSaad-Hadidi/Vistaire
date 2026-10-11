import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { arrangePresentationTable } from '../components/immersive/TablePresentationLayout.js';
import { createRestaurantJourney } from '../components/immersive/RestaurantWorld.js';

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

test('scroll keeps the room registered to its extracted table and chair while atmosphere changes', () => {
  const inventory = JSON.parse(readFileSync(new URL('../components/immersive/restaurant-table-inventory.json', import.meta.url), 'utf8'));
  const table = inventory.recipes.find(recipe => recipe.id === 'table').sourceBounds;
  const chair = inventory.recipes.find(recipe => recipe.id === 'chair').sourceBounds;
  const center = new THREE.Vector3((table.min[0] + table.max[0]) / 2, table.max[1], (table.min[2] + table.max[2]) / 2);
  const scale = 6 / Math.max(table.max[0] - table.min[0], table.max[2] - table.min[2]);
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-0.38353 - center.x, center.z + 10.13489));
  const surface = new THREE.Vector3(0, -0.02, 0);
  const landmarks = [center];
  for (const x of [chair.min[0], chair.max[0]])
    for (const y of [chair.min[1], chair.max[1]])
      for (const z of [chair.min[2], chair.max[2]]) landmarks.push(new THREE.Vector3(x, y, z));
  // Extracted table/chair use source-centered local geometry. The room's
  // internal anchor aligns those same source points by an equivalent transform.
  const expected = landmarks.map(point => point.clone().sub(center).multiplyScalar(scale).applyQuaternion(rotation).add(surface));
  const states = [
    { section: 'hero', progress: 0, openingProgress: 0, scrollDistance: 0 },
    { section: 'grip', progress: 0.5, scrollDistance: 25.5 },
    { section: 'sustainability', progress: 0.5, scrollDistance: 32.702222222222225 },
    { section: 'product', progress: 0.5, scrollDistance: 54.3 },
    { section: 'footer', progress: 1, scrollDistance: 64.44888888888889 },
  ];
  const colors = new Set();
  for (const path of [[states[2]], [states[3]], states, states.toReversed(), [{ section: 'product', progress: 0.5 }]]) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050505');
    scene.fog = new THREE.Fog('#050505', 1, 100);
    const root = new THREE.Group();
    const anchor = new THREE.Group();
    anchor.quaternion.copy(rotation);
    anchor.scale.setScalar(scale);
    anchor.position.copy(center).applyQuaternion(rotation).multiplyScalar(-scale).add(surface);
    root.add(anchor);
    scene.add(root);
    let lightsMoving = false;
    const journey = createRestaurantJourney(scene, root, () => lightsMoving);
    const canvas = { dataset: {} };
    for (const state of path) {
      for (const damping of [0.25, 1]) {
        journey.update(state, damping, canvas);
        scene.updateMatrixWorld(true);
        landmarks.forEach((point, index) => {
          assert.ok(point.clone().applyMatrix4(anchor.matrixWorld).distanceTo(expected[index]) < 1e-10,
            `${state.section}: scroll must not detach the room from source table/chair landmark ${index}`);
        });
        assert.equal(canvas.dataset.roomPosition, '0.000,0.000,0.000');
        assert.equal(canvas.dataset.roomYaw, '0.0000');
        assert.ok(scene.fog.color.equals(scene.background));
      }
      colors.add(scene.background.getHexString());
    }
    lightsMoving = true;
    assert.equal(journey.update(path.at(-1), 1, canvas), true, 'light interpolation still requests continuation');
    lightsMoving = false;
    assert.equal(journey.update(path.at(-1), 1, canvas), false, 'settled atmosphere can sleep');
  }
  assert.ok(colors.size > 1, 'fixed room geometry retains changing chapter atmospheres');
});
