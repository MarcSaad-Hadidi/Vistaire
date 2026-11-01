import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { NextRequest } = createRequire(import.meta.url)('next/server');

test('scheduling fixture uses NextRequest canonical loopback origin without relaxing CSRF', () => {
  const ipOrigin = 'http://127.0.0.1:3192';
  const ipRequest = new NextRequest(`${ipOrigin}/admin/api/scheduling`, { headers: { origin: ipOrigin } });
  assert.equal(new URL(ipRequest.url).origin, 'http://localhost:3192');
  assert.notEqual(ipRequest.headers.get('origin'), new URL(ipRequest.url).origin);
  const origin = 'http://localhost:3192';
  const browserRequest = new NextRequest(`${origin}/admin/api/scheduling`, { headers: { origin, 'sec-fetch-site': 'same-origin' } });
  assert.equal(browserRequest.headers.get('origin'), new URL(browserRequest.url).origin);
  const spec = readFileSync(new URL('../e2e/admin-scheduling.spec.ts', import.meta.url), 'utf8');
  assert.match(spec, /origin.hostname = "localhost"/);
  assert.doesNotMatch(spec, /page.goto\("\/admin/);
  assert.match(spec, /untrusted.example/);
  const route = readFileSync(new URL('../app/(fr)/admin/api/scheduling/route.ts', import.meta.url), 'utf8');
  assert.match(route, /origin!==new URL\(request.url\).origin/);
});
