import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const categories = ['toplevel', 'blink', 'devtools.timeline', 'cc', 'viz', 'gpu'];

async function within(action, milliseconds) {
  let timer;
  try {
    return await Promise.race([action(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Screenshot trace cleanup deadline')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

// Diagnostic only: the caller retains the unchanged screenshot timeout.
export async function traceScreenshot(client, capture, { file, record, maxBytes = 16 * 1024 * 1024 }) {
  Object.assign(record, { status: 'starting', categories, bufferKiB: 16384, maxBytes,
    overhead: 'Bounded native-thread tracing around one screenshot; not visitor timing or a comparative benchmark.' });
  let stream, completed, completeListener, captureError, cleanupError, value;
  const completion = new Promise(resolve => {
    completeListener = event => { completed = event; stream = event.stream; resolve(event); };
    client.once('Tracing.tracingComplete', completeListener);
  });
  let started = false;
  try {
    // A timed-out start may still reach Chromium. Attempt end in finally even
    // if the acknowledgement never arrives; browser ownership remains outside.
    started = true;
    await within(() => client.send('Tracing.start', {
      transferMode: 'ReturnAsStream', streamFormat: 'json',
      traceConfig: { recordMode: 'recordContinuously', traceBufferSizeInKb: 16384, includedCategories: categories },
    }), 5000);
    record.status = 'recording';
    await within(() => client.send('Tracing.recordClockSyncMarker', { syncId: 'vistaire-screenshot-start' }), 5000);
    record.captureStartedAt = new Date().toISOString();
    const captureStart = performance.now();
    try { value = await capture(); }
    catch (error) { captureError = error; }
    finally { record.captureFinishedAt = new Date().toISOString(); record.captureWallMs = performance.now() - captureStart; }
  } catch (error) { captureError = error; record.status = 'failed'; record.startError = error.message; }
  finally {
    if (started) {
      let expired = false;
      try {
        await within(async () => {
          await client.send('Tracing.end');
          await completion;
          if (expired) return;
          assert.ok(stream, 'Screenshot trace stream required');
          record.dataLossOccurred = completed.dataLossOccurred ?? null;
          const chunks = [];
          let size = 0, eof = false;
          while (!eof) {
            const chunk = await client.send('IO.read', { handle: stream, size: 256 * 1024 });
            if (expired) return;
            const bytes = Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8');
            size += bytes.length;
            assert.ok(size <= maxBytes, 'Screenshot trace size exceeds diagnostic budget');
            chunks.push(bytes); eof = chunk.eof;
          }
          await writeFile(file, Buffer.concat(chunks));
          if (expired) return;
          record.bytes = size; record.file = file; record.status = 'saved';
          assert.equal(record.dataLossOccurred, false, 'Screenshot trace reported incomplete evidence');
        }, 5000);
      } catch (error) { expired = true; cleanupError = error; record.status = 'failed'; record.error = error.message; }
    }
    client.off('Tracing.tracingComplete', completeListener);
    if (stream) {
      try { await within(() => client.send('IO.close', { handle: stream }), 1000); record.streamClosed = true; }
      catch (error) { cleanupError ||= error; record.streamClosed = false; record.status = 'failed'; record.closeError = error.message; }
    }
  }
  if (captureError) throw captureError;
  if (cleanupError) throw cleanupError;
  return value;
}
