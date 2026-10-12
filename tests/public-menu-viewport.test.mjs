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

test("landing parks its navigation behind the shared accessible tab without locking the scene", async () => {
  const source = await readFile("components/immersive/App.jsx", "utf8");
  assert.match(source, /\[navigationOpen, setNavigationOpen\] = useState\(false\)/);
  assert.match(source, /<PublicNavigationTab[\s\S]*?expanded=\{navigationOpen\}[\s\S]*?buttonRef=\{navigationTabRef\}/);
  assert.match(source, /data-public-navigation-open=\{navigationOpen\}/);
  assert.match(source, /inert=\{!navigationOpen \? true : undefined\}/);
  assert.match(source, /aria-hidden=\{!navigationOpen\}/);
  assert.match(source, /setNavigationOpen\(false\);[\s\S]*?navigationTabRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  const barEffect = source.match(/useEffect\(\(\) => \{\s*if \(!navigationOpen\) return;([\s\S]*?)\}, \[navigationOpen\]\);/)?.[1];
  assert.ok(barEffect, "opening the bar must focus a header control without moving the page");
  assert.match(barEffect, /headerRef\.current[\s\S]*?focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(barEffect, /body\.style\.overflow/);
  assert.match(source, /if \(!navigationOpen \|\| menu \|\| modal\) return;/);
  const menuEffect = source.match(/useEffect\(\(\) => \{\s*if \(!menu\) return;([\s\S]*?)\}, \[menu\]\);/)?.[1];
  assert.ok(menuEffect);
  assert.match(menuEffect, /navigationTabRef\.current/);
  assert.match(menuEffect, /document\.body\.style\.overflow = "hidden"/);
});


test("Escape leaves an open navigation bar intact while a modal owns dismissal", async () => {
  const source = await readFile("components/immersive/App.jsx", "utf8");
  const marker = source.indexOf("    const closeBar = (event) => {");
  const start = source.lastIndexOf("  useEffect(() => {", marker);
  const end = source.indexOf("  useEffect(() => {", marker);
  const effect = source.slice(start, end);
  const listeners = new Map();
  const updates = [];
  let cleanup, dependencies, focus = 0;
  const context = vm.createContext({
    navigationOpen: true, menu: false, modal: { title: "AR" },
    useEffect(run, deps) { dependencies = deps; cleanup = run(); },
    setNavigationOpen(value) { updates.push(value); },
    navigationTabRef: { current: { focus() { focus++; } } },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { assert.equal(listeners.get(name), callback); listeners.delete(name); },
  });
  vm.runInContext(effect, context);
  assert.equal(listeners.size, 0, "the modal's existing Escape handler must be the sole dismissal owner");
  assert.ok(dependencies.includes(context.modal), "React must suspend bar dismissal whenever a modal opens");
  assert.deepEqual(updates, []);
  assert.equal(focus, 0);
  context.modal = null;
  vm.runInContext(effect, context);
  let prevented = false;
  listeners.get("keydown")({ key: "Escape", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(updates, [false], "bar dismissal resumes once the modal is closed");
  assert.equal(focus, 1);
  cleanup();
  assert.equal(listeners.size, 0);
});
