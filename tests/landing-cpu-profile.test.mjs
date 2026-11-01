import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCPUProfile } from '../scripts/landing-cpu-profile.mjs';

test('CPU profile reports sampled self time without attributing delivery gaps to application functions', () => {
  const summary = summarizeCPUProfile({ startTime: 0, endTime: 10000000,
    nodes: [ { id: 1, callFrame: { functionName: '(idle)', url: '' } },
      { id: 2, callFrame: { functionName: 'draw', url: '/app.js', lineNumber: 9, columnNumber: 2 } } ],
    samples: [1, 2, 1], timeDeltas: [10000, 10000, 10000] });
  assert.equal(summary.elapsedMs, 10000);
  assert.equal(summary.sampledMs, 30);
  assert.equal(summary.functions.find(item => item.functionName === 'draw').sampledSelfMs, 10);
  assert.equal(summary.functions.find(item => item.functionName === '(idle)').sampledSelfMs, 20);
});

test('malformed sample alignment is rejected rather than producing misleading attribution', () => {
  assert.throws(() => summarizeCPUProfile({ nodes: [], samples: [1], timeDeltas: [] }), /alignment/);
});
