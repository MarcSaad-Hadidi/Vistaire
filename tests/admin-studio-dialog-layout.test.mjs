import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("both native Studio dialogs explicitly restore viewport centering after preflight reset", async () => {
  for (const file of ["Studio.module.css", "StudioCharts.module.css"]) {
    const css = await readFile(`components/admin/studio/${file}`, "utf8");
    const rule = css.match(/\.dialog\s*\{([^}]+)\}/)?.[1] ?? "";
    for (const required of [
      /position:\s*fixed/,
      /inset:\s*0/,
      /margin:\s*auto/,
      /overflow:\s*auto/,
      /max-height:/,
    ])
      assert.match(rule, required, `${file}: ${required}`);
  }
});

test("command modal is centered on both axes and chart serif resolves to the approved local font", async () => {
  const command = await readFile(
    "components/admin/studio/StudioCommandPalette.module.css",
    "utf8",
  );
  assert.match(command, /top:\s*50%/);
  assert.match(command, /translate\(-50%,\s*-50%\)/);
  const css = await readFile(
    "components/admin/studio/Studio.module.css",
    "utf8",
  );
  assert.match(css, /--serif:\s*"Suave", Georgia, serif/);
  assert.match(css, /btsuave-regular\.otf/);
});

test("outer dialogs ignore cancellation from a nested chart dialog", async () => {
  const source = await readFile("components/admin/studio/StudioDialog.tsx", "utf8");
  assert.match(source, /onCancel=\{\(event\) => \{\s*if \(event\.target !== event\.currentTarget\) return;/);
});
