import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import { pruneInvisibleRestaurant, readGLB } from '../scripts/3d/prune-restaurant-invisible.mjs';

const sourcePath = 'public/immersive-assets/restaurant/restaurant-evening.glb';
const candidatePath = 'public/immersive-assets/restaurant/restaurant-visible-59412334.glb';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = await readFile(sourcePath);
const original = readGLB(source);
const bufferView = (glb, i) => {
  const view = glb.json.bufferViews[i];
  return glb.binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
};

test('restaurant derivation removes only zero-alpha primitives and copies every retained payload exactly', async () => {
  assert.equal(hash(source), '9c9a160387f36a6830f395e5c863b44ac79863513558ffe5e1bdf24e9e6931f1');
  const derived = pruneInvisibleRestaurant(source);
  assert.deepEqual(await readFile(candidatePath), derived.bytes, 'checked-in derived GLB is reproducible');
  assert.equal(derived.report.sourceTriangles, 163642);
  assert.equal(derived.report.triangles, 81821);
  assert.deepEqual(derived.report.removedMeshes, ['BackSide_0', 'BackSide_0', 'BackSide_0', 'BackSide_0']);
  const candidate = readGLB(derived.bytes);
  assert.equal(candidate.json.meshes.length, 44);
  assert.equal(candidate.json.images.length, 43);
  for (let i = 0; i < 44; i++) {
    const expected = structuredClone(original.json.meshes[i]);
    expected.primitives[0].extensions.KHR_draco_mesh_compression.bufferView--;
    assert.deepEqual(candidate.json.meshes[i], expected, `visible primitive ${i}`);
    const view = original.json.meshes[i].primitives[0].extensions.KHR_draco_mesh_compression.bufferView;
    assert.deepEqual(bufferView(candidate, view - 1), bufferView(original, view), `exact Draco ${i}`);
  }
  for (let i = 0; i < 43; i++) {
    assert.deepEqual(candidate.json.images[i], original.json.images[i]);
    assert.deepEqual(bufferView(candidate, candidate.json.images[i].bufferView), bufferView(original, original.json.images[i].bufferView), `exact WebP ${i}`);
  }
  assert.deepEqual(candidate.json.nodes, original.json.nodes.slice(0, 49).map(node => ({ ...node, ...(node.children ? { children: node.children.filter(i => i < 49) } : {}) })));
  assert.deepEqual(candidate.json.materials, original.json.materials.slice(0, 44));
  assert.deepEqual(candidate.json.textures, original.json.textures.slice(0, 43));
  assert.deepEqual(candidate.json.accessors, original.json.accessors.slice(0, 44 * 4));
  assert.throws(() => pruneInvisibleRestaurant(Buffer.from('{}')), /GLB|source/i);
});

// Decode geometry with the installed native Draco library, then use the actual
// Three GLTFLoader for material flags, scene graph and transforms. Image decoding
// is replaced by empty Texture objects; the first test proves image-byte identity.
async function loadThree(bytes) {
  const glb = readGLB(bytes);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco.createDecoderModule(),
  });
  const doc = await io.readBinary(new Uint8Array(bytes));
  const geometries = new Map();
  doc.getRoot().listMeshes().forEach((mesh, index) => {
    const primitive = mesh.listPrimitives()[0];
    const geometry = new THREE.BufferGeometry();
    for (const [semantic, name] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv']]) {
      const accessor = primitive.getAttribute(semantic);
      geometry.setAttribute(name, new THREE.BufferAttribute(accessor.getArray(), accessor.getElementSize()));
    }
    geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray(), 1));
    geometries.set(hash(bufferView(glb, glb.json.meshes[index].primitives[0].extensions.KHR_draco_mesh_compression.bufferView)), geometry);
  });
  const loader = new GLTFLoader().setDRACOLoader({
    preload() {},
    decodeDracoFile(buffer, callback) { return Promise.resolve(callback(geometries.get(hash(Buffer.from(buffer))).clone())); },
  });
  loader.register(parser => {
    parser.loadTextureImage = async () => new THREE.Texture();
    return { name: 'test-native-draco-no-image-decoding' };
  });
  const result = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  result.scene.updateMatrixWorld(true);
  return result.scene;
}

async function tableFactory() {
  const require = createRequire(import.meta.url);
  const inventory = JSON.parse(await readFile('components/immersive/restaurant-table-inventory.json', 'utf8'));
  const code = (await readFile('components/immersive/RestaurantTable.js', 'utf8'))
    .replace('from "./RestaurantFog.js"', `from ${JSON.stringify(new URL('../components/immersive/RestaurantFog.js', import.meta.url).href)}`)
    .replace('from "three"', `from ${JSON.stringify(pathToFileURL(require.resolve('three')).href)}`)
    .replace('import inventory from "./restaurant-table-inventory.json";', `const inventory = ${JSON.stringify(inventory)};`);
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).createRestaurantTable;
}

function visibleGeometry(root) {
  const rows = [];
  root.updateMatrixWorld(true);
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.material.opacity === 0) return;
    rows.push({ name: mesh.name, matrix: mesh.matrixWorld.toArray(), indices: Array.from(mesh.geometry.index.array),
      attributes: Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name, a]) => [name, Array.from(a.array)])) });
  });
  return rows;
}

test('actual Three materials have no color/depth contribution and foreground extraction remains identical', async () => {
  const before = await loadThree(source);
  const after = await loadThree(await readFile(candidatePath));
  const invisible = [];
  before.traverse(mesh => { if (mesh.isMesh && mesh.material.opacity === 0) invisible.push(mesh); });
  assert.equal(invisible.length, 4);
  for (const mesh of invisible) {
    assert.equal(mesh.material.transparent, true);
    assert.equal(mesh.material.depthWrite, false);
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.material.transmission, undefined);
    assert.equal(mesh.material.blending, THREE.NormalBlending);
  }
  assert.deepEqual(visibleGeometry(after), visibleGeometry(before));
  const createTable = await tableFactory();
  const tableBefore = createTable(before, { width: 6, surfaceY: -0.02 });
  const tableAfter = createTable(after, { width: 6, surfaceY: -0.02 });
  assert.deepEqual(tableAfter.metadata, tableBefore.metadata);
  assert.equal(tableAfter.metadata.triangles, 1900);
  // Independent control: original GLB + full inventory at 4ef9eaf, before this
  // optimization. Pin physical metadata and visible output, not candidate-only
  // equivalence; the old invisible triangle totals were 3800 / 8188 omitted.
  for (const [key, value] of Object.entries({ sourceScale: 3.683727998200768,
    floorY: -3.4884929481777167, height: 3.4684929481777167, width: 6, depth: 6,
    topWidth: 5.16164387257593, topDepth: 5.123286695912952 }))
    assert.equal(tableAfter.metadata[key], value, key);
  assert.equal(hash(JSON.stringify(visibleGeometry(tableAfter.group))),
    '79512823c5aa3f1834fdd771062d02603875886e53bf41a667699dfd41d99c84');
  for (const opacity of [1, 0.25, 0, 1]) {
    tableBefore.setOpacity(opacity);
    tableAfter.setOpacity(opacity);
    assert.deepEqual(visibleGeometry(tableAfter.group), visibleGeometry(tableBefore.group));
  }
  assert.equal(tableAfter.excludeCopiedObjectsFromRoom(), tableBefore.excludeCopiedObjectsFromRoom());
  assert.deepEqual(visibleGeometry(after), visibleGeometry(before));
  assert.equal(hash(JSON.stringify(visibleGeometry(after))),
    'e39c5fff89487f0979dd97502de1c71d6039e85f86d9a193cb574fb72330e587');
  assert.deepEqual(tableAfter.metadata.sourceCenter, [1.5196816676926233, -0.8201289947302096, -8.453422824738405]);
  tableAfter.dispose(); tableBefore.dispose();
});
