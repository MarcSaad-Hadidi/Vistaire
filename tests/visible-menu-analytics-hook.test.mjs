import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function mountAnalytics(analyticsAllowed = true) {
  let now = 0, hidden = false, refIndex = 0, pendingEffect, cleanup, dependencies;
  const refs = [], emitted = [], intersections = [], mutations = [];
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
        useRef: value => refs[refIndex++] ?? (refs[refIndex - 1] = { current: value }),
        useEffect(effect, nextDependencies) {
          if (!dependencies || nextDependencies.some((value, index) => value !== dependencies[index])) pendingEffect = effect;
          dependencies = nextDependencies;
        },
      };
      if (name === "@/components/privacy/PrivacyConsentProvider") return {
        usePrivacyConsent: () => ({ analyticsAllowed }),
      };
      if (name === "@/lib/analytics/client") return {
        trackPublicMenuEvent: (_menu, event) => { if (analyticsAllowed) emitted.push(event); },
        registerPublicMenuVisibility() { return () => {}; },
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
  const menu = {
    source: "supabase", restaurantId: "restaurant", menuId: "menu", dishes: [dish],
  };
  const parent = new Element();
  const root = new Element();
  root.parentElement = parent;
  const render = (allowed) => {
    analyticsAllowed = allowed;
    refIndex = 0;
    const ref = hookModule.exports.useVisibleMenuAnalytics(menu, true, dish);
    ref.current = root;
    if (pendingEffect) {
      cleanup?.();
      cleanup = pendingEffect();
      pendingEffect = undefined;
      intersections.at(-1)?.callback([{ target: root, isIntersecting: true, intersectionRatio: 1 }]);
    }
  };
  render(analyticsAllowed);
  return {
    emitted, timers, mutations,
    at: value => { now = value; },
    consent: render,
    hide() {
      hidden = true;
      for (const observer of mutations) if (observer.targets.has(parent)) observer.callback();
    },
    flush: () => { for (const callback of timers) callback(); },
    cleanup: () => cleanup?.(),
  };
}

test("menu dwell excludes ancestor-hidden time outside the observed reading root", () => {
  const hook = mountAnalytics();
  hook.at(5000);
  hook.hide();
  hook.at(30000);
  hook.flush();
  for (const name of ["session_duration", "dish_dwell"]) {
    assert.equal(hook.emitted.filter(event => event.eventName === name)
      .reduce((sum, event) => sum + event.metadata.durationMs, 0), 5000, name);
  }
  hook.cleanup();
  assert.equal(hook.timers.size, 0);
  assert.ok(hook.mutations.every(observer => observer.targets.size === 0));
});

test("menu dwell starts at consent and never includes time before a later grant", () => {
  const hook = mountAnalytics(false);
  hook.at(20000);
  assert.deepEqual(hook.emitted, []);
  hook.consent(true);
  hook.at(21000);
  hook.flush();
  hook.at(22000);
  hook.consent(false);
  hook.at(42000);
  hook.consent(true);
  hook.at(43000);
  hook.flush();
  for (const name of ["session_duration", "dish_dwell"]) {
    assert.deepEqual(hook.emitted.filter(event => event.eventName === name)
      .map(event => event.metadata.durationMs), [1000, 1000], name);
  }
  hook.cleanup();
});
