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

// A screen-space fit alone cannot detect opaque-table occlusion. These are
// the shipped scans that reproduced the dip during rotation and Home/reset.
test('rotating and resetting food keeps every transformed hull point above the tabletop without resizing it', () => {
  const source = readFileSync('components/immersive/Scene.jsx', 'utf8');
  const helper = source.match(/function minimumDishY\([^]*?\n}/)?.[0];
  assert.ok(helper, 'the actual and target dish poses need a tabletop-clearance constraint');
  const scope = { THREE, activeDish: new THREE.Group(), nativeTable: { metadata: { surfaceY: -0.02 } }, objectTarget: new THREE.Vector3(), targetEuler: new THREE.Euler(), targetQuaternion: new THREE.Quaternion() };
  vm.createContext(scope);
  vm.runInContext(helper, scope);
  const applyTransform = source.match(/    function applyTransform\([^]*?\n    }/)?.[0];
  const targetStart = source.indexOf('      const tableSurfaceY =');
  const targetEnd = source.indexOf('      const pointer =', targetStart);
  const actualStart = source.indexOf('      applyTransform(\n        dishRoot,', targetEnd);
  const actualEnd = source.indexOf('      applyTransform(\n        laptopRoot,', actualStart);
  assert.ok(applyTransform && targetStart > 0 && targetEnd > targetStart && actualStart > targetEnd && actualEnd > actualStart, 'exercise the production target and rendered-pose constraints');
  vm.runInContext(applyTransform, scope);
  const resizeStart = source.indexOf('      if (activeDish) {\n        const scale = dishPresentationScale(');
  assert.ok(resizeStart > 0, 'exercise the actual responsive food normalization');
  let resizeEnd = source.indexOf('{', resizeStart), depth = 1;
  while (depth && ++resizeEnd < source.length) {
    if (source[resizeEnd] === '{') depth++;
    else if (source[resizeEnd] === '}') depth--;
  }
  const productionSteps = [[targetStart, source.slice(targetStart, targetEnd)], [actualStart, source.slice(actualStart, actualEnd)], [resizeStart, source.slice(resizeStart, resizeEnd + 1)]].sort((a, b) => a[0] - b[0]);
  vm.runInContext(`function applyDishPose(pose, damping) {${productionSteps.map(([, code]) => code).join('\n')}}`, scope);
  const hullsByUrl = JSON.parse(readFileSync('public/immersive-assets/dishes/framing-hulls.json', 'utf8')).byUrl;
  const surfaceY = -0.02;
  const damping = 1 - Math.exp(-1 / 60 * 10);
  for (const id of ['homard', 'sushi']) {
    for (const mobile of [false, true]) {
      const hull = id === 'homard' ? hullsByUrl[mobile ? '/media/homard-mobile.glb' : '/media/homard.glb'] : Object.values(hullsByUrl).find(h => h.id === id);
      const displayScale = mobile ? 1 : (id === 'homard' ? 1.75 : 2) / 2.35;
      const scale = mobile ? 0.98 : 1;
      const bounds = new THREE.Box3(new THREE.Vector3(...hull.bounds.min).multiplyScalar(displayScale), new THREE.Vector3(...hull.bounds.max).multiplyScalar(displayScale));
      const points = hull.vertices.map(point => new THREE.Vector3(...point).multiplyScalar(displayScale));
      const corners = [];
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
      const root = new THREE.Group();
      root.position.set(0, 0.2, 0);
      root.scale.setScalar(scale);
      scope.dishRoot = root;
      scope.dishLocalBounds = bounds;
      scope.dishDisplayScale = displayScale;
      scope.mobileViewport = () => mobile;
      scope.dishPresentationScale = (_name, mobileViewport) => mobileViewport ? 1 : (id === 'homard' ? 1.75 : 2) / 2.35;
      scope.canvas = { dataset: { model: id } };
      // The flat, already-safe pose must be unchanged by the constraint.
      assert.equal(Math.max(root.position.y, scope.minimumDishY(bounds, root.quaternion, scale, surfaceY)), root.position.y);
      let reproduced = false;
      for (const [pitch, yaw] of [[0.66, Math.PI / 2], [0.8, -Math.PI], [-0.6, Math.PI / 2], [0.1, 0]]) {
        const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0));
        const targetY = Math.max(0.2, surfaceY - Math.min(...corners.map(point => point.clone().multiplyScalar(scale).applyQuaternion(target).y)));
        for (let frame = 0; frame < 60; frame++) {
          const pose = { dish: [0, 0.2, 0], dishRotation: [pitch, yaw, 0], dishScale: scale };
          scope.applyDishPose(pose, damping);
          assert.ok(Math.abs(pose.dish[1] - targetY) < 1e-10, 'the settling target must use the same minimum clearance');
          const uncorrectedMinimum = Math.min(...points.map(point => point.clone().multiplyScalar(scale).applyQuaternion(root.quaternion).y + 0.2));
          reproduced ||= uncorrectedMinimum < surfaceY - 0.1;
          root.updateMatrixWorld(true);
          const transformedMinimum = Math.min(...[...points, ...corners].map(point => point.clone().applyMatrix4(root.matrixWorld).y));
          assert.ok(transformedMinimum >= surfaceY - 1e-10, `${id}/${mobile ? 'mobile' : 'desktop'} frame ${frame}: food intersects tabletop`);
          assert.deepEqual(root.scale.toArray(), [scale, scale, scale], 'clearance must not shrink the food');
        }
      }
      assert.ok(reproduced, 'the shipped hull must exercise the original tabletop intersection');
      if (id === 'homard' && mobile) {
        // The first reduced-motion update after a responsive size change must
        // derive its corrected target from the newly normalized geometry.
        scope.mobileViewport = () => false;
        const pose = { dish: [0, 0.2, 0], dishRotation: [0.8, Math.PI / 3, 0], dishScale: 1 };
        scope.applyDishPose(pose, 1);
        const resizedCorners = corners.map(point => point.clone().multiplyScalar(1.75 / 2.35));
        const expectedY = Math.max(0.2, surfaceY - Math.min(...resizedCorners.map(point => point.applyQuaternion(root.quaternion).y)));
        assert.ok(Math.abs(pose.dish[1] - expectedY) < 1e-10, 'first resized target uses current food geometry');
        assert.ok(Math.abs(root.position.y - expectedY) < 1e-10, 'first resized rendered pose matches its corrected target');
      }
    }
  }
});

// Lifting a rotated plate above the table must not push it out of its existing
// scissor frame, even before the visitor requests any zoom.
test('the default-zoom camera fits a lifted high-pitch mobile homard', () => {
  const source = readFileSync('components/immersive/Scene.jsx', 'utf8');
  const hull = JSON.parse(readFileSync('public/immersive-assets/dishes/framing-hulls.json', 'utf8')).byUrl['/media/homard-mobile.glb'];
  assert.ok(hull, 'use the actual mobile homard scan');
  const scene = new THREE.Scene();
  const roots = Array.from({ length: 4 }, () => new THREE.Group());
  roots.forEach(root => scene.add(root));
  const camera = new THREE.PerspectiveCamera(40, 390 / 844, 0.05, 200);
  const focus = { x: 0.5, y: 0.465, width: 0.897, height: 0.41 };
  const scope = {
    ...director, ...dolly, THREE, HALF_PI: Math.PI / 2, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), smooth: director.cinematicEase,
    scene, camera, dishRoot: roots[0], supportRoot: roots[1], phoneRoot: roots[2], laptopRoot: roots[3],
    supportAssets: { active: null }, laptopAsset: {}, corner: new THREE.Vector3(), referenceCamera: camera.clone(), calibrations: new Map(), mobileViewport: () => true, fallbackFocus: director.DEFAULT_SCENE_FRAME,
    canvas: { clientWidth: 390, clientHeight: 844 }, activeDish: true,
    dishLocalBounds: new THREE.Box3(new THREE.Vector3(...hull.bounds.min), new THREE.Vector3(...hull.bounds.max)),
    dishZoomCenter: new THREE.Vector3(), dishZoomCorner: new THREE.Vector3(), projectionState: null, projectionSettling: false, framingReference: null,
    applyTransform: (root, position, rotation, scale) => { root.position.fromArray(position); root.quaternion.setFromEuler(new THREE.Euler(...rotation)); root.scale.setScalar(scale); root.visible = scale > 0.003; },
  };
  vm.createContext(scope);
  vm.runInContext(source.match(/function minimumDishY\([^]*?\n}/)[0], scope);
  vm.runInContext(source.slice(source.indexOf('function baseComposition('), source.indexOf('\nfunction composition(')), scope);
  vm.runInContext(source.slice(source.indexOf('    function projectedExtent('), source.indexOf('    function cameraComposition(')), scope);
  scope.cameraComposition = state => scope.calibration('grip', state);
  vm.runInContext(source.slice(source.indexOf('    function frameSubjects('), source.indexOf('      const viewport = { width: viewportWidth')) + '}', scope);
  const state = { section: 'grip', dishZoom: 1, sceneFrame: focus, sceneFrames: { grip: focus } };
  roots[0].quaternion.setFromEuler(new THREE.Euler(0.8, Math.PI / 3, 0));
  roots[0].scale.setScalar(0.98);
  roots[0].position.set(0, Math.max(0.2, scope.minimumDishY(scope.dishLocalBounds, roots[0].quaternion, 0.98, -0.02)), 0);
  scope.frameSubjects(state, 1);
  roots[0].updateWorldMatrix(true, false);
  const bounds = projectHullBounds(hull.vertices, roots[0].matrixWorld, camera, { width: 390, height: 844 });
  assert.ok(bounds.y >= (focus.y - focus.height / 2) * 844 - 0.1, `lifted plate top clipped by ${(focus.y - focus.height / 2) * 844 - bounds.y}px at default zoom`);
  assert.ok(bounds.y + bounds.height <= (focus.y + focus.height / 2) * 844 + 0.1);
  assert.deepEqual(roots[0].scale.toArray(), [0.98, 0.98, 0.98]);
});
