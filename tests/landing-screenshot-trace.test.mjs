import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { traceScreenshot } from '../scripts/landing-screenshot-trace.mjs';

class Client extends EventEmitter {
  calls = [];
  async send(method, params) {
    this.calls.push({ method, params });
    if (method === 'Tracing.end') this.emit('Tracing.tracingComplete', { stream: 'trace-stream', dataLossOccurred: false });
    if (method === 'IO.read') return { data: '{"traceEvents":[]}', eof: true };
    return {};
  }
}

test('trace flushes and closes on screenshot failure without swallowing the original failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vistaire-trace-'));
  try {
    const client = new Client(), record = {}, failure = new Error('screenshot timeout');
    await assert.rejects(traceScreenshot(client, async () => { throw failure; }, { file: path.join(root, 'trace.json'), record }), error => error === failure);
    assert.equal(record.status, 'saved');
    assert.equal(record.dataLossOccurred, false);
    assert.equal(await readFile(path.join(root, 'trace.json'), 'utf8'), '{"traceEvents":[]}');
    assert.equal(client.calls.filter(call => call.method === 'Tracing.end').length, 1);
    assert.equal(client.calls.filter(call => call.method === 'IO.close').length, 1);
    assert.equal(client.listenerCount('Tracing.tracingComplete'), 0);
  } finally { await rm(root, { recursive: true }); }
});

test('oversized trace fails closed and still releases its stream', async () => {
  const client = new Client(), record = {};
  await assert.rejects(traceScreenshot(client, async () => {}, { file: '/unused', record, maxBytes: 1 }), /trace size/);
  assert.equal(record.status, 'failed');
  assert.equal(client.calls.filter(call => call.method === 'IO.close').length, 1);
  assert.equal(client.listenerCount('Tracing.tracingComplete'), 0);
});

test('native trace data loss is explicit and fails diagnostic acceptance', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vistaire-trace-'));
  try {
    const client = new Client(), record = {};
    const send = client.send.bind(client);
    client.send = async (method, params) => {
      if (method === 'Tracing.end') { client.emit('Tracing.tracingComplete', { stream: 'trace-stream', dataLossOccurred: true }); return {}; }
      return send(method, params);
    };
    await assert.rejects(traceScreenshot(client, async () => {}, { file: path.join(root, 'trace.json'), record }), /incomplete evidence/);
    assert.equal(record.status, 'failed');
    assert.equal(record.dataLossOccurred, true);
    assert.equal(record.streamClosed, true);
  } finally { await rm(root, { recursive: true }); }
});
