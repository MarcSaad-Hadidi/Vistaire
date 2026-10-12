import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import vm from 'node:vm';

// New lower-section behavior: a single native page scroll owns reading, with
// reversible keyboard destinations. Existing landing tests do not cover a phone.
test('pricing phone reading starts after entry and reverses through native page positions', async () => {
  assert.ok(existsSync('components/immersive/PricingPhoneLayout.js'), 'the lower offer section needs its measured native-scroll layout');
  const { pricingScrollLayout, pricingScreenScroll, pricingPagePosition } = await import('../components/immersive/PricingPhoneLayout.js');
  const { createPricingPhonePresenter, pricingStageAtScroll } = await import('../components/immersive/PricingPhonePresenter.js');
  for (const height of [844, 932, 900]) {
    const layout = pricingScrollLayout(height, 2400, 530, 0.7);
    assert.equal(pricingScreenScroll(-layout.entry, layout), 0, 'entry must finish before the offers scroll');
    assert.equal(layout.sectionHeight, height + layout.travel);
    for (const offset of [0, 280, 920, layout.maxScroll]) {
      const page = pricingPagePosition(15000, offset, layout);
      assert.ok(Math.abs(pricingScreenScroll(15000 - page, layout) - offset) < 1e-8, 'keyboard and reverse scroll must return to the same offer');
    }
    const viewport = { width: 430, height, introHeight: layout.sectionHeight };
    assert.equal(pricingStageAtScroll(15000, 15000 + layout.entry, viewport).top, 0);
    assert.ok(pricingStageAtScroll(15000, 15000 + layout.sectionHeight, viewport).bottom <= 0, 'the FAQ must be reachable after the phone leaves');
    const reduced = pricingScrollLayout(height, 2400, 530, 0.7, true);
    assert.equal(reduced.readingStart, 0, 'reduced motion removes the animated entry');
  }
  const writes = [];
  const viewport = { set scrollTop(value) { writes.push(value); }, get scrollTop() { throw new Error('continuous scrolling must not force an inner DOM read'); } };
  const presenter = createPricingPhonePresenter({}, viewport);
  const layout = pricingScrollLayout(844, 2400, 530, 0.7);
  const page = pricingPagePosition(15000, 480, layout);
  presenter.scroll(page, 15000, layout);
  presenter.scroll(page, 15000, layout);
  presenter.scroll(15000, 15000, layout);
  assert.equal(writes.length, 2, 'unchanged native samples remain idle');
  assert.ok(Math.abs(writes[0] - 480) < 1e-8);
  assert.equal(writes[1], 0);
});

test('pricing uses the exact approved hand and projects the existing native phone screen', async () => {
  assert.ok(existsSync('components/immersive/PricingFairHand.js'), 'the offers must retain the source hand rather than a replacement illustration');
  const { FAIR_HAND_ASSET, createFairHandGeometry, fairHandEase } = await import('../components/immersive/PricingFairHand.js');
  const { projectPricingScreen, PRICING_SCREEN_WIDTH, PRICING_SCREEN_HEIGHT } = await import('../components/immersive/PricingPhoneLayout.js');
  assert.equal(createHash('sha256').update(readFileSync(`public${FAIR_HAND_ASSET.src}`)).digest('hex'), '8f3254bd90ca10e189596207f23a910edc90ef056976fa95805c94a01c1e0a31');
  assert.deepEqual([FAIR_HAND_ASSET.width, FAIR_HAND_ASSET.height], [1071, 1469]);
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.005, 0.146));
  const hand = createFairHandGeometry(phone);
  assert.equal(hand.getAttribute('position').count, 4, 'retain a photographic plane, not a second phone model');
  assert.ok(hand.getAttribute('position').getY(0) < -0.0025, 'the real phone must occlude the photographic hand');
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.526553630828857, 14.084951400756836));
  screen.updateMatrixWorld(true);
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.01, 100);
  camera.position.z = 20;
  camera.updateMatrixWorld(true);
  const projection = projectPricingScreen(screen, camera, 1000, 1000);
  assert.ok(Math.abs(projection.matrix[0] - projection.matrix[3]) < 1e-8, 'HTML must preserve the real phone screen aspect ratio');
  assert.equal(projection.width, PRICING_SCREEN_WIDTH);
  assert.equal(projection.height, PRICING_SCREEN_HEIGHT);
  assert.equal(fairHandEase(0), 0);
  assert.equal(fairHandEase(1), 1);
  hand.dispose(); phone.geometry.dispose(); screen.geometry.dispose();
});

test('keyboard reading explicitly continues the page at both fixed-portal boundaries', () => {
  const source = readFileSync('components/immersive/Pricing.jsx', 'utf8');
  const start = source.indexOf('  const scrollWithKeyboard = (event) => {');
  const end = source.indexOf('  const guardHiddenControl', start);
  const viewport = { scrollTop: 1000, clientHeight: 530 };
  const layout = { maxScroll: 1000 };
  const calls = [];
  const context = vm.createContext({
    viewportRef: { current: viewport },
    layoutRef: { current: layout },
    introRef: { current: { getBoundingClientRect: () => ({ top: -1000 }) } },
    window: { scrollY: 16000, innerHeight: 900, scrollTo: (options) => calls.push(options), scrollBy: (options) => calls.push(options) },
    pricingPagePosition: (_top, offset) => offset,
  });
  vm.runInContext(`${source.slice(start, end)}; this.onKey = scrollWithKeyboard;`, context);
  let prevented = false;
  const press = (key) => context.onKey({ key, target: viewport, preventDefault: () => { prevented = true; } });
  press('PageDown');
  assert.equal(prevented, true, 'fixed portal ancestors cannot reliably chain native PageDown to the document');
  assert.equal(calls.at(-1).top, 720, 'continue the page far enough to reveal the FAQ');
  viewport.scrollTop = 0;
  press('ArrowUp');
  assert.equal(calls.at(-1).top, -48, 'the first offer returns to the native page toward the collections');
  press('ArrowDown');
  assert.equal(prevented, true);
  assert.equal(calls.length, 3, 'inside the phone, keyboard movement still resolves to a native page position');
});

test('the first native phone projection cannot move the FAQ or footer', async () => {
  const { pricingScrollLayout, PRICING_SCREEN_WIDTH, PRICING_SCREEN_HEIGHT } = await import('../components/immersive/PricingPhoneLayout.js');
  const source = readFileSync('components/immersive/Pricing.jsx', 'utf8');
  const start = source.indexOf('    const measure = () => {');
  const end = source.indexOf('    const queueMeasure = () => {', start);
  const layoutRef = { current: null };
  const projectionRef = { current: null };
  const intro = { style: {}, getBoundingClientRect: () => ({ top: 1000 }) };
  const context = vm.createContext({
    disposed: false, measureFrame: 0, lastReducedMotion: false, sectionTop: 0,
    visual: { clientHeight: 844, clientWidth: 390 }, body: { scrollHeight: 2400 },
    viewport: { clientHeight: 530 }, intro, screen: { style: { setProperty() {} } },
    state: { reducedMotion: false }, window: { scrollY: 0 }, layoutRef, projectionRef,
    pricingScrollLayout, PRICING_SCREEN_WIDTH, PRICING_SCREEN_HEIGHT, syncScroll() {},
  });
  vm.runInContext(`${source.slice(start, end)}; this.measure = measure;`, context);
  context.measure();
  const before = intro.style.height;
  projectionRef.current = { scale: 1.2 };
  context.measure();
  assert.equal(intro.style.height, before, 'asset readiness changes projection, not document geometry');
});

test('compact footer and external copy retain an on-photo contrast surface in either theme', () => {
  const css = readFileSync('components/immersive/pricing.css', 'utf8');
  const marker = css.indexOf('/* Shared on-photo contrast');
  assert.ok(marker >= 0);
  const scoped = css.slice(marker);
  assert.match(scoped, /\.pricing-aside-layer/);
  assert.match(scoped, /\.landing-faq/);
  assert.match(scoped, /\.chapter\.footer/);
  assert.match(scoped, /--public-text: #f8f3e8/);
  assert.match(scoped, /--public-focus: #ffd60a/);
  assert.match(scoped, /--public-black: #050505/);
  assert.match(scoped.split("}")[0], /color: var\(--public-text\)/);
  assert.doesNotMatch(scoped, /\.pricing-phone-screen/);
  assert.match(scoped, /grid-template-rows: auto auto auto/);
  assert.match(scoped, /min-height: calc\(100 \* var\(--journey-vh/);
  assert.match(scoped, /--pricing-panel: #111110b3/);
  assert.match(scoped, /background: var\(--pricing-panel\)/);
});

test('on-photo text meets normal-text contrast even over a white room pixel', () => {
  const css = readFileSync('components/immersive/pricing.css', 'utf8').split('/* Shared on-photo contrast')[1];
  const rgb = hex => [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
  const luminance = channels => channels.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const backdrop = rgb('111110').map(value => value * (0xb3 / 255) + 255 * (1 - 0xb3 / 255));
  for (const token of ['public-text', 'public-muted', 'public-muted-soft', 'public-gold-light']) {
    const match = new RegExp(`--${token}: #([a-f0-9]{6})`).exec(css);
    assert.ok(match, token);
    assert.ok((luminance(rgb(match[1])) + .05) / (luminance(backdrop) + .05) >= 4.5, token);
  }
});

test('Tarifs uses the measured reading start after the hand entrance in all layouts', async () => {
  const { pricingScrollLayout, pricingPagePosition } = await import('../components/immersive/PricingPhoneLayout.js');
  for (const height of [390, 844, 900, 932]) for (const reduced of [false, true]) {
    const layout=pricingScrollLayout(height,2400,530,.7,reduced);
    const target=pricingPagePosition(12000,0,layout);
    assert.equal(target,12000+layout.readingStart);
    assert.ok(target>=12000+layout.entry);
  }
  const pricing=readFileSync('components/immersive/Pricing.jsx','utf8');
  assert.match(pricing,/pricingNavigationTarget/);
  const app=readFileSync('components/immersive/App.jsx','utf8');
  assert.ok((app.match(/pricingNavigationTarget/g)||[]).length>=2,'initial hashes and button navigation share the measured target');
});

test('the below-fold Studio preview does not eagerly download the shared laptop screen', () => {
  const source = readFileSync('components/immersive/Pricing.jsx', 'utf8');
  const preview = source.slice(source.indexOf('className="pricing-pilotage-visual"'), source.indexOf('className="pricing-pilotage-note"'));
  assert.match(preview, /src=\{dashboardReady \?/);
  const start = source.indexOf('    const syncScroll = (');
  const end = source.indexOf('    const measure = () => {', start);
  const requests = [];
  const context = vm.createContext({
    dashboardRequested: false, setDashboardReady: ready => requests.push(ready),
    layoutRef: { current: {} }, lastReducedMotion: false,
    state: { reducedMotion: false, renderSceneFrame() {}, pricingViewport: { height: 844 } },
    presenter: { scroll() {} },
  });
  vm.runInContext(`${source.slice(start, end)}; this.sync = syncScroll;`, context);
  context.sync(0, 20000);
  context.sync(19000, 20000);
  assert.deepEqual(requests, [], 'hidden fixed portals must not request dashboard pixels on initial chapters');
  context.sync(19156, 20000);
  context.sync(20000, 20000);
  context.sync(0, 20000);
  assert.deepEqual(requests, [true], 'load once on measured pricing approach, retaining the loaded image on reverse');
  assert.match(preview, /loading="lazy"/);
  assert.match(preview, /fetchPriority="low"/);
  assert.match(preview, /width="1184"[\s\S]*height="758"/, 'fixed dimensions keep the reading geometry stable');
});
