import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as director from '../components/immersive/SceneDirector.js';
import * as THREE from 'three';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dolly = await import(pathToFileURL(resolve(process.env.VISTAIRE_DOLLY_SOURCE || 'components/immersive/CameraDolly.js')));
import { projectHullBounds } from '../components/immersive/ProjectedBounds.js';

function assertNearClearance(vertices, root, camera, label) {
  root.updateWorldMatrix(true, false);
  const view = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, root.matrixWorld);
  const point = new THREE.Vector3();
  assert.ok(vertices.every(vertex => point.fromArray(vertex).applyMatrix4(view).z <= -camera.near * 2 + 1e-9), `${label}: every actual hull vertex retains twice-near clearance`);
}

function assertWholeFoodFit(bounds, focus, width, height, label) {
  assert.ok(bounds.x >= (focus.x - focus.width / 2) * width - 0.1 && bounds.x + bounds.width <= (focus.x + focus.width / 2) * width + 0.1, `${label}: food sides clipped`);
  assert.ok(bounds.y >= (focus.y - focus.height / 2) * height - 0.1 && bounds.y + bounds.height <= (focus.y + focus.height / 2) * height + 0.1, `${label}: food top or bottom clipped`);
}

test('yaw preserves the camera at cropped maximum zoom and reset restores the complete food', () => {
  const source = readFileSync(process.env.VISTAIRE_SCENE_SOURCE || 'components/immersive/Scene.jsx', 'utf8');
  const hulls = JSON.parse(readFileSync('public/immersive-assets/dishes/framing-hulls.json', 'utf8')).byUrl;
  const footprints = { homard: 1.75, souffle: 1.65, huitres: 1.5, sushi: 2, "chocolat-fume": 1.5, poutine: 1.75, burger: 1.1 };
  const profiles = [
    { width: 390, height: 844, focus: { x: 0.5, y: (223.34375 + 337.65625 / 2) / 844, width: 0.9, height: 337.65625 / 844 } },
    { width: 430, height: 932, focus: { x: 0.5, y: (223.34375 + 425.65625 / 2) / 932, width: 0.9, height: 425.65625 / 932 } },
    { width: 1440, height: 900, focus: { x: (123.828125 + 1192.328125 / 2) / 1440, y: (249.734375 + 370.578125 / 2) / 900, width: 1192.328125 / 1440, height: 370.578125 / 900 } },
    { width: 1337, height: 591, focus: { x: (576.96875 + 736.015625 / 2) / 1337, y: (76 + 499 / 2) / 591, width: 736.015625 / 1337, height: 499 / 591 } },
  ];
  for (const { width, height, focus } of profiles) for (const [id, footprint] of Object.entries(footprints)) {
    const mobile = width < 768;
    const hull = id === 'homard' ? hulls[mobile ? '/media/homard-mobile.glb' : '/media/homard.glb'] : Object.values(hulls).find(h => h.id === id);
    const displayScale = mobile ? (id === 'burger' ? 0.55 : 1) : footprint / 2.35;
    const scene = new THREE.Scene();
    const roots = Array.from({ length: 4 }, () => new THREE.Group());
    roots.forEach(root => scene.add(root));
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 200);
    const scope = {
      ...director, ...dolly, THREE, HALF_PI: Math.PI / 2, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), smooth: director.cinematicEase,
      scene, camera, dishRoot: roots[0], supportRoot: roots[1], phoneRoot: roots[2], laptopRoot: roots[3],
      supportAssets: { active: null }, laptopAsset: {}, corner: new THREE.Vector3(), referenceCamera: camera.clone(), calibrations: new Map(), mobileViewport: () => mobile, fallbackFocus: director.DEFAULT_SCENE_FRAME,
      canvas: { clientWidth: width, clientHeight: height }, activeDish: true,
      dishLocalBounds: new THREE.Box3(new THREE.Vector3(...hull.bounds.min).multiplyScalar(displayScale), new THREE.Vector3(...hull.bounds.max).multiplyScalar(displayScale)),
      dishFramingRadius: Math.max(...hull.vertices.map(([x, , z]) => Math.hypot(x, z))) * displayScale,
      dishZoomCorner: new THREE.Vector3(), projectionState: null, projectionSettling: false, framingReference: null,
      applyTransform: (root, position, rotation, scale) => { root.position.fromArray(position); root.quaternion.setFromEuler(new THREE.Euler(...rotation)); root.scale.setScalar(scale); root.visible = scale > 0.003; },
    };
    vm.createContext(scope);
    vm.runInContext(source.match(/function minimumDishY\([^]*?\n}/)[0], scope);
    vm.runInContext(source.slice(source.indexOf('function baseComposition('), source.indexOf('\nfunction composition(')), scope);
    vm.runInContext(source.slice(source.indexOf('    function projectedExtent('), source.indexOf('    function cameraComposition(')), scope);
    scope.cameraComposition = state => scope.calibration('grip', state);
    vm.runInContext(source.slice(source.indexOf('    function frameSubjects('), source.indexOf('      const viewport = { width: viewportWidth')) + '}', scope);
    const state = { section: 'grip', dishZoom: 1, sceneFrame: focus, sceneFrames: { grip: focus } };
    const root = roots[0];
    root.position.set(0, 0.2, 0);
    root.scale.setScalar(mobile ? 0.98 : 1);
    // Analytic all-yaw bound for the actual AABB clearance rule. A yaw-invariant
    // cylinder alone would not suffice if that rule could lift the root.
    const boxRadius = Math.hypot(Math.max(Math.abs(scope.dishLocalBounds.min.x), Math.abs(scope.dishLocalBounds.max.x)), Math.max(Math.abs(scope.dishLocalBounds.min.z), Math.abs(scope.dishLocalBounds.max.z)));
    const highestClearance = -0.02 + root.scale.x * (boxRadius * Math.sin(0.1) - scope.dishLocalBounds.min.y * Math.cos(0.1));
    assert.ok(highestClearance <= 0.2, `${id}: every allowed yaw must retain the authored root height`);
    root.quaternion.setFromEuler(new THREE.Euler(0.1, 0, 0));
    const cameraPose = () => [...camera.position.toArray(), ...scope.projectionState.look, camera.view.offsetX, camera.view.offsetY];
    const vertices = hull.vertices.map(point => point.map(v => v * displayScale));
    const food = () => {
      assertNearClearance(vertices, root, camera, `${id}/${width}`);
      return projectHullBounds(vertices, root.matrixWorld, camera, { width, height });
    };
    scope.frameSubjects(state, 1);
    const original = food();
    assertWholeFoodFit(original, focus, width, height, `${id}/${width} at 100%`);
    const initial = cameraPose();
    root.quaternion.setFromEuler(new THREE.Euler(0.1, Math.PI / 4, 0));
    scope.frameSubjects(state, 1);
    cameraPose().forEach((value, i) => assert.ok(Math.abs(value - initial[i]) < 1e-9, 'yaw alone must not change camera, aim or view offset'));
    assertWholeFoodFit(food(), focus, width, height, `${id}/${width} yaw at 100%`);
    assert.equal(scope.baseComposition({ section: 'grip', dishPitch: 0.7 }, mobile).dishRotation[0], 0.1, 'interactive pitch cannot alter the authored flat rotation');
    const reference = scope.calibration('grip', state);
    const cap = reference.zoomMax;
    assert.ok(Number.isFinite(cap) && cap > 4, `${id}/${width}: close-up maximum must not retain the old 400% ceiling`);
    assert.equal(cap, Math.floor(reference.distance / reference.minimumDistance * 100) / 100, 'advertise the achievable near-plane maximum rounded down to a whole percent');
    root.quaternion.setFromEuler(new THREE.Euler(0.1, 0, 0));
    state.dishZoom = 1.2;
    scope.frameSubjects(state, 1);
    const enlarged = food();
    assert.ok(enlarged.width > original.width * 1.1 && enlarged.height > original.height * 1.1);
    state.dishZoom = cap;
    scope.frameSubjects(state, 1);
    const maximum = cameraPose();
    assert.ok(food().width > enlarged.width * 1.1, `${id}/${width}: the larger advertised cap must visibly enlarge the food beyond 120%`);
    assert.ok(Math.abs(reference.distance / camera.position.distanceTo(new THREE.Vector3(...reference.look)) - cap) < 1e-9, 'the camera must actually reach its advertised cap');
    assert.deepEqual(root.scale.toArray(), Array(3).fill(mobile ? 0.98 : 1), 'zoom must never resize the food');
    for (const yaw of [Math.PI / 4, Math.PI, -Math.PI, -Math.PI / 2, 0]) {
      const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, yaw, 0));
      for (let frame = 0; frame < 60; frame++) {
        root.quaternion.slerp(target, 1 - Math.exp(-1 / 60 * 10));
        assert.ok(scope.minimumDishY(scope.dishLocalBounds, root.quaternion, root.scale.x, -0.02) <= 0.2, `${id}: the canonical flat-yaw height must stay clear of the table`);
        scope.frameSubjects(state, 1 - Math.exp(-1 / 60 * 10));
        cameraPose().forEach((value, i) => assert.ok(Math.abs(value - maximum[i]) < 1e-8, 'damped yaw and wrap must not reframe the camera'));
        food(); // Cropping is intentional at maximum; actual hull depth is not.
      }
    }
    state.dishZoom = 1;
    for (let frame = 0; frame < 120; frame++) {
      scope.frameSubjects(state, 1 - Math.exp(-1 / 60 * 10));
      const bounds = food();
      if (scope.projectionState.dolly <= 1.0002) assertWholeFoodFit(bounds, focus, width, height, `${id}/${width} reset frame ${frame}`);
      if (!scope.projectionSettling) break; // Match the real renderer's stop condition.
    }
    assert.equal(scope.projectionSettling, false, 'reset must reach the renderer idle condition');
    assertWholeFoodFit(food(), focus, width, height, `${id}/${width} settled reset`);
    cameraPose().forEach((value, i) => assert.ok(Math.abs(value - initial[i]) < 0.0002, 'reset restores the original 100% camera, aim and view offset'));
  }
});

test('default full-fit mode contains the rotated food inside desktop and phone scissor frames', () => {
  assert.equal(typeof dolly.minimumDollyDistance, 'function', 'near-plane safety alone cannot prevent a clipped zoom');
  for (const [width, height] of [[1440, 900], [1337, 591], [390, 844], [430, 932]]) {
    for (const [yaw, pitch] of [[0, 0], [0.9, 0.45], [2.4, -0.6]]) {
      for (const size of [[1.1, 1.35, 1.1], [2.35, 0.3, 1.8]]) {
        const frame = { x: 0.5, y: 0.56, width: width < 768 ? 0.9 : 0.6, height: 0.38 };
        const root = new THREE.Group();
        root.position.set(0, 0.2, 0);
        root.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0));
        root.scale.setScalar(pitch < 0 ? 0.83 : 1.17);
        root.updateMatrixWorld(true);
        const localBounds = new THREE.Box3(new THREE.Vector3(-size[0] / 2, 0, -size[2] / 2), new THREE.Vector3(size[0] / 2, size[1], size[2] / 2));
        const radius = Math.hypot(size[0], size[2]) / 2;
        const surface = [];
        // Check the actual finite cylinder surface, not empty enclosing-box corners.
        for (const y of [0, size[1]]) for (let sample = 0; sample < 128; sample++) {
          const angle = sample / 128 * Math.PI * 2;
          surface.push(new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle)).applyMatrix4(root.matrixWorld).toArray());
        }
        const look = new THREE.Box3().setFromPoints(surface.map(p => new THREE.Vector3(...p))).getCenter(new THREE.Vector3()).toArray();
        const position = look.map((v, i) => v + [0, 2.2, 6.3][i]);
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 200);
        for (const [shiftX, shiftY] of [[-0.04, 0.025], [0, 0], [0.025, -0.035]]) {
          assert.ok(frame.width * 0.94 > Math.abs(shiftX) * 2 && frame.height * 0.94 > Math.abs(shiftY) * 2, 'real focus side-plane denominators stay positive');
          const minimum = dolly.minimumDollyDistance(localBounds, radius, root, position, look, { fov: 40, aspect: width / height, near: 0.05, width: frame.width, height: frame.height, shiftX, shiftY });
          const fit = dolly.cameraDollyPose(position, look, 4, minimum);
          camera.position.fromArray(fit.camera);
          camera.lookAt(new THREE.Vector3(...look));
          camera.setViewOffset(width, height, (0.5 - frame.x + shiftX) * width, (0.5 - frame.y - shiftY) * height, width, height);
          const bounds = projectHullBounds(surface, new THREE.Matrix4(), camera, { width, height });
          assert.ok(surface.every(point => new THREE.Vector3(...point).applyMatrix4(camera.matrixWorldInverse).z <= -camera.near * 2 + 1e-9), 'all cylinder points retain near-plane clearance');
          assert.ok(bounds.x >= (frame.x - frame.width / 2) * width - 1e-5);
          assert.ok(bounds.x + bounds.width <= (frame.x + frame.width / 2) * width + 1e-5);
          assert.ok(bounds.y >= (frame.y - frame.height / 2) * height - 1e-5, 'food top must survive zoom and pitch');
          assert.ok(bounds.y + bounds.height <= (frame.y + frame.height / 2) * height + 1e-5, 'food bottom must survive zoom and pitch');
          assert.ok(Number.isFinite(fit.distance));
        }
      }
    }
  }
  const root = new THREE.Group();
  const bounds = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
  const minimum = dolly.minimumDollyDistance(bounds, 1, root, [0, 0, 5], [0, 0, 0], { fov: 100, aspect: 1, near: 2, width: 1, height: 1, shiftX: 0, shiftY: 0 });
  assert.equal(minimum, 5, 'when the near plane dominates, retain twice-near clearance beyond the cylinder surface');
});

// Actual shipped scan + actual frameSubjects/calibration code. This protects
// the rendered damping guard, which a standalone fit-helper test cannot see.
test('close-up reset and chapter transitions preserve hull depth, then restore full fit at 100%', () => {
  const source = readFileSync(process.env.VISTAIRE_SCENE_SOURCE || 'components/immersive/Scene.jsx', 'utf8');
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
    dishFramingRadius: Math.max(...hull.vertices.map(([x, , z]) => Math.hypot(x, z))) * displayScale,
    dishZoomCorner: new THREE.Vector3(), projectionState: null, projectionSettling: false, framingReference: null,
    applyTransform: (root, position, rotation, scale) => { root.position.fromArray(position); root.quaternion.setFromEuler(new THREE.Euler(...rotation)); root.scale.setScalar(scale); root.visible = scale > 0.003; },
  };
  vm.createContext(scope);
  vm.runInContext(source.slice(source.indexOf('function baseComposition('), source.indexOf('\nfunction composition(')), scope);
  vm.runInContext(source.slice(source.indexOf('    function projectedExtent('), source.indexOf('    function cameraComposition(')), scope);
  scope.cameraComposition = state => scope.calibration('grip', state);
  vm.runInContext(source.slice(source.indexOf('    function frameSubjects('), source.indexOf('      const viewport = { width: viewportWidth')) + '}', scope);
  const state = { section: 'grip', dishZoom: 1, sceneFrame: focus, sceneFrames: { grip: focus } };
  roots[0].position.set(0, 0.2, 0);
  roots[0].quaternion.setFromEuler(new THREE.Euler(0.1, -Math.PI, 0));
  const damping = 1 - Math.exp(-1 / 60 * 10);
  state.dishZoom = scope.calibration('grip', state).zoomMax;
  scope.frameSubjects(state, 1);
  state.dishZoom = 1;
  const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0));
  const vertices = hull.vertices.map(point => point.map(v => v * displayScale));
  for (let frame = 0; frame < 120; frame++) {
    roots[0].quaternion.slerp(target, damping);
    roots[0].updateWorldMatrix(true, false);
    scope.frameSubjects(state, damping);
    assertNearClearance(vertices, roots[0], camera, `reversed sushi reset frame ${frame}`);
    const bounds = projectHullBounds(vertices, roots[0].matrixWorld, camera, { width: 1440, height: 900 });
    if (scope.projectionState.dolly <= 1.0002) assertWholeFoodFit(bounds, focus, 1440, 900, `reset frame ${frame}`);
    if (!scope.projectionSettling) break;
  }
  assert.equal(scope.projectionSettling, false, 'reversed-food reset must settle before rendering stops');
  assertWholeFoodFit(projectHullBounds(vertices, roots[0].matrixWorld, camera, { width: 1440, height: 900 }), focus, 1440, 900, 'settled reversed-food reset');
  // Neighbor frames and cached100% reference cameras come from ddb600c's
  // retained rendered-scroll-telemetry presentation samples (no active join):
  // mobile --afa87 (390x844), desktop --c4a2d (1440x900). Grip calibration is
  // recomputed from the actual sushi hull; neighbor GLTF calibration is captured
  // evidence, not rerun here. All composition, interpolation and guards are real.
  const profiles = [
    {
      width: 390, height: 844,
      frames: {
        encryption: {"x": 0.5, "y": 0.5755609449052133, "width": 0.9, "height": 0.6024326125592417},
        grip: {"x": 0.5, "y": 0.46465861966824645, "width": 0.9, "height": 0.4000666469194313},
        sustainability: {"x": 0.5, "y": 0.6536581753554502, "width": 0.9, "height": 0.478228672985782},
      },
      neighbors: {
        encryption: {"camera": [0.027335708936027492, 4.652719246712908, 7.991140723458387], "look": [0.027335708936027492, 1.1894514764005926, 2.5383361489241016], "distance": 6.459667280669033, "shiftX": 0.0, "shiftY": 0.009354087309624434, "dishOpacity": 1},
        sustainability: {"camera": [0.011199908804053638, 5.813829134702021, 11.985942801951746], "look": [0.011199908804053638, 1.196254347010756, -0.5599207721528211], "distance": 13.368645770606904, "shiftX": 0.0, "shiftY": -0.015537034274441919, "dishOpacity": 1},
      },
    },
    {
      width: 1440, height: 900,
      frames: {
        encryption: {"x": 0.5, "y": 0.6173524305555556, "width": 0.5980034722222223, "height": 0.4861979166666667},
        grip: {"x": 0.4999945746527778, "y": 0.483359375, "width": 0.8280056423611111, "height": 0.41175347222222225},
        sustainability: {"x": 0.7062879774305556, "y": 0.49694444444444447, "width": 0.5074327256944444, "height": 0.7538888888888889},
      },
      neighbors: {
        encryption: {"camera": [0.02637656125406157, 4.581627587298024, 8.314518961509776], "look": [0.02637656125406157, 1.1505233544216245, 2.0404997928215023], "distance": 7.150929505031514, "shiftX": 0.0, "shiftY": 0.004809054697775747, "dishOpacity": 1},
        sustainability: {"camera": [0.06704275964631379, 3.941921124274395, 7.497950504617637], "look": [0.06704275964631379, 1.196254347010756, -0.5560053753557039], "distance": 8.509106378952284, "shiftX": 0.0, "shiftY": -0.04531678410147147, "dishOpacity": 1},
      },
    },
  ];
  Object.assign(scope, { nativeTable: null, objectTarget: new THREE.Vector3(), targetEuler: new THREE.Euler(), targetQuaternion: new THREE.Quaternion(), calibrationKey: '', calibrationFrames: null, serializedFrames: '' });
  vm.runInContext(source.match(/function minimumDishY\([^]*?\n}/)[0], scope);
  vm.runInContext(source.slice(source.indexOf('function composition('), source.indexOf('\nfunction disposeTree(')), scope);
  vm.runInContext(source.match(/    function applyTransform\([^]*?\n    }/)[0], scope);
  vm.runInContext(source.slice(source.indexOf('    function cameraComposition('), source.indexOf('    function frameSubjects(')), scope);
  const targetStart = source.indexOf('      const tableSurfaceY =');
  const actualStart = source.indexOf('      applyTransform(\n        dishRoot,', targetStart);
  vm.runInContext(`function applyComposedPose(state, damping) {
    const pose = composition(state, mobileViewport());
    ${source.slice(targetStart, source.indexOf('      const pointer =', targetStart))}
    ${source.slice(actualStart, source.indexOf('      applyTransform(\n        laptopRoot,', actualStart))}
    for (const [root, name] of [[supportRoot, 'support'], [phoneRoot, 'phone'], [laptopRoot, 'laptop']])
      applyTransform(root, pose[name], pose[name + 'Rotation'], pose[name + 'Scale'], damping);
  }`, scope);
  let safetyCalls = 0;
  scope.minimumDollyDistance = (...args) => {
    const frame = args[5];
    assert.ok(frame.width * 0.94 > 2 * Math.abs(frame.shiftX || 0) && frame.height * 0.94 > 2 * Math.abs(frame.shiftY || 0), 'target and rendered side-plane denominators stay positive');
    safetyCalls++;
    return dolly.minimumDollyDistance(...args);
  };
  for (const profile of profiles) {
    const { width, height } = profile, mobile = width < 768;
    const currentScale = mobile ? 1 : displayScale;
    const vertices = hull.vertices.map(point => point.map(v => v * currentScale));
    scope.mobileViewport = () => mobile;
    Object.assign(scope.canvas, { clientWidth: width, clientHeight: height, width, height, dataset: { model: 'sushi' } });
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    scope.dishLocalBounds.set(new THREE.Vector3(...hull.bounds.min).multiplyScalar(currentScale), new THREE.Vector3(...hull.bounds.max).multiplyScalar(currentScale));
    scope.dishFramingRadius = Math.max(...hull.vertices.map(([x, , z]) => Math.hypot(x, z))) * currentScale;
    Object.assign(state, { section: 'grip', transition: null, sceneFrames: profile.frames, drag: 0.82 });
    const cap = scope.cameraComposition(state).zoomMax;
    for (const [section, reference] of Object.entries(profile.neighbors)) scope.calibrations.set(`${section}:null`, reference);
    for (const [from, to] of [['encryption', 'grip'], ['grip', 'sustainability']]) for (const reverse of [false, true]) for (const reset of [false, true]) {
      scope.projectionState = null;
      const scales = new Set(), cameras = new Set(), focuses = new Set();
      for (let frame = 0; frame < 60; frame++) {
        const progress = reverse ? 1 - frame / 59 : frame / 59;
        Object.assign(state, { section: progress < 0.5 ? from : to, dishZoom: reset && frame >= 30 ? 1 : cap, transition: { from, to, progress, fromProgress: 1, toProgress: 0 } });
        state.sceneFrame = director.transitionSceneFrame(state.transition, state.sceneFrames);
        scope.applyComposedPose(state, frame ? damping : 1);
        const beforeFit = safetyCalls;
        scope.frameSubjects(state, frame ? damping : 1);
        if (!roots[0].visible) continue;
        assert.ok(safetyCalls - beforeFit >= 2, 'visible transitioning food uses both target and rendered safety guards');
        roots[0].updateWorldMatrix(true, false);
        assertNearClearance(vertices, roots[0], camera, `${width}/${from}:${to} frame ${frame}`);
        const bounds = projectHullBounds(vertices, roots[0].matrixWorld, camera, { width, height });
        const focus = scope.framingReference.focus;
        if (state.dishZoom <= 1 && scope.projectionState.dolly <= 1.0002) assertWholeFoodFit(bounds, focus, width, height, `${width}/${from}:${to} frame ${frame}`);
        scales.add(roots[0].scale.x.toFixed(4));
        cameras.add(camera.position.toArray().join(','));
        focuses.add(JSON.stringify(focus));
      }
      assert.ok(scales.size > 1 && cameras.size > 1 && focuses.size > 1, 'the proof must exercise actual changing scale, camera and focus');
      if (reset) {
        for (let frame = 0; frame < 120; frame++) {
          scope.applyComposedPose(state, damping);
          scope.frameSubjects(state, damping);
          if (!roots[0].visible) continue;
          assertNearClearance(vertices, roots[0], camera, `${width}/${from}:${to} settling frame ${frame}`);
          if (scope.projectionState.dolly <= 1.0002) assertWholeFoodFit(projectHullBounds(vertices, roots[0].matrixWorld, camera, { width, height }), scope.framingReference.focus, width, height, `${width}/${from}:${to} settled reset frame ${frame}`);
          if (!scope.projectionSettling) break;
        }
        assert.equal(scope.projectionSettling, false, 'transition reset reaches renderer idle with the complete food framed');
        if (roots[0].visible) assertWholeFoodFit(projectHullBounds(vertices, roots[0].matrixWorld, camera, { width, height }), scope.framingReference.focus, width, height, `${width}/${from}:${to} first idle frame`);
      }
    }
  }
});

// A screen-space fit alone cannot detect opaque-table occlusion. These are
// the shipped scans that reproduced the dip during rotation and Home/reset.
test('rotating and resetting food keeps every transformed hull point above the tabletop without resizing it', () => {
  const source = readFileSync(process.env.VISTAIRE_SCENE_SOURCE || 'components/immersive/Scene.jsx', 'utf8');
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
      scope.dishFramingRadius = Math.max(...hull.vertices.map(([x, , z]) => Math.hypot(x, z))) * displayScale;
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
  const source = readFileSync(process.env.VISTAIRE_SCENE_SOURCE || 'components/immersive/Scene.jsx', 'utf8');
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
    dishFramingRadius: Math.max(...hull.vertices.map(([x, , z]) => Math.hypot(x, z))),
    dishZoomCorner: new THREE.Vector3(), projectionState: null, projectionSettling: false, framingReference: null,
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

// Run the full production fitting path; count serialization without replacing
// calibration math or inventing bounds for a laptop that has not loaded yet.
function referenceFixture(diagnosticsEnabled = false) {
  const source = readFileSync(process.env.VISTAIRE_SCENE_SOURCE || 'components/immersive/Scene.jsx', 'utf8');
  const scene = new THREE.Scene();
  const roots = Array.from({ length: 4 }, () => new THREE.Group());
  roots.forEach(root => scene.add(root));
  const camera = new THREE.PerspectiveCamera(40, 1440 / 900, 0.05, 200);
  const notices = [], serialized = [];
  const scope = {
    ...director, ...dolly, THREE, HALF_PI: Math.PI / 2,
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)), scene, camera,
    dishRoot: roots[0], supportRoot: roots[1], phoneRoot: roots[2], laptopRoot: roots[3],
    supportAssets: { active: null }, laptopAsset: { framingBounds: new THREE.Box3() },
    corner: new THREE.Vector3(), referenceCamera: camera.clone(), mobileViewport: () => false,
    canvas: { clientWidth: 1440, clientHeight: 900, width: 1440, height: 900, dataset: { model: 'homard', laptopReady: 'false' } },
    activeDish: null, nativeTable: null, diagnosticsEnabled, phoneVideo: { playbackRate: 1 },
    callbacks: { current: { onZoomFit: notice => notices.push(notice) } },
    JSON: { stringify(value) { serialized.push(value); return JSON.stringify(value); } },
    applyTransform: (root, position, rotation, scale) => {
      root.position.fromArray(position); root.quaternion.setFromEuler(new THREE.Euler(...rotation));
      root.scale.setScalar(scale); root.visible = scale > 0.003;
    },
  };
  vm.createContext(scope);
  vm.runInContext(source.slice(source.indexOf('function baseComposition('), source.indexOf('\nfunction composition(')), scope);
  vm.runInContext(source.slice(source.indexOf('    const calibrations = new Map();'), source.indexOf('    let foregroundLayerKey =')), scope);
  return { scope, notices, serialized };
}

test('full camera fitting serializes pose and view diagnostics only when explicitly enabled', () => {
  for (const enabled of [false, true]) {
    const f = referenceFixture(enabled);
    const focus = { x: 0.5, y: 0.465, width: 0.9, height: 0.4 };
    const state = { section: 'grip', dishZoom: 1, sceneFrame: focus, sceneFrames: { grip: focus } };
    f.scope.frameSubjects(state, 1);
    assert.equal(f.notices.length, 1, 'the functional zoom callback survives diagnostics gating');
    assert.equal(f.scope.canvas.dataset.phoneRate, '1', 'lightweight playback evidence remains available');
    for (const key of ['cameraViewOffset', 'fittedCameraPosition', 'fittedLook', 'dishScale', 'cameraDistance', 'fittedZoom'])
      assert.equal(key in f.scope.canvas.dataset, enabled, `${key}: explicit diagnostics only`);
    assert.equal(f.serialized.includes(f.scope.camera.view), enabled, 'default fitting never serializes the camera view');
    assert.ok(f.scope.camera.position.toArray().every(Number.isFinite));
  }
});

test('stable reference-frame identity avoids serialization while real frame, asset and viewport changes recalibrate', () => {
  const f = referenceFixture();
  const focus = { x: 0.5, y: 0.5, width: 0.8, height: 0.4 };
  const state = { section: 'sustainability', sceneFrames: { sustainability: focus } };
  const initial = f.scope.cameraComposition(state);
  assert.ok([...initial.camera, ...initial.look, initial.distance].every(Number.isFinite), 'unloaded laptop uses a finite authored reference');
  assert.ok(f.scope.laptopAsset.framingBounds.isEmpty(), 'pending load must not manufacture proxy geometry');
  for (let frame = 0; frame < 12; frame++) {
    state.progress = frame / 12;
    assert.equal(f.scope.cameraComposition(state), initial, 'scroll reuses the calibrated reference');
  }
  assert.equal(f.serialized.filter(value => value === state.sceneFrames).length, 1, 'unchanged sceneFrames identity must serialize only once');
  const oldFrames = state.sceneFrames;
  state.sceneFrames = { sustainability: { ...focus, height: 0.2 } };
  const reframed = f.scope.cameraComposition(state);
  assert.notEqual(reframed, initial, 'new frame geometry invalidates calibration');
  assert.equal(f.serialized.filter(value => value === state.sceneFrames).length, 1);
  assert.equal(f.serialized.filter(value => value === oldFrames).length, 1);
  f.scope.laptopAsset.framingBounds.set(new THREE.Vector3(-1.56, 0, -1), new THREE.Vector3(1.56, 2, 1));
  f.scope.canvas.dataset.laptopReady = 'true';
  let previous = f.scope.cameraComposition(state);
  assert.notEqual(previous, reframed, 'arrival of the real laptop replaces the pending reference');
  assert.notDeepEqual([...previous.camera], [...reframed.camera], 'real laptop bounds affect the fitted camera');
  for (const [key, value] of [['model', 'sushi'], ['support', 'bois'], ['supportReady', 'true'], ['phoneReady', 'true']]) {
    f.scope.canvas.dataset[key] = value;
    const next = f.scope.cameraComposition(state);
    assert.notEqual(next, previous, `${key}: asset changes invalidate calibration`);
    previous = next;
  }
  f.scope.canvas.width = 430;
  assert.notEqual(f.scope.cameraComposition(state), previous, 'drawing-size changes invalidate calibration');
  assert.equal(f.serialized.filter(value => value === state.sceneFrames).length, 1, 'asset and size changes reuse the stable frame serialization');
});


test('laptop model arrival replaces its empty reference before the dashboard image is ready', () => {
  const f = referenceFixture();
  const state = { section: 'sustainability', sceneFrames: { sustainability: { x: 0.5, y: 0.5, width: 0.8, height: 0.4 } } };
  const pending = f.scope.cameraComposition(state);
  assert.ok([...pending.camera, ...pending.look, pending.distance].every(Number.isFinite));
  f.scope.laptopAsset.framingBounds.set(new THREE.Vector3(-1.56, 0, -1), new THREE.Vector3(1.56, 2, 1));
  assert.equal(f.scope.canvas.dataset.laptopReady, 'false');
  const modelReady = f.scope.cameraComposition(state);
  assert.notEqual(modelReady, pending, 'real model bounds invalidate the authored fallback before the image finishes');
  assert.notDeepEqual([...modelReady.camera], [...pending.camera]);
  assert.ok([...modelReady.camera, ...modelReady.look, modelReady.distance].every(Number.isFinite));
});

test('cropped close-up uses the cylinder near guard without silently retaining a screen-fit cap', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-1, -0.1, -1), new THREE.Vector3(1, 0.3, 1));
  const root = new THREE.Group();
  root.position.set(0, 0.2, 0);
  root.rotation.x = 0.1;
  const position = [0, 3, 10], look = [0, 0.3, 0];
  const frame = { fov: 40, aspect: 390 / 844, near: 0.05, width: 0.9, height: 0.4, shiftX: 0, shiftY: 0.02 };
  const whole = dolly.minimumDollyDistance(bounds, Math.SQRT2, root, position, look, frame);
  const near = dolly.minimumDollyDistance(bounds, Math.SQRT2, root, position, look, frame, false);
  assert.ok(near < whole / 2, 'requested close-up must be allowed past the complete-food screen fit');
  const direction = new THREE.Vector3(...position).sub(new THREE.Vector3(...look)).normalize();
  const pose = dolly.cameraDollyPose(position, look, 100, near);
  const eye = new THREE.Vector3(...pose.camera);
  let closestDepth = Infinity;
  for (const y of [bounds.min.y, bounds.max.y]) for (let i = 0; i < 360; i++) {
    const angle = i * Math.PI / 180;
    const point = new THREE.Vector3(Math.SQRT2 * Math.cos(angle), y, Math.SQRT2 * Math.sin(angle)).applyQuaternion(root.quaternion).add(root.position);
    const depth = eye.clone().sub(point).dot(direction);
    closestDepth = Math.min(closestDepth, depth);
    assert.ok(depth >= frame.near * 2 - 1e-9, 'cropping never cuts through the camera near plane');
  }
  assert.ok(Math.abs(closestDepth - frame.near * 2) < 1e-9, 'the maximum reaches the cylinder front plus the twice-near guard');
});

test('the actual opening camera track stops at the AI reading plateau in both directions', () => {
  const source = readFileSync(process.env.VISTAIRE_SCENE_SOURCE || 'components/immersive/Scene.jsx', 'utf8');
  // ddb600c retained mobile rendered-scroll-telemetry (--afa87), samples
  // 202/203/206 at p=.375444/.499667/.625370, replayed as .375/.5/.625 anchors.
  // These are measured poses, not a recreation of model calibration or GPU
  // work; the production interpolation alone is under test at the AI midpoint.
  const captured = [
    { camera: [0.03743780676883769, 6.249342728233127, 10.603290393279588], look: [0.03743780676883769, 1.062870234999014, 0.7012229131872361], distance: 11.178123156566874, shiftX: 0, shiftY: 30.586785795409856 / 844, dishOpacity: 1 },
    { camera: [0.03928231310128377, 6.96640574835967, 10.086790483483966], look: [0.03928231310128377, 1.2104652375497669, 0.6769669068202662], distance: 11.030667745332492, shiftX: 0, shiftY: 42.97166823357118 / 844, dishOpacity: 1 },
    { camera: [0.07819529178107358, 6.144670868921719, 9.762985442217456], look: [0.07819529178107358, 1.2047920558313805, 0.6894646900596658], distance: 10.331078430050606, shiftX: 0, shiftY: 26.4184845652207 / 844, dishOpacity: 1 },
  ];
  const scope = { ...director, smooth: director.cinematicEase, calibrationFrames: null, serializedFrames: '', calibrationKey: '', calibrations: new Map(),
    canvas: { width: 390, height: 844, dataset: {} }, laptopAsset: {},
    calibration: (_section, _state, p) => captured[p < 0.5 ? 0 : p > 0.5 ? 2 : 1],
  };
  vm.createContext(scope);
  vm.runInContext(source.slice(source.indexOf('    function cameraComposition('), source.indexOf('    function frameSubjects(')), scope);
  const state = { sceneFrames: {}, openingProgress: 0.5 };
  const at = p => scope.cameraComposition({ ...state, openingProgress: p });
  const middle = at(0.5), epsilon = 1e-6;
  for (const side of [-1, 1]) {
    const adjacent = at(0.5 + side * epsilon);
    for (const field of ['camera', 'look']) middle[field].forEach((value, i) =>
      assert.ok(Math.abs((adjacent[field][i] - value) / epsilon) < 0.001, `${field}[${i}] has a velocity seam beside the constant AI hold`));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(middle)), captured[1], 'the replayed midpoint itself must not move');
});
