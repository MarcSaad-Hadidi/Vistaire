import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { cameraDollyPose } from '../components/immersive/CameraDolly.js';
import { interpolatePose } from '../components/immersive/SceneDirector.js';

const source = readFileSync(process.env.VISTAIRE_SCENE_SOURCE || 'components/immersive/Scene.jsx', 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `production boundary: ${start} → ${end}`);
  return source.slice(a, b);
}
const render = new vm.Script('{\n' + between('          renderer.info.reset();', '\n        }\n        if (\n          !ready') + '\n}');

// Execute the production pass order with real Three transforms. GPU submission
// is replaced only at WebGLRenderer's matrix-update boundary; this is a CPU
// work/preservation test, not a browser pixel or GPU-speed assertion.
test('the two passes share current world matrices, including dirty descendants on the next frame', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050505');
  const room = new THREE.Group(), table = new THREE.Group(), phone = new THREE.Group();
  scene.add(room, table, phone);
  const screen = new THREE.Object3D();
  phone.add(screen);
  table.layers.set(2); phone.layers.set(1); screen.layers.set(1);
  for (const [name, object] of Object.entries({ room, table, phone, screen })) object.name = name;
  let updates = 0;
  const update = scene.updateMatrixWorld.bind(scene);
  scene.updateMatrixWorld = (...args) => { updates++; update(...args); };
  const camera = new THREE.PerspectiveCamera(40, 390 / 844, 0.05, 150);
  const cameraRig = new THREE.Group();
  cameraRig.position.set(0.2, 0, 0);
  cameraRig.add(camera); scene.add(cameraRig);
  camera.name = 'camera';
  const snapshots = [], passes = [];
  let failForeground = false;
  const renderer = {
    autoClear: true, shadowMap: { needsUpdate: false },
    info: { reset() {}, render: { calls: 2, triangles: 1, frame: 1 } },
    setScissor() {}, setScissorTest() {},
    render(renderedScene, renderedCamera) {
      if (renderedScene.matrixWorldAutoUpdate) renderedScene.updateMatrixWorld();
      if (renderedCamera.parent === null && renderedCamera.matrixWorldAutoUpdate) renderedCamera.updateMatrixWorld();
      snapshots.push([room, table, phone, screen, camera].map(object => [...object.matrixWorld.elements]));
      passes.push([renderedCamera.layers.mask, this.autoClear, renderedScene.background?.getHex() ?? null]);
      if (failForeground && renderedCamera.layers.mask === 2) throw new Error('submission failed');
    },
  };
  const scope = vm.createContext({ THREE, scene, camera, renderer, performance: { now: () => 1 },
    canvas: { dataset: { model: 'homard' }, clientWidth: 390, clientHeight: 844 },
    drawingSize: { width: 390, height: 844, pixelRatio: 3 },
    diagnosticsEnabled: false, state: { section: 'hero' }, authoredCamera: camera.position.clone(),
  });
  for (let frame = 0; frame < 2; frame++) {
    phone.position.x = frame + 0.75;
    screen.rotation.y = frame * 0.25;
    camera.position.set(0, 2 + frame, 7);
    camera.setViewOffset(390, 844, 17 + frame, -4, 390, 844);
    const expectedScene = scene.clone();
    expectedScene.updateMatrixWorld(true);
    const expected = [room, table, phone, screen, camera].map(object =>
      [...expectedScene.getObjectByName(object.name).matrixWorld.elements]);
    render.runInContext(scope);
    assert.deepEqual(snapshots.at(-2), expected, 'first pass includes every changed transform');
    assert.deepEqual(snapshots.at(-1), expected, 'foreground reuses identical transforms and camera');
    assert.equal(scene.matrixWorldAutoUpdate, true, 'future frames retain automatic updates');
  }
  assert.equal(updates, 2, 'one scene traversal per frame, not one per pass');
  assert.deepEqual(passes, [[5, true, 0x050505], [2, false, null], [5, true, 0x050505], [2, false, null]]);
  failForeground = true;
  assert.throws(() => render.runInContext(scope), /submission failed/);
  assert.equal(scene.matrixWorldAutoUpdate, true, 'a failed foreground submission cannot leave matrix updates disabled');
});

test('fitting and clipping reuse logical resize dimensions without per-frame layout reads', () => {
  let width = 390, height = 844, reads = 0;
  const canvas = { dataset: {}, width: 0, height: 0,
    get clientWidth() { reads++; return width; },
    get clientHeight() { reads++; return height; },
  };
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 150);
  let scissor;
  const renderer = { shadowMap: {}, info: { reset() {}, render: {} },
    setDrawingBufferSize(w, h, ratio) { canvas.width = Math.floor(w * ratio); canvas.height = Math.floor(h * ratio); },
    render() {}, setScissor(...value) { scissor = value; }, setScissorTest() {},
  };
  const focus = { x: 0.5, y: 0.5, width: 0.9, height: 0.4 };
  const scope = vm.createContext({ THREE, canvas, camera, renderer,
    window: { devicePixelRatio: 3 }, disposed: false, arExperience: null, invalidateScene() {},
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)), cameraDollyPose, interpolatePose,
    cameraComposition: () => ({ camera: [0, 2, 7], look: [0, 0, 0], shiftX: 0, shiftY: 0 }),
    fallbackFocus: focus, activeDish: false, projectionState: null, projectionSettling: false,
    framingReference: null, diagnosticsEnabled: false, scene: new THREE.Scene(), performance: { now: () => 1 },
    authoredCamera: new THREE.Vector3(), state: { section: 'grip', sceneFrame: focus },
  });
  vm.runInContext(between('    let drawingSize;', '    function applyTransform('), scope);
  vm.runInContext(between('    function frameSubjects(', '      const viewport = { width: viewportWidth') + '\n}', scope);
  for (const dimensions of [[390, 844], [430, 932], [844, 390], [390, 844]]) {
    [width, height] = dimensions;
    if (camera.view) {
      // A toolbar/orientation layout can change before its ResizeObserver. Use
      // the current drawing buffer's logical size until resize updates both.
      const previous = [camera.view.fullWidth, camera.view.fullHeight];
      const beforeResize = reads;
      scope.frameSubjects(scope.state, 1);
      render.runInContext(scope);
      assert.equal(reads, beforeResize);
      assert.deepEqual([camera.view.fullWidth, camera.view.fullHeight], previous);
    }
    scope.resize();
    const afterResize = reads;
    scope.frameSubjects(scope.state, 1);
    render.runInContext(scope);
    assert.equal(reads, afterResize, 'fit and clip must not read layout after App writes its scroll styles');
    assert.equal(camera.view.fullWidth, width);
    assert.equal(camera.view.fullHeight, height);
    assert.ok(canvas.width > width, 'drawing buffer remains Retina; view offsets use CSS pixels');
    assert.deepEqual(scissor, [(focus.x - focus.width / 2) * width, (1 - focus.y - focus.height / 2) * height, focus.width * width, focus.height * height]);
  }
});
