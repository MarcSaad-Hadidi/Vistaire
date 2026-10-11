import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRestaurantTable } from '../../src/RestaurantTable.js';
import { createRestaurantModel } from '../../src/RestaurantModel.js';

// An independent Vistaire scene. Geometry, light and camera are rendered at
// each exact frame time; this is not a pan over a still image.
const params = new URLSearchParams(location.search);
const portrait = params.get('format') === 'portrait';
const width = portrait ? 720 : 1280;
const height = portrait ? 1280 : 720;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setSize(width, height);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#050505');
scene.fog = new THREE.FogExp2('#050505', 0.016);
const camera = new THREE.PerspectiveCamera(portrait ? 39 : 35, width / height, 0.03, 35);
const environment = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(environment, 0.12);
scene.environment = env.texture;
scene.environmentIntensity = 0.32;
pmrem.dispose();

scene.add(new THREE.HemisphereLight('#f1e9da', '#1b1813', 1.5));
const key = new THREE.DirectionalLight('#fff1d8', 3);
key.position.set(-3.8, 5.5, 2.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left:-4, right:4, top:4, bottom:-4, near:0.1, far:15 });
key.shadow.normalBias = 0.012;
key.shadow.bias = -0.00008;
key.shadow.radius = 5;
key.shadow.intensity = 0.68;
scene.add(key);
const rim = new THREE.DirectionalLight('#d8a365', 2.5);
rim.position.set(2.5, 2.8, -3.8);
scene.add(rim);
const fill = new THREE.DirectionalLight('#f7e1c5', 0.35);
fill.position.set(1.5, 1.5, 4);
scene.add(fill);
const room = createRestaurantModel(scene, {
  renderer,
  canvas: renderer.domElement,
  disposeTree(root) {
    root.traverse(object => {
      object.geometry?.dispose();
      for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
        for (const texture of Object.values(material)) if (texture?.isTexture) texture.dispose();
        material.dispose();
      }
    });
  },
  onReady(model) {
    const nativeTable = createRestaurantTable(model, {
      width: 6, surfaceY: -0.02,
      placements: { placeSetting: [-1.8, 0.01, 0.7], glass: [2.05, 0.01, 0.3], candle: [-2.05, 0.01, 0.15] },
    });
    const center = nativeTable.metadata.sourceCenter;
    nativeTable.group.rotation.y = Math.atan2(-0.38353 - center[0], center[2] + 10.13489);
    nativeTable.excludeCopiedObjectsFromRoom();
    scene.add(nativeTable.group);
    return nativeTable.metadata;
  },
  onError(error) { throw error; },
});
await room.loading;
const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const dishName = params.get('dish') === 'souffle' ? 'souffle' : 'homard-mobile';
const gltf = await gltfLoader.loadAsync(`/media/${dishName}.glb`);
const dish = gltf.scene;
const bounds = new THREE.Box3().setFromObject(dish);
const size = bounds.getSize(new THREE.Vector3());
const center = bounds.getCenter(new THREE.Vector3());
// Match the interactive desktop portions on the original six-unit table.
// Preserve the already approved portrait film's original macro proportions.
const footprint = portrait ? 2.7 : dishName === 'souffle' ? 1.65 : 1.75;
const scale = footprint / Math.max(size.x, size.z);
dish.scale.multiplyScalar(scale);
dish.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
dish.traverse(object => {
  if (!object.isMesh) return;
  object.castShadow = true;
  object.receiveShadow = true;
  for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
    if ('envMapIntensity' in material) material.envMapIntensity = 0.35;
    if (material.emissiveMap) material.emissiveIntensity = 0.25;
  }
});
scene.add(dish);

const vignetteScene = new THREE.Scene();
const vignetteCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
vignetteScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.ShaderMaterial({ transparent:true, depthTest:false, depthWrite:false, vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.);}', fragmentShader:'varying vec2 vUv; void main(){vec2 p=(vUv-.5)*vec2(1.,.86);float v=smoothstep(.2,.69,length(p))*.4;gl_FragColor=vec4(.024,.014,.009,v);}' })));

window.renderCinematicFrame = function(seconds) {
  const phase=seconds/8*Math.PI*2;
  room.update({section:'grip',progress:(Math.sin(phase)+1)/2},1,renderer.domElement);
  const angle=(portrait ? 0.06 : -0.16) + Math.sin(phase)*0.12;
  const distance=(portrait ? 5.15 : 3.75) + Math.cos(phase)*0.13;
  const elevation=(portrait ? 4.25 : 3.1) + Math.sin(phase+0.4)*0.15;
  camera.position.set(Math.sin(angle)*distance,elevation,Math.cos(angle)*distance);
  camera.lookAt(portrait ? 0 : -0.17, portrait ? 0.22 : 0.15, 0);
  renderer.autoClear=true;
  renderer.render(scene,camera);
  renderer.autoClear=false;
  renderer.render(vignetteScene,vignetteCamera);
  return {width,height,seconds,triangles:renderer.info.render.triangles};
};
window.captureCinematicFrame = function(seconds) {
  window.renderCinematicFrame(seconds);
  return renderer.domElement.toDataURL('image/png').split(',')[1];
};
renderer.shadowMap.needsUpdate=true;
window.renderCinematicFrame(0);
window.cinematicReady=true;
