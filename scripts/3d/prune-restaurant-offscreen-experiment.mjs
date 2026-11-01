// Experimental only: a matched browser A/B must pass before runtime activation.
// This pinned whole-primitive copy never decodes or re-encodes any payload.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { readGLB } from './prune-restaurant-invisible.mjs';

export function pruneOffscreenExperiment(source) {
  assert.equal(createHash('sha256').update(source).digest('hex'),
    '594123340aa71cf74cb0e83c69b966c399230fc03e2188ed5cb80931d05f4f66',
    'Unrecognized phase-one source');
  const { json, binary } = readGLB(source);
  const sourceJson = structuredClone(json);
  const remove = new Set([3, 24, 29]);
  const map = (length, keep) => new Map(Array.from({ length }, (_, i) => i)
    .filter(keep).map((old, i) => [old, i]));
  const meshes = map(json.meshes.length, i => !remove.has(i));
  const nodes = map(json.nodes.length,
    i => json.nodes[i].mesh === undefined || meshes.has(json.nodes[i].mesh));
  const materials = map(json.materials.length,
    i => [...meshes.keys()].some(n => json.meshes[n].primitives.some(p => p.material === i)));
  const accessors = new Map(), views = new Map(), textures = new Map(), images = new Map();
  const take = (mapping, i) => {
    if (!mapping.has(i)) mapping.set(i, mapping.size);
    return mapping.get(i);
  };
  for (const i of meshes.keys()) for (const primitive of json.meshes[i].primitives) {
    take(accessors, primitive.indices);
    for (const accessor of Object.values(primitive.attributes)) take(accessors, accessor);
    take(views, primitive.extensions.KHR_draco_mesh_compression.bufferView);
  }
  for (const i of materials.keys()) {
    for (const texture of Object.values(json.materials[i].pbrMetallicRoughness))
      if (texture && typeof texture === 'object' && !Array.isArray(texture) && 'index' in texture)
        take(textures, texture.index);
  }
  for (const i of textures.keys()) take(images, json.textures[i].extensions.EXT_texture_webp.source);
  for (const i of images.keys()) take(views, json.images[i].bufferView);
  for (const mapping of [accessors, views, textures, images]) {
    const ids = [...mapping.keys()].sort((a, b) => a - b);
    mapping.clear();
    ids.forEach(i => take(mapping, i));
  }
  json.meshes = [...meshes.keys()].map(i => json.meshes[i]);
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    primitive.indices = accessors.get(primitive.indices);
    primitive.material = materials.get(primitive.material);
    for (const key of Object.keys(primitive.attributes))
      primitive.attributes[key] = accessors.get(primitive.attributes[key]);
    const draco = primitive.extensions.KHR_draco_mesh_compression;
    draco.bufferView = views.get(draco.bufferView);
  }
  json.nodes = [...nodes.keys()].map(i => json.nodes[i]);
  for (const node of json.nodes) {
    if (node.mesh !== undefined) node.mesh = meshes.get(node.mesh);
    if (node.children) node.children = node.children.filter(i => nodes.has(i)).map(i => nodes.get(i));
  }
  for (const scene of json.scenes) scene.nodes = scene.nodes.map(i => nodes.get(i));
  json.materials = [...materials.keys()].map(i => json.materials[i]);
  for (const material of json.materials) {
    for (const texture of Object.values(material.pbrMetallicRoughness))
      if (texture && typeof texture === 'object' && !Array.isArray(texture) && 'index' in texture)
        texture.index = textures.get(texture.index);
  }
  json.textures = [...textures.keys()].map(i => json.textures[i]);
  for (const texture of json.textures)
    texture.extensions.EXT_texture_webp.source = images.get(texture.extensions.EXT_texture_webp.source);
  json.images = [...images.keys()].map(i => json.images[i]);
  for (const image of json.images) image.bufferView = views.get(image.bufferView);
  json.accessors = [...accessors.keys()].map(i => json.accessors[i]);
  let offset = 0;
  const chunks = [];
  json.bufferViews = [...views.keys()].map(i => {
    const view = json.bufferViews[i];
    const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const padding = Buffer.alloc((4 - bytes.length % 4) % 4);
    const next = { ...view, byteOffset: offset };
    offset += bytes.length + padding.length;
    chunks.push(bytes, padding);
    return next;
  });
  json.buffers[0].byteLength = offset;
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8);
  header.write('glTF'); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + offset, 8);
  header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binaryHeader.writeUInt32LE(offset, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
  const bytes = Buffer.concat([header, paddedJson, binaryHeader, ...chunks]);
  return { bytes, report: {
    status: 'experimental, not active or visually certified',
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    removedMeshes: [...remove].map(i => sourceJson.meshes[i].name), triangles: 80143,
  } };
}

if (basename(process.argv[1] ?? '') === 'prune-restaurant-offscreen-experiment.mjs') {
  const result = pruneOffscreenExperiment(await readFile('public/immersive-assets/restaurant/restaurant-visible-59412334.glb'));
  if (process.argv[2] === '--stdout') process.stdout.write(result.bytes);
  else {
    assert.ok(process.argv[2], 'Provide an experiment output path or --stdout');
    await writeFile(process.argv[2], result.bytes);
    console.log(JSON.stringify(result.report, null, 2));
  }
}
