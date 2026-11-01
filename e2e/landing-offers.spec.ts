import { writeFile } from "node:fs/promises";
import { expect, test as base, type Page, type TestInfo } from '@playwright/test';
// @ts-expect-error -- use the authored camera-leg timing, not copied scroll constants.
import { CINEMATIC_TIMING } from '../components/immersive/SceneDirector.js';

// Hosted fixture correctness checks. Software rendering can need 120s for the
// existing restaurant/phone assets and 60s for the first hand GPU submission.
// These budgets do not represent device FPS, thermal or performance acceptance.
const ASSET_READY_MS = 120_000;
const HAND_READY_MS = 60_000;
const test = base.extend({
  launchOptions: async ({ browserName }, provideOptions) => {
    await provideOptions(browserName === 'chromium'
      ? { args: ['--use-angle=swiftshader', '--use-gl=angle'] }
      : {});
  },
});
test.use({ actionTimeout: 15_000 });
const profiles = [
  { label: '390-fr', width: 390, height: 844, path: '/' },
  { label: '430-en', width: 430, height: 932, path: '/en' },
  { label: 'desktop-fr', width: 1440, height: 900, path: '/' },
] as const;

async function retainJson(info: TestInfo, name: string, value: unknown) {
  const path = info.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify(value, null, 2));
  await info.attach(name, { path, contentType: 'application/json' });
}

async function openScene(page: Page, path = '/', anchor = '', reducedMotion: 'reduce' | 'no-preference' = 'reduce') {
  await page.emulateMedia({ reducedMotion });
  await page.goto(`${path}?sceneDiagnostics=1${anchor}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-ready', 'true', { timeout: ASSET_READY_MS });
  await expect(page.locator('.preloader')).toHaveCount(0, { timeout: HAND_READY_MS });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator('.pricing-hero').evaluate(el =>
    el.clientHeight > el.querySelector<HTMLElement>('.pricing-hand-visual')!.clientHeight),
  { timeout: 15_000 }).toBe(true);
}

async function geometry(page: Page) {
  // ResizeObserver queues Pricing's measure on the next frame. Read after
  // that measure, not between the new stage size and its document travel.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return page.locator('.pricing-hero').evaluate(el => ({
    top: el.getBoundingClientRect().top + scrollY,
    height: el.getBoundingClientRect().height,
    stage: el.querySelector<HTMLElement>('.pricing-hand-visual')!.clientHeight,
  }));
}

async function scrollPage(page: Page, top: number) {
  await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), top);
  await expect.poll(() => page.evaluate(target => Math.abs(scrollY - target), top), { timeout: 15_000 }).toBeLessThanOrEqual(1);
}

async function handReady(page: Page) {
  await expect(page.locator('.pricing-hand-visual')).toHaveAttribute('data-hand-ready', 'true', { timeout: HAND_READY_MS });
  await expect(page.locator('.pricing-phone-layer')).toHaveAttribute('data-hand-ready', 'true');
  await expect(page.locator('.pricing-phone-layer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.pricing-phone-layer')).not.toHaveAttribute('inert');
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-active', 'true');
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-hand-progress', '1');
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-backdrop', 'ready');
  await expect.poll(() => page.locator('.scene-canvas').evaluate((canvas: HTMLCanvasElement) =>
    canvas.dataset.pricingBackdropWidth === String(canvas.width) &&
    canvas.dataset.pricingBackdropHeight === String(canvas.height)
  ), { message: 'the current viewport has a rendered pricing projection' }).toBe(true);
}

async function enterOffers(page: Page) {
  const before = await geometry(page);
  await scrollPage(page, before.top + 1);
  await handReady(page);
  expect((await geometry(page)).height).toBeCloseTo(before.height, 1);
  return before;
}

async function backdrop(page: Page) {
  return page.locator('.scene-canvas').evaluate((node: HTMLCanvasElement) => ({
    generation: Number(node.dataset.pricingBackdropGeneration),
    pose: node.dataset.pricingBackdropPose,
    theme: node.dataset.pricingBackdropTheme,
    width: Number(node.dataset.pricingBackdropWidth),
    height: Number(node.dataset.pricingBackdropHeight),
    bufferWidth: node.width, bufferHeight: node.height,
    frames: Number(node.dataset.frames),
  }));
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, timeout: 60_000 });
  await info.attach(name, { path, contentType: 'image/png' });
}

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function assertProjection(page: Page) {
  const measured = await page.locator('.pricing-phone-screen').evaluate(el => {
    const bounds = el.getBoundingClientRect();
    const screen = getComputedStyle(el);
    const viewport = el.querySelector<HTMLElement>('.pricing-phone-viewport')!;
    return {
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      transform: screen.transform,
      fallbackBezel: getComputedStyle(el, '::before').display,
      overflow: getComputedStyle(viewport).overflowY,
      radius: parseFloat(getComputedStyle(viewport).borderBottomLeftRadius),
      actionOverlaps: [...document.querySelectorAll<HTMLElement>('.pricing-aside-intro, .pricing-aside-actions')]
        .filter(node => {
          const other = node.getBoundingClientRect();
          return other.width > 0 && other.height > 0 &&
            Math.min(bounds.right, other.right) - Math.max(bounds.left, other.left) > 1 &&
            Math.min(bounds.bottom, other.bottom) - Math.max(bounds.top, other.top) > 1;
        }).map(node => node.className),
    };
  });
  expect(measured.transform).toMatch(/^matrix\(/);
  expect(measured.width).toBeGreaterThan(Math.min(160, measured.viewportHeight * 0.2));
  expect(measured.height).toBeGreaterThan(Math.min(320, measured.viewportHeight * 0.4));
  expect(measured.width / measured.height).toBeCloseTo(6.526553630828857 / 14.084951400756836, 2);
  expect(measured.x).toBeGreaterThanOrEqual(0);
  expect(measured.y).toBeGreaterThanOrEqual(0);
  expect(measured.x + measured.width).toBeLessThanOrEqual(measured.viewportWidth + 1);
  expect(measured.y + measured.height).toBeLessThanOrEqual(measured.viewportHeight + 1);
  expect(measured.fallbackBezel).toBe('none');
  expect(measured.overflow).toBe('hidden');
  expect(measured.radius).toBeGreaterThan(0);
  expect(measured.actionOverlaps, 'the projected phone must not cover title/actions').toEqual([]);
  // Real hit testing must permit the visible link, while the scene's ray-based
  // guard rejects a pointer event outside the actual rounded phone aperture.
  const firstCard = page.locator('.pricing-offer-card').first();
  await firstCard.click({ trial: true });
  expect(await firstCard.evaluate(el => {
    const box = document.querySelector('.pricing-phone-screen')!.getBoundingClientRect();
    return el.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, detail: 1,
      clientX: Math.max(0, box.left - 12), clientY: box.top + box.height / 2,
    }));
  })).toBe(false);
}

async function assertOnPhotoContrast(page: Page, selector: string) {
  const values = await page.locator(selector).evaluate(el => {
    const style = getComputedStyle(el);
    return { color: style.color, text: style.getPropertyValue('--public-text').trim() };
  });
  const light = await page.locator('html').getAttribute('data-vistaire-theme') === 'light';
  expect(values.text.toLowerCase()).toBe(light ? '#28251f' : '#f8f3e8');
  expect(values.color).toBe(light ? 'rgb(40, 37, 31)' : 'rgb(248, 243, 232)');
}

for (const profile of profiles) {
  test(`${profile.label}: projected offers and closing sections retain dark/light readability`, { tag: profile.width < 500 ? '@critical' : [] }, async ({ page }, info) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await openScene(page, profile.path);
    const layout = await enterOffers(page);
    const initial = await backdrop(page);
    expect(initial.generation).toBeGreaterThan(0);
    expect(initial.pose).toMatch(/^pricing-entry:/);
    expect(initial.width).toBe(initial.bufferWidth);
    expect(initial.height).toBe(initial.bufferHeight);
    await assertProjection(page);
    const phone = page.locator('.pricing-phone-screen');
    await expect(phone.locator('.pricing-offer-card')).toHaveCount(4);
    await expect(phone.locator('.pricing-offer-card h4')).toHaveText(['Acrylique', 'Sculpté', 'Carré', 'Signature']);
    for (const [index, amount] of ['000', '050', '100', '200'].entries()) {
      await expect(phone.locator('.pricing-offer-price').nth(index)).toContainText(new RegExp(`2[\\s,\\u00a0\\u202f]*${amount}`));
      await expect(phone.locator('.pricing-offer-price small').nth(index)).toHaveText(profile.path === '/en' ? 'Starting from' : 'À partir de');
    }
    await expect(phone.locator('.pricing-monthly')).toContainText('200');
    await expect(phone.locator('.pricing-pilotage-price')).toContainText('100');
    await expect(phone.locator('.pricing-pilotage-note').first()).toContainText(profile.path === '/en' ? 'Synthetic demo data' : 'Données de démonstration fictives');
    const target = profile.path === '/en' ? '/en/pricing-digital-restaurant-menu' : '/tarifs-menu-digital-restaurant';
    await expect(phone.locator('.pricing-offer-card').last()).toHaveAttribute('href', `${target}#collection-signature`);
    await expect(page.locator('.pricing-aside-terms')).toContainText('CAD');
    await expect(page.locator('.pricing-aside-terms')).toContainText('12');

    for (const theme of ['dark', 'light'] as const) {
      await scrollPage(page, layout.top + 1);
      await handReady(page);
      if (theme === 'light') {
        const before = await backdrop(page);
        await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
        await page.locator('.site-header [data-public-theme-toggle]').click();
        await expect(page.locator('html')).toHaveAttribute('data-vistaire-theme', 'light');
        await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-backdrop-theme', 'light');
        const after = await backdrop(page);
        expect(after.generation).toBe(before.generation);
        expect(after.pose).toBe(before.pose);
        const surface = await phone.evaluate(el => getComputedStyle(el).backgroundColor);
        expect(surface).toBe('rgb(255, 252, 245)');
      }
      await expect(phone.locator('.pricing-pilotage-visual img')).toHaveAttribute('src', theme === 'light' ? '/immersive-assets/dashboard/dashboard-light.webp' : '/immersive-assets/dashboard/dashboard-black-gold.webp');
      // The below-fold Studio image is intentionally lazy inside the reader.
      // Reveal it in each theme before requiring every image to decode, then
      // return to the first collection for unchanged layout/hit-test evidence.
      const reader = page.locator('.pricing-phone-viewport');
      await reader.focus();
      await reader.press('End');
      await expect(phone.locator('.pricing-pilotage-visual img')).toBeInViewport();
      await expect.poll(() => phone.locator('img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
      await reader.press('Home');
      await handReady(page);
      await assertProjection(page);
      await assertOnPhotoContrast(page, '.pricing-aside-layer');
      await assertNoOverflow(page);
      await screenshot(page, info, `${profile.label}-${theme}-offers`);
      const currentLayout = await geometry(page);
      await scrollPage(page, currentLayout.top + currentLayout.height + 2);
      await expect(page.locator('.pricing-phone-layer')).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator('.landing-faq [data-seo-faq-question]')).toHaveCount(5);
      await expect(page.locator('.landing-faq [data-faq-ask-input]')).toBeVisible();
      await assertOnPhotoContrast(page, '.landing-faq');
      await screenshot(page, info, `${profile.label}-${theme}-faq`);
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      const footer = page.locator('#footer');
      await expect(footer.locator('.footer-main, .footer-scene')).toHaveCount(0);
      await expect(footer.locator('[data-footer-navigation] section')).toHaveCount(6);
      await expect(footer.locator('.footer-bottom')).toBeInViewport();
      await assertOnPhotoContrast(page, '#footer');
      expect((await backdrop(page)).pose).toBe(initial.pose);
      expect((await backdrop(page)).generation).toBe(initial.generation);
      await screenshot(page, info, `${profile.label}-${theme}-footer`);
      await assertNoOverflow(page);
    }
    await retainJson(info, 'cache-evidence', { initial, final: await backdrop(page), errors });
    expect(errors).toEqual([]);
  });
}

test('keyboard reads every offer, yields to the FAQ and wakes the original scene on reverse', { tag: '@critical' }, async ({ page }, info) => {
  test.setTimeout(210_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openScene(page);
  const layout = await enterOffers(page);
  const viewport = page.locator('.pricing-phone-viewport');
  const cards = page.locator('.pricing-offer-card');
  for (let index = 0; index < 4; index++) {
    await cards.nth(index).focus();
    await expect(cards.nth(index)).toBeFocused();
    await expect.poll(() => cards.nth(index).evaluate(el => {
      const a = el.getBoundingClientRect();
      const b = document.querySelector('.pricing-phone-viewport')!.getBoundingClientRect();
      return a.top >= b.top - 2 && a.bottom <= b.bottom + 2;
    }), { message: `offer ${index + 1} is inside the clipped reading viewport` }).toBe(true);
  }
  await viewport.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => viewport.evaluate(el => (-new DOMMatrixReadOnly(getComputedStyle(el.firstElementChild!).transform).m42 || 0))).toBeLessThan(1);
  await page.keyboard.press('PageDown');
  await expect.poll(() => viewport.evaluate(el => (-new DOMMatrixReadOnly(getComputedStyle(el.firstElementChild!).transform).m42 || 0))).toBeGreaterThan(100);
  const before = await backdrop(page);
  const offset = await viewport.evaluate(el => (-new DOMMatrixReadOnly(getComputedStyle(el.firstElementChild!).transform).m42 || 0));
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => viewport.evaluate(el => (-new DOMMatrixReadOnly(getComputedStyle(el.firstElementChild!).transform).m42 || 0))).toBeGreaterThan(offset);
  // Explicit 250ms settled observation, not a hardware FPS benchmark.
  await page.waitForTimeout(250);
  expect((await backdrop(page)).frames).toBe(before.frames);
  await page.keyboard.press('End');
  try {
    await expect.poll(() => viewport.evaluate(el => Math.abs((el.firstElementChild as HTMLElement).offsetHeight - el.clientHeight - (-new DOMMatrixReadOnly(getComputedStyle(el.firstElementChild!).transform).m42 || 0)))).toBeLessThanOrEqual(1);
  } finally {
    await retainJson(info, 'keyboard-end-layout', await viewport.evaluate(el => ({
      y: scrollY, readerHeight: el.clientHeight, contentHeight: (el.firstElementChild as HTMLElement).offsetHeight,
      scrollHeight: el.firstElementChild!.scrollHeight, transform: getComputedStyle(el.firstElementChild!).transform,
      images: [...el.querySelectorAll('img')].map(img => ({ src: img.currentSrc, loaded: img.complete,
        height: img.offsetHeight, ratio: getComputedStyle(img).aspectRatio })),
    })));
  }
  await expect(page.locator('.pricing-pilotage')).toBeInViewport();
  const pageBeforeExit = await page.evaluate(() => scrollY);
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(pageBeforeExit + 1);
  await expect(page.locator('.landing-faq')).toBeInViewport();
  const question = page.locator('.landing-faq [data-seo-faq-question]').nth(1);
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(question).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.landing-faq [data-faq-ask-input]').focus();
  await expect(page.locator('.landing-faq [data-faq-ask-input]')).toBeFocused();
  await screenshot(page, info, 'keyboard-reaches-faq');
  await scrollPage(page, layout.top - 2);
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-backdrop', 'released');
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-suspended', 'false');
  await enterOffers(page);
  expect((await backdrop(page)).pose).toBe(before.pose);
  expect((await backdrop(page)).generation).toBeGreaterThan(before.generation);
});

test('direct pricing anchor and normal native-scroll entry capture the same intended room', async ({ page }, info) => {
  test.setTimeout(300_000); // Two independent asset-ready page lifecycles.
  await page.setViewportSize({ width: 1440, height: 900 });
  await openScene(page, '/', '#open-weight');
  await enterOffers(page);
  const direct = await backdrop(page);
  await screenshot(page, info, 'direct-anchor-offers');
  await openScene(page);
  const layout = await geometry(page);
  // Native document positions approach the preceding product chapter, then the
  // boundary. This is deliberately independent of goto/hash navigation.
  await scrollPage(page, layout.top - layout.stage * 0.75);
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-section', 'product');
  await scrollPage(page, layout.top - 2);
  await scrollPage(page, layout.top + 1);
  await handReady(page);
  const normal = await backdrop(page);
  expect(normal.pose).toBe(direct.pose);
  expect(normal.width).toBe(direct.width);
  expect(normal.height).toBe(direct.height);
  expect(normal.pose).toMatch(/^pricing-entry:/);
  await screenshot(page, info, 'normal-scroll-offers');
  await scrollPage(page, 0);
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-backdrop', 'released');
  await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
  await page.locator('.desktop-nav').getByRole('button', { name: 'Tarifs', exact: true }).click();
  await handReady(page);
  const navigation = await backdrop(page);
  expect(navigation.pose).toBe(normal.pose);
  expect(navigation.generation).toBeGreaterThan(normal.generation);
  await retainJson(info, 'entry-path-cache-comparison', { direct, normal, navigation });
});

test('portrait to landscape remeasures the actual hand and returns to a usable portrait', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openScene(page);
  await enterOffers(page);
  const orientationEvidence: unknown[] = [];
  const observeOrientation = async (phase: string) => {
    orientationEvidence.push(await page.evaluate(label => {
      const canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas');
      const measured = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const bounds = element.getBoundingClientRect(), style = getComputedStyle(element);
        return { bounds: bounds.toJSON(), client: [element.clientWidth, element.clientHeight],
          transform: style.transform, handReady: element.dataset.handReady, ariaHidden: element.getAttribute('aria-hidden') };
      };
      return { phase: label, at: performance.now(), viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
        visualViewport: window.visualViewport ? [visualViewport!.width, visualViewport!.height] : null,
        scroll: scrollY, canvas: canvas ? { width: canvas.width, height: canvas.height, data: { ...canvas.dataset } } : null,
        stage: measured('.pricing-hand-visual'), layer: measured('.pricing-phone-layer'), screen: measured('.pricing-phone-screen') };
    }, phase));
  };
  try {
  await observeOrientation('portrait-ready');
  for (const viewport of [{ width: 844, height: 390 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual(viewport);
    await expect.poll(() => page.locator('.pricing-hand-visual').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight })), { timeout: 15_000 }).toEqual(viewport);
    await enterOffers(page);
    await observeOrientation(`before-projection-${viewport.width}x${viewport.height}`);
    await assertProjection(page);
    const cache = await backdrop(page);
    expect(cache.width).toBe(cache.bufferWidth);
    expect(cache.height).toBe(cache.bufferHeight);
    for (const link of await page.locator('.pricing-aside-links a').all()) await expect(link).toBeInViewport();
    await assertNoOverflow(page);
    await screenshot(page, info, `orientation-${viewport.width}x${viewport.height}`);
  }
  } finally {
    await retainJson(info, 'orientation-current-projection', orientationEvidence);
  }
});

test('an unavailable hand keeps all offers and keyboard access in the semantic fallback', { tag: '@critical' }, async ({ page }, info) => {
  test.setTimeout(210_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/immersive-assets/pricing-hand/fair-hand-grip-v3.png', route => route.abort('failed'));
  await openScene(page, '/en');
  const layout = await geometry(page);
  await scrollPage(page, layout.top + 1);
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-hand', 'fallback', { timeout: HAND_READY_MS });
  await expect(page.locator('.pricing-phone-layer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.pricing-phone-layer')).toHaveAttribute('data-hand-ready', 'false');
  await expect(page.locator('.pricing-phone-layer')).not.toHaveAttribute('inert');
  await expect(page.locator('.pricing-offer-card')).toHaveCount(4);
  for (const card of await page.locator('.pricing-offer-card').all()) {
    await card.focus();
    await expect(card).toBeFocused();
    await expect(card).toHaveAttribute('href', /\/en\/pricing-digital-restaurant-menu#collection-/);
  }
  await page.locator('.pricing-phone-viewport').focus();
  await page.keyboard.press('End');
  await expect(page.locator('.pricing-pilotage')).toBeInViewport();
  await screenshot(page, info, 'hand-unavailable-readable-fallback');
  await page.keyboard.press('PageDown');
  await expect(page.locator('.landing-faq')).toBeInViewport();
  await expect(page.locator('.landing-faq [data-faq-ask-input]')).toBeVisible();
  await assertNoOverflow(page);
});

for (const profile of [{width:390,height:844,path:'/en',label:'Pricing'}, {width:1440,height:900,path:'/',label:'Tarifs'}]) {
  test(`${profile.width}px normal-motion pricing links finish the hand entrance and preserve history`, async ({page},info)=>{
    test.setTimeout(240_000);
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await openScene(page,profile.path,'#open-weight','no-preference');
    await handReady(page);
    await expect.poll(()=>page.locator('.pricing-phone-viewport').evaluate(el=>(-new DOMMatrixReadOnly(getComputedStyle(el.firstElementChild!).transform).m42 || 0))).toBeLessThanOrEqual(1);
    await page.evaluate(()=>{location.hash='hero';});
    await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-backdrop','released');
    await page.goBack();
    await handReady(page);
    await page.setViewportSize({width:profile.width===390?430:1337,height:profile.height});
    await scrollPage(page,0);
    await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-backdrop','released');
    await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
    if(profile.width===390){
      await page.locator('.site-header .menu-toggle').click();
      await page.locator('#mobile-menu').getByRole('button',{name:`04 ${profile.label}`,exact:true}).click();
    }else await page.locator('.desktop-nav').getByRole('button',{name:profile.label,exact:true}).click();
    await handReady(page);
    await expect.poll(()=>page.locator('.pricing-phone-viewport').evaluate(el=>(-new DOMMatrixReadOnly(getComputedStyle(el.firstElementChild!).transform).m42 || 0))).toBeLessThanOrEqual(1);
    await assertProjection(page);
    await screenshot(page,info,`pricing-navigation-${profile.width}`);
  });
}

for (const width of [390, 430, 1440]) test(`the laptop follows scroll and animates the selected site theme at ${width}px`,async({page,browserName},info)=>{
  test.setTimeout(210_000);
  await page.addInitScript(()=>localStorage.setItem('vistaire-public-theme','light'));
  await page.setViewportSize({width,height:900});
  await openScene(page);
  await page.locator('#sustainability').evaluate(el=>scrollTo({top:el.getBoundingClientRect().top+scrollY+innerHeight*.5,behavior:'instant'}));
  const canvas=page.locator('.scene-canvas');
  await expect(canvas).toHaveAttribute('data-laptop-ready','true',{timeout:ASSET_READY_MS});
  await expect(canvas).toHaveAttribute('data-laptop-dashboard-theme','light');
  const angle = () => canvas.evaluate(el => Number((el as HTMLElement).dataset.laptopAngle));
  const position = async (progress: number) => {
    await page.locator('#sustainability').evaluate((el, progress) => scrollTo({
      top: el.getBoundingClientRect().top + scrollY + (el.clientHeight - el.firstElementChild!.clientHeight) * progress,
      behavior: 'instant',
    }), progress);
    await expect(canvas).toHaveAttribute('data-section', 'sustainability');
  };
  await position(.2);
  await expect.poll(angle).toBeLessThan(90);
  const early = await angle();
  await position(.65);
  await expect.poll(angle).toBeGreaterThan(early + 20);
  await position(.2);
  await expect.poll(async () => Math.abs(await angle() - early)).toBeLessThan(1);
  await screenshot(page,info,'current-dashboard-laptop-light');
  await expect(page.locator("[data-public-navigation-open]")).toBeVisible();
  await page.evaluate(() => {
    if (!document.startViewTransition) return;
    const native = document.startViewTransition.bind(document);
    document.startViewTransition = update => {
      const transition = native(update);
      void transition.ready.then(() => {
        const style = getComputedStyle(document.documentElement, '::view-transition-new(root)');
        document.documentElement.dataset.themeAnimation = style.animationName;
        document.documentElement.dataset.themeAnimationDuration = style.animationDuration;
      }).catch(() => {});
      return transition;
    };
  });
  await page.locator('.site-header [data-public-theme-toggle]').click();
  await expect(canvas).toHaveAttribute('data-laptop-dashboard-theme','dark');
  if (browserName === 'chromium') {
    await expect(page.locator('html')).toHaveAttribute('data-theme-animation', 'vistaire-theme-blinds-reveal');
    const duration = await page.locator('html').evaluate(el => parseFloat(el.dataset.themeAnimationDuration!));
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(.1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await screenshot(page,info,'current-dashboard-laptop-dark');
});


for (const width of [390,1440]) test(`native entry assistance is bounded, interruptible and reduced-motion safe at ${width}px`,async({page,browserName},info)=>{
  test.setTimeout(240_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  // Passive, bounded evidence for actual native-input delivery. This never
  // marks synthetic input trusted or changes the application's scroll calls.
  await page.addInitScript(() => {
    const records: Record<string, unknown>[] = [];
    const record = (type: string, event?: Event, call?: unknown) => {
      const target = event?.target instanceof Element ? event.target : null;
      records.push({ type, at: performance.now(), y: scrollY, call,
        eventTimeStamp: event?.timeStamp, trusted: event?.isTrusted, defaultPrevented: event?.defaultPrevented,
        target: target?.tagName ?? (event?.target === document ? '#document' : undefined),
        active: document.activeElement?.tagName, hasScrollEnd: 'onscrollend' in document,
        key: event instanceof KeyboardEvent ? event.key : undefined,
        deltaY: event instanceof WheelEvent ? event.deltaY : undefined,
        hidden: document.hidden, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        ready: document.querySelector('.scene-canvas')?.getAttribute('data-ready'),
        settled: document.querySelector('.scene-canvas')?.getAttribute('data-settled'),
      });
      if (records.length > 250) records.shift();
    };
    const host = window as typeof window & { __entryAssistEvidence?: unknown[]; __vistaireScrollAssistTrace?: (row: Record<string, unknown>) => void };
    host.__entryAssistEvidence = records;
    host.__vistaireScrollAssistTrace = row => record('helper', undefined, row);
    for (const type of ['wheel', 'keydown', 'keyup', 'scroll', 'scrollend', 'focusin', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'visibilitychange'])
      document.addEventListener(type, event => record(type, event), { capture: true, passive: true });
    const original = window.scrollTo.bind(window);
    window.scrollTo = ((...args: [ScrollToOptions] | [number, number]) => {
      record('scrollTo', undefined, args);
      if (typeof args[0] === 'number') original(args[0], args[1]!);
      else original(args[0]);
    }) as typeof window.scrollTo;
  });
  try {
  await page.setViewportSize({width,height:844});
  await openScene(page,'/','','no-preference');
  const opening = await page.locator('.opening-journey').evaluate(el => ({
    top: el.getBoundingClientRect().top + scrollY,
    stage: parseFloat(getComputedStyle(el.firstElementChild!).height),
  }));
  // Match App's authored navigation anchors: AI is the middle of its
  // reading hold, not the end of the incoming camera leg.
  const end = opening.top + opening.stage * CINEMATIC_TIMING.openingMotionScreens / 2;
  const wearable = opening.top + opening.stage * CINEMATIC_TIMING.openingMotionScreens;
  const position = async (y: number) => {
    await scrollPage(page, y);
    // A setup teleport is not the gesture under test. Wait for its actual
    // processed pose before sending fresh trusted input into that position.
    await expect.poll(() => page.locator('.scene-canvas').evaluate(el =>
      Number(el.getAttribute('data-processed-scroll-distance'))), { timeout: 15_000 })
      .toBeCloseTo((Math.round(y) - opening.top) / opening.stage, 2);
    await expect(page.locator('.scene-canvas')).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
  };
  const gesture = async (direction: number) => {
    if (browserName === 'webkit') {
      // This mobile WebKit project has no mouse.wheel support. Use its real
      // keyboard input; it is not evidence of native iPhone touch inertia.
      await page.keyboard.press(direction > 0 ? 'ArrowDown' : 'ArrowUp');
    } else await page.mouse.wheel(0, direction * 40);
  };
  // The pinned mobile WebKit ArrowDown traverses 89px; leave enough real
  // keyboard travel before the endpoint instead of demanding a backward pull.
  const inputRoom = browserName === 'webkit' ? 180 : 80;
  await page.mouse.move(width*.85,600);
  await position(end-inputRoom);
  await gesture(1);
  await expect.poll(()=>page.evaluate(target=>Math.abs(scrollY-target),end),{timeout:15_000}).toBeLessThanOrEqual(1);
  await page.waitForTimeout(350);
  expect(await page.evaluate(target=>Math.abs(scrollY-target),end)).toBeLessThanOrEqual(1);
  await position(inputRoom);
  await gesture(-1);
  await expect.poll(()=>page.evaluate(()=>scrollY),{timeout:15_000}).toBeLessThanOrEqual(1);
  // A materially larger committed handoff now completes too, then stops.
  await position(end - Math.min(opening.stage, end * 0.4));
  await gesture(1);
  await expect.poll(()=>page.evaluate(target=>Math.abs(scrollY-target),end),{timeout:15_000}).toBeLessThanOrEqual(1);
  // No proximity gate: a small genuine gesture near the beginning completes
  // to the adjacent AI reading stop, without chaining on to Wearable.
  await position(opening.top + opening.stage * .15);
  await gesture(1);
  await expect.poll(()=>page.evaluate(target=>Math.abs(scrollY-target),end),{timeout:15_000}).toBeLessThanOrEqual(1);
  await page.waitForTimeout(350);
  expect(await page.evaluate(target=>Math.abs(scrollY-target),end)).toBeLessThanOrEqual(1);
  // A far reverse gesture uses the previous reading stop, not an exit boundary.
  await position(end - opening.stage * .15);
  await gesture(-1);
  await expect.poll(()=>page.evaluate(target=>Math.abs(scrollY-target),opening.top),{timeout:15_000}).toBeLessThanOrEqual(1);
  // Leaving the AI reading point completes its remaining hold AND the following
  // transition as one journey to the existing Wearable reading anchor.
  await position(end + opening.stage * .15);
  await gesture(1);
  await expect.poll(()=>page.evaluate(target=>Math.abs(scrollY-target),wearable),{timeout:15_000}).toBeLessThanOrEqual(1);
  await page.waitForTimeout(350);
  expect(await page.evaluate(target=>Math.abs(scrollY-target),wearable)).toBeLessThanOrEqual(1);

  // Internal stable poses are their own stops: one gesture from the closed lid
  // ends on the fully opened laptop, and one from detail 1 ends on detail 2.
  const exitStart = (id: string) => page.locator(`#${id}`).evaluate(el => Number((el as HTMLElement).dataset.exitStart));
  const laptopOpen = await exitStart('sustainability');
  await position(laptopOpen - opening.stage * 2);
  await gesture(1);
  await expect.poll(()=>page.evaluate(target=>Math.abs(scrollY-target),laptopOpen),{timeout:20_000}).toBeLessThanOrEqual(1);
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-laptop-angle', '120.00');
  await expect(page.locator('html')).toHaveAttribute('data-chapter', 'sustainability');
  const featuresTop = await page.locator('#features').evaluate(el => el.getBoundingClientRect().top + scrollY);
  await position(featuresTop + opening.stage * (CINEMATIC_TIMING.edgeScreens + .3));
  await gesture(1);
  await expect.poll(()=>page.locator('.feature-number').textContent(),{timeout:20_000}).toContain('2');
  await page.waitForTimeout(600);
  await expect(page.locator('html')).toHaveAttribute('data-chapter', 'features');
  expect(await page.locator('#features').evaluate(el => Number((el as HTMLElement).style.getPropertyValue('--detail-opacity')))).toBeCloseTo(1, 6);

  await position(end-inputRoom);
  await gesture(1);
  await page.keyboard.press('Escape');
  // An owned wheel can be cancelled before its first frame moves the page.
  const interruptedAt = await page.evaluate(() => scrollY);
  await page.waitForTimeout(350);
  if (browserName === 'chromium') {
    expect(Math.abs(await page.evaluate(() => scrollY) - interruptedAt)).toBeLessThanOrEqual(1);
  } else {
    // Escape cancels our continuation, not the browser's already committed
    // native ArrowDown motion. That motion still stops short of the target.
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(end - inputRoom + 5);
  }
  expect(await page.evaluate(()=>scrollY)).toBeLessThan(end-10);
  const cancellation = await page.evaluate(() => {
    const records = (window as typeof window & { __entryAssistEvidence?: Array<{
      type: string; key?: string; call?: Record<string, unknown>;
    }> }).__entryAssistEvidence ?? [];
    const escape = records.findLastIndex(row => row.type === 'keydown' && row.key === 'Escape');
    return { seen: escape >= 0, helpers: records.slice(escape + 1)
      .flatMap(row => row.type === 'helper' && row.call ? [row.call] : []) };
  });
  expect(cancellation.seen).toBe(true);
  expect(cancellation.helpers).toContainEqual(expect.objectContaining({
    type: 'intent-rejected', mode: 'native', gesture: null, assisting: null,
  }));
  expect(cancellation.helpers.filter(row => row.type === 'assist-start' || row.type === 'assist-write')).toEqual([]);
  await page.emulateMedia({reducedMotion:'reduce'});
  await position(end-inputRoom);
  await gesture(1);
  await expect.poll(()=>page.evaluate(target=>Math.abs(scrollY-target),end)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  } finally {
    let diagnosticTimer: ReturnType<typeof setTimeout> | undefined;
    const evidence = await Promise.race([
      page.evaluate(() => (window as typeof window & {
        __entryAssistEvidence?: unknown[];
      }).__entryAssistEvidence ?? []).catch(() => []),
      new Promise<unknown[]>(resolve => { diagnosticTimer = setTimeout(() => resolve([]), 1000); }),
    ]).finally(() => clearTimeout(diagnosticTimer));
    await retainJson(info, `entry-assist-${browserName === 'webkit' ? 'keyboard' : 'wheel'}-${width}`, evidence);
  }
});

for (const width of [390, 1440]) test(`section reveals preserve the visible subject orientation at ${width}px`, async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width, height: 844 });
  await openScene(page, '/', '', 'no-preference');
  const canvas = page.locator('.scene-canvas');
  const evidence: Array<{ join: string; progress: number; quaternion: number[]; scale: number; bounds: unknown }> = [];
  try {
  for (const [from, to, subject] of [['features', 'encryption', 'dish'], ['encryption', 'grip', 'support']] as const) {
    const window = await page.locator(`#${from}`).evaluate(element => {
      const d = (element as HTMLElement).dataset;
      return { start: Number(d.exitStart), end: Number(d.exitEnd) };
    });
    expect(window.end).toBeGreaterThan(window.start);
    if (subject === 'support') {
      await scrollPage(page, window.start - 10);
      await page.locator('#encryption').getByRole('button', { name: 'Retourner le support', exact: true }).click();
      await expect(page.locator('#encryption').getByRole('button', { name: 'Voir le QR code', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    let reference: number[] | undefined;
    for (const progress of [.1, .35, .65, .9, .65, .35, .1]) {
      await scrollPage(page, window.start + (window.end - window.start) * progress);
      await page.waitForFunction(({ join, progress, subject }) => {
        const d = document.querySelector<HTMLCanvasElement>('.scene-canvas')!.dataset;
        return d.transition === join && Math.abs(Number(d.transitionProgress) - progress) < .002 &&
          d.settled === 'true' && Boolean(d[`${subject}Bounds`]) &&
          (subject !== 'dish' || Boolean(d.renderedModel));
      }, { join: `${from}:${to}`, progress, subject }, { timeout: HAND_READY_MS });
      const state = await canvas.evaluate((element, subject) => {
        const d = (element as HTMLCanvasElement).dataset;
        return { quaternion: d[`${subject}Quaternion`]!.split(',').map(Number),
          scale: Number(d[`${subject}Scale`]!.split(',')[0]), bounds: JSON.parse(d[`${subject}Bounds`]!) };
      }, subject);
      expect(state.scale).toBeGreaterThan(.003);
      expect(state.quaternion.every(Number.isFinite)).toBe(true);
      reference ??= state.quaternion;
      // q and -q represent the same orientation; no hidden-default spin is allowed.
      const length = (q: number[]) => Math.sqrt(q.reduce((sum, value) => sum + value * value, 0));
      const alignment = Math.abs(state.quaternion.reduce((sum, value, index) => sum + value * reference![index], 0)) /
        (length(state.quaternion) * length(reference));
      expect(alignment).toBeGreaterThan(1 - 1e-10);
      evidence.push({ join: `${from}:${to}`, progress, ...state });
    }
  }
  } finally {
    await retainJson(info, 'visible-subject-transition-poses', evidence);
  }
});

// Same-build native-input evidence: these traces measure the actual position
// join rather than inferring smoothness from the controller's polynomial.
// WebKit uses genuine keyboard input; it does not emulate iPhone inertia.
const HANDOFF_COMPLETION_MS = 15_000;
const HANDOFF_STABILITY_MS = 150;
type HandoffRow = Record<string, unknown>;
type HandoffTraceHost = Window & {
  __vistaireScrollAssistTrace?: (row: HandoffRow) => void;
  __handoffCapture?: {
    start(): void;
    read(target: number): { acknowledged: boolean; remainingMs: number };
    finish(): { rows: HandoffRow[]; meta: HandoffRow };
  };
};
function installHandoffCapture({ budgetMs, stabilityMs }: { budgetMs: number; stabilityMs: number }) {
  const host = window as HandoffTraceHost;
  const rows: HandoffRow[] = [];
  const original = window.scrollTo;
  // Capture covers the same completion budget and the existing stability tail.
  const frameWindowMs = budgetMs + stabilityMs;
  let running = false, frame = 0, stopTimer = 0, started = 0, previousAt = 0, previousY = 0;
  let exhausted: string | null = null;
  const stopAtLimit = (reason: string) => { exhausted = reason; running = false; cancelAnimationFrame(frame); };
  const append = (type: string, detail: HandoffRow = {}) => {
    if (!running) return;
    if (rows.length >= 3000) { stopAtLimit('row-limit'); return; }
    if (performance.now() - started > frameWindowMs) { stopAtLimit('time-limit'); return; }
    rows.push({ type, at: performance.now(), y: scrollY, ...detail });
  };
  const sample = (rafAt: number) => {
    if (!running) return;
    const at = performance.now(), y = scrollY, dt = at - previousAt;
    append('position', { at, rafAt, dt, velocity: dt > 0 ? (y - previousY) / dt : null,
      renderedFrames: Number(document.querySelector<HTMLElement>('.scene-canvas')?.dataset.frames) });
    previousAt = at; previousY = y;
    if (running) frame = requestAnimationFrame(sample);
  };
  const types = ['wheel', 'keydown', 'keyup', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'scroll', 'scrollend', 'visibilitychange'];
  const observe = (event: Event) => append('input-event', {
    eventType: event.type, eventTimeStamp: event.timeStamp, trusted: event.isTrusted,
    documentScroll: event.target === document,
    key: event instanceof KeyboardEvent ? event.key : undefined,
    deltaY: event instanceof WheelEvent ? event.deltaY : undefined,
    contacts: 'touches' in event ? (event as TouchEvent).touches.length : undefined,
  });
  for (const type of types) document.addEventListener(type, observe, { passive: true, capture: true });
  const scrollWrapper = function(this: Window, ...args: Parameters<Window['scrollTo']>) {
    const before = scrollY, calledAt = performance.now();
    try { return Reflect.apply(original, this, args); }
    finally { append('scroll-write', { calledAt, before, args }); }
  } as typeof window.scrollTo;
  window.scrollTo = scrollWrapper;
  host.__vistaireScrollAssistTrace = row => append('helper', { helper: row });
  host.__handoffCapture = {
    start() {
      rows.length = 0; started = previousAt = performance.now(); previousY = scrollY; running = true; exhausted = null;
      append('start', { hasScrollEnd: 'onscrollend' in document, hidden: document.hidden,
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches });
      frame = requestAnimationFrame(sample);
      stopTimer = window.setTimeout(() => stopAtLimit('time-limit'), frameWindowMs);
    },
    read(target) {
      const completed = rows.findIndex(row => row.type === 'helper' && (row.helper as HandoffRow).type === 'completed');
      return {
        // Row order matters when WebKit timestamps share the same millisecond.
        acknowledged: completed >= 0 && rows.slice(completed + 1).some(row => row.type === 'position'
          && Number(row.at) - started <= budgetMs && Math.abs(Number(row.y) - target) <= 1),
        remainingMs: Math.max(0, budgetMs - (performance.now() - started)),
      };
    },
    finish() {
      append('finish'); running = false; cancelAnimationFrame(frame); clearTimeout(stopTimer);
      for (const type of types) document.removeEventListener(type, observe, { capture: true });
      if (window.scrollTo === scrollWrapper) window.scrollTo = original;
      delete host.__vistaireScrollAssistTrace;
      return { rows, meta: { timeOrigin: performance.timeOrigin, width: innerWidth, height: innerHeight,
        startedAt: started, elapsed: performance.now() - started, maxRows: 3000,
        completionBudgetMs: budgetMs, stabilityMs, frameWindowMs, exhausted,
        visibility: document.visibilityState, scene: { ...document.querySelector<HTMLElement>('.scene-canvas')?.dataset } } };
    },
  };
}

for (const width of [390, 1440]) test(`continuous assistance retains the actual native-to-assisted position trace at ${width}px`, async ({ page, browserName }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(installHandoffCapture, { budgetMs: HANDOFF_COMPLETION_MS, stabilityMs: HANDOFF_STABILITY_MS });
  const failures: string[] = [];
  let geometry: { top: number; stage: number; end: number; from: number } | undefined;
  let captureStarted = false;
  try {
    // The helper consumer is installed before startup; heavy 3D diagnostics are
    // unnecessary for native position ownership and completion evidence.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('.scene-canvas');
    await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: ASSET_READY_MS });
    await expect(page.locator('.preloader')).toHaveCount(0, { timeout: HAND_READY_MS });
    await page.evaluate(() => document.fonts.ready);
    const opening = await page.locator('.opening-journey').evaluate(el => ({
      top: el.getBoundingClientRect().top + scrollY,
      stage: parseFloat(getComputedStyle(el.firstElementChild!).height),
    }));
    const join = await page.locator('#wearable').evaluate(element => ({
      start: Number((element as HTMLElement).dataset.exitStart),
      end: Number((element as HTMLElement).dataset.exitEnd),
    }));
    expect(join.end).toBeGreaterThan(join.start);
    const end = join.end;
    const from = end - opening.stage * .7;
    expect(from).toBeGreaterThan(join.start);
    geometry = { ...opening, end, from };
    const beforeFrames = await canvas.evaluate(el => Number((el as HTMLElement).dataset.frames));
    await scrollPage(page, from);
    await page.waitForFunction(({ from, beforeFrames }) => {
      const canvas = document.querySelector<HTMLElement>('.scene-canvas');
      if (!canvas || Math.abs(scrollY - from) > 1 || canvas.dataset.ready !== 'true') return false;
      const current = [...document.querySelectorAll<HTMLElement>('.chapter')]
        .filter(el => scrollY >= el.getBoundingClientRect().top + scrollY - 1).at(-1);
      if (!current) return false;
      const rect = current.getBoundingClientRect(), stage = current.firstElementChild!.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - stage.height)));
      return Number(canvas.dataset.frames) > beforeFrames && canvas.dataset.section === current.id
        && Math.abs(Number(canvas.dataset.progress) - progress) < .00011;
    }, { from, beforeFrames }, { timeout: 15_000 });
    await expect(canvas).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
    await page.mouse.move(width * .85, 600);
    await page.evaluate(() => (window as HandoffTraceHost).__handoffCapture!.start());
    captureStarted = true;
    if (browserName === 'chromium') {
      // One trusted impulse avoids mistaking delayed automation packets for
      // separate gestures. This does not reproduce physical trackpad inertia.
      await page.mouse.wheel(0, 160);
    } else {
      await page.keyboard.down('ArrowDown');
      await page.waitForTimeout(60);
      await page.keyboard.up('ArrowDown');
    }
    // Reaching a rounded pixel can precede the helper's trusted completion.
    // The deadline includes input dispatch; do not restart another 15 s wait.
    const remainingMs = await page.evaluate(target => (window as HandoffTraceHost).__handoffCapture!.read(target).remainingMs, end);
    await expect.poll(() => page.evaluate(target => (window as HandoffTraceHost).__handoffCapture!.read(target).acknowledged, end),
      { timeout: Math.max(1, remainingMs) }).toBe(true);
    await page.waitForTimeout(HANDOFF_STABILITY_MS);
    expect(await page.evaluate(target => Math.abs(scrollY - target), end), 'one gesture must stop at its intended reading pose').toBeLessThanOrEqual(1);
  } catch (error) {
    failures.push(String(error));
  } finally {
    let diagnosticTimer: ReturnType<typeof setTimeout> | undefined;
    const captured = captureStarted ? await Promise.race([
      page.evaluate(() => (window as HandoffTraceHost).__handoffCapture!.finish()).catch(error => ({ error: String(error) })),
      new Promise<{ error: string }>(resolve => { diagnosticTimer = setTimeout(() => resolve({ error: 'capture retrieval exceeded 1000ms' }), 1000); }),
    ]).finally(() => clearTimeout(diagnosticTimer)) : { error: 'capture did not reach the genuine gesture' };
    try {
      await retainJson(info, `scroll-handoff-native-${browserName}-${width}`, {
        browserName, input: browserName === 'chromium' ? 'single trusted wheel impulse' : 'released ArrowDown',
        geometry, source: 'native browser position trace; no physical-device or FPS claim', capture: captured,
      });
    } catch (error) { failures.push(`trace retention failed: ${String(error)}`); }
    if ('error' in captured) failures.push(captured.error);
    else {
      const trusted = captured.rows.some(row => row.type === 'input-event' && row.trusted && ['wheel', 'keydown'].includes(String(row.eventType)));
      const positions = captured.rows.filter(row => row.type === 'position');
      const helpers = captured.rows.filter(row => row.type === 'helper').map(row => row.helper as HandoffRow);
      const start = helpers.find(row => row.type === 'assist-start');
      const handoff = helpers.find(row => row.type === 'handoff');
      const completed = helpers.find(row => row.type === 'completed');
      const completedIndex = captured.rows.findIndex(row => row.type === 'helper' && (row.helper as HandoffRow).type === 'completed');
      const targetCaptured = Boolean(start && completed && captured.rows.slice(completedIndex + 1).some(row => row.type === 'position'
        && Number(row.at) >= Number(start.handledAt) && Number(row.at) - Number(captured.meta.startedAt) <= HANDOFF_COMPLETION_MS
        && Math.abs(Number(row.y) - Number(geometry?.end)) <= 1));
      const writes = captured.rows.filter(row => row.type === 'scroll-write');
      const options = writes.map(row => (row.args as Array<{ top?: number; behavior?: string }>)[0]);
      const assistWrites = helpers.filter(row => row.type === 'assist-write');
      const writeFrames = assistWrites.map(write => positions.filter(row => Number(row.at) <= Number(write.handledAt)).at(-1));
      const timedWrites = Boolean(start) && assistWrites.length >= 2 && assistWrites.every((write, i) => {
        const rafAt = Number(writeFrames[i]?.rafAt);
        const expected = Math.min(1, Math.max(0, (rafAt - Number((start!.assisting as HandoffRow)?.started)) / Number(start!.duration)));
        return Number.isFinite(rafAt) && Math.abs(Number(write.progress) - expected) < 0.001;
      });
      // SwiftShader can block the main thread longer than the whole trip.
      // In that case verify wall-clock catch-up from the actual RAF stamps;
      // normal frame delivery must still retain intermediate visible poses.
      const frameStarved = writeFrames.some((row, i) => i > 0 &&
        Number(row?.rafAt) - Number(writeFrames[i - 1]?.rafAt) > Number(start?.duration) / 2);
      const observed = positions.filter(row => Number(row.at) >= Number(start?.handledAt));
      const moved = new Set(observed.map(row => row.y)).size >= (frameStarved ? 2 : 3);
      const controlledWrites = timedWrites && options.length >= (frameStarved ? 2 : 3) && options.every(option => option.behavior === 'instant');
      const nativeEnd = captured.rows.find(row => row.type === 'input-event' && row.eventType === 'scrollend'
        && row.trusted && row.documentScroll && Number(row.at) <= Number(start?.handledAt));
      const monotone = observed.every((row, index) => index === 0 || Number(row.y) >= Number(observed[index - 1].y) - 1);
      const gradual = completed && start && Number(completed.duration) >= Number(start.duration);
      if (!trusted || !moved) failures.push('actual trusted input and the available assisted frame positions were not captured');
      if (!start || !helpers.some(row => row.type === 'handoff')) failures.push('actual assist/handoff was not retained');
      const ownedWheel = handoff?.source === 'wheel' && start?.eventType === 'wheel' &&
        start?.owner === 'javascript' && start?.defaultPrevented === true;
      if (!ownedWheel && !nativeEnd) failures.push('native assistance must wait for the native gesture to finish');
      if (!controlledWrites || !gradual) failures.push('the continuation must honor its authored duration through controlled frame positions');
      if (!monotone) failures.push('the visible continuation must not jump backwards');
      if (captured.meta.exhausted || !targetCaptured) failures.push('trace was exhausted or did not retain the acknowledged post-handoff target');
    }
  }
  expect(failures, 'native assistance must retain genuine movement and reach its authored reading pose').toEqual([]);
});
