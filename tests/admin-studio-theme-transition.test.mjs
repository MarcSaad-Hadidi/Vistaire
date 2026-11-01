import test from "node:test";
import assert from "node:assert/strict";
import { createStudioThemeTransition } from "../components/admin/studio/studioThemeTransition.ts";
function fixture(startViewTransition) {
  const root = { dataset: {} };
  let theme = "light";
  const changes = [];
  const controller = createStudioThemeTransition({
    document: { documentElement: root, startViewTransition },
    getTheme: () => theme,
    setTheme: (value) => {
      theme = value;
      changes.push(value);
    },
  });
  return { root, controller, changes, theme: () => theme };
}
test("approved circle reveal commits once and rejects repeated activation until finished", async () => {
  let finish;
  const f = fixture((update) => {
    update();
    return {
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      finished: new Promise((resolve) => {
        finish = resolve;
      }),
    };
  });
  assert.equal(f.controller.toggle(false), true);
  assert.equal(f.controller.toggle(false), false);
  assert.equal(f.root.dataset.studioThemeTransition, "circle");
  assert.deepEqual(f.changes, ["dark"]);
  finish();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.root.dataset.studioThemeTransition, undefined);
  assert.equal(f.controller.pending, false);
});
test("reduced motion, unsupported transitions and failed snapshots still switch theme", async () => {
  const noApi = fixture();
  noApi.controller.toggle(false);
  assert.equal(noApi.theme(), "dark");
  const reduced = fixture(() => {
    throw new Error("must not capture");
  });
  reduced.controller.toggle(true);
  assert.equal(reduced.theme(), "dark");
  const failed = fixture(() => {
    throw new Error("snapshot unavailable");
  });
  failed.controller.toggle(false);
  assert.equal(failed.theme(), "dark");
  assert.equal(failed.controller.pending, false);
});
test("disposing before the browser callback commits once and restores the transition scope", async () => {
  let update;
  let finish;
  const f = fixture((callback) => {
    update = callback;
    return {
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      finished: new Promise((resolve) => {
        finish = resolve;
      }),
      skipTransition() {},
    };
  });
  f.controller.toggle(false);
  f.controller.dispose();
  update();
  finish();
  await Promise.resolve();
  assert.deepEqual(f.changes, ["dark"]);
  assert.equal(f.root.dataset.studioThemeTransition, undefined);
  assert.equal(f.controller.toggle(false), false);
});
