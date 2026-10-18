#!/usr/bin/env node
// Asset-specific, lossless container pruning. Never decode/re-encode geometry or
// images here. The pinned source and checks deliberately reject another export.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SOURCE = 'public/immersive-assets/restaurant/restaurant-evening.glb';
const OUTPUT_DIRECTORY = 'public/immersive-assets/restaurant';
const SOURCE_SHA = '9c9a160387f36a6830f395e5c863b44ac79863513558ffe5e1bdf24e9e6931f1';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function readGLB(bytes) {
  assert.ok(bytes.length >= 28 && bytes.toString('ascii', 0, 4) === 'glTF', 'Expected GLB source');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(24 + jsonLength), 0x004e4942);
  return { json: JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)), binary: bytes.subarray(28 + jsonLength) };
}

export function pruneInvisibleRestaurant(source) {
  assert.equal(sha256(source), SOURCE_SHA, 'Unrecognized restaurant source; re-audit before pruning');
  const { json, binary } = readGLB(source);
  assert.equal(json.meshes.length, 48);
  assert.equal(json.images.length, 44);
  assert.equal(json.materials[44].alphaMode, 'BLEND');
  assert.equal(json.materials[44].pbrMetallicRoughness.baseColorFactor[3], 0);
  for (const mesh of json.meshes.slice(44)) {
    assert.equal(mesh.name, 'BackSide_0');
    assert.equal(mesh.primitives.length, 1);
    assert.equal(mesh.primitives[0].material, 44);
  }
  const triangles = meshes => meshes.reduce((total, mesh) => total + json.accessors[mesh.primitives[0].indices].count / 3, 0);
  const sourceTriangles = triangles(json.meshes);
  const retainedTriangles = triangles(json.meshes.slice(0, 44));
  const removedMeshes = json.meshes.slice(44).map(mesh => mesh.name);
  // This source stores visible images first (0..42), invisible image 43,
  // visible Draco payloads 44..87, then invisible Draco payloads 88..91.
  const retainedViews = json.bufferViews.map((_, i) => i).filter(i => i !== 43 && i < 88);
  const remap = new Map(retainedViews.map((old, i) => [old, i]));
  let offset = 0;
  const chunks = [];
  json.bufferViews = retainedViews.map(i => {
    const view = json.bufferViews[i];
    const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const padding = Buffer.alloc((4 - bytes.length % 4) % 4);
    const next = { ...view, byteOffset: offset };
    offset += bytes.length + padding.length;
    chunks.push(bytes, padding);
    return next;
  });
  json.meshes = json.meshes.slice(0, 44);
  for (const mesh of json.meshes)
    mesh.primitives[0].extensions.KHR_draco_mesh_compression.bufferView = remap.get(mesh.primitives[0].extensions.KHR_draco_mesh_compression.bufferView);
  json.images = json.images.slice(0, 43);
  for (const image of json.images) image.bufferView = remap.get(image.bufferView);
  json.textures = json.textures.slice(0, 43);
  json.materials = json.materials.slice(0, 44);
  json.accessors = json.accessors.slice(0, 176);
  json.nodes = json.nodes.slice(0, 49);
  for (const node of json.nodes) if (node.children) node.children = node.children.filter(i => i < 49);
  json.buffers[0].byteLength = offset;
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(20);
  header.write('glTF'); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + offset, 8);
  header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(offset, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
  const bytes = Buffer.concat([header, paddedJson, binaryHeader, ...chunks]);
  return { bytes, report: {
    source: SOURCE, sourceSHA256: SOURCE_SHA, sourceBytes: source.length, sourceTriangles,
    output: `${OUTPUT_DIRECTORY}/restaurant-visible-${sha256(bytes).slice(0, 8)}.glb`, sha256: sha256(bytes), bytes: bytes.length, triangles: retainedTriangles,
    removedMeshes, removedMaterial: 'TextureMaterial_44', removedImages: 1,
    meshes: 44, materials: 44, images: 43,
    method: 'Remove four zero-alpha BLEND meshes and unreferenced resources; retained Draco and WebP payloads copied byte-for-byte. Original retained.',
  } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = pruneInvisibleRestaurant(await readFile(SOURCE));
  await writeFile(result.report.output, result.bytes);
  console.log(JSON.stringify(result.report, null, 2));
}
