import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function configure(args, inherited = {}) {
  const source = readFileSync('scripts/diagnose-landing-composition.mjs', 'utf8');
  const start = source.indexOf('const journeyQA =');
  const end = source.indexOf('const runtimes =', start);
  const env = { ...inherited };
  const loads = [];
  vm.runInNewContext(source.slice(start, end).replace('import.meta.url', '"file:///fixture/helper.mjs"'), {
    assert, process: { argv: ['node', 'helper', ...args], env },
    createRequire: () => name => { loads.push({ name, legacy: env.PLAYWRIGHT_LEGACY_SCREENSHOT }); return { chromium: {} }; },
  });
  return { env, loads };
}

test('legacy screenshot experiment is opt-in and configured before loading Playwright', () => {
  const mode = configure(['--journey-qa', '--diagnostic-profile', '--legacy-screenshot-diagnostic']);
  assert.equal(mode.env.PLAYWRIGHT_LEGACY_SCREENSHOT, '1');
  assert.deepEqual(mode.loads, [{ name: '@playwright/test', legacy: '1' }]);
});

test('normal journey and paired benchmark cannot silently inherit the legacy capture switch', () => {
  for (const args of [[], ['--journey-qa'], ['--journey-qa', '--diagnostic-profile']]) {
    assert.equal(configure(args).env.PLAYWRIGHT_LEGACY_SCREENSHOT, undefined);
    assert.throws(() => configure(args, { PLAYWRIGHT_LEGACY_SCREENSHOT: '1' }), /explicit/);
  }
  assert.throws(() => configure(['--legacy-screenshot-diagnostic']), /diagnostic/);
  assert.throws(() => configure(['--journey-qa', '--legacy-screenshot-diagnostic']), /diagnostic/);
});
