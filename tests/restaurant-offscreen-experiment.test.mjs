import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readGLB } from '../scripts/3d/prune-restaurant-invisible.mjs';
import { pruneOffscreenExperiment } from '../scripts/3d/prune-restaurant-offscreen-experiment.mjs';

test('isolated offscreen experiment preserves all retained compressed payloads and protected nodes', async () => {
  const source = await readFile('public/immersive-assets/restaurant/restaurant-visible-59412334.glb');
  const { bytes } = pruneOffscreenExperiment(source);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'e92a37f1eafc320091ef6ed3764f3552e82e3c443a1cf25f5965a4b400cbaf6f');
  const before = readGLB(source), after = readGLB(bytes);
  const payload = (g, i) => { const v = g.json.bufferViews[i]; return g.binary.subarray(v.byteOffset, v.byteOffset + v.byteLength); };
  assert.equal(after.json.meshes.length, 41);
  for (const mesh of after.json.meshes) {
    const old = before.json.meshes.find(m => m.name === mesh.name);
    assert.ok(old);
    assert.deepEqual(payload(after, mesh.primitives[0].extensions.KHR_draco_mesh_compression.bufferView), payload(before, old.primitives[0].extensions.KHR_draco_mesh_compression.bufferView));
  }
  for (const image of after.json.images)
    assert.ok(before.json.images.some(old => payload(before, old.bufferView).equals(payload(after, image.bufferView))));
  for (const name of ['FrontSide_0', 'FrontSide_1', 'FrontSide_23', 'FrontSide_26', 'FrontSide_34', 'FrontSide_20', 'FrontSide_25', 'FrontSide_33'])
    assert.ok(after.json.nodes.some(node => node.name === name), name);
  assert.throws(() => pruneOffscreenExperiment(Buffer.from('{}')), /source/i);
});
