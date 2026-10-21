import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js';
import { installRestaurantIndexCrop } from '../components/immersive/RestaurantIndexCrop.js';

const certificate = JSON.parse(await readFile('components/immersive/restaurant-index-crop.json'));
const bytes = await readFile('public/immersive-assets/restaurant/restaurant-visible-59412334.glb');
const sourceSHA256 = createHash('sha256').update(bytes).digest('hex');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco.createDecoderModule() });
const doc = await io.readBinary(bytes);
const anchor = new THREE.Matrix4().fromArray([2.438997521683397,0,2.7606417829828063,0,0,3.683727998200768,0,0,-2.7606417829828063,0,2.438997521683397,0,-27.043372080443376,3.0011321400239233,16.422580610613586,1]);
function fixture() {
  const scene = new THREE.Scene(), model = new THREE.Group(); scene.add(model);
  const meshes = doc.getRoot().listMeshes().map(mesh => {
    const p = mesh.listPrimitives()[0], geometry = new THREE.BufferGeometry();
    for (const [semantic, name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]) {
      const a = p.getAttribute(semantic); geometry.setAttribute(name, new THREE.BufferAttribute(a.getArray().slice(), a.getElementSize()));
    }
    // Three DRACOLoader.decodeIndex always emits Uint32Array, even when the
    // GLB accessor/NodeIO can represent the same values in 16 bits.
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(p.getIndices().getArray()), 1));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({ transparent: p.getMaterial().getAlphaMode() === 'BLEND' });
    const object = new THREE.Mesh(geometry, material); object.name = mesh.getName(); object.matrixAutoUpdate = false;
    object.matrix.multiplyMatrices(anchor, new THREE.Matrix4().fromArray(doc.getRoot().listNodes().find(n => n.getMesh() === mesh).getWorldMatrix()));
    model.add(object); return object;
  });
  scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(40,390/844,.05,150);
  camera.position.set(.01588739822542906,3.9235264788513478,21.017952723814453);
  camera.lookAt(.01588739822542906,.3673851200609982,.45);
  camera.setViewOffset(390,844,0,-52.42539043378702,390,844); camera.updateMatrixWorld(true);
  const renderer = { shadowMap: { type: THREE.PCFShadowMap }, capabilities: { precision: 'highp' }, xr: { enabled: false }, getCurrentViewport(v) { return v.set(0,0,390,844); } };
  const draw = () => scene.onBeforeRender(renderer, scene, camera, null);
  return { scene, model, meshes, camera, renderer, draw };
}
const selected = () => {
  const result = new Map();
  for (const box of certificate.boxes) for (const [i,ranges] of box.selections) {
    if (!result.has(i)) result.set(i,new Set());
    for (let r=0;r<ranges.length;r+=2) for(let f=ranges[r];f<ranges[r+1];f++) result.get(i).add(f);
  }
  return result;
};

test('actual source crop preserves oriented faces, attributes, bounds and buffers; unsafe draw restores once before submission', () => {
  assert.equal(sourceSHA256, certificate.sourceSHA256);
  const f=fixture(), removed=selected(), originals=f.meshes.map(m=>({ array:m.geometry.index.array.slice(), index:m.geometry.index, attributes:{...m.geometry.attributes}, box:m.geometry.boundingBox.clone(), sphere:m.geometry.boundingSphere.clone(), material:m.material }));
  let ready=false, previousCalls=0; const previous=()=>previousCalls++; f.scene.onBeforeRender=previous;
  const crop=installRestaurantIndexCrop({ ...f, certificate, sourceSHA256, ready:()=>ready });
  f.draw(); assert.equal(crop.stats.state,'pending'); assert.equal(previousCalls,1);
  ready=true; f.draw(); assert.equal(crop.stats.state,'cropped'); assert.equal(crop.stats.removedTriangles,19150);
  const expectedBackupBytes = [...removed.keys()].reduce((sum, i) =>
    sum + doc.getRoot().listMeshes()[i].listPrimitives()[0].getIndices().getCount() * Uint32Array.BYTES_PER_ELEMENT, 0);
  assert.equal(crop.stats.backupBytes,expectedBackupBytes,'account for actual Three Draco index width');
  const gl={FLOAT:5126,UNSIGNED_SHORT:5123,UNSIGNED_INT:5125,createBuffer(){return {};},bindBuffer(){},bufferData(){},bufferSubData(){uploads++;},deleteBuffer(){}};
  const gpu=WebGLAttributes(gl); let uploads=0;
  for(let i=0;i<f.meshes.length;i++) {
    const g=f.meshes[i].geometry, original=originals[i];
    assert.equal(g.index.array.BYTES_PER_ELEMENT,Uint32Array.BYTES_PER_ELEMENT);
    assert.equal(g.index,original.index); assert.equal(f.meshes[i].material,original.material);
    assert.deepEqual(g.boundingBox,original.box); assert.deepEqual(g.boundingSphere,original.sphere);
    for(const [name,a] of Object.entries(original.attributes)) assert.equal(g.attributes[name],a);
    if(!removed.has(i)) { assert.deepEqual(g.index.array,original.array); continue; }
    let at=0;
    for(let face=0;face<original.array.length/3;face++) if(!removed.get(i).has(face)) for(let corner=0;corner<3;corner++) assert.equal(g.index.array[at++],original.array[face*3+corner]);
    assert.equal(g.drawRange.count,at); gpu.update(g.index,34963);
  }
  f.draw(); for(const i of removed.keys()) gpu.update(f.meshes[i].geometry.index,34963); assert.equal(uploads,0);
  const draws=crop.stats.roomDraws;
  f.camera.layers.set(1); f.draw(); assert.equal(crop.stats.roomDraws,draws,'foreground-only pass is excluded');
  f.camera.layers.set(0); f.camera.layers.enable(2);
  f.scene.onBeforeRender(f.renderer,f.scene,f.camera,{isWebGLRenderTarget:true,width:390,height:844});
  assert.equal(crop.stats.state,'cropped','canonical room target uses the same pre-submission guard');
  assert.equal(crop.stats.roomDraws,draws+1);
  const rendererSource = THREE.REVISION;
  assert.equal(rendererSource,'183','pre-draw hook ordering is verified for installed Three');
  // An actual camera looking into a removed box invalidates the crop before the next submission.
  const box=certificate.boxes[0]; f.camera.clearViewOffset(); f.camera.position.fromArray(box.max).addScalar(1); f.camera.lookAt(new THREE.Vector3().fromArray(box.min)); f.camera.updateMatrixWorld(true);
  f.draw(); assert.equal(crop.stats.state,'full'); assert.equal(crop.stats.reason,'visible-removed-region');
  for(const i of removed.keys()) { const g=f.meshes[i].geometry; assert.deepEqual(g.index.array,originals[i].array); assert.equal(g.drawRange.count,Infinity); gpu.update(g.index,34963); }
  assert.equal(uploads,removed.size);
  f.draw(); for(const i of removed.keys()) gpu.update(f.meshes[i].geometry.index,34963); assert.equal(uploads,removed.size);
  crop.dispose(); assert.equal(f.scene.onBeforeRender,previous);
});

test('bad proof input rejects before mutation; changed transform, shadow or unsupported camera fails closed', () => {
  for(const kind of ['source','coverage','protected','callback']) {
    const f=fixture(), proof=structuredClone(certificate), original=f.meshes[6].geometry.index.array.slice();
    if(kind==='callback') f.meshes[6].onBeforeRender=()=>{};
    if(kind==='source') proof.sourceSHA256='bad';
    if(kind==='coverage') proof.boxes[0].min[0]=proof.boxes[0].max[0]-.001;
    if(kind==='protected') proof.boxes[0].selections.push([0,[0,1]]);
    assert.throws(()=>installRestaurantIndexCrop({...f,certificate:proof,sourceSHA256,ready:()=>true}),/crop/i);
    assert.deepEqual(f.meshes[6].geometry.index.array,original);
  }
  for(const kind of ['transform','shadow','projection','layers','vsm','dispose']) {
    const f=fixture(), original=f.meshes[6].geometry.index.array.slice();
    const crop=installRestaurantIndexCrop({...f,certificate,sourceSHA256,ready:()=>true}); f.draw(); assert.equal(crop.stats.state,'cropped');
    if(kind==='transform') f.meshes[6].matrixWorld.elements[12]+=.01;
    if(kind==='vsm') f.renderer.shadowMap.type=THREE.VSMShadowMap;
    if(kind==='shadow') f.meshes[6].castShadow=true;
    if(kind==='layers') { f.meshes[6].layers.set(1); f.camera.layers.set(1); }
    if(kind==='projection') f.camera.projectionMatrix.elements[0]=NaN;
    if(kind==='dispose') crop.dispose(); else f.draw();
    assert.equal(crop.stats.state,'full'); assert.deepEqual(f.meshes[6].geometry.index.array,original);
  }
});

// Exercise the real loader lifecycle with controlled network/decoder boundaries.
// Geometry safety is covered above; this isolates opt-in, hashing and disposal.
test('Model hook reuses its sole download, rejects wrong bytes and ignores disposed async work', async () => {
  const originalFetch=globalThis.fetch, originalWindow=globalThis.window;
  const source=await readFile('components/immersive/RestaurantModel.js','utf8');
  let sequence=0;
  async function run({search='',wrong=false,disposeDuringHash=false}={}) {
    let fetches=0,installs=0,cropDisposals=0,releaseHash;
    const control={model:new THREE.Group(),certificate,helper:{installRestaurantIndexCrop(options){
      installs++;assert.equal(options.sourceSHA256,sourceSHA256);assert.equal(options.ready(),false);
      return {stats:{state:'pending'},dispose(){cropDisposals++;}};
    }},digest:async (...args)=>{
      if(disposeDuringHash) await new Promise(resolve=>{releaseHash=resolve;});
      return globalThis.crypto.subtle.digest(...args);
    }};
    globalThis.__restaurantCropLifecycle=control;
    globalThis.window={location:{search}};
    globalThis.fetch=async()=>{fetches++;return {ok:true,arrayBuffer:async()=>{
      const copy=new Uint8Array(bytes);if(wrong)copy[copy.length-1]^=1;return copy.buffer;
    }};};
    const code=source
      .replace(/^import .*publicModelAssets.*;$/m,'const publicModelBaseUrl=()=>""; const resolvePublicModelUrl=()=>"/phase1.glb";')
      .replace('from "three"',`from ${JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href)}`)
      .replace(/^import .*RestaurantFog.*;$/m,'const applyLinearRestaurantFog=()=>{};')
      .replace(/^import .*GLTFLoader.*;$/m,'class GLTFLoader { setDRACOLoader(){return this;} async parseAsync(){return {scene:globalThis.__restaurantCropLifecycle.model};} }')
      .replace(/^import .*sharedDraco.*;$/m,'const sharedDraco=()=>({ dispose(){} });')
      .replace(/^import .*RestaurantWorld.*;$/m,'const createRestaurantJourney=()=>({});')
      .replace('import("./RestaurantIndexCrop.js")','Promise.resolve(globalThis.__restaurantCropLifecycle.helper)')
      .replace('import("./restaurant-index-crop.json")','Promise.resolve({default:globalThis.__restaurantCropLifecycle.certificate})')
      .replace('globalThis.crypto.subtle.digest(', 'globalThis.__restaurantCropLifecycle.digest(');
    const {createRestaurantModel}=await import(`data:text/javascript;base64,${Buffer.from(code+`\n// lifecycle ${sequence++}`).toString('base64')}`);
    const canvas={dataset:{}}, errors=[];
    const model=createRestaurantModel(new THREE.Scene(),{canvas,renderer:{capabilities:{getMaxAnisotropy:()=>1}},disposeTree(){},onError:e=>errors.push(e),onReady:()=>null});
    if(disposeDuringHash) {
      for(let i=0;i<20&&!releaseHash;i++) await new Promise(resolve=>setImmediate(resolve));
      assert.equal(typeof releaseHash,'function','experiment hashing started');model.dispose();releaseHash();
    }
    await model.loading;
    assert.equal(fetches,1,'no additional model request');assert.deepEqual(errors,[]);
    if(!search||wrong||disposeDuringHash) assert.equal(installs,0);
    else {assert.equal(installs,1);model.dispose();assert.equal(cropDisposals,1);}
    if(wrong) assert.equal(canvas.dataset.restaurantCrop,'full');
    if(!search) assert.equal(canvas.dataset.restaurantCrop,undefined,'query-off diagnostics unchanged');
  }
  try {await run();await run({search:'?restaurantCrop=guarded'});await run({search:'?restaurantCrop=guarded',wrong:true});await run({search:'?restaurantCrop=guarded',disposeDuringHash:true});}
  finally {globalThis.fetch=originalFetch;globalThis.window=originalWindow;delete globalThis.__restaurantCropLifecycle;}
});
