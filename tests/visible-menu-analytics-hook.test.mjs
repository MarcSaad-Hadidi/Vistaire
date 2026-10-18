import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("menu dwell excludes ancestor-hidden time outside the observed reading root", () => {
  let now = 0, hidden = false;
  const effects = [], emitted = [], intersections = [], mutations = [];
  const timers = new Set();
  class Element extends EventTarget {
    parentElement = null;
    closest(selector) { return selector.includes("aria-hidden") && hidden ? this.parentElement : null; }
    querySelectorAll() { return []; }
    contains(element) { return element === this; }
  }
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; intersections.push(this); }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  class MutationObserver {
    targets = new Set();
    constructor(callback) { this.callback = callback; mutations.push(this); }
    observe(target) { this.targets.add(target); }
    disconnect() { this.targets.clear(); }
  }
  const hookModule = { exports: {} };
  const window = Object.assign(new EventTarget(), {
    setInterval: callback => (timers.add(callback), callback),
    clearInterval: callback => timers.delete(callback),
  });
  const runtime = {
    module: hookModule, exports: hookModule.exports,
    require(name) {
      if (name === "react") return {
        useRef: value => ({ current: value }), useEffect: effect => effects.push(effect),
      };
      if (name === "@/lib/analytics/client") return {
        trackPublicMenuEvent: (_menu, event) => emitted.push(event),
        trackPublicMenuSessionStarted() {},
      };
      throw new Error(`Unexpected hook dependency: ${name}`);
    },
    document: Object.assign(new EventTarget(), { visibilityState: "visible", hasFocus: () => true }),
    window, IntersectionObserver, MutationObserver, performance: { now: () => now },
  };
  const source = readFileSync(new URL("../components/menu/analytics/useVisibleMenuAnalytics.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, runtime);
  const dish = { slug: "soup", categorySlug: "main" };
  const ref = hookModule.exports.useVisibleMenuAnalytics({
    source: "supabase", restaurantId: "restaurant", menuId: "menu", dishes: [dish],
  }, true, dish);
  const parent = new Element();
  ref.current = new Element();
  ref.current.parentElement = parent;
  const cleanup = effects.map(effect => effect()).filter(Boolean);
  intersections.at(-1).callback([{ target: ref.current, isIntersecting: true, intersectionRatio: 1 }]);
  now = 5000;
  hidden = true;
  for (const observer of mutations) if (observer.targets.has(parent)) observer.callback();
  now = 30000;
  for (const callback of timers) callback();
  for (const name of ["session_duration", "dish_dwell"]) {
    assert.equal(emitted.filter(event => event.eventName === name)
      .reduce((sum, event) => sum + event.metadata.durationMs, 0), 5000, name);
  }
  for (const callback of cleanup) callback();
  assert.equal(timers.size, 0);
  assert.ok(mutations.every(observer => observer.targets.size === 0));
});
