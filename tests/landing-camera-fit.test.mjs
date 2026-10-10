import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as director from '../components/immersive/SceneDirector.js';
import * as THREE from 'three';
import * as dolly from '../components/immersive/CameraDolly.js';
import { projectHullBounds } from '../components/immersive/ProjectedBounds.js';

test('zoom fits the complete rotated food inside the actual scissor frame at desktop and phone aspect ratios', () => {
  assert.equal(typeof dolly.minimumDollyDistance, 'function', 'near-plane safety alone cannot prevent a clipped zoom');
  for (const [width, height] of [[1440, 900], [1337, 591], [390, 844], [430, 932]]) {
    for (const [yaw, pitch] of [[0, 0], [0.9, 0.45], [2.4, -0.6]]) {
      for (const size of [[1.1, 1.35, 1.1], [2.35, 0.3, 1.8]]) {
        const frame = { x: 0.5, y: 0.56, width: width < 768 ? 0.9 : 0.6, height: 0.38 };
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.2, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0)), new THREE.Vector3(1, 1, 1));
        const corners = [];
        for (const x of [-size[0] / 2, size[0] / 2]) for (const y of [0, size[1]]) for (const z of [-size[2] / 2, size[2] / 2])
          corners.push(new THREE.Vector3(x, y, z).applyMatrix4(matrix).toArray());
        const look = new THREE.Box3().setFromPoints(corners.map(p => new THREE.Vector3(...p))).getCenter(new THREE.Vector3()).toArray();
        const position = look.map((v, i) => v + [0, 2.2, 6.3][i]);
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 200);
        for (const shift of [-0.015, 0, 0.015]) {
          const minimum = dolly.minimumDollyDistance(corners, position, look, { fov: 40, aspect: width / height, near: 0.05, width: frame.width, height: frame.height, shiftX: shift, shiftY: shift });
          const fit = dolly.cameraDollyPose(position, look, 4, minimum);
          camera.position.fromArray(fit.camera);
          camera.lookAt(new THREE.Vector3(...look));
          camera.setViewOffset(width, height, (0.5 - frame.x + shift) * width, (0.5 - frame.y - shift) * height, width, height);
          const bounds = projectHullBounds(corners, new THREE.Matrix4(), camera, { width, height });
          assert.ok(bounds.x >= (frame.x - frame.width / 2) * width - 1e-5);
          assert.ok(bounds.x + bounds.width <= (frame.x + frame.width / 2) * width + 1e-5);
          assert.ok(bounds.y >= (frame.y - frame.height / 2) * height - 1e-5, 'food top must survive zoom and pitch');
          assert.ok(bounds.y + bounds.height <= (frame.y + frame.height / 2) * height + 1e-5, 'food bottom must survive zoom and pitch');
          assert.ok(Number.isFinite(fit.distance));
        }
      }
    }
  }
});

// Actual shipped scan + actual frameSubjects/calibration code. This protects
// the rendered damping guard, which a standalone fit-helper test cannot see.
test('resetting a fully zoomed, reversed sushi preserves every hull point on each damped frame', () => {
  const source = readFileSync('components/immersive/Scene.jsx', 'utf8');
  const hull = Object.values(JSON.parse(readFileSync('public/immersive-assets/dishes/framing-hulls.json', 'utf8')).byUrl).find(h => h.id === 'sushi');
  const scene = new THREE.Scene();
  const roots = Array.from({ length: 4 }, () => new THREE.Group());
  roots.forEach(root => scene.add(root));
  const camera = new THREE.PerspectiveCamera(40, 1440 / 900, 0.05, 200);
  const displayScale = 2 / 2.35;
  const focus = { x: 0.5, y: 0.52, width: 0.85, height: 0.28 };
  const scope = {
    ...director, ...dolly, THREE, HALF_PI: Math.PI / 2, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), smooth: director.cinematicEase,
    scene, camera, dishRoot: roots[0], supportRoot: roots[1], phoneRoot: roots[2], laptopRoot: roots[3],
    supportAssets: { active: null }, laptopAsset: {}, corner: new THREE.Vector3(), referenceCamera: camera.clone(), calibrations: new Map(), mobileViewport: () => false, fallbackFocus: director.DEFAULT_SCENE_FRAME,
    canvas: { clientWidth: 1440, clientHeight: 900 }, activeDish: true,
    dishLocalBounds: new THREE.Box3(new THREE.Vector3(...hull.bounds.min).multiplyScalar(displayScale), new THREE.Vector3(...hull.bounds.max).multiplyScalar(displayScale)),
    dishZoomCenter: new THREE.Vector3(), dishZoomCorner: new THREE.Vector3(), projectionState: null, projectionSettling: false, framingReference: null,
    applyTransform: (root, position, rotation, scale) => { root.position.fromArray(position); root.quaternion.setFromEuler(new THREE.Euler(...rotation)); root.scale.setScalar(scale); root.visible = scale > 0.003; },
  };
  vm.createContext(scope);
  vm.runInContext(source.slice(source.indexOf('function baseComposition('), source.indexOf('\nfunction composition(')), scope);
  vm.runInContext(source.slice(source.indexOf('    function projectedExtent('), source.indexOf('    function cameraComposition(')), scope);
  scope.cameraComposition = state => scope.calibration('grip', state);
  vm.runInContext(source.slice(source.indexOf('    function frameSubjects('), source.indexOf('      const viewport = { width: viewportWidth')) + '}', scope);
  const state = { section: 'grip', dishZoom: 4, sceneFrame: focus, sceneFrames: { grip: focus } };
  roots[0].position.set(0, 0.2, 0);
  roots[0].quaternion.setFromEuler(new THREE.Euler(0.1, -Math.PI, 0));
  const damping = 1 - Math.exp(-1 / 60 * 10);
  scope.frameSubjects(state, 1);
  state.dishZoom = 1;
  const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0));
  for (let frame = 0; frame < 15; frame++) {
    roots[0].quaternion.slerp(target, damping);
    roots[0].updateWorldMatrix(true, false);
    scope.frameSubjects(state, damping);
    const bounds = projectHullBounds(hull.vertices.map(point => point.map(v => v * displayScale)), roots[0].matrixWorld, camera, { width: 1440, height: 900 });
    assert.ok(bounds.y >= (focus.y - focus.height / 2) * 900 - 0.1, `reset frame ${frame}: food top clipped`);
    assert.ok(bounds.y + bounds.height <= (focus.y + focus.height / 2) * 900 + 0.1, `reset frame ${frame}: food bottom clipped`);
  }
});
