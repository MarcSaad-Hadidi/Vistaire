import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('planning select labels exclude options and have unique explicit targets', async () => {
  const source = await readFile('components/admin/studio/StudioPlanning.tsx', 'utf8');
  for (const name of ['dish', 'base', 'manual', 'type', 'available']) {
    assert.match(source, new RegExp(`htmlFor=\\{\\x60\\$\\{formId\\}-${name}`));
    assert.match(source, new RegExp(`<select id=\\{\\x60\\$\\{formId\\}-${name}`));
  }
  assert.doesNotMatch(source, /<label>[^<]+<select/);
});
test('scheduling isolation resets independent fixture state before and after failures', async () => {
  const fixture = await readFile('e2e/support/admin-visual-fixture-server.mjs', 'utf8');
  const spec = await readFile('e2e/admin-scheduling.spec.ts', 'utf8');
  assert.match(fixture, /const baselineTables = structuredClone\(tables\)/);
  assert.match(fixture, /request.method === "POST".*\/fixture\/reset-admin-scheduling/);
  assert.match(fixture, /tables\[table\] = structuredClone\(rows\)/);
  assert.match(spec, /test.beforeEach\(resetSchedulingFixture\)/);
  assert.match(spec, /test.afterEach\(resetSchedulingFixture\)/);
});

test('fixture reset restores availability, timezone, schedules, history and replay state', async (t) => {
  const { spawn } = await import('node:child_process');
  const { once } = await import('node:events');
  const child = spawn(process.execPath, ['e2e/support/admin-visual-fixture-server.mjs'], { env: { ...process.env, VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT: '0', VISTAIRE_ADMIN_FIXTURE_SCENARIO: 'full-menu' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Fixture startup timeout')), 15000);
    child.once('error', reject);
    child.stdout.on('data', (chunk) => { const match = chunk.toString().match(/ready on (\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
  });
  const origin = `http://127.0.0.1:${port}`;
  const get = async (table) => (await fetch(`${origin}/rest/v1/${table}`)).json();
  const post = async (path, body) => fetch(`${origin}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const names = ['menus', 'menu_dishes', 'dish_schedules', 'menu_change_history'];
  const baseline = await Promise.all(names.map(get));
  const qr = (await get('qr_codes')).find(row => row.target_kind === 'admin');
  const menu = baseline[0].find(row => row.restaurant_id === qr.restaurant_id && row.is_primary);
  const dish = baseline[1].find(row => row.menu_id === menu.id);
  const identity = { p_qr_id: qr.id, p_restaurant_id: qr.restaurant_id, p_dish_id: dish.id };
  const schedule = { ...identity, p_timezone: 'Europe/Paris', p_expected_timezone: menu.settings_json.timezone, p_expected_revision: 0, p_request_id: 'test-replay', p_base_available: false, p_manual_override: null, p_rules: [] };
  assert.equal((await post('rest/v1/rpc/save_admin_dish_schedule', schedule)).status, 200);
  assert.equal((await post('rest/v1/rpc/set_admin_dish_manual_availability', { ...identity, p_available: !dish.is_available })).status, 200);
  assert.notDeepEqual(await Promise.all(names.map(get)), baseline);
  assert.equal((await post('fixture/reset-admin-scheduling', {})).status, 200);
  assert.deepEqual(await Promise.all(names.map(get)), baseline);
  // Same request ID with a different payload succeeds after reset: no stale replay.
  assert.equal((await post('rest/v1/rpc/save_admin_dish_schedule', { ...schedule, p_base_available: true })).status, 200);
});
