import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
test('Sauge viewer retains tenant context and deliberate 3D intent', () => {
 const source = read('components/menu/unique/sauge-noire/SaugeNoireDishDetail.tsx');
 assert.match(source, /analyticsContext=\{getPublicMenuAnalyticsContext\(menu\)/);
 assert.match(source, /eventName: "dish_3d_clicked"/);
});
test('visible analytics observes viewport and pauses dwell on lost focus, hiding, and page lifecycle', () => {
 const source = read('components/menu/analytics/useVisibleMenuAnalytics.ts');
 for (const signal of ['IntersectionObserver','visibilitychange','pagehide','pageshow','blur','focus','dish_dwell','menu_list_viewed','dish_selected']) assert.ok(source.includes(signal), signal);
});
test('Trouvable sends only query length buckets and results, never query text', () => {
 const source = read('components/menu/TrouvablePremiumMenuExperience.tsx');
 assert.doesNotMatch(source, /searchQuery:\s*query/);
 assert.match(source, /queryLengthBucket/);
 assert.match(source, /search_results/);
});
test('Sauge excludes physical pageflip copies from detail reading analytics', () => {
 const source = read('components/menu/unique/sauge-noire/SaugeNoireDishDetail.tsx');
 assert.match(source, /useVisibleMenuAnalytics\(menu, analyticsEnabled && !isPreview && renderMode === "reading-surface", dish\)/);
});
test('Sauge adjacent navigation emits selected target once with the owning menu', () => {
 const source = read('components/menu/unique/sauge-noire/SaugeNoireDishDetail.tsx');
 const body = source.match(/const requestDishNavigation = useCallback\([\s\S]*?\) => \{([\s\S]*?)\n  \}, \[[^\]]*\]\);/)?.[1];
 assert.ok(body, 'central adjacent navigation callback exists');
 const events = [];
 const menu = { restaurantId: 'tenant-a', menuId: 'menu-a', source: 'supabase' };
 const target = { id: 'dish-b', slug: 'next-dish', categorySlug: 'mains' };
 const navigate = new Function('navigationInFlightRef', 'currentDishRef', 'setPageTurn', 'pageTurnRef', 'dishFlipPhaseRef', 'trackPublicMenuEvent', 'menu', 'href', 'direction', 'targetDish', body);
 const args = [{ current: false }, { current: { id: 'dish-a' } }, () => {}, { current: null }, { current: null }, (...event) => events.push(event), menu, '/menu/a/dishes/next-dish', 'next', target];
 navigate(...args);
 navigate(...args);
 assert.deepEqual(events, [[menu, { eventName: 'dish_selected', dishSlug: 'next-dish', categorySlug: 'mains' }]]);
});
