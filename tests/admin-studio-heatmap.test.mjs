import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".tsx")) {
      for (const extension of [".tsx", ".ts"]) {
        const url = new URL(`${specifier}${extension}`, context.parentURL);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".css"))
      return {
        format: "module",
        source: "export default {};",
        shortCircuit: true,
      };
    if (url.endsWith(".tsx"))
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
        shortCircuit: true,
      };
    return nextLoad(url, context);
  },
});

test("UTC heatmap sums all 24 hourly bins into twelve rows and seven Monday-first columns", async () => {
  const { createStudioHeatmapData } =
    await import("../components/admin/studio/StudioCharts.tsx");
  const columns = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const cells = Array.from({ length: 168 }, (_, index) => ({
    weekdayUtc: Math.floor(index / 24),
    hourUtc: index % 24,
    count: index + 1,
  }));
  const model = createStudioHeatmapData(cells, columns);
  assert.equal(model.rows.length, 12);
  assert.equal(model.rows[0], "00–02 h UTC");
  assert.equal(model.rows.at(-1), "22–24 h UTC");
  assert.deepEqual(model.columns, columns);
  assert.equal(model.data.length, 84);
  assert.deepEqual(model.data[0], {
    row: model.rows[0],
    column: "Mon",
    value: 25 + 26,
  });
  assert.deepEqual(model.data.at(-1), {
    row: model.rows.at(-1),
    column: "Sun",
    value: 23 + 24,
  });
  assert.equal(
    model.data.reduce((sum, cell) => sum + cell.value, 0),
    cells.reduce((sum, cell) => sum + cell.count, 0),
  );
  assert.equal(model.max, 167 + 168);
  const sparse = createStudioHeatmapData(
    [{ weekdayUtc: 0, hourUtc: 23, count: 9 }],
    columns,
  );
  assert.equal(sparse.data.at(-1).value, 9);
  assert.equal(sparse.data[0].value, 0);
});

test("heatmap reads all six theme tokens and follows the actual Studio ancestor until cleanup", async (t) => {
  const { observeStudioHeatmapPalette } =
    await import("../components/admin/studio/StudioCharts.tsx");
  const light = [
    "#e8f7ff",
    "#a5e6f1",
    "#46c5de",
    "#3b82f6",
    "#7556e8",
    "#5b21b6",
  ];
  const dark = [
    "#172032",
    "#23405b",
    "#146b8c",
    "#397dda",
    "#9275f2",
    "#b39bfa",
  ];
  let theme = "light";
  let tokens = light;
  const studio = { getAttribute: () => theme };
  const root = {
    ownerDocument: { documentElement: {} },
    closest: () => studio,
  };
  const observations = [];
  let notify;
  let disconnected = false;
  const previousStyle = globalThis.getComputedStyle;
  const previousObserver = globalThis.MutationObserver;
  t.after(() => {
    globalThis.getComputedStyle = previousStyle;
    globalThis.MutationObserver = previousObserver;
  });
  globalThis.getComputedStyle = () => ({
    getPropertyValue: (name) => tokens[Number(name.at(-1))],
  });
  globalThis.MutationObserver = class {
    constructor(callback) {
      notify = callback;
    }
    observe(target, options) {
      observations.push({ target, options });
    }
    disconnect() {
      disconnected = true;
    }
  };
  const palettes = [];
  const dispose = observeStudioHeatmapPalette(root, (palette) =>
    palettes.push(palette),
  );
  assert.deepEqual(palettes.at(-1), light);
  assert.ok(
    observations.some(
      ({ target, options }) =>
        target === studio && options.attributeFilter.includes("data-theme"),
    ),
  );
  theme = "dark";
  tokens = dark;
  notify();
  assert.deepEqual(palettes.at(-1), dark);
  tokens = ["var(--invalid)", ...dark.slice(1)];
  notify();
  assert.deepEqual(
    palettes.at(-1),
    dark,
    "KindUI receives opaque hex colors even if a token is invalid",
  );
  dispose();
  assert.equal(disconnected, true);
});
