import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function appNavigation() {
  const source = readFileSync('components/immersive/App.jsx', 'utf8');
  const hashStart = source.indexOf('    const navigateHash =');
  const hashEnd = source.indexOf('    addEventListener("hashchange", navigateHash);', hashStart);
  const arrivalStart = source.indexOf('      if (arrivalAnchor != null');
  const arrivalEnd = source.indexOf('      const y = scrollY;', arrivalStart);
  let latestInputAt = 9000;
  const calls = [];
  const scope = vm.createContext({
    arrivalAnchor: null, arrivalEvent: null,
    location: { hash: '#product' },
    entryAssist: {
      isNavigationCurrent: event => event.timeStamp >= latestInputAt,
      cancel: reason => calls.push(['cancel', reason]),
    },
    queue: () => calls.push(['queue']),
    scrollTo: options => calls.push(['scroll', options.top]),
    scrollTargets: { current: { hero: 0, ai: 4000, product: 12000, 'open-weight': 15000 } },
    stateRef: { current: {} },
  });
  vm.runInContext(`${source.slice(hashStart, hashEnd)}; this.navigate = navigateHash;
    this.applyArrival = () => { ${source.slice(arrivalStart, arrivalEnd)} };`, scope);
  return { scope, calls, acceptInput: at => { latestInputAt = at; } };
}

test('App rejects an older dispatched hash before cancelling a newer input or queuing its anchor', () => {
  const f = appNavigation();
  f.acceptInput(9533);
  f.scope.navigate({ type: 'hashchange', timeStamp: 9383 });
  assert.deepEqual(f.calls, [], 'the delayed hash must not cancel PageDown or schedule a jump');
  assert.equal(f.scope.arrivalAnchor, null);
  assert.equal(f.scope.arrivalEvent, null);

  const fresh = { type: 'hashchange', timeStamp: 10000 };
  f.scope.navigate(fresh);
  assert.deepEqual(f.calls, [['cancel', 'hash-navigation'], ['queue']]);
  assert.equal(f.scope.arrivalAnchor, 'product');
  assert.equal(f.scope.arrivalEvent, fresh);
  f.scope.applyArrival();
  assert.deepEqual(f.calls.at(-1), ['scroll', 12000]);
  assert.equal(f.scope.arrivalAnchor, null);
  assert.equal(f.scope.arrivalEvent, null);
});

test('deferred hash arrivals recheck input provenance while initial and ready pricing anchors still work', () => {
  const f = appNavigation();
  f.scope.navigate({ type: 'hashchange', timeStamp: 9383 });
  f.acceptInput(9533);
  f.scope.applyArrival();
  assert.equal(f.calls.filter(([type]) => type === 'scroll').length, 0, 'new input before RAF invalidates the already queued hash jump');
  assert.equal(f.scope.arrivalAnchor, null);
  assert.equal(f.scope.arrivalEvent, null);

  f.scope.arrivalAnchor = 'hero';
  f.scope.applyArrival();
  assert.deepEqual(f.calls.at(-1), ['scroll', 0], 'initial deep links have no delayed event to invalidate');

  f.scope.location.hash = '#open-weight';
  f.scope.navigate({ type: 'hashchange', timeStamp: 10000 });
  f.scope.applyArrival();
  assert.equal(f.scope.arrivalAnchor, 'open-weight', 'pricing waits for its measured first-offer target');
  f.scope.stateRef.current.pricingNavigationTarget = () => 15170;
  f.scope.applyArrival();
  assert.deepEqual(f.calls.at(-1), ['scroll', 15170]);
  assert.equal(f.scope.arrivalAnchor, null);
  assert.equal(f.scope.arrivalEvent, null);
});
