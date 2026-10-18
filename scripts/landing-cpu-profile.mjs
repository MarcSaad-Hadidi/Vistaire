import assert from 'node:assert/strict';

// V8 sampling is attribution evidence, not exact function CPU or GPU duration.
export function summarizeCPUProfile(profile) {
  const { nodes = [], samples = [], timeDeltas = [] } = profile;
  assert.equal(samples.length, timeDeltas.length, 'CPU profile sample alignment');
  const byID = new Map(nodes.map(node => [node.id, node.callFrame]));
  const totals = new Map();
  for (let index = 0; index < samples.length; index++) {
    const id = samples[index];
    assert.ok(byID.has(id), 'CPU profile sample must resolve to a call frame');
    assert.ok(Number.isFinite(timeDeltas[index]) && timeDeltas[index] >= 0, 'CPU profile delta must be nonnegative');
    totals.set(id, (totals.get(id) || 0) + timeDeltas[index]);
  }
  return {
    elapsedMs: (profile.endTime - profile.startTime) / 1000,
    sampledMs: timeDeltas.reduce((sum, value) => sum + value, 0) / 1000,
    samples: samples.length,
    attribution: 'Sampled V8 self time only. Includes idle/native frames. Not GPU time, exact CPU utilization, or proof of driver backpressure. Production names may be minified; retain raw call tree and URLs/locations.',
    functions: [...totals].map(([id, microseconds]) => ({ ...byID.get(id), sampledSelfMs: microseconds / 1000 }))
      .sort((a, b) => b.sampledSelfMs - a.sampledSelfMs),
  };
}
