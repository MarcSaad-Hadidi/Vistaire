import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createModelTelemetry } from "../components/dish/modelTelemetry.ts";

test("model hook preserves visible deltas across ancestor hiding and node removal", () => {
  let now = 0;
  let hidden = false;
  const emitted = [], effects = [], intersections = [], mutations = [];
  const timers = new Set();
  class Element extends EventTarget {
    parentElement = null;
    closest() { return hidden ? this : null; }
    getBoundingClientRect() { return { top: 0, bottom: 100 }; }
  }
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; intersections.push(this); }
    observe() {}
    disconnect() {}
  }
  class MutationObserver {
    targets = new Set();
    constructor(callback) { this.callback = callback; mutations.push(this); }
    observe(target) { this.targets.add(target); }
    disconnect() { this.targets.clear(); }
  }
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible", hasFocus: () => true,
  });
  const hookModule = { exports: {} };
  const source = readFileSync(new URL("../components/dish/useModelTelemetry.ts", import.meta.url), "utf8");
  const runtime = {
    module: hookModule, exports: hookModule.exports,
    require(name) {
      if (name === "react") return {
        useRef: value => ({ current: value }),
        useCallback: callback => callback,
        useEffect: effect => effects.push(effect),
      };
      if (name === "@/lib/analytics/client") return { trackMenuEvent: event => emitted.push(event) };
      if (name === "./modelTelemetry") return { createModelTelemetry };
      throw new Error(`Unexpected hook dependency: ${name}`);
    },
    document, window: new EventTarget(), IntersectionObserver, MutationObserver,
    performance: { now: () => now },
    crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
    setInterval: callback => (timers.add(callback), callback),
    clearInterval: callback => timers.delete(callback),
    setTimeout: () => 0, clearTimeout() {}, innerHeight: 800,
  };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, runtime);
  const hook = hookModule.exports.useModelTelemetry({
    context: {}, dishSlug: "dish", categorySlug: "main", attempt: 0,
    modelSource: "/model.glb", hasModel: true, loaded: true, failure: null,
  });
  const parent = new Element();
  const element = new Element();
  element.parentElement = parent;
  hook.bindNode(element);
  const cleanup = effects.map(effect => effect()).filter(Boolean);
  intersections.at(-1).callback([{ isIntersecting: true, intersectionRatio: 1 }]);
  now = 5000;
  hidden = true;
  for (const observer of mutations) if (observer.targets.has(parent)) observer.callback();
  now = 30000;
  for (const callback of timers) callback();
  const duration = () => emitted.filter(event => event.eventName === "model_active_duration")
    .reduce((sum, event) => sum + event.metadata.durationMs, 0);
  assert.equal(duration(), 5000, "valid visible time survives a flush while hidden");
  now = 60000;
  hook.bindNode(null);
  for (const callback of cleanup) callback();
  assert.equal(duration(), 5000, "hidden/disconnected time adds no dwell");
  assert.equal(timers.size, 0, "node disposal removes periodic flushes");
});
