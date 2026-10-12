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
const profiles = [
  { label: '390-fr', width: 390, height: 844, path: '/' },
  { label: '430-en', width: 430, height: 932, path: '/en' },
  { label: 'desktop-fr', width: 1440, height: 900, path: '/' },
] as const;

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
  await page.screenshot({ path });
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
  test(`${profile.label}: projected offers and closing sections retain dark/light readability`, async ({ page }, info) => {
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
    await expect.poll(() => phone.locator('img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);

    for (const theme of ['dark', 'light'] as const) {
      await scrollPage(page, layout.top + 1);
      await handReady(page);
      if (theme === 'light') {
        const before = await backdrop(page);
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
      await assertOnPhotoContrast(page, '.pricing-aside-layer');
      await assertNoOverflow(page);
      await screenshot(page, info, `${profile.label}-${theme}-offers`);
      await scrollPage(page, layout.top + layout.height + 2);
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
    await info.attach('cache-evidence', { body: JSON.stringify({ initial, final: await backdrop(page), errors }, null, 2), contentType: 'application/json' });
    expect(errors).toEqual([]);
  });
}

test('keyboard reads every offer, yields to the FAQ and wakes the original scene on reverse', async ({ page }, info) => {
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
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeLessThan(1);
  await page.keyboard.press('PageDown');
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  const before = await backdrop(page);
  const offset = await viewport.evaluate(el => el.scrollTop);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(offset);
  // Explicit 250ms settled observation, not a hardware FPS benchmark.
  await page.waitForTimeout(250);
  expect((await backdrop(page)).frames).toBe(before.frames);
  await page.keyboard.press('End');
  await expect.poll(() => viewport.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThanOrEqual(1);
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
  await page.locator('.desktop-nav').getByRole('button', { name: 'Tarifs', exact: true }).click();
  await handReady(page);
  const navigation = await backdrop(page);
  expect(navigation.pose).toBe(normal.pose);
  expect(navigation.generation).toBeGreaterThan(normal.generation);
  await info.attach('entry-path-cache-comparison', { body: JSON.stringify({ direct, normal, navigation }, null, 2), contentType: 'application/json' });
});

test('portrait to landscape remeasures the actual hand and returns to a usable portrait', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openScene(page);
  await enterOffers(page);
  for (const viewport of [{ width: 844, height: 390 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual(viewport);
    await expect.poll(() => page.locator('.pricing-hand-visual').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight })), { timeout: 15_000 }).toEqual(viewport);
    await enterOffers(page);
    await assertProjection(page);
    const cache = await backdrop(page);
    expect(cache.width).toBe(cache.bufferWidth);
    expect(cache.height).toBe(cache.bufferHeight);
    for (const link of await page.locator('.pricing-aside-links a').all()) await expect(link).toBeInViewport();
    await assertNoOverflow(page);
    await screenshot(page, info, `orientation-${viewport.width}x${viewport.height}`);
  }
});

test('an unavailable hand keeps all offers and keyboard access in the semantic fallback', async ({ page }, info) => {
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
    await expect.poll(()=>page.locator('.pricing-phone-viewport').evaluate(el=>el.scrollTop)).toBeLessThanOrEqual(1);
    await page.evaluate(()=>{location.hash='hero';});
    await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-backdrop','released');
    await page.goBack();
    await handReady(page);
    await page.setViewportSize({width:profile.width===390?430:1337,height:profile.height});
    await scrollPage(page,0);
    await expect(page.locator('.scene-canvas')).toHaveAttribute('data-pricing-backdrop','released');
    if(profile.width===390){
      await page.locator('.site-header .menu-toggle').click();
      await page.locator('#mobile-menu').getByRole('button',{name:`04 ${profile.label}`,exact:true}).click();
    }else await page.locator('.desktop-nav').getByRole('button',{name:profile.label,exact:true}).click();
    await handReady(page);
    await expect.poll(()=>page.locator('.pricing-phone-viewport').evaluate(el=>el.scrollTop)).toBeLessThanOrEqual(1);
    await assertProjection(page);
    await screenshot(page,info,`pricing-navigation-${profile.width}`);
  });
}

test('the laptop uses the current dashboard capture in the selected site theme',async({page},info)=>{
  test.setTimeout(210_000);
  await page.addInitScript(()=>localStorage.setItem('vistaire-public-theme','light'));
  await page.setViewportSize({width:1440,height:900});
  await openScene(page);
  await page.locator('#sustainability').evaluate(el=>scrollTo({top:el.getBoundingClientRect().top+scrollY+innerHeight*.5,behavior:'instant'}));
  const canvas=page.locator('.scene-canvas');
  await expect(canvas).toHaveAttribute('data-laptop-ready','true',{timeout:ASSET_READY_MS});
  await expect(canvas).toHaveAttribute('data-laptop-dashboard-theme','light');
  await screenshot(page,info,'current-dashboard-laptop-light');
  await page.locator('.site-header [data-public-theme-toggle]').click();
  await expect(canvas).toHaveAttribute('data-laptop-dashboard-theme','dark');
  await screenshot(page,info,'current-dashboard-laptop-dark');
});


for (const width of [390,1440]) test(`native entry assistance is bounded, interruptible and reduced-motion safe at ${width}px`,async({page},info)=>{
  test.setTimeout(240_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.setViewportSize({width,height:844});
  await openScene(page,'/','','no-preference');
  const end=await page.locator('.opening-journey').evaluate((el,leg)=>el.getBoundingClientRect().top+scrollY+parseFloat(getComputedStyle(el.firstElementChild!).height)*leg,CINEMATIC_TIMING.transitionScreens);
  await page.mouse.move(width*.85,600);
  await scrollPage(page,end-80);
  await page.mouse.wheel(0,40);
  await expect.poll(()=>page.evaluate(target=>Math.abs(scrollY-target),end),{timeout:15_000}).toBeLessThanOrEqual(1);
  await page.waitForTimeout(350);
  expect(await page.evaluate(target=>Math.abs(scrollY-target),end)).toBeLessThanOrEqual(1);
  await scrollPage(page,80);
  await page.mouse.wheel(0,-40);
  await expect.poll(()=>page.evaluate(()=>scrollY),{timeout:15_000}).toBeLessThanOrEqual(1);
  await scrollPage(page,end-80);
  await page.mouse.wheel(0,40);
  await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(end-75);
  await page.waitForTimeout(350);
  expect(await page.evaluate(()=>scrollY)).toBeLessThan(end-10);
  await page.emulateMedia({reducedMotion:'reduce'});
  await scrollPage(page,end-80);
  await page.mouse.wheel(0,40);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(end-75);
  await page.waitForTimeout(350);
  expect(await page.evaluate(()=>scrollY)).toBeLessThan(end-10);
  // Retain real room/foreground pixels and reject shader errors. These views
  // are review evidence, not a claim that different camera poses match pixels.
  await page.locator('#product').evaluate(el=>{
    const stage=el.firstElementChild!;
    scrollTo({top:el.getBoundingClientRect().top+scrollY+(el.getBoundingClientRect().height-stage.getBoundingClientRect().height)*.5,behavior:'instant'});
  });
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-section','product');
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-settled','true',{timeout:15_000});
  await screenshot(page,info,`linear-fog-live-room-${width}`);
  await enterOffers(page);
  await screenshot(page,info,`preserved-offers-room-${width}`);
  expect(errors).toEqual([]);
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
    await screenshot(page, info, `steady-subject-${from}-${to}-${width}`);
  }
  } finally {
    await info.attach('visible-subject-transition-poses', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  }
});
