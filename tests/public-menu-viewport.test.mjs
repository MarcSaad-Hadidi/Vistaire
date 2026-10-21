import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { bindPublicMenuViewport } from "../lib/publicMenuViewport.ts";

function fixture(previous = "") {
  const properties = new Map(previous ? [["--vistaire-menu-top", previous]] : []);
  const writes = [];
  const events = new Map();
  const viewportEvents = new Map();
  let resizeHeader;
  let observed;
  let disconnected = false;
  let bottom = 79.4;
  const header = { getBoundingClientRect: () => ({ bottom }) };
  const panel = { style: {
    getPropertyValue: (key) => properties.get(key) ?? "",
    getPropertyPriority: () => "",
    setProperty(key, value) { properties.set(key, value); writes.push(value); },
    removeProperty(key) { properties.delete(key); },
  } };
  const view = {
    ResizeObserver: class {
      constructor(callback) { resizeHeader = callback; }
      observe(element) { observed = element; }
      disconnect() { disconnected = true; }
    },
    addEventListener: (event, listener) => events.set(event, listener),
    removeEventListener(event, listener) { assert.equal(events.get(event), listener); events.delete(event); },
    visualViewport: {
      addEventListener: (event, listener) => viewportEvents.set(event, listener),
      removeEventListener(event, listener) { assert.equal(viewportEvents.get(event), listener); viewportEvents.delete(event); },
    },
  };
  return {
    header, panel, view, properties, writes, events, viewportEvents,
    setBottom(value) { bottom = value; },
    resizeHeader() { resizeHeader(); },
    observed: () => observed,
    disconnected: () => disconnected,
  };
}

test("public drawer follows the measured header through resize without redundant writes", () => {
  const f = fixture();
  const cleanup = bindPublicMenuViewport(f.header, f.panel, f.view);
  assert.equal(f.observed(), f.header);
  assert.equal(f.properties.get("--vistaire-menu-top"), "88px");
  f.resizeHeader();
  assert.deepEqual(f.writes, ["88px"]);
  f.setBottom(94);
  f.resizeHeader();
  assert.equal(f.properties.get("--vistaire-menu-top"), "102px");
  f.setBottom(66);
  f.events.get("resize")();
  assert.equal(f.properties.get("--vistaire-menu-top"), "74px");
  f.setBottom(120);
  f.viewportEvents.get("resize")();
  assert.equal(f.properties.get("--vistaire-menu-top"), "128px");
  cleanup();
  assert.equal(f.disconnected(), true);
  assert.equal(f.events.size, 0);
  assert.equal(f.viewportEvents.size, 0);
  assert.equal(f.properties.has("--vistaire-menu-top"), false);
});

test("drawer measurement restores an existing property and supports no visual viewport", () => {
  const f = fixture("96px");
  f.view.visualViewport = null;
  const cleanup = bindPublicMenuViewport(f.header, f.panel, f.view);
  assert.equal(f.properties.get("--vistaire-menu-top"), "88px");
  cleanup();
  assert.equal(f.properties.get("--vistaire-menu-top"), "96px");
  assert.equal(f.events.size, 0);
});

test("landing binds the shared drawer viewport only while open and cleans it up", async () => {
  const source = await readFile("components/immersive/App.jsx", "utf8");
  assert.match(source, /import\s*\{\s*bindPublicMenuViewport\s*\}\s*from\s*["']@\/lib\/publicMenuViewport["']/);
  const effect = source.match(/useEffect\(\(\) => \{\s*if \(!menu\) return;([\s\S]*?)\}, \[menu\]\);/)?.[1];
  assert.ok(effect, "the measurement must remain scoped to the existing menu-open effect");
  assert.match(effect, /const unbindViewport = bindPublicMenuViewport\(headerRef\.current, menuRef\.current\)/);
  assert.match(effect, /return \(\) => \{\s*unbindViewport\(\);/);
});

test("navbar is always visible and has no launcher or collapse handler", async () => {
  const source = await readFile("components/immersive/App.jsx", "utf8");
  assert.doesNotMatch(source, /PublicNavigationTab|navigationOpen|navigationTabRef|closeBar/);
  assert.match(source, /data-public-navigation-open="true"/);
  assert.doesNotMatch(source, /aria-hidden=\{!navigationOpen\}/);
  const css = readFileSync('components/vistaire-preview/VistairePreviewChrome.module.css', 'utf8');
  assert.doesNotMatch(css, /navigationTab|clip-path|data-public-navigation-ready/);
});

test("drawer focuses after rendering, respects newer focus, and cancels pending callbacks", async () => {
  for (const path of ['components/immersive/App.jsx']) {
    const source = await readFile(path, 'utf8');
    const focusBody = source.match(/const focusFrame = (?:window\.)?requestAnimationFrame\(\(\) => \{([\s\S]*?)\n    \}\);/)?.[1];
    assert.ok(focusBody, `${path}: focus must wait for the opening render`);
    assert.match(source, /cancelAnimationFrame\(focusFrame\)/);
    for (const scenario of ['visible', 'hidden', 'moved', 'closed']) {
      const previous = {};
      let focused = 0;
      const first = { focus: () => focused++ };
      const drawer = { inert: scenario === 'closed', querySelector: () => first };
      const context = { previous, menuRef: { current: drawer }, panel: { current: drawer },
        document: { activeElement: scenario === 'moved' ? {} : previous },
        getComputedStyle: () => ({ visibility: scenario === 'hidden' ? 'hidden' : 'visible' }) };
      vm.runInNewContext(focusBody.replace(/<HTMLElement>/g, '').replace(/current!/g, 'current'), context);
      assert.equal(focused, scenario === 'visible' ? 1 : 0, `${path}: ${scenario}`);
    }
  }
});


test("public drawer waits across the render boundary and cancels stale focus", async () => {
  const source = await readFile('components/vistaire-preview/PublicNavigation.tsx', 'utf8');
  const start = source.search(/(?:const|let) focusFrame = requestAnimationFrame/);
  const end = source.indexOf('    const dismiss =', start);
  assert.ok(start > 0 && end > start);
  const block = source.slice(start, end).replace(/<HTMLElement>/g, '').replace(/current!/g, 'current');
  for (const scenario of ['delayed', 'close-before-first', 'close-between', 'new-focus', 'closed-drawer', 'disconnected', 'still-hidden', 'missing-target', 'reduced']) {
    const frames = new Map();
    let nextId = 0, focused = 0, visibility = scenario === 'reduced' ? 'visible' : 'hidden';
    const previous = {};
    const first = { isConnected: true, focus: () => focused++ };
    const drawer = { inert: false, querySelector: () => first };
    const context = vm.createContext({ panel: { current: drawer }, previous, document: { activeElement: previous },
      requestAnimationFrame: (fn) => { const id = ++nextId; frames.set(id, fn); return id; },
      cancelAnimationFrame: (id) => frames.delete(id), getComputedStyle: () => ({ visibility }) });
    vm.runInContext(block, context);
    const frame = () => { const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(); };
    const close = () => { drawer.inert = true; vm.runInContext('cancelAnimationFrame(focusFrame)', context); };
    if (scenario === 'close-before-first') close();
    frame(); // The original single-RAF code observes the still-hidden child here.
    assert.equal(focused, 0, 'never transfer focus in the pre-paint frame');
    if (scenario === 'close-between') close();
    if (scenario === 'new-focus') context.document.activeElement = {};
    if (scenario === 'closed-drawer') drawer.inert = true;
    if (scenario === 'disconnected') first.isConnected = false;
    if (scenario === 'missing-target') drawer.querySelector = () => null;
    visibility = scenario === 'still-hidden' ? 'hidden' : 'visible';
    frame(); // A rendered opportunity has elapsed; no animation-duration timeout.
    assert.equal(focused, ['delayed', 'reduced'].includes(scenario) ? 1 : 0, scenario);
    assert.equal(frames.size, 0, 'no idle focus polling');
  }
});
