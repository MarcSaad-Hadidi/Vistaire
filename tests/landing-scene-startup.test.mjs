import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("components/immersive/deferredScene.js", "utf8")
  .replace(/import[^;]+from "react";/, "")
  .replaceAll("export ", "");

test("the scene starts on the first idle after load without visitor input and cancels on unmount", () => {
  for (const readyState of ["loading", "complete"]) {
    const listeners = new Map();
    const idle = new Map();
    const timers = new Map();
    let nextId = 0, fetched = 0, started = false, cleanup;
    const scope = vm.createContext({
      document: { readyState }, scrollY: 0,
      useState: () => [false, value => { started = value; }],
      useEffect: effect => { cleanup = effect(); },
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: name => listeners.delete(name),
      requestIdleCallback: callback => { idle.set(++nextId, callback); return nextId; },
      cancelIdleCallback: id => idle.delete(id),
      setTimeout: (callback, delay) => { timers.set(++nextId, { callback, delay }); return nextId; },
      clearTimeout: id => timers.delete(id),
      prefetch: () => { fetched++; },
    });
    vm.runInContext(source + "\nuseDeferredScene(prefetch);", scope);
    if (readyState === "loading") {
      assert.equal(fetched, 0, "the poster keeps network priority until load");
      listeners.get("load")();
    }
    assert.equal(fetched, 1);
    assert.equal(idle.size, 1, "scene setup is queued at idle immediately after load");
    assert.equal(timers.size, 0, "no six-second delay before preparing the scene");
    assert.equal(started, false);
    const start = [...idle.values()][0];
    start();
    assert.equal(started, true, "no pointer, wheel or key is needed");
    cleanup();
    assert.equal(listeners.size, 0);
    assert.equal(idle.size, 0);

    started = false;
    vm.runInContext("useDeferredScene(prefetch);", scope);
    if (readyState === "loading") listeners.get("load")();
    cleanup();
    assert.equal(idle.size, 0, "unmount cancels queued scene work");
    assert.equal(listeners.size, 0);
    assert.equal(started, false);
  }
});
